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
            filters = []
            params = []
            if q:
                like = f"%{q}%"
                filters.append("(title ILIKE %s OR recipe_key ILIKE %s)")
                params.extend([like, like])
            if cuisine:
                filters.append("recipe_json->'meta'->> 'cuisine' ILIKE %s OR (recipe_json->> 'cuisine') ILIKE %s")
                params.extend([f"%{cuisine}%", f"%{cuisine}%"])
            where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""
            # date range filter
            if start_date and end_date:
                where_clause = (where_clause + " AND " if where_clause else "WHERE ") + " (rm.created_at::date BETWEEN %s AND %s)"
                params.extend([start_date, end_date])

            count_sql = f"SELECT COUNT(*) AS cnt FROM recipe_master {where_clause}"
            cur.execute(count_sql, tuple(params))
            total = cur.fetchone()["cnt"]

            allowed_sort = {"created_at", "title", "id", "likes"}
            if sort_by not in allowed_sort:
                sort_by = "created_at"
            if order not in ("asc", "desc"):
                order = "desc"

            select_sql = f"""
                SELECT rm.id, rm.recipe_key, rm.title, rm.servings, rm.created_at, rm.updated_at, rm.recipe_json,
                       COALESCE(rrc.likes, 0) AS likes, COALESCE(rrc.dislikes, 0) AS dislikes
                FROM recipe_master rm
                LEFT JOIN recipe_reaction_count rrc ON rrc.recipe_id = rm.id
                {where_clause}
                ORDER BY {sort_by} {order}
                LIMIT %s OFFSET %s
            """
            cur.execute(select_sql, tuple(params) + (per_page, offset))
            rows = cur.fetchall()
            # map rows to expected shape (include cuisine/difficulty/estimated_time if present)
            results = []
            for r in rows:
                rj = r.get("recipe_json") or {}
                meta = rj.get("meta") or {}
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
                    "owner_name": meta.get("author") or meta.get("creator") or rj.get("author") or None,
                    "generated_by": meta.get("generated_by") or meta.get("provider") or meta.get("llm") or None,
                    "is_featured": False,
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

