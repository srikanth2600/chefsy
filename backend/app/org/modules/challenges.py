"""
Org Shared Module — Challenges & Leaderboard

Shared across Gym + Nutrition org types.
Staff creates challenges; members enroll and log progress.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.org import service as org_service
from app.core.db import get_connection

router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


# ── Repository helpers ────────────────────────────────────────────────────────

def _create_challenge(org_id: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_challenge
                  (org_id, title, description, challenge_type, start_date, end_date,
                   target_value, unit, reward_description, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org_id,
                    data["title"],
                    data.get("description"),
                    data.get("challenge_type", "general"),
                    data.get("start_date"),
                    data.get("end_date"),
                    data.get("target_value"),
                    data.get("unit"),
                    data.get("reward_description"),
                    data.get("status", "active"),
                ),
            )
            challenge_id = cur.fetchone()["id"]
        conn.commit()
    return challenge_id


def _list_challenges(org_id: int, status: Optional[str] = None) -> list:
    cond, params = "WHERE org_id = %s", [org_id]
    if status:
        cond += " AND status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM org_challenge {cond} ORDER BY created_at DESC",
                params,
            )
            return cur.fetchall()


def _get_challenge(challenge_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM org_challenge WHERE id = %s AND org_id = %s",
                (challenge_id, org_id),
            )
            return cur.fetchone()


def _update_challenge(challenge_id: int, fields: dict) -> None:
    if not fields:
        return
    set_clauses = [f"{k} = %s" for k in fields]
    values = list(fields.values()) + [challenge_id]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_challenge SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                values,
            )
        conn.commit()


def _delete_challenge(challenge_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM org_challenge WHERE id = %s", (challenge_id,))
        conn.commit()


def _get_member_id(user_id: int, org_id: int) -> Optional[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_member WHERE user_id = %s AND org_id = %s AND status = 'active'",
                (user_id, org_id),
            )
            row = cur.fetchone()
    return row["id"] if row else None


def _enroll_member(challenge_id: int, member_id: int) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_challenge_enrollment (challenge_id, member_id)
                VALUES (%s, %s)
                ON CONFLICT (challenge_id, member_id) DO NOTHING
                RETURNING id
                """,
                (challenge_id, member_id),
            )
            row = cur.fetchone()
        conn.commit()
    return row["id"] if row else None


def _update_progress(challenge_id: int, member_id: int, progress: float, note: Optional[str]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE org_challenge_enrollment
                   SET current_value = %s, notes = %s, updated_at = NOW()
                 WHERE challenge_id = %s AND member_id = %s
                """,
                (progress, note, challenge_id, member_id),
            )
        conn.commit()


def _get_leaderboard(challenge_id: int) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.full_name, e.current_value, e.updated_at
                  FROM org_challenge_enrollment e
                  JOIN org_member m ON m.id = e.member_id
                 WHERE e.challenge_id = %s
                 ORDER BY e.current_value DESC NULLS LAST
                 LIMIT 50
                """,
                (challenge_id,),
            )
            return cur.fetchall()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    challenge_type: Optional[str] = "general"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    reward_description: Optional[str] = None
    status: Optional[str] = "active"


class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    end_date: Optional[str] = None
    reward_description: Optional[str] = None


class ProgressUpdate(BaseModel):
    org_id: int
    current_value: float
    notes: Optional[str] = None


class EnrollRequest(BaseModel):
    org_id: int


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
def create_challenge(request: Request, body: ChallengeCreate):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    challenge_id = _create_challenge(org["id"], body.model_dump())
    return {"id": challenge_id, "status": "created"}


@router.get("")
def list_challenges(
    request: Request,
    status: Optional[str] = Query(None),
):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    return _list_challenges(org["id"], status)


@router.get("/{challenge_id}")
def get_challenge(challenge_id: int, request: Request):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    item = _get_challenge(challenge_id, org["id"])
    if not item:
        raise HTTPException(status_code=404, detail="Challenge not found.")
    return item


@router.patch("/{challenge_id}")
def update_challenge(challenge_id: int, request: Request, body: ChallengeUpdate):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if not _get_challenge(challenge_id, org["id"]):
        raise HTTPException(status_code=404, detail="Challenge not found.")
    _update_challenge(challenge_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


@router.delete("/{challenge_id}")
def delete_challenge(challenge_id: int, request: Request):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if not _get_challenge(challenge_id, org["id"]):
        raise HTTPException(status_code=404, detail="Challenge not found.")
    _delete_challenge(challenge_id)
    return {"status": "deleted"}


@router.post("/{challenge_id}/enroll")
def enroll_in_challenge(challenge_id: int, request: Request, body: EnrollRequest):
    """Member enrolls themselves in a challenge."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, body.org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    # Verify challenge belongs to that org
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_challenge WHERE id = %s AND org_id = %s AND status = 'active'",
                (challenge_id, body.org_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Challenge not found.")
    _enroll_member(challenge_id, member_id)
    return {"status": "enrolled"}


@router.patch("/{challenge_id}/progress")
def update_my_progress(challenge_id: int, request: Request, body: ProgressUpdate):
    """Member updates their own progress in a challenge."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, body.org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    _update_progress(challenge_id, member_id, body.current_value, body.notes)
    return {"status": "ok"}


@router.get("/{challenge_id}/leaderboard")
def get_leaderboard(challenge_id: int, request: Request, org_id: int = Query(...)):
    """Public leaderboard for a challenge (top 50)."""
    _require_user(request)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_challenge WHERE id = %s AND org_id = %s",
                (challenge_id, org_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Challenge not found.")
    return _get_leaderboard(challenge_id)
