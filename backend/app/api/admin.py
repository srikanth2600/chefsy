from fastapi import APIRouter, HTTPException, Request
from app.core.db import get_connection
from pydantic import BaseModel
from psycopg.types.json import Json
from app.api import auth as auth_module

router = APIRouter(prefix="/admin")

def _get_user_id_from_request(req: Request):
    auth = req.headers.get("authorization") or req.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())", (token,))
            r = cur.fetchone()
            return r["user_id"] if r else None

def _ensure_admin(user_id: int):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_admin FROM users WHERE id = %s", (user_id,))
            r = cur.fetchone()
            return bool(r and r.get("is_admin"))



class AdminCreateRequest(BaseModel):
    full_name: str
    email: str
    password: str
    phone: str | None = None
    designation: str | None = None
    user_type: str | None = None
    permissions: dict | None = None


class AdminUpdateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    designation: str | None = None
    user_type: str | None = None
    is_admin: bool | None = None
    permissions: dict | None = None


class UserUpdateRequest(BaseModel):
    user_type: str | None = None
    designation: str | None = None


# --- Video admin models & endpoints (create/update/get/delete) ---
class VideoCreateRequest(BaseModel):
    user_id: int | None = None
    recipe_id: int | None = None
    url: str
    title: str | None = None
    description: str | None = None
    keywords: list[str] | None = None
    category: str | None = None
    thumbnail: str | None = None
    channel: str | None = None
    watch_count: int | None = 0


class VideoUpdateRequest(BaseModel):
    recipe_id: int | None = None
    url: str | None = None
    title: str | None = None
    description: str | None = None
    keywords: list[str] | None = None
    category: str | None = None
    thumbnail: str | None = None
    channel: str | None = None
    watch_count: int | None = None
    status: str | None = None


