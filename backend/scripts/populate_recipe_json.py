#!/usr/bin/env python3
"""
Populate recipe_master.recipe_json using existing CSV steps and DB ingredient mappings.
Reads:
  .cursor/CSV/recipes.csv  (expects columns: recipe_id, recipe_key, recipe_name, steps_json)
Uses DB to fetch ingredient mappings and ingredient_master details.
"""
import csv
import json
from pathlib import Path
from psycopg import connect
from psycopg.rows import dict_row

BASE = Path(__file__).resolve().parents[3]
CSV_DIR = BASE / ".cursor" / "CSV"

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "gharka_chef",
    "user": "postgres",
    "password": "postgres123",
}


def get_conn():
    return connect(**DB_CONFIG, row_factory=dict_row)


def parse_steps(raw: str):
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        try:
            return json.loads(raw.replace('""', '"'))
        except Exception:
            # fallback: return as single-step string
            return [str(raw)]


def build_ingredients_for_recipe(cur, recipe_db_id):
    cur.execute(
        """
        SELECT im.name, rim.quantity, rim.unit, im.category, im.image_path, im.nutrition_json
        FROM recipe_ingredient_map rim
        JOIN ingredient_master im ON im.id = rim.ingredient_id
        WHERE rim.recipe_id = %s
        ORDER BY rim.id
        """,
        (recipe_db_id,),
    )
    rows = cur.fetchall()
    ingredients = []
    for r in rows:
        ing = {
            "name": r.get("name"),
        }
        if r.get("quantity") is not None:
            ing["quantity"] = r.get("quantity")
        if r.get("unit") is not None:
            ing["unit"] = r.get("unit")
        if r.get("category") is not None:
            ing["category"] = r.get("category")
        if r.get("image_path"):
            ing["image_path"] = r.get("image_path")
        if r.get("nutrition_json"):
            ing["nutrition"] = r.get("nutrition_json")
        ingredients.append(ing)
    return ingredients


def main():
    recf = CSV_DIR / "recipes.csv"
    if not recf.exists():
        print("recipes.csv not found in", CSV_DIR)
        return

    rows = []
    with open(recf, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            rows.append(r)
    print("Found", len(rows), "recipe rows in CSV")

    updated = 0
    skipped = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            for r in rows:
                recipe_key = (r.get("recipe_key") or r.get("recipe_name") or "").strip()
                if not recipe_key:
                    skipped += 1
                    continue
                # find db recipe id
                cur.execute("SELECT id, recipe_json FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
                dbrow = cur.fetchone()
                if not dbrow:
                    skipped += 1
                    continue
                rid = dbrow["id"]
                existing = dbrow.get("recipe_json") or {}
                # skip if already non-empty (to avoid overwriting)
                if existing and isinstance(existing, dict) and len(existing.keys()) > 0:
                    skipped += 1
                    continue

                steps_raw = r.get("steps_json") or ""
                steps = parse_steps(steps_raw)
                ingredients = build_ingredients_for_recipe(cur, rid)

                # Prefer authoritative title from DB (recipe_master.title)
                db_title = dbrow.get("title") or recipe_key
                recipe_json = {
                    "recipe_key": recipe_key,
                    "title": db_title,
                    "servings": None,
                    "steps": steps,
                    "ingredients": ingredients,
                }
                # Only update if missing or mismatched title/recipe_key to avoid overwriting hand-edited JSON
                should_update = False
                if not existing or not isinstance(existing, dict) or len(existing.keys()) == 0:
                    should_update = True
                else:
                    if existing.get("title") != db_title or existing.get("recipe_key") != recipe_key:
                        should_update = True

                if should_update:
                    try:
                        cur.execute("UPDATE recipe_master SET recipe_json = %s WHERE id = %s", (json.dumps(recipe_json), rid))
                        updated += 1
                    except Exception as exc:
                        print("Failed to update recipe", recipe_key, exc)
                        skipped += 1
                else:
                    skipped += 1
            conn.commit()
    print("Done. updated:", updated, "skipped:", skipped)


if __name__ == "__main__":
    main()

