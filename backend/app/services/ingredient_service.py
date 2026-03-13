from typing import Any, Dict, List, Tuple
import logging

from app.core.db import get_connection
from app.services.ingredient_emojis import get_ingredient_emojis
from app.domain.nutrition import aggregate_nutrition

logger = logging.getLogger(__name__)


def get_recipe_ingredients(recipe_id: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Return (ingredients_list, nutrition_total) for a given recipe_id.
    Each ingredient will include emoji and category metadata.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT im.name, rim.quantity, rim.unit, im.image_path, im.nutrition_json
                    FROM recipe_ingredient_map rim
                    JOIN ingredient_master im ON im.id = rim.ingredient_id
                    WHERE rim.recipe_id = %s
                    """,
                    (recipe_id,),
                )
                rows = cur.fetchall()

        ingredients = []
        for r in rows:
            name = r["name"]
            emojis = get_ingredient_emojis(name)
            ingredients.append({
                "name": name,
                "quantity": r["quantity"] or "",
                "unit": r["unit"] or "",
                "image_url": r["image_path"] or "",
                "category": emojis.get("category"),
                "emoji": emojis.get("emoji"),
                "nutrition": r["nutrition_json"] or {},
            })

        nutrition_total = aggregate_nutrition(ingredients)
        return ingredients, nutrition_total
    except Exception as exc:
        logger.exception("ingredient_service.get_recipe_ingredients failed: %s", exc)
        return [], {}