@router.post("/videos/create")
def create_video(req: VideoCreateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO videos
                  (user_id, recipe_id, url, title, description, keywords, keywords_json, category, thumbnail, channel, watch_count, status, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending',NOW(),NOW())
                RETURNING id
                """,
                (
                    req.user_id,
                    req.recipe_id,
                    req.url,
                    req.title,
                    req.description,
                    ','.join(req.keywords) if req.keywords else None,
                    Json(req.keywords or []),
                    req.category,
                    req.thumbnail,
                    req.channel,
                    req.watch_count or 0,
                ),
            )
            vid = cur.fetchone()["id"]
            conn.commit()
            return {"status": "ok", "id": vid}


# Alias: allow admin POST /admin/videos to create (keeps frontend simple)
@router.post("/videos")
def create_video_admin(req: VideoCreateRequest, request: Request):
    # reuse existing create_video implementation (same validation/auth)
    return create_video(req, request)


@router.get("/videos/{video_id}")
def get_video(video_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, user_id, recipe_id, url, title, description, keywords, keywords_json, category, thumbnail, channel, watch_count, status, created_at, updated_at FROM videos WHERE id = %s", (video_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Video not found")
            return row


@router.put("/videos/{video_id}")
def update_video(video_id: int, body: VideoUpdateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    updates = []
    params = []
    if body.recipe_id is not None:
        updates.append("recipe_id = %s"); params.append(body.recipe_id)
    if body.url is not None:
        updates.append("url = %s"); params.append(body.url)
    if body.title is not None:
        updates.append("title = %s"); params.append(body.title)
    if body.description is not None:
        updates.append("description = %s"); params.append(body.description)
    if body.keywords is not None:
        updates.append("keywords = %s"); params.append(','.join(body.keywords))
        updates.append("keywords_json = %s"); params.append(Json(body.keywords))
    if body.category is not None:
        updates.append("category = %s"); params.append(body.category)
    if body.thumbnail is not None:
        updates.append("thumbnail = %s"); params.append(body.thumbnail)
    if body.channel is not None:
        updates.append("channel = %s"); params.append(body.channel)
    if body.watch_count is not None:
        updates.append("watch_count = %s"); params.append(body.watch_count)
    if body.status is not None:
        updates.append("status = %s"); params.append(body.status)
    if not updates:
        return {"status": "ok"}
    params.append(video_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE videos SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s", tuple(params))
            conn.commit()
            return {"status": "ok"}


@router.delete("/videos/{video_id}")
def delete_video(video_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM videos WHERE id = %s", (video_id,))
            conn.commit()
            return {"status": "ok"}


@router.get("/admins")
def list_admins(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, full_name, email, phone, designation, user_type, is_verified, is_admin, permissions_json, created_at FROM users WHERE is_admin = TRUE ORDER BY created_at DESC")
            return {"admins": cur.fetchall()}


@router.post("/admins")
def create_admin(req: AdminCreateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    # create user with password and mark is_admin true
    salt = auth_module._generate_salt()
    pw_hash = auth_module._hash_password(req.password, salt)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (full_name, email, phone, designation, user_type, password_hash, password_salt, is_verified, is_admin, permissions_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, TRUE, %s)
                RETURNING id
                """,
                (req.full_name, req.email, req.phone, req.designation, req.user_type, pw_hash, salt, Json(req.permissions or {})),
            )
            uid_new = cur.fetchone()["id"]
            conn.commit()
            return {"status": "ok", "id": uid_new}


@router.put("/admins/{admin_id}")
def update_admin(admin_id: int, body: AdminUpdateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    # Build dynamic SET clause
    updates = []
    params = []
    if body.full_name is not None:
        updates.append("full_name = %s"); params.append(body.full_name)
    if body.email is not None:
        updates.append("email = %s"); params.append(body.email)
    if body.phone is not None:
        updates.append("phone = %s"); params.append(body.phone)
    if body.designation is not None:
        updates.append("designation = %s"); params.append(body.designation)
    if body.user_type is not None:
        updates.append("user_type = %s"); params.append(body.user_type)
    if body.is_admin is not None:
        updates.append("is_admin = %s"); params.append(body.is_admin)
    if body.permissions is not None:
        updates.append("permissions_json = %s"); params.append(Json(body.permissions))
    if not updates:
        return {"status": "ok"}
    params.append(admin_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", tuple(params))
            conn.commit()
            return {"status": "ok"}


@router.post("/admins/{admin_id}/set-password")
def admin_set_password(admin_id: int, data: dict, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    new_pw = data.get("password")
    if not new_pw:
        raise HTTPException(status_code=400, detail="Password required")
    salt = auth_module._generate_salt()
    pw_hash = auth_module._hash_password(new_pw, salt)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s, password_salt = %s, is_verified = TRUE WHERE id = %s", (pw_hash, salt, admin_id))
            conn.commit()
            return {"status": "ok"}


@router.get("/users")
def list_users(request: Request):
    """
    List customer users with optional server-side search and pagination.
    Query params:
      - q: search term (matches name, email, phone, business company)
      - page: page number (1-indexed)
      - per_page: items per page
      - status: active|inactive|all
    Returns: { users: [...], total: N }
    """
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")

    q = (request.query_params.get("q") or "").strip()
    try:
        page = int(request.query_params.get("page") or "1")
    except ValueError:
        page = 1
    try:
        per_page = int(request.query_params.get("per_page") or "20")
    except ValueError:
        per_page = 20
    status = (request.query_params.get("status") or "all").lower()
    designation = (request.query_params.get("designation") or "").strip()
    gender = (request.query_params.get("gender") or "").strip()
    user_type = (request.query_params.get("user_type") or "").strip()
    company = (request.query_params.get("company") or "").strip()
    email = (request.query_params.get("email") or "").strip()
    phone = (request.query_params.get("phone") or "").strip()
    if page < 1: page = 1
    if per_page < 1: per_page = 20
    offset = (page - 1) * per_page

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Build filters
            filters = []
            params = []
            if q:
                like = f"%{q}%"
                filters.append("(full_name ILIKE %s OR email ILIKE %s OR phone ILIKE %s OR (business_details->> 'company') ILIKE %s)")
                params.extend([like, like, like, like])
            if designation:
                filters.append("designation ILIKE %s")
                params.append(f"%{designation}%")
            if gender:
                filters.append("gender = %s")
                params.append(gender)
            if user_type:
                filters.append("user_type ILIKE %s")
                params.append(f"%{user_type}%")
            if company:
                filters.append("(business_details->> 'company') ILIKE %s")
                params.append(f"%{company}%")
            if email:
                filters.append("email ILIKE %s")
                params.append(f"%{email}%")
            if phone:
                filters.append("phone ILIKE %s")
                params.append(f"%{phone}%")
            if status == "active":
                filters.append("is_verified = TRUE")
            elif status == "inactive":
                filters.append("is_verified = FALSE")
            where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

            # By default exclude admin staff from customer listing unless explicitly requested
            include_admins = request.query_params.get("include_admins", "0")
            admin_filter = "" if include_admins == "1" else "WHERE is_admin = FALSE"
            # Merge admin filter with where_clause
            if where_clause:
                # remove leading WHERE from where_clause and combine
                combined_where = f"WHERE ({where_clause[6:]}) AND is_admin = FALSE" if include_admins != "1" else where_clause
            else:
                combined_where = admin_filter

            # Total count
            count_sql = f"SELECT COUNT(*) AS cnt FROM users {combined_where}"
            cur.execute(count_sql, tuple(params))
            total = cur.fetchone()["cnt"]

            # Select page
            select_sql = f"""
                SELECT id, full_name, email, phone, profile_pic, business_details, gender, designation, user_type, is_verified, is_admin, created_at
                FROM users
                {combined_where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            cur.execute(select_sql, tuple(params) + (per_page, offset))
            rows = cur.fetchall()
            return {"users": rows, "total": total}


@router.post("/users/{user_id}/block")
def block_user(user_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET is_verified = FALSE WHERE id = %s", (user_id,))
            conn.commit()
            return {"status": "ok"}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
            return {"status": "ok"}


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: UserUpdateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    updates = []
    params = []
    if body.user_type is not None:
        updates.append("user_type = %s"); params.append(body.user_type)
    if body.designation is not None:
        updates.append("designation = %s"); params.append(body.designation)
    if not updates:
        return {"status": "ok"}
    params.append(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", tuple(params))
            conn.commit()
            return {"status": "ok"}


@router.get("/recipes")
def list_recipes(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")

    q = (request.query_params.get("q") or "").strip()
    cuisine = (request.query_params.get("cuisine") or "").strip()
    recipe_type = (request.query_params.get("recipe_type") or "").strip().lower()  # ai | chef | draft
    try:
        page = int(request.query_params.get("page") or "1")
    except ValueError:
        page = 1
    try:
        per_page = int(request.query_params.get("per_page") or "20")
    except ValueError:
        per_page = 20
    sort_by = (request.query_params.get("sort_by") or "created_at").strip()
    order = (request.query_params.get("order") or "desc").strip().lower()
    start_date = (request.query_params.get("start_date") or "").strip()
    end_date = (request.query_params.get("end_date") or "").strip()
    if page < 1: page = 1
    if per_page < 1: per_page = 20
    offset = (page - 1) * per_page

    with get_connection() as conn:
        with conn.cursor() as cur:
            filters = ["1=1"]
            params = []
            if q:
                like = f"%{q}%"
                filters.append("(rm.title ILIKE %s OR rm.recipe_key ILIKE %s)")
                params.extend([like, like])
            if cuisine:
                filters.append("(rm.recipe_json->'meta'->>'cuisine' ILIKE %s OR rm.recipe_json->>'cuisine' ILIKE %s)")
                params.extend([f"%{cuisine}%", f"%{cuisine}%"])
            # recipe_type filter
            if recipe_type == "ai":
                filters.append("rm.chef_id IS NULL")
            elif recipe_type == "chef":
                filters.append("rm.chef_id IS NOT NULL")
            elif recipe_type == "draft":
                filters.append("COALESCE(rm.is_published, TRUE) = FALSE")
            else:
                # "all" tab: only show active recipes by default
                filters.append("COALESCE(rm.is_active, TRUE) = TRUE")

            where_clause = "WHERE " + " AND ".join(filters)
            # date range filter
            if start_date and end_date:
                where_clause += " AND (rm.created_at::date BETWEEN %s AND %s)"
                params.extend([start_date, end_date])

            count_sql = f"SELECT COUNT(*) AS cnt FROM recipe_master rm {where_clause}"
            cur.execute(count_sql, tuple(params))
            total = cur.fetchone()["cnt"]

            allowed_sort = {"created_at", "title", "id", "likes"}
            if sort_by not in allowed_sort:
                sort_by = "created_at"
            if order not in ("asc", "desc"):
                order = "desc"

            select_sql = f"""
                SELECT rm.id, rm.recipe_key, rm.title, rm.servings, rm.created_at, rm.updated_at, rm.recipe_json,
                       rm.chef_id,
                       COALESCE(rm.is_active, TRUE) AS is_active,
                       COALESCE(rm.is_published, TRUE) AS is_published,
                       COALESCE(rrc.likes, 0) AS likes, COALESCE(rrc.dislikes, 0) AS dislikes,
                       u.full_name AS chef_name
                FROM recipe_master rm
                LEFT JOIN recipe_reaction_count rrc ON rrc.recipe_id = rm.id
                LEFT JOIN chef_profile cp ON cp.id = rm.chef_id
                LEFT JOIN users u ON u.id = cp.user_id
                {where_clause}
                ORDER BY rm.{sort_by} {order}
                LIMIT %s OFFSET %s
            """
            cur.execute(select_sql, tuple(params) + (per_page, offset))
            rows = cur.fetchall()
            results = []
            for r in rows:
                rj = r.get("recipe_json") or {}
                meta = rj.get("meta") or {}
                chef_name = r.get("chef_name")
                generated_by = meta.get("generated_by") or meta.get("provider") or meta.get("llm") or None
                results.append({
                    "id": r["id"],
                    "recipe_key": r["recipe_key"],
                    "title": r["title"],
                    "cuisine": meta.get("cuisine") or rj.get("cuisine") or "",
                    "difficulty": meta.get("difficulty") or rj.get("difficulty") or "",
                    "estimated_time": meta.get("estimated_time") or rj.get("estimated_time") or "",
                    "servings": r.get("servings"),
                    "likes": r.get("likes") or 0,
                    "dislikes": r.get("dislikes") or 0,
                    "owner_name": chef_name or meta.get("author") or meta.get("creator") or rj.get("author") or None,
                    "generated_by": generated_by,
                    "is_featured": False,
                    "is_active": r.get("is_active", True),
                    "is_published": r.get("is_published", True),
                    "cached": True,
                    "created_at": r.get("created_at"),
                    "tags": rj.get("tags") or [],
                })
            return {"recipes": results, "total": total}


@router.get("/recipes/{recipe_id}")
def get_recipe_admin(recipe_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, recipe_key, title, recipe_json, servings, image_path, created_at, updated_at FROM recipe_master WHERE id = %s", (recipe_id,))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Recipe not found")
            rj = r.get("recipe_json") or {}
            meta = rj.get("meta") or {}
            # derive owner info: prefer explicit author fields in recipe_json.meta
            owner_name = meta.get("author") or meta.get("creator") or rj.get("author") or None
            generated_by = meta.get("generated_by") or meta.get("provider") or meta.get("llm") or None
            return {
                "id": r["id"],
                "recipe_key": r["recipe_key"],
                "title": r["title"],
                "servings": r.get("servings"),
                "image_path": r.get("image_path"),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
                "recipe_json": rj,
                "owner_name": owner_name,
                "generated_by": generated_by,
            }


@router.post("/recipes/{recipe_id}/delete")
def admin_delete_recipe(recipe_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM recipe_master WHERE id = %s", (recipe_id,))
            conn.commit()
            return {"status": "ok"}


@router.post("/recipes/{recipe_id}/toggle-active")
def admin_toggle_recipe_active(recipe_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(is_active, TRUE) AS is_active FROM recipe_master WHERE id = %s", (recipe_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            new_val = not row["is_active"]
            cur.execute("UPDATE recipe_master SET is_active = %s WHERE id = %s", (new_val, recipe_id))
            conn.commit()
            return {"status": "ok", "is_active": new_val}


@router.get("/videos")
def list_videos(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")

    q = (request.query_params.get("q") or "").strip()
    try:
        page = int(request.query_params.get("page") or "1")
    except ValueError:
        page = 1
    try:
        per_page = int(request.query_params.get("per_page") or "20")
    except ValueError:
        per_page = 20
    status = (request.query_params.get("status") or "").strip().lower()
    recipe_id = request.query_params.get("recipe_id")
    sort_by = (request.query_params.get("sort_by") or "created_at").strip()
    order = (request.query_params.get("order") or "desc").strip().lower()
    start_date = (request.query_params.get("start_date") or "").strip()
    end_date = (request.query_params.get("end_date") or "").strip()
    if page < 1: page = 1
    if per_page < 1: per_page = 20
    offset = (page - 1) * per_page

    with get_connection() as conn:
        with conn.cursor() as cur:
            filters = []
            params = []
            if q:
                like = f"%{q}%"
                filters.append("(title ILIKE %s OR channel ILIKE %s OR url ILIKE %s OR keywords ILIKE %s)")
                params.extend([like, like, like, like])
            if status:
                filters.append("status = %s")
                params.append(status)
            if recipe_id:
                try:
                    rid = int(recipe_id)
                    filters.append("recipe_id = %s")
                    params.append(rid)
                except Exception:
                    pass
            where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""
            if start_date and end_date:
                where_clause = (where_clause + " AND " if where_clause else "WHERE ") + " (created_at::date BETWEEN %s AND %s)"
                params.extend([start_date, end_date])

            # total count
            count_sql = f"SELECT COUNT(*) AS cnt FROM videos {where_clause}"
            cur.execute(count_sql, tuple(params))
            total = cur.fetchone()["cnt"]

            # sanitize sort_by and order
            allowed_sort = {"created_at", "title", "id", "watch_count"}
            if sort_by not in allowed_sort:
                sort_by = "created_at"
            if order not in ("asc", "desc"):
                order = "desc"
            select_sql = f"""
                SELECT id, user_id, recipe_id, url, title, thumbnail, channel, keywords, keywords_json, category, watch_count, status, created_at
                FROM videos
                {where_clause}
                ORDER BY {sort_by} {order}
                LIMIT %s OFFSET %s
            """
            cur.execute(select_sql, tuple(params) + (per_page, offset))
            rows = cur.fetchall()
            return {"videos": rows, "total": total}


@router.post("/videos/{video_id}/approve")
def approve_video(video_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE videos SET status = 'approved' WHERE id = %s", (video_id,))
            conn.commit()
            return {"status": "ok"}


@router.post("/videos/{video_id}/reject")
def reject_video(video_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE videos SET status = 'rejected' WHERE id = %s", (video_id,))
            conn.commit()
            return {"status": "ok"}


# ─── Admin: Chef Management ───────────────────────────────────────────────────

@router.get("/chefs")
def admin_list_chefs(
    request: Request,
    q: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 15,
):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    rows, total = chef_repo.admin_list_chefs(q=q, status=status, page=page, per_page=per_page)
    for r in rows:
        r["created_at"] = str(r.get("created_at", ""))
        r["rating"] = float(r["rating"]) if r.get("rating") else None
        r["recipe_count"] = int(r.get("recipe_count", 0))
    return {"chefs": rows, "total": total}


@router.get("/chefs/{chef_id}")
def admin_get_chef(chef_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef = chef_repo.get_by_id(chef_id)
    if not chef:
        raise HTTPException(status_code=404, detail="Chef not found")
    chef["created_at"] = str(chef.get("created_at", ""))
    chef["updated_at"] = str(chef.get("updated_at", ""))
    chef["rating"] = float(chef["rating"]) if chef.get("rating") else None
    chef["recipe_count"] = int(chef.get("recipe_count", 0))
    recipes, _ = chef_repo.get_chef_recipes(chef_id, page=1, per_page=5)
    for r in recipes:
        r["created_at"] = str(r.get("created_at", ""))
    chef["recent_recipes"] = recipes
    return chef


@router.post("/chefs/{chef_id}/verify")
def admin_verify_chef(chef_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef_repo.toggle_verified(chef_id)
    return {"status": "ok"}


@router.post("/chefs/{chef_id}/feature")
def admin_feature_chef(chef_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef_repo.toggle_featured(chef_id)
    return {"status": "ok"}


@router.post("/chefs/{chef_id}/activate")
def admin_activate_chef(chef_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef_repo.toggle_active(chef_id)
    return {"status": "ok"}


@router.delete("/chefs/{chef_id}")
def admin_delete_chef(chef_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef_repo.delete_chef(chef_id)
    return {"status": "ok"}


# ─── Admin: Chef Roles ────────────────────────────────────────────────────────

class RoleCreateRequest(BaseModel):
    name: str
    description: str | None = None


class RoleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("/chef-roles")
def admin_list_roles(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    roles = chef_repo.get_all_roles()
    for r in roles:
        r["created_at"] = str(r["created_at"])
    return {"roles": roles}


@router.post("/chef-roles")
def admin_create_role(payload: RoleCreateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    role_id = chef_repo.create_role(payload.name, payload.description)
    return {"id": role_id, "status": "ok"}


@router.put("/chef-roles/{role_id}")
def admin_update_role(role_id: int, payload: RoleUpdateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    if not chef_repo.get_role_by_id(role_id):
        raise HTTPException(status_code=404, detail="Role not found")
    chef_repo.update_role(role_id, payload.name, payload.description)
    return {"status": "ok"}


@router.delete("/chef-roles/{role_id}")
def admin_delete_role(role_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef_repo.delete_role(role_id)
    return {"status": "ok"}


# ─── Admin: Categories ────────────────────────────────────────────────────────

class CategoryCreateRequest(BaseModel):
    name: str
    slug: str
    parent_id: int | None = None


class CategoryUpdateRequest(BaseModel):
    name: str | None = None
    slug: str | None = None


@router.get("/categories")
def admin_list_categories(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    cats = chef_repo.get_all_categories()
    for c in cats:
        c["created_at"] = str(c["created_at"])
    return {"categories": cats}


@router.get("/categories/tree")
def admin_categories_tree(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo

    def _fmt(node):
        node["created_at"] = str(node["created_at"])
        node["children"] = [_fmt(ch) for ch in node.get("children", [])]
        return node

    return {"tree": [_fmt(n) for n in chef_repo.get_category_tree()]}


@router.post("/categories")
def admin_create_category(payload: CategoryCreateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    try:
        cat_id = chef_repo.create_category(payload.name, payload.slug, payload.parent_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": cat_id, "status": "ok"}


@router.put("/categories/{category_id}")
def admin_update_category(category_id: int, payload: CategoryUpdateRequest, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    if not chef_repo.get_category_by_id(category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    chef_repo.update_category(category_id, payload.name, payload.slug)
    return {"status": "ok"}


@router.delete("/categories/{category_id}")
def admin_delete_category(category_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    chef_repo.delete_category(category_id)
    return {"status": "ok"}


# ─── Admin: Chef Reels ────────────────────────────────────────────────────────

class ReelAdminUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None
    status: str | None = None


@router.get("/reels")
def admin_list_reels(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    import json as _json
    q = request.query_params.get("q") or None
    status = request.query_params.get("status") or None
    try:
        chef_id = int(request.query_params.get("chef_id") or 0) or None
    except ValueError:
        chef_id = None
    try:
        page = max(1, int(request.query_params.get("page") or "1"))
    except ValueError:
        page = 1
    try:
        per_page = max(1, min(100, int(request.query_params.get("per_page") or "20")))
    except ValueError:
        per_page = 20
    reels, total = chef_repo.admin_list_reels(q=q, chef_id=chef_id, status=status, page=page, per_page=per_page)
    for r in reels:
        r["created_at"] = str(r.get("created_at", ""))
        if isinstance(r.get("hashtags"), str):
            try:
                r["hashtags"] = _json.loads(r["hashtags"])
            except Exception:
                r["hashtags"] = []
    return {"reels": reels, "total": total, "page": page, "per_page": per_page}


@router.put("/reels/{reel_id}")
def admin_update_reel(reel_id: int, payload: ReelAdminUpdate, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    reel = chef_repo.get_reel_by_id(reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if fields:
        chef_repo.update_reel(reel_id, fields)
    return {"status": "ok"}


@router.delete("/reels/{reel_id}")
def admin_delete_reel(reel_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    from app.chef import repository as chef_repo
    reel = chef_repo.get_reel_by_id(reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    chef_repo.delete_reel(reel_id)
    return {"status": "ok"}


# ─── Admin: Reviews ───────────────────────────────────────────────────────────

@router.get("/reviews")
def admin_list_reviews(request: Request):
    """All recipe reviews across all chefs, with optional filters."""
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    q = (request.query_params.get("q") or "").strip()
    chef_id = request.query_params.get("chef_id")
    try:
        page = max(1, int(request.query_params.get("page") or "1"))
        per_page = max(1, min(100, int(request.query_params.get("per_page") or "20")))
    except ValueError:
        page, per_page = 1, 20
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            filters = ["1=1"]
            params: list = []
            if chef_id:
                try:
                    filters.append("cp.id = %s")
                    params.append(int(chef_id))
                except ValueError:
                    pass
            if q:
                like = f"%{q}%"
                filters.append("(u.full_name ILIKE %s OR rm.title ILIKE %s OR rr.review_text ILIKE %s)")
                params.extend([like, like, like])
            where = "WHERE " + " AND ".join(filters)
            cur.execute(
                f"""
                SELECT COUNT(*) AS cnt
                FROM recipe_reviews rr
                JOIN recipe_master rm ON rm.id = rr.recipe_id
                LEFT JOIN chef_profile cp ON cp.id = rm.chef_id
                LEFT JOIN users u ON u.id = rr.user_id
                {where}
                """,
                tuple(params),
            )
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"""
                SELECT rr.id, rr.rating, rr.review_text, rr.created_at,
                       rm.id AS recipe_id, rm.title AS recipe_title,
                       COALESCE(u.full_name, rr.user_id::text) AS reviewer_name,
                       u.email AS reviewer_email,
                       COALESCE(chef_user.full_name, '') AS chef_name,
                       cp.id AS chef_id
                FROM recipe_reviews rr
                JOIN recipe_master rm ON rm.id = rr.recipe_id
                LEFT JOIN chef_profile cp ON cp.id = rm.chef_id
                LEFT JOIN users u ON u.id = rr.user_id
                LEFT JOIN users chef_user ON chef_user.id = cp.user_id
                {where}
                ORDER BY rr.created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params) + (per_page, offset),
            )
            reviews = [dict(r) for r in cur.fetchall()]
    for r in reviews:
        r["created_at"] = str(r["created_at"])
    return {"reviews": reviews, "total": total, "page": page, "per_page": per_page}


@router.delete("/reviews/{review_id}")
def admin_delete_review(review_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM recipe_reviews WHERE id = %s", (review_id,))
            conn.commit()
    return {"status": "ok"}


# ─── Admin: Messages ──────────────────────────────────────────────────────────

@router.get("/messages")
def admin_list_messages(request: Request):
    """All chef inbox messages across all chefs."""
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    q = (request.query_params.get("q") or "").strip()
    chef_id = request.query_params.get("chef_id")
    is_read = request.query_params.get("is_read")
    try:
        page = max(1, int(request.query_params.get("page") or "1"))
        per_page = max(1, min(100, int(request.query_params.get("per_page") or "20")))
    except ValueError:
        page, per_page = 1, 20
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            filters = ["1=1"]
            params: list = []
            if chef_id:
                try:
                    filters.append("cm.chef_id = %s")
                    params.append(int(chef_id))
                except ValueError:
                    pass
            if is_read in ("true", "false"):
                filters.append("cm.is_read = %s")
                params.append(is_read == "true")
            if q:
                like = f"%{q}%"
                filters.append("(cm.sender_name ILIKE %s OR cm.subject ILIKE %s OR cm.message ILIKE %s)")
                params.extend([like, like, like])
            where = "WHERE " + " AND ".join(filters)
            cur.execute(
                f"SELECT COUNT(*) AS cnt FROM chef_messages cm {where}",
                tuple(params),
            )
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"""
                SELECT cm.id, cm.sender_name, cm.sender_email, cm.subject, cm.message,
                       cm.is_read, cm.created_at,
                       COALESCE(chef_user.full_name, '') AS chef_name,
                       cp.id AS chef_id
                FROM chef_messages cm
                LEFT JOIN chef_profile cp ON cp.id = cm.chef_id
                LEFT JOIN users chef_user ON chef_user.id = cp.user_id
                {where}
                ORDER BY cm.created_at DESC
                LIMIT %s OFFSET %s
                """,
                tuple(params) + (per_page, offset),
            )
            messages = [dict(r) for r in cur.fetchall()]
    for m in messages:
        m["created_at"] = str(m["created_at"])
    return {"messages": messages, "total": total, "page": page, "per_page": per_page}


@router.delete("/messages/{message_id}")
def admin_delete_message(message_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chef_messages WHERE id = %s", (message_id,))
            conn.commit()
    return {"status": "ok"}


# ──────────────────────────────────────────────────────────────────────
# Meal Plan admin endpoints
# ──────────────────────────────────────────────────────────────────────

@router.get("/meal-plans")
def admin_list_meal_plans(
    request: Request,
    q: str = "",
    status: str = "active",
    page: int = 1,
    per_page: int = 30,
):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            base_filter = "WHERE mp.status = %s"
            params: list = [status]
            if q:
                base_filter += " AND (u.full_name ILIKE %s OR u.email ILIKE %s OR mp.name ILIKE %s)"
                like = f"%{q}%"
                params += [like, like, like]
            cur.execute(f"SELECT COUNT(*) AS cnt FROM meal_plan mp JOIN users u ON u.id = mp.user_id {base_filter}", params)
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"""
                SELECT mp.id, mp.name, mp.description, mp.week_start_date, mp.servings,
                       mp.status, mp.created_at,
                       u.id AS user_id, u.full_name AS user_name, u.email AS user_email,
                       COUNT(s.id) AS slot_count
                FROM meal_plan mp
                JOIN users u ON u.id = mp.user_id
                LEFT JOIN meal_plan_slot s ON s.meal_plan_id = mp.id
                {base_filter}
                GROUP BY mp.id, u.id
                ORDER BY mp.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, (page - 1) * per_page],
            )
            rows = cur.fetchall()
    plans = []
    for r in rows:
        d = dict(r)
        d["created_at"] = str(d["created_at"])
        if d.get("week_start_date"):
            d["week_start_date"] = str(d["week_start_date"])
        plans.append(d)
    return {"plans": plans, "total": total, "page": page, "per_page": per_page}


@router.get("/meal-plans/{plan_id}")
def admin_get_meal_plan(plan_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT mp.*, u.full_name AS user_name, u.email AS user_email
                FROM meal_plan mp JOIN users u ON u.id = mp.user_id
                WHERE mp.id = %s
                """,
                (plan_id,),
            )
            plan = cur.fetchone()
            if not plan:
                raise HTTPException(status_code=404, detail="Meal plan not found")
            cur.execute(
                """
                SELECT s.*, rm.title AS recipe_title, rm.recipe_key
                FROM meal_plan_slot s
                LEFT JOIN recipe_master rm ON rm.id = s.recipe_id
                WHERE s.meal_plan_id = %s
                ORDER BY s.day_index, s.sort_order
                """,
                (plan_id,),
            )
            slots = [dict(r) for r in cur.fetchall()]
    plan_dict = dict(plan)
    plan_dict["created_at"] = str(plan_dict["created_at"])
    plan_dict["updated_at"] = str(plan_dict["updated_at"])
    if plan_dict.get("week_start_date"):
        plan_dict["week_start_date"] = str(plan_dict["week_start_date"])
    return {"plan": plan_dict, "slots": slots}


@router.delete("/meal-plans/{plan_id}")
def admin_delete_meal_plan(plan_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meal_plan WHERE id = %s", (plan_id,))
            conn.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Meal Plan Options (dietary / allergy / cuisine)
# ---------------------------------------------------------------------------

class MealPlanOptionBody(BaseModel):
    category: str
    label: str
    sort_order: int = 0
    is_active: bool = True


@router.get("/meal-plan-options")
def admin_list_meal_plan_options(request: Request, category: str = ""):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            if category:
                cur.execute(
                    "SELECT * FROM meal_plan_option WHERE category = %s ORDER BY sort_order, label",
                    (category,),
                )
            else:
                cur.execute("SELECT * FROM meal_plan_option ORDER BY category, sort_order, label")
            return [dict(r) for r in cur.fetchall()]


@router.post("/meal-plan-options")
def admin_create_meal_plan_option(request: Request, body: MealPlanOptionBody):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    if body.category not in ("dietary", "allergy", "cuisine"):
        raise HTTPException(status_code=422, detail="category must be dietary, allergy or cuisine")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO meal_plan_option (category, label, sort_order, is_active) VALUES (%s, %s, %s, %s) RETURNING *",
                (body.category, body.label.strip(), body.sort_order, body.is_active),
            )
            row = dict(cur.fetchone())
            conn.commit()
    row["created_at"] = str(row["created_at"])
    return row


@router.put("/meal-plan-options/{option_id}")
def admin_update_meal_plan_option(option_id: int, request: Request, body: MealPlanOptionBody):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE meal_plan_option SET label = %s, sort_order = %s, is_active = %s WHERE id = %s RETURNING *",
                (body.label.strip(), body.sort_order, body.is_active, option_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Option not found")
            row = dict(row)
            conn.commit()
    row["created_at"] = str(row["created_at"])
    return row


@router.delete("/meal-plan-options/{option_id}")
def admin_delete_meal_plan_option(option_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meal_plan_option WHERE id = %s", (option_id,))
            conn.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Subscription Packages — CRUD + Feature Limits
# ---------------------------------------------------------------------------

from typing import Optional as _Opt, List as _List

class PackageBody(BaseModel):
    name: str
    display_name: str
    description: str = ""
    price_monthly: float = 0
    price_yearly: float = 0
    is_active: bool = True
    sort_order: int = 0


class FeatureLimitItem(BaseModel):
    feature: str   # ai_recipe | meal_plan | ai_video
    period: str    # daily | monthly
    limit_value: _Opt[int] = None  # None = unlimited


class PackageLimitsUpdate(BaseModel):
    limits: _List[FeatureLimitItem]


def _fmt_pkg(row: dict) -> dict:
    row = dict(row)
    row["created_at"] = str(row["created_at"])
    row["updated_at"] = str(row["updated_at"])
    row["price_monthly"] = float(row["price_monthly"])
    row["price_yearly"] = float(row["price_yearly"])
    return row


@router.get("/packages")
def admin_list_packages(request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM subscription_package ORDER BY sort_order, name")
            pkgs = [_fmt_pkg(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM package_feature_limit ORDER BY package_id, feature, period")
            limits = [dict(r) for r in cur.fetchall()]
    # Attach limits to packages
    limits_by_pkg: dict = {}
    for lim in limits:
        pid = lim["package_id"]
        if pid not in limits_by_pkg:
            limits_by_pkg[pid] = []
        limits_by_pkg[pid].append({
            "id": lim["id"],
            "feature": lim["feature"],
            "period": lim["period"],
            "limit_value": lim["limit_value"],
        })
    for pkg in pkgs:
        pkg["limits"] = limits_by_pkg.get(pkg["id"], [])
    return pkgs


@router.post("/packages")
def admin_create_package(request: Request, body: PackageBody):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    name = body.name.strip().lower().replace(" ", "_")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO subscription_package
                   (name,display_name,description,price_monthly,price_yearly,is_active,sort_order)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (name, body.display_name.strip(), body.description.strip(),
                 body.price_monthly, body.price_yearly, body.is_active, body.sort_order),
            )
            row = _fmt_pkg(cur.fetchone())
            conn.commit()
    row["limits"] = []
    return row


@router.put("/packages/{package_id}")
def admin_update_package(package_id: int, request: Request, body: PackageBody):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE subscription_package
                   SET display_name=%s,description=%s,price_monthly=%s,price_yearly=%s,
                       is_active=%s,sort_order=%s,updated_at=NOW()
                   WHERE id=%s RETURNING *""",
                (body.display_name.strip(), body.description.strip(),
                 body.price_monthly, body.price_yearly, body.is_active,
                 body.sort_order, package_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Package not found")
            row = _fmt_pkg(row)
            conn.commit()
    return row


@router.delete("/packages/{package_id}")
def admin_delete_package(package_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM subscription_package WHERE id = %s", (package_id,))
            conn.commit()
    return {"status": "ok"}


@router.put("/packages/{package_id}/limits")
def admin_update_package_limits(package_id: int, request: Request, body: PackageLimitsUpdate):
    """Upsert all feature limits for a package (replaces existing set)."""
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    valid_features = {"ai_recipe", "meal_plan", "ai_video"}
    valid_periods  = {"daily", "monthly"}
    for item in body.limits:
        if item.feature not in valid_features:
            raise HTTPException(status_code=422, detail=f"Invalid feature: {item.feature}")
        if item.period not in valid_periods:
            raise HTTPException(status_code=422, detail=f"Invalid period: {item.period}")
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Verify package exists
            cur.execute("SELECT id FROM subscription_package WHERE id = %s", (package_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Package not found")
            # Replace all limits: delete existing then insert fresh
            cur.execute("DELETE FROM package_feature_limit WHERE package_id = %s", (package_id,))
            for item in body.limits:
                cur.execute(
                    """INSERT INTO package_feature_limit (package_id,feature,period,limit_value)
                       VALUES (%s,%s,%s,%s)""",
                    (package_id, item.feature, item.period, item.limit_value),
                )
            conn.commit()
            # Return updated limits
            cur.execute(
                "SELECT * FROM package_feature_limit WHERE package_id=%s ORDER BY feature,period",
                (package_id,),
            )
            limits = [{"id": r["id"], "feature": r["feature"], "period": r["period"],
                       "limit_value": r["limit_value"]} for r in cur.fetchall()]
    return {"status": "ok", "limits": limits}


@router.get("/packages/{package_id}/limits")
def admin_get_package_limits(package_id: int, request: Request):
    uid = _get_user_id_from_request(request)
    if not uid or not _ensure_admin(uid):
        raise HTTPException(status_code=403, detail="Admin required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM package_feature_limit WHERE package_id=%s ORDER BY feature,period",
                (package_id,),
            )
            limits = [{"id": r["id"], "feature": r["feature"], "period": r["period"],
                       "limit_value": r["limit_value"]} for r in cur.fetchall()]
    return limits

