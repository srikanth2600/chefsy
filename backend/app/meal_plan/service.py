import json
import logging
import re
from typing import Any, Optional

from fastapi import HTTPException
from openai import OpenAI

from app.core.config import settings
from app.core.db import get_connection
from app.meal_plan import repository
from app.services.search_service import lookup_recipe_by_query

logger = logging.getLogger(__name__)

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ---------------------------------------------------------------------------
# Premium gate
# ---------------------------------------------------------------------------

def check_premium(user_id: int) -> None:
    """Raise 403 if the user's package does not allow meal plan generation."""
    from app.core.packages import get_user_plan, has_feature_access
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Developer / Admin bypass
            cur.execute("SELECT user_type FROM users WHERE id = %s", (user_id,))
            u = cur.fetchone()
            if u and u.get("user_type") in ("Developer", "Admin"):
                return
    plan = get_user_plan(user_id)
    if has_feature_access(plan, "meal_plan"):
        return
    raise HTTPException(
        status_code=403,
        detail={
            "message": "Meal planning requires a Premium package",
            "upgrade_url": "/upgrade",
            "feature": "ai_meal_planner",
        },
    )


# ---------------------------------------------------------------------------
# List / CRUD helpers
# ---------------------------------------------------------------------------

def list_plans(user_id: int, page: int, per_page: int, status: str) -> dict:
    plans, total = repository.get_meal_plans_for_user(user_id, page, per_page, status)
    for p in plans:
        p["created_at"] = str(p["created_at"])
        p["updated_at"] = str(p["updated_at"])
        if p.get("week_start_date"):
            p["week_start_date"] = str(p["week_start_date"])
    return {"plans": plans, "total": total, "page": page, "per_page": per_page}


def get_plan_detail(plan_id: int) -> dict:
    plan = repository.get_meal_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    slots = repository.get_slots_for_plan(plan_id)
    plan["created_at"] = str(plan["created_at"])
    plan["updated_at"] = str(plan["updated_at"])
    if plan.get("week_start_date"):
        plan["week_start_date"] = str(plan["week_start_date"])

    # Build daily summary (calories per day)
    daily_totals: dict[int, int] = {}
    for slot in slots:
        mj = slot.get("meal_json") or {}
        cal = mj.get("calories_estimate", 0) if isinstance(mj, dict) else 0
        daily_totals[slot["day_index"]] = daily_totals.get(slot["day_index"], 0) + (cal or 0)

    daily_summary = [
        {"day_index": i, "day_name": DAY_NAMES[i], "calories": daily_totals.get(i, 0)}
        for i in range(7)
    ]

    # Build shopping list (deduplicated ingredients from all slots)
    seen: set[str] = set()
    shopping_list: list[str] = []
    for slot in slots:
        mj = slot.get("meal_json") or {}
        ingredients = mj.get("ingredients_summary", []) if isinstance(mj, dict) else []
        for ing in ingredients:
            key = ing.lower().strip()
            if key and key not in seen:
                seen.add(key)
                shopping_list.append(ing)

    return {
        "plan": plan,
        "slots": slots,
        "daily_summary": daily_summary,
        "shopping_list": shopping_list,
    }


# ---------------------------------------------------------------------------
# AI Generation
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> str:
    """Strip markdown fences and extract the first JSON object/array."""
    text = re.sub(r"^```[a-z]*\n?", "", text.strip(), flags=re.MULTILINE)
    text = re.sub(r"```$", "", text.strip(), flags=re.MULTILINE)
    # Find first { ... }
    start = text.find("{")
    if start == -1:
        return text.strip()
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return text[start:].strip()


