"""
Org Shared Module — Meal Plan Batches

Bulk AI meal plan generation for an entire group.
Status flow: queued → processing → review_pending → approved → published
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.org.modules import require_module_active
from app.org import repository, service as org_service
from app.core.db import get_connection
from psycopg.types.json import Json

router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


# ── Repository helpers ────────────────────────────────────────────────────────

def _create_batch(org_id: int, group_id: Optional[int], initiated_by: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_meal_plan_batch
                  (org_id, group_id, initiated_by, batch_name, week_start_date, total_members)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (org_id, group_id, initiated_by,
                 data.get("batch_name"),
                 data.get("week_start_date"),
                 data.get("total_members", 0)),
            )
            batch_id = cur.fetchone()["id"]
        conn.commit()
    return batch_id


def _list_batches(org_id: int, status: Optional[str] = None) -> list:
    cond, params = "WHERE org_id = %s", [org_id]
    if status:
        cond += " AND status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM org_meal_plan_batch {cond} ORDER BY created_at DESC",
                params,
            )
            return cur.fetchall()


def _get_batch(batch_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM org_meal_plan_batch WHERE id = %s AND org_id = %s",
                (batch_id, org_id),
            )
            return cur.fetchone()


def _update_batch_status(batch_id: int, status: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE org_meal_plan_batch SET status = %s, updated_at = NOW() WHERE id = %s",
                (status, batch_id),
            )
        conn.commit()


def _list_batch_plans(batch_id: int) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.*, m.email, m.full_name
                  FROM org_member_meal_plan p
                  JOIN org_member m ON m.id = p.member_id
                 WHERE p.batch_id = %s
                 ORDER BY m.full_name
                """,
                (batch_id,),
            )
            return cur.fetchall()


# ── Schemas ───────────────────────────────────────────────────────────────────

class BatchCreate(BaseModel):
    group_id: Optional[int] = None
    batch_name: Optional[str] = None
    week_start_date: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
def create_batch(request: Request, body: BatchCreate):
    """Initiate a bulk meal plan generation run for a group."""
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    require_module_active(org["org_type"])

    member_count = 0
    if body.group_id:
        group = repository.get_group_by_id(body.group_id)
        if not group or group["org_id"] != org["id"]:
            raise HTTPException(status_code=404, detail="Group not found.")
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS cnt FROM org_group_member WHERE group_id = %s",
                    (body.group_id,),
                )
                member_count = cur.fetchone()["cnt"]

    batch_id = _create_batch(org["id"], body.group_id, user_id, {
        "batch_name": body.batch_name,
        "week_start_date": body.week_start_date,
        "total_members": member_count,
    })
    return {"id": batch_id, "status": "queued"}


@router.get("")
def list_batches(
    request: Request,
    status: Optional[str] = Query(None),
):
    """List all batches for this org, optionally filtered by status."""
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    return _list_batches(org["id"], status)


@router.get("/{batch_id}")
def get_batch(batch_id: int, request: Request):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    batch = _get_batch(batch_id, org["id"])
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return batch


@router.get("/{batch_id}/plans")
def list_batch_plans(batch_id: int, request: Request):
    """List individual member plans inside a batch."""
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if not _get_batch(batch_id, org["id"]):
        raise HTTPException(status_code=404, detail="Batch not found.")
    return _list_batch_plans(batch_id)


@router.patch("/{batch_id}/status")
def update_batch_status(batch_id: int, request: Request, status: str = Query(...)):
    """Advance or set batch status (approve / publish etc.)."""
    valid = {"queued", "processing", "partial_complete", "review_pending", "approved", "published", "failed"}
    if status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of: {', '.join(sorted(valid))}")
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if not _get_batch(batch_id, org["id"]):
        raise HTTPException(status_code=404, detail="Batch not found.")
    _update_batch_status(batch_id, status)
    return {"status": status}
