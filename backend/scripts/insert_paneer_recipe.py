#!/usr/bin/env python3
"""
Insert a single recipe (Paneer Butter Masala) with ingredients and mappings.
This is idempotent: it will skip inserting the recipe if recipe_key exists,
and will upsert ingredients by name.
"""
import json
from psycopg import connect
from psycopg.rows import dict_row

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "gharka_chef",
    "user": "postgres",
    "password": "postgres123",
}

RECIPE_KEY = "paneer-butter-masala-classic"

RECIPE = {
    "recipe_key": RECIPE_KEY,
    "title": "Paneer Butter Masala (Restaurant Style)",
    "description": "Paneer Butter Masala is a rich and creamy North Indian curry made with soft paneer cubes simmered in a buttery tomato-based gravy flavored with aromatic spices. It is one of the most popular vegetarian dishes served in Indian restaurants.",
    "servings": 3,
    "image_path": "/images/paneer-butter-masala.jpg",
    "steps": [
        {"title":"Prepare ingredients","description":"Cut paneer into cubes and chop vegetables."},
        {"title":"Cook onion base","description":"Saute onions in butter and oil until golden."},
        {"title":"Add aromatics","description":"Add ginger garlic paste and cook until fragrant."},
        {"title":"Cook tomatoes","description":"Add tomatoes and cook until soft."},
        {"title":"Add spices","description":"Mix turmeric, chili powder and coriander powder."},
        {"title":"Blend gravy","description":"Blend mixture into smooth gravy."},
        {"title":"Simmer gravy","description":"Cook gravy again for 5 minutes."},
        {"title":"Add paneer","description":"Add paneer cubes and cook gently."},
        {"title":"Finish with cream","description":"Add cream and garam masala."},
        {"title":"Garnish and serve","description":"Top with coriander leaves and serve hot."}
    ],
    "meta": {"cuisine":"Indian","difficulty":"Moderate","estimated_time":"35 mins","tags":["veg","curry","north-indian"], "diet": {"type":"vegetarian","gluten_free": True}},
    "nutrition_total": {"calories":420,"protein":18,"fat":30,"carbs":16},
}

INGREDIENTS = [
    {"name":"paneer","category":"dairy","nutrition":{"calories":265,"protein":18,"fat":20,"carbs":3}},
    {"name":"onion","category":"vegetable","nutrition":{"calories":40,"protein":1,"fat":0,"carbs":9}},
    {"name":"tomato","category":"vegetable","nutrition":{"calories":22,"protein":1,"fat":0,"carbs":5}},
    {"name":"ginger garlic paste","category":"spice","nutrition":{"calories":20,"protein":1}},
    {"name":"butter","category":"dairy","nutrition":{"calories":102,"fat":12}},
    {"name":"cream","category":"dairy","nutrition":{"calories":52,"fat":5}},
    {"name":"turmeric","category":"spice","nutrition":{"calories":8}},
    {"name":"red chili powder","category":"spice","nutrition":{"calories":6}},
    {"name":"coriander powder","category":"spice","nutrition":{"calories":5}},
    {"name":"garam masala","category":"spice","nutrition":{"calories":5}},
    {"name":"oil","category":"condiment","nutrition":{"calories":120,"fat":14}},
    {"name":"salt","category":"spice","nutrition":{}},
    {"name":"coriander leaves","category":"herb","nutrition":{"calories":2}},
]

MAP_ROWS = [
    ("paneer", "250", "g"),
    ("onion", "2", "medium"),
    ("tomato", "3", "medium"),
    ("ginger garlic paste", "1", "tbsp"),
    ("butter", "2", "tbsp"),
    ("cream", "3", "tbsp"),
    ("turmeric", "1/2", "tsp"),
    ("red chili powder", "1", "tsp"),
    ("coriander powder", "1", "tsp"),
    ("garam masala", "1/2", "tsp"),
    ("oil", "1", "tbsp"),
    ("salt", "to taste", ""),
    ("coriander leaves", "2", "tbsp"),
]


def get_conn():
    return connect(**DB_CONFIG, row_factory=dict_row)


def upsert_ingredient(cur, ing):
    name = ing["name"].strip()
    cur.execute("SELECT id FROM ingredient_master WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute(
        "INSERT INTO ingredient_master (name, category, image_path, nutrition_json) VALUES (%s,%s,%s,%s) RETURNING id",
        (name, ing.get("category"), None, json.dumps(ing.get("nutrition") or {})),
    )
    return cur.fetchone()["id"]


def insert_recipe():
    with get_conn() as conn:
        with conn.cursor() as cur:
            # check existing recipe key
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (RECIPE_KEY,))
            existing = cur.fetchone()
            if existing:
                print("Recipe already exists with id", existing["id"])
                return existing["id"]

            steps_json = json.dumps(RECIPE["steps"])
            recipe_json = {
                "recipe_key": RECIPE_KEY,
                "title": RECIPE["title"],
                "servings": RECIPE["servings"],
                "steps": RECIPE["steps"],
                "ingredients": [],  # filled below
                "meta": RECIPE.get("meta"),
                "nutrition_total": RECIPE.get("nutrition_total"),
            }

            cur.execute(
                "INSERT INTO recipe_master (recipe_key, title, steps_json, servings, image_path, recipe_json, ai_context_json) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (
                    RECIPE_KEY,
                    RECIPE["title"],
                    steps_json,
                    RECIPE["servings"],
                    RECIPE["image_path"],
                    json.dumps(recipe_json),
                    json.dumps({}),
                ),
            )
            rid = cur.fetchone()["id"]

            # upsert ingredients and insert mappings
            for name, qty, unit in MAP_ROWS:
                # find ingredient object from INGREDIENTS list
                ing_obj = next((i for i in INGREDIENTS if i["name"] == name), {"name": name, "category": None, "nutrition": {}})
                iid = upsert_ingredient(cur, ing_obj)
                # insert mapping if not exists
                cur.execute(
                    "SELECT id FROM recipe_ingredient_map WHERE recipe_id = %s AND ingredient_id = %s",
                    (rid, iid),
                )
                if cur.fetchone():
                    continue
                cur.execute(
                    "INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id, quantity, unit) VALUES (%s,%s,%s,%s)",
                    (rid, iid, qty if qty else None, unit if unit else None),
                )

            # update recipe_json.ingredients with ingredient details
            cur.execute(
                """
                SELECT im.name, rim.quantity, rim.unit, im.category, im.image_path, im.nutrition_json
                FROM recipe_ingredient_map rim
                JOIN ingredient_master im ON im.id = rim.ingredient_id
                WHERE rim.recipe_id = %s
                ORDER BY rim.id
                """,
                (rid,),
            )
            rows = cur.fetchall()
            recipe_json["ingredients"] = [
                {
                    "name": r["name"],
                    "quantity": r["quantity"],
                    "unit": r["unit"],
                    "category": r.get("category"),
                    "nutrition": r.get("nutrition_json") or {},
                }
                for r in rows
            ]
            cur.execute("UPDATE recipe_master SET recipe_json = %s WHERE id = %s", (json.dumps(recipe_json), rid))
            conn.commit()
            print("Inserted recipe id", rid)
            return rid


if __name__ == "__main__":
    insert_recipe()

