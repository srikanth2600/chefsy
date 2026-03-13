#!/usr/bin/env python3
import psycopg

def main():
    conn = psycopg.connect(host="localhost", port=5432, dbname="gharka_chef", user="postgres", password="postgres123")
    cur = conn.cursor()
    # Upsert recipe without relying on ON CONFLICT (older DBs may lack unique constraint)
    cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", ("test-pulao",))
    row = cur.fetchone()
    if row:
        recipe_id = row[0]
        cur.execute("UPDATE recipe_master SET title = %s WHERE id = %s", ("Test Pulao", recipe_id))
    else:
        cur.execute("INSERT INTO recipe_master (recipe_key, title, steps_json, servings) VALUES (%s, %s, %s, %s) RETURNING id", ("test-pulao", "Test Pulao", "[]", 2))
        recipe_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM ingredient_master WHERE name = %s", ("test rice",))
    row = cur.fetchone()
    if row:
        ingr_id = row[0]
    else:
        cur.execute("INSERT INTO ingredient_master (name, image_path, nutrition_json) VALUES (%s, %s, %s) RETURNING id", ("test rice", "", "{}"))
        ingr_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM recipe_ingredient_map WHERE recipe_id = %s AND ingredient_id = %s", (recipe_id, ingr_id))
    if not cur.fetchone():
        cur.execute("INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id, quantity, unit) VALUES (%s, %s, %s, %s)", (recipe_id, ingr_id, '2', 'cups'))
    conn.commit()
    print(recipe_id)

if __name__ == "__main__":
    main()