def _generate_slots(req: dict) -> list[dict[str, Any]]:
    """
    Call the LLM and return a list of slot dicts ready for bulk_insert_slots.
    Does NOT touch the database.
    """
    dietary = ", ".join(req.get("dietary_preferences") or []) or "none"
    allergies = ", ".join(req.get("allergies") or []) or "none"
    cuisine = req.get("cuisine_preference") or "any"
    servings = req.get("servings", 2)
    meal_types = req.get("meal_types") or ["breakfast", "lunch", "dinner"]

    system_prompt = f"""You are a professional nutrition-aware meal planner.
Return ONLY a valid JSON object — no markdown, no code fences, no commentary.

OUTPUT SCHEMA:
{{
  "plan_name": "string",
  "days": [
    {{
      "day_index": 0,
      "day_name": "Monday",
      "slots": [
        {{
          "meal_type": "breakfast",
          "meal_name": "string",
          "recipe_key": "slug-hint-or-null",
          "calories_estimate": 400,
          "ingredients_summary": ["ingredient1", "ingredient2"],
          "notes": "optional string"
        }}
      ]
    }}
  ]
}}

RULES:
- Generate exactly 7 days (day_index 0=Monday through 6=Sunday)
- Each day must include these meal types: {', '.join(meal_types)}
- recipe_key: provide a kebab-case slug hint matching a recipe name (e.g. "dal-makhani", "greek-salad"), or null if unknown
- dietary preferences: {dietary}
- allergies/avoid: {allergies}
- cuisine: {cuisine}
- servings per meal: {servings}
- Keep calories realistic (300-700 per slot). Do NOT repeat the same meal_name more than twice in the week.
- ingredients_summary: list 3-6 main ingredients only"""

    user_message = f"Generate a 7-day meal plan. Dietary: {dietary}. Allergies: {allergies}. Cuisine: {cuisine}. Servings: {servings}."

    try:
        client = OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url)
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.8,
            max_tokens=4000,
        )
        raw = response.choices[0].message.content or ""
    except Exception as exc:
        logger.exception("OpenAI meal plan generation failed")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}") from exc

    try:
        json_str = _extract_json(raw)
        data = json.loads(json_str)
    except Exception:
        logger.error("Failed to parse meal plan JSON: %s", raw[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for meal plan")

    slots_to_insert: list[dict[str, Any]] = []
    for day in data.get("days", []):
        day_index = int(day.get("day_index", 0))
        for i, slot in enumerate(day.get("slots", [])):
            recipe_id: Optional[int] = None
            recipe_key_hint = slot.get("recipe_key")
            if recipe_key_hint:
                try:
                    match = lookup_recipe_by_query(recipe_key_hint)
                    if match:
                        recipe_id = match["id"]
                except Exception:
                    pass

            meal_json = {
                "title": slot.get("meal_name", ""),
                "calories_estimate": slot.get("calories_estimate", 0),
                "ingredients_summary": slot.get("ingredients_summary", []),
                "notes": slot.get("notes"),
            }
            slots_to_insert.append({
                "day_index": day_index,
                "meal_type": slot.get("meal_type", "breakfast"),
                "recipe_id": recipe_id,
                "meal_name": slot.get("meal_name"),
                "meal_json": meal_json,
                "sort_order": i,
            })

    return slots_to_insert


def generate_meal_plan(user_id: int, req: dict) -> dict:
    """
    AI-generate a full 7-day meal plan, persist it (new plan), and return detail.
    """
    plan_name = req.get("name") or "AI Meal Plan"
    meal_types = req.get("meal_types") or ["breakfast", "lunch", "dinner"]
    preferences_json = {
        "dietary": req.get("dietary_preferences") or [],
        "allergies": req.get("allergies") or [],
        "cuisine": req.get("cuisine_preference") or "",
        "meal_types": meal_types,
    }

    slots = _generate_slots(req)

    plan_id = repository.create_meal_plan(user_id, {
        "name": plan_name,
        "description": req.get("description"),
        "week_start_date": req.get("week_start_date"),
        "servings": req.get("servings", 2),
        "preferences_json": preferences_json,
    })

    repository.bulk_insert_slots(plan_id, slots)
    logger.info("Generated meal plan id=%d for user_id=%d with %d slots", plan_id, user_id, len(slots))

    return get_plan_detail(plan_id)


def regenerate_meal_plan(plan_id: int, req: dict) -> dict:
    """Re-generate slots for an existing plan (replaces all slots)."""
    repository.delete_slots_for_plan(plan_id)
    slots = _generate_slots(req)
    repository.bulk_insert_slots(plan_id, slots)
    logger.info("Regenerated slots for plan_id=%d: %d slots", plan_id, len(slots))
    return get_plan_detail(plan_id)