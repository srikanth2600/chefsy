"""
Org Shared Module — Daily Compliance / Check-ins

Privacy-critical: compliance logs are only accessible to the owning member
and assigned staff — never returned in aggregate admin queries.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.org import repository as org_repo
from app.core.db import get_connection

router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


# ── Repository helpers ────────────────────────────────────────────────────────

def _upsert_log(member_id: int, data: dict) -> dict:
    fields = ["breakfast", "lunch", "dinner", "snack", "weight_kg",
              "mood_score", "energy_score", "workout_done",
              "workout_duration_min", "clinical_notes"]
    set_clauses = ["log_date = EXCLUDED.log_date"]
    vals = [member_id, data["log_date"]]
    for f in fields:
        if f in data and data[f] is not None:
            set_clauses.append(f"{f} = EXCLUDED.{f}")
    col_list = ", ".join(["member_id", "log_date"] + [f for f in fields if f in data and data[f] is not None])
    val_list = ", ".join(["%s"] * (2 + sum(1 for f in fields if f in data and data[f] is not None)))
    vals += [data[f] for f in fields if f in data and data[f] is not None]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO org_compliance_log ({col_list})
                VALUES ({val_list})
                ON CONFLICT (member_id, log_date) DO UPDATE
                   SET {', '.join(set_clauses)}
                RETURNING id, log_date
                """,
                vals,
            )
            row = cur.fetchone()
        conn.commit()
    return row


def _get_my_logs(member_id: int, limit: int = 30) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM org_compliance_log WHERE member_id = %s ORDER BY log_date DESC LIMIT %s",
                (member_id, limit),
            )
            return cur.fetchall()


def _get_member_id_for_user(user_id: int, org_id: int) -> Optional[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_member WHERE user_id = %s AND org_id = %s AND status = 'active'",
                (user_id, org_id),
            )
            row = cur.fetchone()
    return row["id"] if row else None


# ── Schema ────────────────────────────────────────────────────────────────────

class ComplianceLog(BaseModel):
    org_id: int
    log_date: str                          # YYYY-MM-DD
    breakfast: Optional[str] = None        # 'yes'|'partial'|'no'
    lunch: Optional[str] = None
    dinner: Optional[str] = None
    snack: Optional[str] = None
    weight_kg: Optional[float] = None
    mood_score: Optional[int] = None       # 1-5
    energy_score: Optional[int] = None     # 1-5
    workout_done: Optional[bool] = None
    workout_duration_min: Optional[int] = None
    clinical_notes: Optional[str] = None   # private; member-visible only


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
def submit_compliance(request: Request, body: ComplianceLog):
    """Member submits or updates their daily compliance log."""
    user_id = _require_user(request)
    member_id = _get_member_id_for_user(user_id, body.org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    row = _upsert_log(member_id, body.model_dump(exclude={"org_id"}))
    return {"id": row["id"], "log_date": str(row["log_date"]), "status": "saved"}


@router.get("")
def my_compliance_history(request: Request, org_id: int, limit: int = 30):
    """Member views their own compliance history (last N days)."""
    user_id = _require_user(request)
    member_id = _get_member_id_for_user(user_id, org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    logs = _get_my_logs(member_id, min(limit, 90))
    # Strip clinical_notes from response (only include in member's own private view via separate endpoint)
    return [
        {k: v for k, v in log.items() if k != "clinical_notes"}
        for log in logs
    ]
