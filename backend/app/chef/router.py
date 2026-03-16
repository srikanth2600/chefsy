from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File, Form
from typing import Optional
from pydantic import BaseModel
import uuid, pathlib


class MessageCreate(BaseModel):
    sender_name: str
    sender_email: str = ""
    subject: str = ""
    message: str
from app.chef import service, repository
from app.chef.schema import (
    ChefProfileCreate, ChefProfileUpdate,
    ChefPublicOut, ChefFollowOut, ChefReviewCreate,
    ChefRoleCreate, ChefRoleUpdate, ChefRoleAssign,
    CategoryCreate, CategoryUpdate, RecipeCategoryAssign,
    ReelCreate, ReelUpdate, RecipeSave,
)
from app.core.db import get_connection

_MEDIA_ROOT = pathlib.Path(__file__).resolve().parents[3] / "media"
_ALLOWED_IMG = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_VID = {"video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/avi", "video/x-msvideo", "application/octet-stream"}
_MAX_AVATAR = 2 * 1024 * 1024     # 2 MB
_MAX_BANNER = 5 * 1024 * 1024     # 5 MB
_MAX_REEL   = 100 * 1024 * 1024   # 100 MB

router = APIRouter()


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


def _require_admin(req: Request) -> int:
    uid = _require_user(req)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_admin FROM users WHERE id = %s", (uid,))
            r = cur.fetchone()
            if not (r and r.get("is_admin")):
                raise HTTPException(status_code=403, detail="Admin required")
    return uid


# ─── Chef Roles (public read, admin write) ────────────────────────────────────

@router.get("/roles")
def list_roles():
    roles = repository.get_all_roles()
    for r in roles:
        r["created_at"] = str(r["created_at"])
    return {"roles": roles}


@router.post("/roles")
def create_role(payload: ChefRoleCreate, req: Request):
    _require_admin(req)
    role_id = repository.create_role(payload.name, payload.description)
    return {"id": role_id, "status": "ok"}


@router.put("/roles/{role_id}")
def update_role(role_id: int, payload: ChefRoleUpdate, req: Request):
    _require_admin(req)
    if not repository.get_role_by_id(role_id):
        raise HTTPException(status_code=404, detail="Role not found")
    repository.update_role(role_id, payload.name, payload.description)
    return {"status": "ok"}


@router.delete("/roles/{role_id}")
def delete_role(role_id: int, req: Request):
    _require_admin(req)
    repository.delete_role(role_id)
    return {"status": "ok"}


# ─── Categories (public read, admin write) ────────────────────────────────────

@router.get("/categories")
def list_categories():
    cats = repository.get_all_categories()
    for c in cats:
        c["created_at"] = str(c["created_at"])
    return {"categories": cats}


@router.get("/categories/tree")
def categories_tree():
    def _fmt(node):
        node["created_at"] = str(node["created_at"])
        node["children"] = [_fmt(ch) for ch in node.get("children", [])]
        return node
    return {"tree": [_fmt(n) for n in repository.get_category_tree()]}


@router.post("/categories")
def create_category(payload: CategoryCreate, req: Request):
    _require_admin(req)
    cat_id = repository.create_category(payload.name, payload.slug, payload.parent_id)
    return {"id": cat_id, "status": "ok"}


@router.put("/categories/{category_id}")
def update_category(category_id: int, payload: CategoryUpdate, req: Request):
    _require_admin(req)
    if not repository.get_category_by_id(category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    repository.update_category(category_id, payload.name, payload.slug)
    return {"status": "ok"}


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, req: Request):
    _require_admin(req)
    repository.delete_category(category_id)
    return {"status": "ok"}


# ─── Chef dashboard own-profile routes  (MUST be before /{slug} catch-all) ───

@router.get("/me/profile")
def my_profile(req: Request):
    user_id = _require_user(req)
    profile = service.get_my_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Chef profile not found. Please complete your registration.")
    return profile


@router.put("/me/profile")
def update_my_profile(payload: ChefProfileUpdate, req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    service.update_profile(user_id, payload)
    return {"status": "ok"}


@router.post("/me/avatar")
async def upload_avatar(req: Request, file: UploadFile = File(...)):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="Only JPG / PNG / WebP / GIF allowed")
    data = await file.read()
    if len(data) > _MAX_AVATAR:
        raise HTTPException(status_code=400, detail="Avatar must be under 2 MB")
    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    filename = f"chef_avatar_{chef['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = _MEDIA_ROOT / "chefs"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / filename).write_bytes(data)
    url = f"/media/chefs/{filename}"
    repository.update_profile(user_id, {"avatar_url": url})
    return {"url": url}


