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