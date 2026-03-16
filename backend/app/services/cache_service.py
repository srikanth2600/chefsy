from typing import Any, Dict, Optional
import logging

from app.core.db import get_connection

logger = logging.getLogger(__name__)


def get_cached_recipe(recipe_key: str, user_id: int | None, title_hint: str | None = None) -> Optional[Dict[str, Any]]:
    """
    Insert search log and return cached recipe dict (matching previous routes logic),
    or None if not found.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # log the search
                try:
                    cur.execute(
                        "INSERT INTO recipe_search_log (recipe_key, user_id) VALUES (%s, %s)",
                        (recipe_key, user_id),
                    )
                except Exception:
                    # non-fatal
                    logger.exception("Failed to insert recipe_search_log for %s", recipe_key)

                cur.execute(
                    """
                    SELECT id, title, steps_json, servings, image_path, recipe_json
                    FROM recipe_master
                    WHERE recipe_key = %s
                    """,
                    (recipe_key,),
                )
                row = cur.fetchone()
                if not row and title_hint:
                    # Fallback: try to find by title (case-insensitive partial match)
                    try:
                        cur.execute(
                            """
                            SELECT id, title, steps_json, servings, image_path, recipe_json
                            FROM recipe_master
                            WHERE LOWER(title) LIKE LOWER(%s)
                            LIMIT 1
                            """,
                            (f"%{title_hint}%",),
                        )
                        row = cur.fetchone()
                    except Exception:
                        row = None
                if not row:
                    return None

                recipe_id = row["id"]
                # fetch ingredients
                cur.execute(
                    """
                    SELECT im.name, rim.quantity, rim.unit, im.image_path, im.nutrition_json
                    FROM recipe_ingredient_map rim
                    JOIN ingredient_master im ON im.id = rim.ingredient_id
                    WHERE rim.recipe_id = %s
                    """,
                    (recipe_id,),
                )
                ingredients_rows = cur.fetchall()

        # Build normalized structure (do not hold cursors)
        ingredients = []
        for r in ingredients_rows:
            ingredients.append({
                "name": r["name"],
                "quantity": r["quantity"] or "",
                "unit": r["unit"] or "",
                "image_url": r["image_path"] or "",
                "nutrition": r["nutrition_json"] or {},
            })

        # merge structured JSON if present
        master_json = row.get("recipe_json") or {}

        # Fallback: if ingredient_map was empty (normalization failed), use recipe_json
        if not ingredients and isinstance(master_json, dict):
            ingredients = master_json.get("ingredients") or []

        response_dict: Dict[str, Any] = {
            "recipe_key": recipe_key,
            "recipe_id": recipe_id,
            "title": row["title"],
            "servings": row["servings"],
            "steps": row["steps_json"],
            "ingredients": ingredients,
            "nutrition_total": {},  # let ingredient service compute if needed
            "cached": True,
            "recipe_image_url": row.get("image_path") or "",
        }
        if isinstance(master_json, dict):
            for k in ("description", "tips", "meta", "nutrition", "tags", "ai_context"):
                if k in master_json:
                    response_dict[k] = master_json.get(k)

        return response_dict
    except Exception as exc:
        logger.exception("cache_service.get_cached_recipe failed: %s", exc)
        return None