@router.post("/me/banner")
async def upload_banner(req: Request, file: UploadFile = File(...)):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    if file.content_type not in _ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="Only JPG / PNG / WebP / GIF allowed")
    data = await file.read()
    if len(data) > _MAX_BANNER:
        raise HTTPException(status_code=400, detail="Banner must be under 5 MB")
    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    filename = f"chef_banner_{chef['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = _MEDIA_ROOT / "chefs"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / filename).write_bytes(data)
    url = f"/media/chefs/{filename}"
    repository.update_profile(user_id, {"banner_url": url})
    return {"url": url}


@router.get("/me/analytics")
def my_analytics(req: Request):
    user_id = _require_user(req)
    result = service.get_analytics(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    return result


@router.get("/me/recipes")
def my_recipes(
    req: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    recipes, total = repository.get_chef_recipes(chef["id"], page, per_page)
    for r in recipes:
        r["created_at"] = str(r.get("created_at", ""))
    return {"recipes": recipes, "total": total, "page": page, "per_page": per_page}


@router.post("/me/recipes")
def save_my_recipe(payload: RecipeSave, req: Request):
    """Create or update a chef-authored recipe (draft or published)."""
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    try:
        rid = repository.save_chef_recipe(chef["id"], payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"id": rid, "status": "ok"}


@router.get("/me/plan-usage")
def my_plan_usage(req: Request):
    user_id = _require_user(req)
    result = service.get_plan_usage(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    return result


@router.get("/me/roles")
def my_roles(req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    roles = repository.get_chef_roles(chef["id"])
    for r in roles:
        r["created_at"] = str(r["created_at"])
    return {"roles": roles}


@router.post("/me/roles")
def assign_my_roles(payload: ChefRoleAssign, req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    repository.assign_chef_roles(chef["id"], payload.role_ids)
    return {"status": "ok"}


@router.get("/me/reviews")
def my_reviews(
    req: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """All recipe reviews received by this chef across all their recipes."""
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT rr.id, rr.rating, rr.review_text, rr.created_at,
                       rm.title AS recipe_title, rm.id AS recipe_id,
                       COALESCE(u.full_name, rr.user_id::text) AS reviewer_name
                FROM recipe_reviews rr
                JOIN recipe_master rm ON rm.id = rr.recipe_id
                LEFT JOIN users u ON u.id = rr.user_id
                WHERE rm.chef_id = %s
                ORDER BY rr.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (chef["id"], per_page, (page - 1) * per_page),
            )
            reviews = [dict(r) for r in cur.fetchall()]
            cur.execute(
                """
                SELECT COUNT(*) AS cnt
                FROM recipe_reviews rr
                JOIN recipe_master rm ON rm.id = rr.recipe_id
                WHERE rm.chef_id = %s
                """,
                (chef["id"],),
            )
            total = cur.fetchone()["cnt"]
    for r in reviews:
        r["created_at"] = str(r["created_at"])
    return {"reviews": reviews, "total": total, "page": page, "per_page": per_page}


@router.get("/me/messages")
def my_messages(
    req: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Inbox of messages sent to this chef."""
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cm.id, cm.sender_name, cm.sender_email, cm.subject,
                       cm.message, cm.is_read, cm.created_at,
                       COALESCE(u.full_name, cm.sender_name) AS user_full_name
                FROM chef_messages cm
                LEFT JOIN users u ON u.id = cm.user_id
                WHERE cm.chef_id = %s
                ORDER BY cm.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (chef["id"], per_page, (page - 1) * per_page),
            )
            messages = [dict(r) for r in cur.fetchall()]
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM chef_messages WHERE chef_id = %s",
                (chef["id"],),
            )
            total = cur.fetchone()["cnt"]
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM chef_messages WHERE chef_id = %s AND is_read = FALSE",
                (chef["id"],),
            )
            unread = cur.fetchone()["cnt"]
    for m in messages:
        m["created_at"] = str(m["created_at"])
    return {"messages": messages, "total": total, "unread": unread, "page": page, "per_page": per_page}


@router.put("/me/messages/{message_id}/read")
def mark_message_read(message_id: int, req: Request):
    """Mark a message as read."""
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chef_messages SET is_read = TRUE WHERE id = %s AND chef_id = %s",
                (message_id, chef["id"]),
            )
        conn.commit()
    return {"status": "ok"}


@router.get("/me/categories")
def my_categories(req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    cats = repository.get_chef_categories(chef["id"])
    return {"categories": cats}


@router.post("/me/categories")
def assign_my_categories(payload: RecipeCategoryAssign, req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    repository.assign_chef_categories(chef["id"], payload.category_ids)
    return {"status": "ok"}


# ─── Chef Reels ───────────────────────────────────────────────────────────────

@router.get("/me/reels")
def my_reels(
    req: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    reels, total = repository.get_reels_by_chef(chef["id"], page, per_page)
    for r in reels:
        r["created_at"] = str(r.get("created_at", ""))
        if isinstance(r.get("hashtags"), str):
            import json as _json
            try:
                r["hashtags"] = _json.loads(r["hashtags"])
            except Exception:
                r["hashtags"] = []
    return {"reels": reels, "total": total, "page": page, "per_page": per_page}


@router.post("/me/reels")
def create_reel(payload: ReelCreate, req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    if not payload.video_url:
        raise HTTPException(status_code=400, detail="video_url is required (use /me/reels/upload for file uploads)")
    platform = repository._detect_platform(payload.video_url)
    reel_id = repository.create_reel(
        chef_id=chef["id"],
        title=payload.title,
        description=payload.description,
        hashtags=payload.hashtags,
        video_url=payload.video_url,
        video_file_path=None,
        platform=platform,
    )
    return {"id": reel_id, "status": "ok"}


@router.post("/me/reels/upload")
async def upload_reel(
    req: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    hashtags: str = Form(None),
):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    if file.content_type not in _ALLOWED_VID:
        raise HTTPException(status_code=400, detail="Only MP4, MOV, WebM allowed")
    data = await file.read()
    if len(data) > _MAX_REEL:
        raise HTTPException(status_code=400, detail="Video must be under 100 MB")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    import json as _json
    tags = []
    if hashtags:
        try:
            tags = _json.loads(hashtags)
        except Exception:
            tags = [t.strip() for t in hashtags.split(",") if t.strip()]
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "mp4"
    filename = f"reel_{chef['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    dest = _MEDIA_ROOT / "reels"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / filename).write_bytes(data)
    file_path = f"/media/reels/{filename}"
    reel_id = repository.create_reel(
        chef_id=chef["id"],
        title=title,
        description=description,
        hashtags=tags,
        video_url=None,
        video_file_path=file_path,
        platform="upload",
    )
    return {"id": reel_id, "url": file_path, "status": "ok"}


@router.put("/me/reels/{reel_id}")
def update_reel(reel_id: int, payload: ReelUpdate, req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    reel = repository.get_reel_by_id(reel_id)
    if not reel or reel["chef_id"] != chef["id"]:
        raise HTTPException(status_code=404, detail="Reel not found")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if fields:
        repository.update_reel(reel_id, fields)
    return {"status": "ok"}


@router.delete("/me/reels/{reel_id}")
def delete_reel(reel_id: int, req: Request):
    user_id = _require_user(req)
    chef = repository.get_by_user_id(user_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef profile not found")
    reel = repository.get_reel_by_id(reel_id)
    if not reel or reel["chef_id"] != chef["id"]:
        raise HTTPException(status_code=404, detail="Reel not found")
    repository.delete_reel(reel_id)
    return {"status": "ok"}


# ─── Recipe category endpoints ────────────────────────────────────────────────

@router.get("/recipes/{recipe_id}/categories")
def get_recipe_categories(recipe_id: int):
    cats = repository.get_recipe_categories(recipe_id)
    return {"categories": cats}


@router.post("/recipes/{recipe_id}/categories")
def set_recipe_categories(recipe_id: int, payload: RecipeCategoryAssign, req: Request):
    _require_user(req)
    repository.set_recipe_categories(recipe_id, payload.category_ids)
    return {"status": "ok"}


# ─── Public endpoints  (/{slug} MUST come last — it's a catch-all) ─────────────

@router.get("")
def list_chefs(
    q: Optional[str] = Query(None),
    featured: Optional[bool] = Query(None),
    location: Optional[str] = Query(None),
    cuisine: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    return service.list_chefs(q=q, featured=featured, location=location, cuisine=cuisine, page=page, per_page=per_page)


@router.get("/{slug}/recipes")
def get_chef_recipes(
    slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    chef = repository.get_by_slug(slug)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    recipes, total = repository.get_chef_recipes(chef["id"], page, per_page)
    for r in recipes:
        r["created_at"] = str(r.get("created_at", ""))
    return {"recipes": recipes, "total": total, "page": page, "per_page": per_page}


@router.get("/reels/recent")
def get_recent_reels_global(per_page: int = Query(20, ge=1, le=50)):
    """Returns recent active reels from all chefs with chef info, for the find-chef page."""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT cr.id, cr.title, cr.description, cr.hashtags, cr.video_url,
                       cr.video_file_path, cr.platform, cr.thumbnail, cr.view_count, cr.created_at,
                       cp.slug AS chef_slug, u.full_name AS chef_name,
                       cp.avatar_color AS chef_avatar_color, cp.avatar_url AS chef_avatar_url
                FROM chef_reels cr
                JOIN chef_profile cp ON cp.id = cr.chef_id
                JOIN users u ON u.id = cp.user_id
                WHERE cr.status = 'active'
                ORDER BY cr.created_at DESC
                LIMIT %s
            """, (per_page,))
            rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        r["created_at"] = str(r["created_at"])
        if isinstance(r.get("hashtags"), str):
            try:
                r["hashtags"] = _json.loads(r["hashtags"])
            except Exception:
                r["hashtags"] = []
    return {"reels": rows}


@router.get("/recipes/recent")
def get_recent_recipes_global(per_page: int = Query(12, ge=1, le=50)):
    """Returns recent published recipes from all chefs with chef info, for the find-chef page."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT rm.id, rm.title, rm.servings, rm.recipe_json, rm.created_at,
                       COALESCE(rrc.likes, 0) AS like_count,
                       cp.slug AS chef_slug, u.full_name AS chef_name,
                       cp.avatar_color AS chef_avatar_color, cp.is_verified AS chef_verified
                FROM recipe_master rm
                LEFT JOIN recipe_reaction_count rrc ON rrc.recipe_id = rm.id
                JOIN chef_profile cp ON cp.id = rm.chef_id
                JOIN users u ON u.id = cp.user_id
                WHERE COALESCE(rm.is_published, TRUE) = TRUE
                  AND COALESCE(rm.is_active, TRUE) = TRUE
                  AND rm.chef_id IS NOT NULL
                ORDER BY rm.created_at DESC
                LIMIT %s
            """, (per_page,))
            rows = [dict(r) for r in cur.fetchall()]
    result = []
    for r in rows:
        rj = r.get("recipe_json") or {}
        meta = rj.get("meta") or {}
        result.append({
            "id": r["id"],
            "title": r.get("title") or "",
            "cuisine": meta.get("cuisine") or "",
            "difficulty": meta.get("difficulty") or "Moderate",
            "cook_time": meta.get("estimated_time") or "",
            "like_count": r["like_count"],
            "image_url": rj.get("image_url"),
            "description": rj.get("description") or "",
            "ingredients": rj.get("ingredients") or [],
            "steps": rj.get("steps") or [],
            "tips": rj.get("tips") or "",
            "hashtags": rj.get("hashtags") or [],
            "chef_slug": r["chef_slug"],
            "chef_name": r["chef_name"],
            "chef_avatar_color": r["chef_avatar_color"],
            "chef_verified": r.get("chef_verified") or False,
        })
    return {"recipes": result}


@router.get("/{slug}/reels")
def get_chef_reels_public(
    slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    import json as _json
    chef = repository.get_by_slug(slug)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    reels, total = repository.get_reels_by_chef(chef["id"], page, per_page)
    for r in reels:
        r["created_at"] = str(r.get("created_at", ""))
        if isinstance(r.get("hashtags"), str):
            try:
                r["hashtags"] = _json.loads(r["hashtags"])
            except Exception:
                r["hashtags"] = []
    return {"reels": reels, "total": total, "page": page, "per_page": per_page}


@router.get("/{slug}/reviews")
def get_chef_reviews(slug: str):
    chef = repository.get_by_slug(slug)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    reviews = repository.get_reviews(chef["id"])
    for r in reviews:
        r["created_at"] = str(r.get("created_at", ""))
    return {"reviews": reviews, "total": len(reviews)}


@router.post("/{slug}/follow", response_model=ChefFollowOut)
def follow_chef(slug: str, req: Request):
    user_id = _require_user(req)
    try:
        return service.follow_toggle(slug, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{slug}/message")
def send_message(slug: str, payload: MessageCreate, req: Request):
    """User sends a message to a chef's inbox."""
    user_id = _get_user_id(req)  # optional auth
    chef = repository.get_by_slug(slug)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chef_messages (chef_id, user_id, sender_name, sender_email, subject, message)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    chef["id"],
                    user_id,
                    payload.sender_name,
                    payload.sender_email,
                    payload.subject,
                    payload.message,
                ),
            )
        conn.commit()
    return {"status": "ok"}


@router.post("/{slug}/reviews")
def post_review(slug: str, payload: ChefReviewCreate, req: Request):
    user_id = _require_user(req)
    try:
        service.add_review(slug, user_id, payload.rating, payload.comment)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{slug}/roles")
def get_chef_roles_public(slug: str):
    chef = repository.get_by_slug(slug)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    roles = repository.get_chef_roles(chef["id"])
    for r in roles:
        r["created_at"] = str(r["created_at"])
    return {"roles": roles}


@router.get("/{slug}")
def get_chef_profile(slug: str):
    """Public chef profile. Returns 404 if slug not found — used by registration to check availability."""
    profile = service.get_public_profile(slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Chef not found")
    return profile
