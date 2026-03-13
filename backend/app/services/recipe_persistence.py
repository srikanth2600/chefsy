from typing import Any, Dict, List, Optional
import logging

from psycopg.types.json import Json

from app.core.db import get_connection
from app.domain.ingredient import normalize_ingredient_alias_key, normalize_ingredient_name
from app.services.image_generator import generate_ingredient_image

logger = logging.getLogger(__name__)


def save_generated_recipe(recipe_key: str, generated: Dict[str, Any], title: str, servings: int) -> int:
    """
    Persist generated recipe and its ingredients. Returns recipe_id.
    This function opens its own DB connection and commits the transaction.
    """
    ingredients_raw = generated.get("ingredients") or []
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO recipe_master (recipe_key, title, steps_json, servings, recipe_json)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (recipe_key) DO UPDATE
                      SET title = EXCLUDED.title,
                          steps_json = COALESCE(recipe_master.steps_json, EXCLUDED.steps_json),
                          servings = EXCLUDED.servings,
                          recipe_json = COALESCE(recipe_master.recipe_json, EXCLUDED.recipe_json),
                          updated_at = NOW()
                    RETURNING id
                    """,
                    # Ensure JSON/JSONB parameters are passed as proper JSON values.
                    # Wrap steps and the full recipe in the Json adapter to avoid passing
                    # Python-native types (e.g., set or repr strings) that would produce
                    # invalid JSON in the database driver.
                    (recipe_key, title, Json(generated.get("steps") or []), servings, Json(generated)),
                )
                row = cur.fetchone()
                if not row:
                    raise RuntimeError("Failed to insert or retrieve recipe_master id")
                recipe_id = row["id"]
                conn.commit()

            # Insert ingredients and maps in their own cursor scope
            with conn.cursor() as cur:
                for item in ingredients_raw:
                    if not isinstance(item, dict):
                        continue
                    raw_name = str(item.get("name") or "")
                    alias_key = normalize_ingredient_alias_key(raw_name)
                    if not alias_key or alias_key == "ingredient":
                        continue

                    # lookup alias
                    cur.execute(
                        "SELECT canonical_name FROM ingredient_alias WHERE alias = %s",
                        (alias_key,),
                    )
                    alias_row = cur.fetchone()
                    name = alias_row["canonical_name"] if alias_row else None
                    if not name:
                        name = normalize_ingredient_name(raw_name)
                        if not name or name == "ingredient":
                            continue
                        # insert alias entries (ignore conflicts)
                        try:
                            cur.execute(
                                "INSERT INTO ingredient_alias (alias, canonical_name) VALUES (%s, %s) ON CONFLICT (alias) DO NOTHING",
                                (alias_key, name),
                            )
                        except Exception:
                            # fallback insert without ON CONFLICT if DB lacks constraint
                            try:
                                cur.execute("INSERT INTO ingredient_alias (alias, canonical_name) VALUES (%s, %s)", (alias_key, name))
                            except Exception:
                                pass
                        if alias_key != name:
                            try:
                                cur.execute(
                                    "INSERT INTO ingredient_alias (alias, canonical_name) VALUES (%s, %s) ON CONFLICT (alias) DO NOTHING",
                                    (name, name),
                                )
                            except Exception:
                                pass

                    # upsert ingredient_master
                    cur.execute("SELECT id, image_path, nutrition_json FROM ingredient_master WHERE name = %s", (name,))
                    existing = cur.fetchone()
                    image_path = existing["image_path"] if existing else ""
                    nutrition_json = existing["nutrition_json"] if existing else None

                    if not image_path:
                        try:
                            image_path = generate_ingredient_image(name)
                        except Exception:
                            logger.exception("Image generation failed for ingredient %s", name)
                            image_path = ""

                    if existing:
                        cur.execute(
                            "UPDATE ingredient_master SET image_path = %s, nutrition_json = COALESCE(nutrition_json, %s::jsonb), updated_at = NOW() WHERE id = %s",
                            (image_path, Json(nutrition_json or {}), existing["id"]),
                        )
                        ingredient_id = existing["id"]
                    else:
                        cur.execute(
                            "INSERT INTO ingredient_master (name, image_path, nutrition_json) VALUES (%s, %s, %s) RETURNING id",
                            (name, image_path, Json({})),
                        )
                        ingredient_id = cur.fetchone()["id"]

                    # insert mapping (avoid duplicates)
                    cur.execute(
                        "SELECT 1 FROM recipe_ingredient_map WHERE recipe_id = %s AND ingredient_id = %s",
                        (recipe_id, ingredient_id),
                    )
                    if not cur.fetchone():
                        cur.execute(
                            "INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id, quantity, unit) VALUES (%s, %s, %s, %s)",
                            (
                                recipe_id,
                                ingredient_id,
                                str(item.get("quantity") or ""),
                                str(item.get("unit") or ""),
                            ),
                        )
                conn.commit()

        return recipe_id
    except Exception as exc:
        logger.exception("recipe_persistence.save_generated_recipe failed: %s", exc)
        raise


def update_recipe_image(recipe_id: int, image_path: str) -> None:
    """Update recipe_master.image_path for given recipe_id."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE recipe_master SET image_path = %s, updated_at = NOW() WHERE id = %s", (image_path, recipe_id))
                conn.commit()
    except Exception:
        logger.exception("Failed to update recipe image for id=%s", recipe_id)


def get_recipe_by_id(recipe_id: int) -> Optional[Dict[str, Any]]:
    """Return recipe_master row as dict or None."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, steps_json, servings, image_path, recipe_json FROM recipe_master WHERE id = %s",
                    (recipe_id,),
                )
                row = cur.fetchone()
                return row if row else None
    except Exception:
        logger.exception("Failed to fetch recipe_master id=%s", recipe_id)
        return None

