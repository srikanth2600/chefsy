#!/usr/bin/env python3
from pathlib import Path
from psycopg import connect
from psycopg.rows import dict_row
import csv, json

BASE = Path(__file__).resolve().parents[3]
CSV_DIR = BASE / ".cursor" / "CSV"
DB_CONFIG = {"host":"localhost","port":5432,"dbname":"gharka_chef","user":"postgres","password":"postgres123"}

def main():
    recf = CSV_DIR / "recipes.csv"
    keys = []
    with open(recf, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for i, r in enumerate(reader):
            if i>=10: break
            keys.append((r.get("recipe_key") or r.get("recipe_name") or "").strip())
    conn = connect(**DB_CONFIG, row_factory=dict_row)
    cur = conn.cursor()
    for k in keys:
        cur.execute("SELECT id, recipe_key, title, recipe_json FROM recipe_master WHERE recipe_key=%s", (k,))
        row = cur.fetchone()
        if not row:
            print("NOT FOUND", k)
            continue
        rj = row.get("recipe_json") or {}
        title_in_json = rj.get("title") if isinstance(rj, dict) else None
        first_step = None
        try:
            if isinstance(rj, dict):
                s = rj.get("steps") or []
                if isinstance(s, list) and len(s)>0:
                    first_step = s[0].get("description") if isinstance(s[0], dict) else s[0]
        except Exception:
            first_step = None
        print("DB id:", row["id"], "key:", row["recipe_key"], "db_title:", row["title"])
        print("  json_title:", title_in_json)
        print("  first_step_sample:", (first_step or "")[:120])
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()

