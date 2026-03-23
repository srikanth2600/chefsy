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


def _resolve_llm_client(provider_id: str | None) -> tuple["OpenAI", str]:
    """
    Return (openai_compatible_client, model_name) for the given provider_id string.
    provider_id formats: "groq:<model_id>", "openai", "ollama:<model_id>", or a custom model_id.
    Falls back to Groq settings if provider_id is None or unrecognised.
    Also checks the llm_model DB table for a stored api_key / base_url override.
    """
    # Try to look up overrides from DB first
    db_api_key: str | None = None
    db_base_url: str | None = None
    db_model_id: str | None = None
    if provider_id:
        try:
            with get_connection() as _conn:
                with _conn.cursor() as _cur:
                    # Match by (provider + model_id) derived from the provider_id string
                    if provider_id.startswith("groq:"):
                        mid = provider_id.split(":", 1)[1]
                        _cur.execute(
                            "SELECT api_key, base_url, model_id FROM llm_model WHERE provider='groq' AND model_id=%s AND is_active=TRUE LIMIT 1",
                            (mid,),
                        )
                    elif provider_id == "openai":
                        _cur.execute(
                            "SELECT api_key, base_url, model_id FROM llm_model WHERE provider='openai' AND is_active=TRUE ORDER BY is_default DESC LIMIT 1"
                        )
                    elif provider_id.startswith("ollama:"):
                        mid = provider_id.split(":", 1)[1]
                        _cur.execute(
                            "SELECT api_key, base_url, model_id FROM llm_model WHERE provider='ollama' AND model_id=%s AND is_active=TRUE LIMIT 1",
                            (mid,),
                        )
                    else:
                        _cur.execute(
                            "SELECT api_key, base_url, model_id FROM llm_model WHERE model_id=%s AND is_active=TRUE LIMIT 1",
                            (provider_id,),
                        )
                    row = _cur.fetchone()
                    if row:
                        db_api_key = row["api_key"] or None
                        db_base_url = row["base_url"] or None
                        db_model_id = row["model_id"] or None
        except Exception:
            logger.warning("Could not look up LLM model from DB for provider_id=%s", provider_id)

    pid = (provider_id or "").lower()

    if pid.startswith("groq"):
        model = db_model_id or (pid.split(":", 1)[1] if ":" in pid else settings.groq_model)
        api_key = db_api_key or settings.groq_api_key
        base_url = db_base_url or settings.groq_base_url
        return OpenAI(api_key=api_key, base_url=base_url), model

    if pid == "openai":
        model = db_model_id or getattr(settings, "openai_model", "gpt-4o-mini")
        api_key = db_api_key or getattr(settings, "openai_api_key", "")
        base_url = db_base_url or None
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        return OpenAI(**kwargs), model

    if pid.startswith("ollama"):
        model = db_model_id or (pid.split(":", 1)[1] if ":" in pid else getattr(settings, "default_ollama_model", "llama3"))
        base_url = db_base_url or "http://localhost:11434/v1"
        return OpenAI(api_key="ollama", base_url=base_url), model

    # Custom / unknown — use DB values if present, else fall back to Groq
    if db_api_key and db_base_url and db_model_id:
        return OpenAI(api_key=db_api_key, base_url=db_base_url), db_model_id

    # Default fallback: Groq
    return OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url), settings.groq_model


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


def _generate_slots(req: dict, provider_id: str | None = None) -> list[dict[str, Any]]:
    """
    Call the LLM and return a list of slot dicts ready for bulk_insert_slots.
    Does NOT touch the database.
    provider_id: optional provider string (e.g. "groq:llama-3.1-8b-instant"). Falls back to Groq if None.
    """
    dietary = ", ".join(req.get("dietary_preferences") or []) or "none"
    allergies = ", ".join(req.get("allergies") or []) or "none"
    cuisine = req.get("cuisine_preference") or "any"
    servings = req.get("servings", 2)
    meal_types = req.get("meal_types") or ["breakfast", "lunch", "dinner"]
    extra_context = (req.get("extra_context") or "").strip()
    body = req.get("body_lifestyle") or {}

    # Build body/lifestyle context block for the LLM
    body_lines: list[str] = []
    if body.get("weight") and body.get("weightUnit"):
        body_lines.append(f"Weight: {body['weight']} {body['weightUnit']}")
    if body.get("height") and body.get("heightUnit"):
        body_lines.append(f"Height: {body['height']} {body['heightUnit']}")
    if body.get("dob"):
        body_lines.append(f"Date of Birth: {body['dob']}")
    if body.get("gender"):
        body_lines.append(f"Gender: {body['gender']}")
    if body.get("activityLevel"):
        body_lines.append(f"Activity Level: {body['activityLevel']}")
    if body.get("goal"):
        body_lines.append(f"Health Goal: {body['goal']}")
    body_context = "\n".join(body_lines) if body_lines else ""

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
- ingredients_summary: list 3-6 main ingredients only
{f'- USER BODY PROFILE (use to calibrate calories and macros appropriately):{chr(10)}{body_context}' if body_context else ''}"""

    user_message = f"Generate a 7-day meal plan. Dietary: {dietary}. Allergies: {allergies}. Cuisine: {cuisine}. Servings: {servings}."
    if extra_context:
        user_message += f"\n\nAdditional user instructions: {extra_context}"

    try:
        client, model_name = _resolve_llm_client(provider_id)
        logger.info("[MEAL_PLAN] generating slots with provider_id=%s model=%s", provider_id, model_name)
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.8,
            max_tokens=4000,
        )
        raw = response.choices[0].message.content or ""
    except Exception as exc:
        logger.exception("Meal plan LLM generation failed (provider_id=%s)", provider_id)
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

    slots = _generate_slots(req, provider_id=req.get("llm_provider"))

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
    slots = _generate_slots(req, provider_id=req.get("llm_provider"))
    repository.bulk_insert_slots(plan_id, slots)
    logger.info("Regenerated slots for plan_id=%d: %d slots", plan_id, len(slots))
    return get_plan_detail(plan_id)