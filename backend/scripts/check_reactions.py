#!/usr/bin/env python3
from psycopg import connect
from psycopg.rows import dict_row

DB = {"host":"localhost","port":5432,"dbname":"gharka_chef","user":"postgres","password":"postgres123"}

def main():
    conn = connect(**DB, row_factory=dict_row)
    cur = conn.cursor()
    key = "paneer-butter-masala-classic"
    cur.execute("SELECT id, title FROM recipe_master WHERE recipe_key = %s", (key,))
    row = cur.fetchone()
    if not row:
        print("Recipe not found:", key)
        return
    rid = row["id"]
    print("Recipe id:", rid, "title:", row["title"])

    cur.execute("SELECT likes, dislikes FROM recipe_reaction_count WHERE recipe_id = %s", (rid,))
    cnt = cur.fetchone()
    print("reaction counts:", cnt)

    cur.execute("SELECT user_id, reaction, created_at FROM recipe_reaction_user WHERE recipe_id = %s ORDER BY created_at DESC LIMIT 100", (rid,))
    rows = cur.fetchall()
    print("recent reactions (up to 100):", len(rows))
    for r in rows:
        print(r)

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()

