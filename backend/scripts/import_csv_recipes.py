#!/usr/bin/env python3
"""
Import recipes, ingredients, and recipe_ingredient_map from CSV files located in:
  .cursor/CSV/recipes.csv
  .cursor/CSV/ingredients.csv
  .cursor/CSV/recipe_ingredient_map.csv

This script is best-effort and idempotent: it will skip existing recipes (by recipe_key)
and existing ingredients (by name). It resolves CSV recipe_id (UUID) -> DB recipe_master.id
so the mapping file can reference recipes by CSV id.

Usage:
  python backend/scripts/import_csv_recipes.py
"""
import csv
import json
import os
import sys
from pathlib import Path

import psycopg
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
    return psycopg.connect(**DB_CONFIG, row_factory=dict_row)


def load_ingredients(ing_path):
    print("Loading ingredients from", ing_path)
    names = []
    with open(ing_path, newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        headers = next(reader, None)
        # If single-column file with header 'ingredient_name' treat accordingly
        for row in reader:
            if not row:
                continue
            names.append(row[0].strip())
    print(f"Found {len(names)} ingredients")
    name_id = {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            for n in names:
                if not n:
                    continue
                cur.execute("SELECT id FROM ingredient_master WHERE name = %s", (n,))
                r = cur.fetchone()
                if r:
                    name_id[n] = r["id"]
                    continue
                cur.execute(
                    "INSERT INTO ingredient_master (name, category, image_path, nutrition_json) VALUES (%s,%s,%s,%s) RETURNING id",
                    (n, None, None, json.dumps({})),
                )
                nid = cur.fetchone()["id"]
                name_id[n] = nid
        conn.commit()
    print(f"Upserted {len(name_id)} ingredients")
    return name_id


def load_recipes(rec_path):
    print("Loading recipes from", rec_path)
    csv_map = {}  # csv_recipe_id -> db_recipe_id
    count = 0
    with open(rec_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        # Expected columns seen: recipe_id, recipe_key, recipe_name, steps_json
        rows = list(reader)
    print(f"Found {len(rows)} recipe rows")
    with get_conn() as conn:
        with conn.cursor() as cur:
            for r in rows:
                csv_id = r.get("recipe_id") or r.get("id") or r.get("uuid")
                recipe_key = (r.get("recipe_key") or r.get("slug") or "").strip()
                title = (r.get("recipe_name") or r.get("title") or "").strip()
                steps_raw = r.get("steps_json") or "[]"
                # parse steps_json safely
                try:
                    steps = json.loads(steps_raw)
                except Exception:
                    # try to fix common CSV quoting issues
                    try:
                        steps = json.loads(steps_raw.replace('""', '"'))
                    except Exception:
                        print("WARN: failed to parse steps_json for", recipe_key, "- storing empty steps")
                        steps = []

                if not recipe_key:
                    # fall back to generated key
                    recipe_key = (title.lower().replace(" ", "-"))[:80] or None
                if not recipe_key:
                    print("Skipping row without recipe_key/title", r)
                    continue

                # check existing
                cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
                ex = cur.fetchone()
                if ex:
                    db_id = ex["id"]
                    csv_map[csv_id] = db_id
                    continue

                cur.execute(
                    "INSERT INTO recipe_master (recipe_key, title, steps_json, servings, image_path, recipe_json, ai_context_json) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (
                        recipe_key,
                        title or recipe_key,
                        json.dumps(steps),
                        None,
                        None,
                        json.dumps({}),
                        json.dumps({}),
                    ),
                )
                new_id = cur.fetchone()["id"]
                csv_map[csv_id] = new_id
                count += 1
        conn.commit()
    print(f"Inserted {count} new recipes")
    return csv_map


def load_recipe_ingredient_map(map_path, csv_recipe_map, ing_name_map):
    print("Loading recipe_ingredient_map from", map_path)
    inserted = 0
    skipped = 0
    with open(map_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
    with get_conn() as conn:
        with conn.cursor() as cur:
            for r in rows:
                csv_rid = r.get("recipe_id")
                ing_name = (r.get("ingredient_name") or r.get("ingredient") or "").strip()
                qty = r.get("quantity") or ""
                unit = r.get("unit") or ""
                if not csv_rid or not ing_name:
                    skipped += 1
                    continue
                recipe_db_id = csv_recipe_map.get(csv_rid)
                if not recipe_db_id:
                    # try if csv_rid equals recipe_key
                    recipe_db_id = None
                ing_db_id = ing_name_map.get(ing_name)
                if not ing_db_id:
                    # upsert missing ingredient
                    cur.execute("SELECT id FROM ingredient_master WHERE name = %s", (ing_name,))
                    r2 = cur.fetchone()
                    if r2:
                        ing_db_id = r2["id"]
                        ing_name_map[ing_name] = ing_db_id
                    else:
                        cur.execute(
                            "INSERT INTO ingredient_master (name, category, image_path, nutrition_json) VALUES (%s,%s,%s,%s) RETURNING id",
                            (ing_name, None, None, json.dumps({})),
                        )
                        ing_db_id = cur.fetchone()["id"]
                        ing_name_map[ing_name] = ing_db_id
                if not recipe_db_id:
                    # try lookup by recipe_key (some CSVs use recipe_key in recipe_id column)
                    cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (csv_rid,))
                    rx = cur.fetchone()
                    if rx:
                        recipe_db_id = rx["id"]
                if not recipe_db_id:
                    skipped += 1
                    continue

                # avoid duplicate mapping
                cur.execute(
                    "SELECT id FROM recipe_ingredient_map WHERE recipe_id = %s AND ingredient_id = %s",
                    (recipe_db_id, ing_db_id),
                )
                if cur.fetchone():
                    skipped += 1
                    continue
                cur.execute(
                    "INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id, quantity, unit) VALUES (%s,%s,%s,%s)",
                    (recipe_db_id, ing_db_id, qty or None, unit or None),
                )
                inserted += 1
        conn.commit()
    print(f"Inserted {inserted} recipe_ingredient_map rows, skipped {skipped}")
    return inserted, skipped


def main():
    recf = CSV_DIR / "recipes.csv"
    ingf = CSV_DIR / "ingredients.csv"
    mapf = CSV_DIR / "recipe_ingredient_map.csv"
    if not recf.exists() or not ingf.exists() or not mapf.exists():
        print("CSV files not found in", CSV_DIR)
        print("Expected: recipes.csv, ingredients.csv, recipe_ingredient_map.csv")
        sys.exit(1)

    ing_map = load_ingredients(ingf)
    csv_recipe_map = load_recipes(recf)
    inserted, skipped = load_recipe_ingredient_map(mapf, csv_recipe_map, ing_map)
    print("Done. Summary:")
    print(f"Ingredients upserted: {len(ing_map)}")
    print(f"Recipes processed: {len(csv_recipe_map)}")
    print(f"Mappings inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()

