from typing import Any, Dict, List


def aggregate_nutrition(ingredients: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Sum numeric nutrition fields across ingredients.
    Expects ingredients to be a list of dicts with a 'nutrition' mapping.
    """
    totals: Dict[str, float] = {}
    for ingredient in ingredients:
        nutrition = ingredient.get("nutrition") or {}
        if not isinstance(nutrition, dict):
            continue
        for key, value in nutrition.items():
            try:
                if isinstance(value, (int, float)):
                    totals[key] = totals.get(key, 0.0) + float(value)
            except Exception:
                # ignore non-numeric fields
                continue
    return totals

