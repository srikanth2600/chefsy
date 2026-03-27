"""
Org Shared Module — Content (Reels / Articles / Health Tips)

Shared across Gym + Nutrition org types.
Staff can publish; members can view.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from psycopg.types.json import Json

from app.org import service as org_service
from app.core.db import get_connection

router = APIRouter()

_ALLOWED_TYPES = {"reel", "health_tip", "article", "workout_video", "recipe_demo"}


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


# ── Repository helpers ────────────────────────────────────────────────────────

def _create_content(org_id: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_content
                  (org_id, staff_id, content_type, title, description, hashtags,
                   video_url, video_file, thumbnail, platform, body_text, target_group, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org_id,
                    data.get("staff_id"),
                    data["content_type"],
                    data["title"],
                    data.get("description"),
                    Json(data.get("hashtags") or []),
                    data.get("video_url"),
                    data.get("video_file"),
                    data.get("thumbnail"),
                    data.get("platform"),
                    data.get("body_text"),
                    data.get("target_group", "all"),
                    data.get("status", "active"),
                ),
            )
            content_id = cur.fetchone()["id"]
        conn.commit()
    return content_id


def _list_content(org_id: int, content_type: Optional[str] = None, status: str = "active") -> list:
    cond, params = "WHERE org_id = %s AND status = %s", [org_id, status]
    if content_type:
        cond += " AND content_type = %s"
        params.append(content_type)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM org_content {cond} ORDER BY created_at DESC",
                params,
            )
            return cur.fetchall()


def _get_content(content_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM org_content WHERE id = %s AND org_id = %s",
                (content_id, org_id),
            )
            return cur.fetchone()


def _update_content(content_id: int, fields: dict) -> None:
    if not fields:
        return
    set_clauses, values = [], []
    for k, v in fields.items():
        set_clauses.append(f"{k} = %s")
        values.append(Json(v) if k == "hashtags" else v)
    values.append(content_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_content SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                values,
            )
        conn.commit()


def _delete_content(content_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM org_content WHERE id = %s", (content_id,))
        conn.commit()


def _increment_view(content_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE org_content SET view_count = view_count + 1 WHERE id = %s",
                (content_id,),
            )
        conn.commit()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContentCreate(BaseModel):
    content_type: str
    title: str
    description: Optional[str] = None
    hashtags: Optional[list] = None
    video_url: Optional[str] = None
    thumbnail: Optional[str] = None
    platform: Optional[str] = None
    body_text: Optional[str] = None
    target_group: Optional[str] = "all"
    status: Optional[str] = "active"


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[list] = None
    body_text: Optional[str] = None
    target_group: Optional[str] = None
    status: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
def create_content(request: Request, body: ContentCreate):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if body.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail=f"content_type must be one of: {', '.join(sorted(_ALLOWED_TYPES))}")
    content_id = _create_content(org["id"], body.model_dump())
    return {"id": content_id, "status": "created"}


@router.get("")
def list_content(
    request: Request,
    content_type: Optional[str] = Query(None),
    status: str = Query("active"),
):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    return _list_content(org["id"], content_type, status)


@router.get("/{content_id}")
def get_content(content_id: int, request: Request):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    item = _get_content(content_id, org["id"])
    if not item:
        raise HTTPException(status_code=404, detail="Content not found.")
    _increment_view(content_id)
    return item


@router.patch("/{content_id}")
def update_content(content_id: int, request: Request, body: ContentUpdate):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if not _get_content(content_id, org["id"]):
        raise HTTPException(status_code=404, detail="Content not found.")
    _update_content(content_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


@router.delete("/{content_id}")
def delete_content(content_id: int, request: Request):
    user_id = _require_user(request)
    org = org_service._require_org_admin(user_id)
    if not _get_content(content_id, org["id"]):
        raise HTTPException(status_code=404, detail="Content not found.")
    _delete_content(content_id)
    return {"status": "deleted"}
