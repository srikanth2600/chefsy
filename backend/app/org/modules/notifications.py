"""
Org Shared Module — Notifications

Staff sends push/in-app notifications to members or groups.
Members view their own notification history.
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

def _send_notification(org_id: int, sender_id: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_notification_log
                  (org_id, sender_id, target_type, target_id, title, body,
                   notification_type, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org_id,
                    sender_id,
                    data.get("target_type", "all"),
                    data.get("target_id"),
                    data["title"],
                    data["body"],
                    data.get("notification_type", "in_app"),
                    "sent",
                ),
            )
            notif_id = cur.fetchone()["id"]
        conn.commit()
    return notif_id


def _list_sent(org_id: int, limit: int = 50) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM org_notification_log WHERE org_id = %s ORDER BY created_at DESC LIMIT %s",
                (org_id, limit),
            )
            return cur.fetchall()


def _get_my_notifications(member_id: int, limit: int = 30) -> list:
    """
    Returns notifications targeted at this member specifically,
    their group, or broadcast to all members.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.*
                  FROM org_notification_log n
                 WHERE n.org_id = (
                       SELECT org_id FROM org_member WHERE id = %s
                 )
                   AND (
                         n.target_type = 'all'
                      OR (n.target_type = 'member' AND n.target_id = %s)
                      OR (n.target_type = 'group'  AND n.target_id IN (
                            SELECT group_id FROM org_group_member WHERE member_id = %s
                          ))
                   )
                 ORDER BY n.created_at DESC
                 LIMIT %s
                """,
                (member_id, member_id, member_id, limit),
            )
            return cur.fetchall()


def _get_member_id(user_id: int, org_id: int) -> Optional[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_member WHERE user_id = %s AND org_id = %s AND status = 'active'",
                (user_id, org_id),
            )
            row = cur.fetchone()
    return row["id"] if row else None


# ── Schemas ───────────────────────────────────────────────────────────────────

_VALID_TARGET_TYPES = {"all", "member", "group"}
_VALID_NOTIF_TYPES = {"in_app", "push", "sms", "email"}


class NotificationSend(BaseModel):
    title: str
    body: str
    target_type: Optional[str] = "all"       # all | member | group
    target_id: Optional[int] = None          # member_id or group_id when not 'all'
    notification_type: Optional[str] = "in_app"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
def send_notification(request: Request, body: NotificationSend):
    """Staff/admin sends a notification to members."""
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)

    if body.target_type not in _VALID_TARGET_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"target_type must be one of: {', '.join(sorted(_VALID_TARGET_TYPES))}",
        )
    if body.notification_type not in _VALID_NOTIF_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"notification_type must be one of: {', '.join(sorted(_VALID_NOTIF_TYPES))}",
        )
    if body.target_type != "all" and body.target_id is None:
        raise HTTPException(status_code=422, detail="target_id is required when target_type is not 'all'.")

    notif_id = _send_notification(org["id"], user_id, body.model_dump())
    return {"id": notif_id, "status": "sent"}


@router.get("")
def list_sent_notifications(
    request: Request,
    limit: int = Query(50, le=200),
):
    """Admin views all notifications sent by this org."""
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    return _list_sent(org["id"], limit)


@router.get("/my")
def my_notifications(
    request: Request,
    org_id: int = Query(...),
    limit: int = Query(30, le=90),
):
    """Member views their own notification inbox."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    return _get_my_notifications(member_id, limit)
