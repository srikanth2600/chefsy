#!/usr/bin/env python3
"""
Index all existing recipes from recipe_master into the vector store.

Usage (from repo root):
  python -m scripts.index_existing_recipes
  # or: cd backend && python scripts/index_existing_recipes.py
"""
from app.application.recipe_retriever import RecipeRetriever
from app.core.db import get_connection

retriever = RecipeRetriever()

with get_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT id, title, steps_json FROM recipe_master")

    for row in cur.fetchall():
        rid = row["id"]
        title = row["title"] or ""
        steps = row["steps_json"] or []
        text = f"{title} {' '.join(s if isinstance(s, str) else str(s) for s in steps)}"
        retriever.index_recipe(rid, text)

print("All recipes indexed successfully.")
