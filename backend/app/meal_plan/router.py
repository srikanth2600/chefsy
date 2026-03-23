from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from app.core.db import get_connection
from app.meal_plan import service, repository
from app.meal_plan.schema import MealPlanCreate, MealPlanUpdate, MealPlanGenerateRequest, SlotUpdate

router = APIRouter()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_user_id(req: Request) -> Optional[int]:
    auth = req.headers.get("authorization") or req.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())",
                (token,),
            )
            r = cur.fetchone()
            return r["user_id"] if r else None


def _require_user(req: Request) -> int:
    uid = _get_user_id(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _require_owner(user_id: int, plan_id: int) -> dict:
    """Return plan row or 404 (hides existence from non-owners)."""
    plan = repository.get_meal_plan_by_id(plan_id)
    if not plan or plan["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return plan


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/usage")
def get_usage(request: Request):
    """Return today's meal plan generation count vs the configured daily limit."""
    user_id = _require_user(request)
    from datetime import date as _date
    from app.core.packages import get_user_plan, get_package_limits
    plan_name = get_user_plan(user_id)
    limits = get_package_limits(plan_name)
    meal_limits = limits.get("meal_plan", {})

    daily_limit: int | None = meal_limits.get("daily")
    monthly_limit: int | None = meal_limits.get("monthly")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM meal_plan WHERE user_id = %s AND DATE(created_at) = %s",
                (user_id, _date.today()),
            )
            today_used = int(cur.fetchone()["cnt"])
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM meal_plan WHERE user_id = %s AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())",
                (user_id,),
            )
            month_used = int(cur.fetchone()["cnt"])

    can_generate = True
    if daily_limit is not None and today_used >= daily_limit:
        can_generate = False
    if monthly_limit is not None and monthly_limit == 0:
        can_generate = False

    return {
        "plan": plan_name,
        "daily_limit": daily_limit,
        "monthly_limit": monthly_limit,
        "today_used": today_used,
        "month_used": month_used,
        "can_generate": can_generate,
    }


@router.get("/options")
def get_options():
    """Return active dietary / allergy / cuisine options for the generate modal."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT category, label FROM meal_plan_option WHERE is_active = TRUE ORDER BY category, sort_order, label"
            )
            rows = cur.fetchall()
    grouped: dict = {"dietary": [], "allergy": [], "cuisine": []}
    for r in rows:
        cat = r["category"]
        if cat in grouped:
            grouped[cat].append(r["label"])
    return grouped


@router.get("")
def list_plans(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query("active"),
):
    user_id = _require_user(request)
    return service.list_plans(user_id, page, per_page, status)


@router.post("")
def create_plan(request: Request, body: MealPlanCreate):
    user_id = _require_user(request)
    service.check_premium(user_id)
    plan_id = repository.create_meal_plan(user_id, body.model_dump())
    return {"id": plan_id, "status": "ok"}


@router.post("/generate")
def generate_plan(request: Request, body: MealPlanGenerateRequest):
    user_id = _require_user(request)
    service.check_premium(user_id)

    # Redis rate limit — prevent duplicate requests within 30 s
    _redis_key = f"meal_plan:generate:{user_id}"
    try:
        import redis as _redis_mod
        from app.core.config import settings as _settings
        _rc = _redis_mod.from_url(_settings.redis_url, decode_responses=True)
        if _rc.exists(_redis_key):
            raise HTTPException(
                status_code=429,
                detail="Please wait a moment before generating another meal plan.",
            )
        _rc.setex(_redis_key, 30, "1")
    except HTTPException:
        raise
    except Exception:
        pass  # Redis unavailable — proceed without rate limiting

    result = service.generate_meal_plan(user_id, body.model_dump())
    return result


@router.get("/{plan_id}")
def get_plan(plan_id: int, request: Request):
    user_id = _require_user(request)
    _require_owner(user_id, plan_id)
    return service.get_plan_detail(plan_id)


@router.put("/{plan_id}")
def update_plan(plan_id: int, request: Request, body: MealPlanUpdate):
    user_id = _require_user(request)
    _require_owner(user_id, plan_id)
    repository.update_meal_plan(plan_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, request: Request):
    user_id = _require_user(request)
    _require_owner(user_id, plan_id)
    repository.delete_meal_plan(plan_id)
    return {"status": "ok"}


@router.put("/{plan_id}/slots/{slot_id}")
def update_slot(plan_id: int, slot_id: int, request: Request, body: SlotUpdate):
    user_id = _require_user(request)
    _require_owner(user_id, plan_id)
    # Verify slot belongs to this plan
    slot = repository.get_slot_by_id(slot_id)
    if not slot or slot["meal_plan_id"] != plan_id:
        raise HTTPException(status_code=404, detail="Slot not found")
    updated = repository.update_slot(slot_id, body.model_dump(exclude_none=True))
    return {"status": "ok", "slot": updated}


@router.post("/{plan_id}/regenerate")
def regenerate_plan(plan_id: int, request: Request, body: MealPlanGenerateRequest):
    user_id = _require_user(request)
    existing = _require_owner(user_id, plan_id)
    service.check_premium(user_id)
    req_data = body.model_dump()
    # Fall back to existing plan preferences if not provided in request
    if not req_data.get("dietary_preferences") and existing.get("preferences_json"):
        pref = existing["preferences_json"]
        req_data["dietary_preferences"] = pref.get("dietary", [])
        req_data["allergies"] = pref.get("allergies", [])
        req_data["cuisine_preference"] = pref.get("cuisine", "")
        req_data["meal_types"] = pref.get("meal_types", ["breakfast", "lunch", "dinner"])
    return service.regenerate_meal_plan(plan_id, req_data)