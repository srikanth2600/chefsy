"""
Org Module — Custom (Manual) Meal Planner

Allows org admins and staff to build 7-day template meal plans manually,
then invite individual members or entire groups to adopt them.

Status flow for template plans: draft → published → archived
Invite status flow: pending → adopted | declined
"""
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.org.modules import require_module_active, require_org_module_active
from app.org import service as org_service
from app.core.db import get_connection
from psycopg.types.json import Json

router = APIRouter()

_MODULE_KEY = "org_custom_meal_planner"


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _require_org_and_module(user_id: int) -> dict:
    """Get org, verify it is active, and enforce both module guards."""
    org = org_service._require_org_admin(user_id)
    require_module_active(_MODULE_KEY)
    require_org_module_active(org, _MODULE_KEY)
    return org


# ── Repository helpers ────────────────────────────────────────────────────────

def _create_plan(org_id: int, created_by: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_template_meal_plan
                  (org_id, created_by, name, description, week_start_date, meal_types, target_prefs)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    org_id,
                    created_by,
                    data["name"],
                    data.get("description"),
                    data.get("week_start_date"),
                    Json(data.get("meal_types", ["breakfast", "lunch", "dinner"])),
                    Json(data.get("target_prefs") or {}),
                ),
            )
            plan_id = cur.fetchone()["id"]
        conn.commit()
    return plan_id


def _list_plans(org_id: int, status: Optional[str] = None) -> list:
    cond, params = "WHERE t.org_id = %s", [org_id]
    if status:
        cond += " AND t.status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT t.*,
                       u.full_name AS created_by_name,
                       (SELECT COUNT(*) FROM org_template_meal_plan_slot s WHERE s.template_plan_id = t.id) AS slot_count
                  FROM org_template_meal_plan t
                  LEFT JOIN users u ON u.id = t.created_by
                 {cond}
                 ORDER BY t.created_at DESC
                """,
                params,
            )
            return cur.fetchall()


def _get_plan(plan_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.*, u.full_name AS created_by_name
                  FROM org_template_meal_plan t
                  LEFT JOIN users u ON u.id = t.created_by
                 WHERE t.id = %s AND t.org_id = %s
                """,
                (plan_id, org_id),
            )
            return cur.fetchone()


def _get_slots(plan_id: int) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.*, r.title AS recipe_title
                  FROM org_template_meal_plan_slot s
                  LEFT JOIN recipe_master r ON r.id = s.recipe_id
                 WHERE s.template_plan_id = %s
                 ORDER BY s.day_index, s.sort_order, s.meal_type
                """,
                (plan_id,),
            )
            return cur.fetchall()


def _upsert_slot(plan_id: int, data: dict) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_template_meal_plan_slot
                  (template_plan_id, day_index, meal_type, meal_name, recipe_id, meal_json, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (template_plan_id, day_index, meal_type)
                DO UPDATE SET
                  meal_name  = EXCLUDED.meal_name,
                  recipe_id  = EXCLUDED.recipe_id,
                  meal_json  = EXCLUDED.meal_json,
                  sort_order = EXCLUDED.sort_order,
                  updated_at = NOW()
                RETURNING *
                """,
                (
                    plan_id,
                    data["day_index"],
                    data["meal_type"],
                    data.get("meal_name"),
                    data.get("recipe_id"),
                    Json(data["meal_json"]) if data.get("meal_json") else None,
                    data.get("sort_order", 0),
                ),
            )
            row = cur.fetchone()
        conn.commit()
    return dict(row)


def _delete_slot(slot_id: int, plan_id: int) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM org_template_meal_plan_slot WHERE id = %s AND template_plan_id = %s",
                (slot_id, plan_id),
            )
            deleted = cur.rowcount > 0
        conn.commit()
    return deleted


def _count_slots(plan_id: int) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM org_template_meal_plan_slot WHERE template_plan_id = %s",
                (plan_id,),
            )
            return cur.fetchone()["cnt"]


def _update_plan_status(plan_id: int, status: str, set_published_at: bool = False) -> None:
    extra_sql = ", published_at = NOW()" if set_published_at else ""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_template_meal_plan SET status = %s, updated_at = NOW(){extra_sql} WHERE id = %s",
                (status, plan_id),
            )
        conn.commit()


def _bulk_invite_members(plan_id: int, member_ids: list, group_id: Optional[int] = None) -> int:
    """Bulk-insert invite rows; silently skip duplicates. Returns inserted count."""
    if not member_ids:
        return 0
    inserted = 0
    with get_connection() as conn:
        with conn.cursor() as cur:
            for mid in member_ids:
                cur.execute(
                    """
                    INSERT INTO org_template_plan_invite (template_plan_id, member_id, group_id)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (template_plan_id, member_id) DO NOTHING
                    """,
                    (plan_id, mid, group_id),
                )
                inserted += cur.rowcount
        conn.commit()
    return inserted


def _list_invites(plan_id: int) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT i.*, m.email, m.full_name,
                       g.name AS group_name
                  FROM org_template_plan_invite i
                  JOIN org_member m ON m.id = i.member_id
                  LEFT JOIN org_group g ON g.id = i.group_id
                 WHERE i.template_plan_id = %s
                 ORDER BY i.invited_at DESC
                """,
                (plan_id,),
            )
            return cur.fetchall()


# ── Schemas ───────────────────────────────────────────────────────────────────

class TemplatePlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    week_start_date: Optional[str] = None
    meal_types: List[str] = ["breakfast", "lunch", "dinner"]
    target_prefs: Optional[dict] = None


class TemplatePlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    week_start_date: Optional[str] = None
    meal_types: Optional[List[str]] = None
    target_prefs: Optional[dict] = None


class TemplateSlotUpsert(BaseModel):
    day_index: int
    meal_type: str
    meal_name: Optional[str] = None
    recipe_id: Optional[int] = None
    meal_json: Optional[dict] = None
    sort_order: int = 0


class AssignToMembers(BaseModel):
    member_ids: List[int]


class AssignToGroup(BaseModel):
    group_id: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
def create_plan(request: Request, body: TemplatePlanCreate):
    """Create a new draft template meal plan."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan_id = _create_plan(org["id"], user_id, body.model_dump())
    return {"id": plan_id, "status": "draft"}


