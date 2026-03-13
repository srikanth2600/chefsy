#!/usr/bin/env python3
"""
Backup and delete imported recipes, ingredients, and recipe_ingredient_map rows.
Criteria:
 - Recipes: recipe_key LIKE 'recipe_%'
 - Ingredients: names listed in .cursor/CSV/ingredients.csv

Backups are written to .cursor/CSV/backups/*.json
"""
import json
from pathlib import Path
from datetime import datetime
from psycopg import connect
from psycopg.rows import dict_row

BASE = Path(__file__).resolve().parents[3]
CSV_DIR = BASE / ".cursor" / "CSV"
BACKUP_DIR = CSV_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "gharka_chef",
    "user": "postgres",
    "password": "postgres123",
}


def read_ingredient_names():
    ingf = CSV_DIR / "ingredients.csv"
    names = []
    if not ingf.exists():
        return names
    with ingf.open(encoding="utf-8") as fh:
        # handle single-column CSV with header
        for i, line in enumerate(fh):
            if i == 0:
                continue
            n = line.strip()
            if n:
                names.append(n)
    return names


def backup_query(cur, sql, params, out_path):
    cur.execute(sql, params)
    rows = cur.fetchall()
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(rows, fh, default=str, indent=2)
    return rows


def main():
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    ing_names = read_ingredient_names()
    print("Ingredient names from CSV:", len(ing_names))

    conn = connect(**DB_CONFIG, row_factory=dict_row)
    cur = conn.cursor()

    # Backup recipes to delete
    print("Backing up recipes with recipe_key LIKE 'recipe_%' ...")
    recs = backup_query(
        cur,
        "SELECT * FROM recipe_master WHERE recipe_key LIKE %s",
        ("recipe_%",),
        BACKUP_DIR / f"recipe_master_backup_{timestamp}.json",
    )
    rec_ids = [r["id"] for r in recs]
    print("Recipes to delete:", len(rec_ids))

    # Backup recipe_ingredient_map rows referencing these recipes
    if rec_ids:
        print("Backing up recipe_ingredient_map for selected recipes ...")
        rim = backup_query(
            cur,
            "SELECT * FROM recipe_ingredient_map WHERE recipe_id = ANY(%s)",
            (rec_ids,),
            BACKUP_DIR / f"recipe_ingredient_map_backup_{timestamp}.json",
        )
    else:
        rim = []

    # Backup ingredients matching CSV names
    if ing_names:
        print("Backing up ingredient_master for listed ingredient names ...")
        ingr = backup_query(
            cur,
            "SELECT * FROM ingredient_master WHERE name = ANY(%s)",
            (ing_names,),
            BACKUP_DIR / f"ingredient_master_backup_{timestamp}.json",
        )
        ingr_ids = [r["id"] for r in ingr]
        print("Ingredient rows to delete:", len(ingr_ids))
    else:
        ingr = []
        ingr_ids = []

    # Also backup recipe_ingredient_map rows referencing these ingredient ids (if any)
    if ingr_ids:
        print("Backing up recipe_ingredient_map for selected ingredient ids ...")
        rim2 = backup_query(
            cur,
            "SELECT * FROM recipe_ingredient_map WHERE ingredient_id = ANY(%s)",
            (ingr_ids,),
            BACKUP_DIR / f"recipe_ingredient_map_by_ingredient_backup_{timestamp}.json",
        )
    else:
        rim2 = []

    # Proceed to delete (wrapped in transaction)
    try:
        print("Deleting recipe_ingredient_map rows referencing recipes or ingredients ...")
        if rec_ids:
            cur.execute("DELETE FROM recipe_ingredient_map WHERE recipe_id = ANY(%s)", (rec_ids,))
        if ingr_ids:
            cur.execute("DELETE FROM recipe_ingredient_map WHERE ingredient_id = ANY(%s)", (ingr_ids,))

        print("Deleting recipes ...")
        if rec_ids:
            cur.execute("DELETE FROM recipe_master WHERE id = ANY(%s)", (rec_ids,))

        print("Deleting ingredients ...")
        if ingr_ids:
            cur.execute("DELETE FROM ingredient_master WHERE id = ANY(%s)", (ingr_ids,))

        conn.commit()
        print("Delete completed successfully.")
    except Exception as exc:
        conn.rollback()
        print("Delete failed, rolled back:", exc)
    finally:
        cur.close()
        conn.close()

    print("Backups written to:", BACKUP_DIR)


if __name__ == "__main__":
    main()

