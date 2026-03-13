from fastapi import APIRouter, HTTPException, Request
from app.videos import service
from app.core.db import get_connection
from app.videos.schema import VideoCreate, VideoOut

router = APIRouter()


def _get_user_from_request(req: Request) -> int | None:
    auth_header = req.headers.get("authorization") or req.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())", (token,))
            r = cur.fetchone()
            return r["user_id"] if r else None


@router.post("/", response_model=VideoOut)
def create_video(request: Request, payload: VideoCreate):
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    # resolve recipe_key to recipe_id if provided
    recipe_id = None
    if payload.recipe_key:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (payload.recipe_key,))
                r = cur.fetchone()
                recipe_id = r["id"] if r else None
    vid = service.create_video(user_id, payload.url, payload.title, payload.description, recipe_id)
    v = service.get_video(vid)
    if not v:
        raise HTTPException(status_code=500, detail="Failed to retrieve saved video")
    return VideoOut(id=v["id"], url=v["url"], title=v.get("title"), thumbnail=v.get("thumbnail"), recipe_key=v.get("recipe_key"))


@router.get("/user")
def get_user_videos(request: Request, limit: int = 3):
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.list_user_videos(user_id, limit)


@router.get("/{video_id}")
def get_video(video_id: int):
    v = service.get_video(video_id)
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoOut(id=v["id"], url=v["url"], title=v.get("title"), thumbnail=v.get("thumbnail"), recipe_key=v.get("recipe_key"))