@router.get("")
def list_plans(request: Request, status: Optional[str] = Query(None)):
    """List template plans for this org, optionally filtered by status."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    return _list_plans(org["id"], status)


@router.get("/{plan_id}")
def get_plan(plan_id: int, request: Request):
    """Get a template plan with all its slots."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")
    slots = _get_slots(plan_id)
    result = dict(plan)
    result["slots"] = slots
    return result


@router.patch("/{plan_id}")
def update_plan(plan_id: int, request: Request, body: TemplatePlanUpdate):
    """Update template plan metadata."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return {"detail": "No changes provided."}

    set_parts = []
    params = []
    for field, val in updates.items():
        set_parts.append(f"{field} = %s")
        params.append(Json(val) if isinstance(val, (dict, list)) else val)
    params.append(plan_id)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_template_meal_plan SET {', '.join(set_parts)}, updated_at = NOW() WHERE id = %s",
                params,
            )
        conn.commit()
    return {"detail": "Updated."}


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, request: Request):
    """Delete a DRAFT template plan. Published plans must be archived first."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if plan["status"] != "draft":
        raise HTTPException(status_code=422, detail="Only draft plans can be deleted. Archive the plan first.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM org_template_meal_plan WHERE id = %s", (plan_id,))
        conn.commit()
    return {"detail": "Deleted."}


@router.put("/{plan_id}/slots")
def upsert_slot(plan_id: int, request: Request, body: TemplateSlotUpsert):
    """Insert or update a single slot in the 7-day grid (idempotent)."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    if not _get_plan(plan_id, org["id"]):
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if body.day_index < 0 or body.day_index > 6:
        raise HTTPException(status_code=422, detail="day_index must be 0–6.")
    slot = _upsert_slot(plan_id, body.model_dump())
    return slot


@router.delete("/{plan_id}/slots/{slot_id}")
def delete_slot(plan_id: int, slot_id: int, request: Request):
    """Clear (delete) a single slot from the grid."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    if not _get_plan(plan_id, org["id"]):
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if not _delete_slot(slot_id, plan_id):
        raise HTTPException(status_code=404, detail="Slot not found.")
    return {"detail": "Slot cleared."}


@router.post("/{plan_id}/publish")
def publish_plan(plan_id: int, request: Request):
    """Publish a draft plan (requires at least one slot to exist)."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if plan["status"] != "draft":
        raise HTTPException(status_code=422, detail=f"Plan is already '{plan['status']}', not a draft.")
    if _count_slots(plan_id) == 0:
        raise HTTPException(status_code=422, detail="Cannot publish an empty plan — add at least one meal to the grid first.")
    _update_plan_status(plan_id, "published", set_published_at=True)
    return {"status": "published"}


@router.post("/{plan_id}/archive")
def archive_plan(plan_id: int, request: Request):
    """Archive a published plan (no further assignments can be made)."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if plan["status"] != "published":
        raise HTTPException(status_code=422, detail="Only published plans can be archived.")
    _update_plan_status(plan_id, "archived")
    return {"status": "archived"}


@router.post("/{plan_id}/assign/members")
def assign_to_members(plan_id: int, request: Request, body: AssignToMembers):
    """Invite specific org members to adopt this plan."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if plan["status"] != "published":
        raise HTTPException(status_code=422, detail="Plan must be published before assigning.")

    # Validate all member_ids belong to this org
    if body.member_ids:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM org_member WHERE id = ANY(%s) AND org_id = %s",
                    (body.member_ids, org["id"]),
                )
                valid_ids = [r["id"] for r in cur.fetchall()]
        invalid = set(body.member_ids) - set(valid_ids)
        if invalid:
            raise HTTPException(status_code=422, detail=f"Member IDs not found in your org: {sorted(invalid)}")

    count = _bulk_invite_members(plan_id, body.member_ids)
    return {"invited_count": count, "detail": f"{count} new invite(s) sent."}


@router.post("/{plan_id}/assign/group")
def assign_to_group(plan_id: int, request: Request, body: AssignToGroup):
    """Snapshot-invite all current members of a group to adopt this plan."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    plan = _get_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Template plan not found.")
    if plan["status"] != "published":
        raise HTTPException(status_code=422, detail="Plan must be published before assigning.")

    # Verify group belongs to this org
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_group WHERE id = %s AND org_id = %s",
                (body.group_id, org["id"]),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Group not found in your org.")

            # Get all current group member IDs (snapshot)
            cur.execute(
                "SELECT member_id FROM org_group_member WHERE group_id = %s",
                (body.group_id,),
            )
            member_ids = [r["member_id"] for r in cur.fetchall()]

    if not member_ids:
        return {"invited_count": 0, "detail": "Group has no members."}

    count = _bulk_invite_members(plan_id, member_ids, group_id=body.group_id)
    return {"invited_count": count, "group_id": body.group_id, "detail": f"{count} new invite(s) sent."}


@router.get("/{plan_id}/invites")
def list_invites(plan_id: int, request: Request):
    """List all invites for a template plan with member info and status."""
    user_id = _require_user(request)
    org = _require_org_and_module(user_id)
    if not _get_plan(plan_id, org["id"]):
        raise HTTPException(status_code=404, detail="Template plan not found.")
    return _list_invites(plan_id)
