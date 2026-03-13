#!/usr/bin/env python3
from psycopg import connect
from psycopg.rows import dict_row
import json

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "gharka_chef",
    "user": "postgres",
    "password": "postgres123",
}

def main():
    conn = connect(**DB_CONFIG, row_factory=dict_row)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS total FROM recipe_master")
    total = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) AS has_json FROM recipe_master WHERE recipe_json IS NOT NULL AND recipe_json != '{}'::jsonb")
    has_json = cur.fetchone()["has_json"]
    cur.execute("SELECT id, recipe_key, recipe_json FROM recipe_master WHERE recipe_json IS NOT NULL AND recipe_json != '{}'::jsonb LIMIT 10")
    samples = cur.fetchall()
    print("total_recipes:", total)
    print("recipes_with_nonempty_recipe_json:", has_json)
    print("sample_nonempty_recipe_json_rows (up to 10):")
    for s in samples:
        rid = s["id"]
        key = s["recipe_key"]
        try:
            rj = json.dumps(s["recipe_json"]) if s["recipe_json"] is not None else "null"
        except Exception:
            rj = str(s["recipe_json"])
        print(f"- id={rid} key={key} recipe_json_present_length={len(rj)}")
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()

