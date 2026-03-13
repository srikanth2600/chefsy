from app.core.db import get_connection
from typing import Optional, Dict, List, Tuple
import json


def create_chef_profile(
    user_id: int,
    slug: str,
    designation: Optional[str] = None,
    cuisine_speciality: Optional[str] = None,
    cuisine_tags: Optional[list] = None,
    experience_years: Optional[int] = None,
    location: Optional[str] = None,
    bio: Optional[str] = None,
) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chef_profile
                  (user_id, slug, designation, cuisine_speciality, cuisine_tags,
                   experience_years, location, bio)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                  slug = EXCLUDED.slug,
                  updated_at = NOW()
                RETURNING id
                """,
                (
                    user_id, slug, designation, cuisine_speciality,
                    json.dumps(cuisine_tags or []),
                    experience_years, location, bio,
                ),
            )
            chef_id = cur.fetchone()["id"]
            conn.commit()
            return chef_id


def get_by_slug(slug: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cp.*, u.full_name AS name,
                  (SELECT COUNT(*) FROM recipe_master rm WHERE rm.chef_id = cp.id) AS recipe_count
                FROM chef_profile cp
                JOIN users u ON u.id = cp.user_id
                WHERE cp.slug = %s
                """,
                (slug,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_by_user_id(user_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cp.*, u.full_name AS name, u.email, u.phone,
                  (SELECT COUNT(*) FROM recipe_master rm WHERE rm.chef_id = cp.id) AS recipe_count
                FROM chef_profile cp
                JOIN users u ON u.id = cp.user_id
                WHERE cp.user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def get_by_id(chef_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cp.*, u.full_name AS name, u.email, u.phone,
                  (SELECT COUNT(*) FROM recipe_master rm WHERE rm.chef_id = cp.id) AS recipe_count
                FROM chef_profile cp
                JOIN users u ON u.id = cp.user_id
                WHERE cp.id = %s
                """,
                (chef_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def update_profile(user_id: int, fields: Dict) -> None:
    if not fields:
        return
    set_clauses = []
    values = []
    for col, val in fields.items():
        set_clauses.append(f"{col} = %s")
        if isinstance(val, (list, dict)):
            values.append(json.dumps(val))
        else:
            values.append(val)
    set_clauses.append("updated_at = NOW()")
    values.append(user_id)
    sql = f"UPDATE chef_profile SET {', '.join(set_clauses)} WHERE user_id = %s"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, values)
            conn.commit()


def list_chefs(
    q: Optional[str] = None,
    featured: Optional[bool] = None,
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[Dict], int]:
    conditions = ["cp.is_active = TRUE"]
    params: list = []

    if q:
        conditions.append(
            "(u.full_name ILIKE %s OR cp.cuisine_speciality ILIKE %s OR cp.location ILIKE %s)"
        )
        like = f"%{q}%"
        params += [like, like, like]
    if featured is True:
        conditions.append("cp.is_featured = TRUE")
    if location:
        conditions.append("cp.location ILIKE %s")
        params.append(f"%{location}%")
    if cuisine:
        conditions.append("cp.cuisine_speciality ILIKE %s")
        params.append(f"%{cuisine}%")

    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*) AS cnt FROM chef_profile cp
                JOIN users u ON u.id = cp.user_id
                WHERE {where}
                """,
                params,
            )
            total = cur.fetchone()["cnt"]

            cur.execute(
                f"""
                SELECT cp.id, cp.slug, u.full_name AS name, cp.designation,
                  cp.cuisine_speciality, cp.location, cp.avatar_color, cp.avatar_url,
                  cp.is_verified, cp.is_featured, cp.plan, cp.rating, cp.review_count,
                  (SELECT COUNT(*) FROM recipe_master rm WHERE rm.chef_id = cp.id) AS recipe_count
                FROM chef_profile cp
                JOIN users u ON u.id = cp.user_id
                WHERE {where}
                ORDER BY cp.is_featured DESC, cp.rating DESC NULLS LAST, cp.follower_count DESC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, offset],
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows], total


def slug_exists(slug: str) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM chef_profile WHERE slug = %s", (slug,))
            return cur.fetchone() is not None


def increment_profile_views(chef_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chef_profile SET profile_views = profile_views + 1 WHERE id = %s",
                (chef_id,),
            )
            conn.commit()


def follow(chef_id: int, follower_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chef_follower (chef_id, follower_id)
                VALUES (%s, %s)
                ON CONFLICT (chef_id, follower_id) DO NOTHING
                """,
                (chef_id, follower_id),
            )
            cur.execute(
                "UPDATE chef_profile SET follower_count = (SELECT COUNT(*) FROM chef_follower WHERE chef_id = %s) WHERE id = %s",
                (chef_id, chef_id),
            )
            conn.commit()


def unfollow(chef_id: int, follower_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM chef_follower WHERE chef_id = %s AND follower_id = %s",
                (chef_id, follower_id),
            )
            cur.execute(
                "UPDATE chef_profile SET follower_count = (SELECT COUNT(*) FROM chef_follower WHERE chef_id = %s) WHERE id = %s",
                (chef_id, chef_id),
            )
            conn.commit()


def is_following(chef_id: int, follower_id: int) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM chef_follower WHERE chef_id = %s AND follower_id = %s",
                (chef_id, follower_id),
            )
            return cur.fetchone() is not None


def get_follower_count(chef_id: int) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT follower_count FROM chef_profile WHERE id = %s", (chef_id,)
            )
            row = cur.fetchone()
            return row["follower_count"] if row else 0


def create_review(chef_id: int, user_id: int, rating: int, comment: Optional[str]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chef_review (chef_id, user_id, rating, comment)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (chef_id, user_id) DO UPDATE SET
                  rating = EXCLUDED.rating,
                  comment = EXCLUDED.comment
                """,
                (chef_id, user_id, rating, comment),
            )
            conn.commit()


def get_reviews(chef_id: int, limit: int = 20) -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cr.id, cr.chef_id, cr.user_id, u.full_name AS reviewer_name,
                  cr.rating, cr.comment, cr.created_at
                FROM chef_review cr
                JOIN users u ON u.id = cr.user_id
                WHERE cr.chef_id = %s
                ORDER BY cr.created_at DESC
                LIMIT %s
                """,
                (chef_id, limit),
            )
            return [dict(r) for r in cur.fetchall()]


def recalc_rating(chef_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE chef_profile SET
                  rating = (SELECT ROUND(AVG(rating)::numeric, 2) FROM chef_review WHERE chef_id = %s),
                  review_count = (SELECT COUNT(*) FROM chef_review WHERE chef_id = %s)
                WHERE id = %s
                """,
                (chef_id, chef_id, chef_id),
            )
            conn.commit()


def get_chef_recipes(chef_id: int, page: int = 1, per_page: int = 20) -> Tuple[List[Dict], int]:
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM recipe_master WHERE chef_id = %s", (chef_id,)
            )
            total = cur.fetchone()["cnt"]
            cur.execute(
                """
                SELECT id, recipe_key, title, cuisine, created_at,
                  (SELECT COUNT(*) FROM likes WHERE recipe_id = id) AS like_count
                FROM recipe_master
                WHERE chef_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (chef_id, per_page, offset),
            )
            return [dict(r) for r in cur.fetchall()], total


def get_analytics(chef_id: int, user_id: int) -> Dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT profile_views, follower_count, review_count, rating FROM chef_profile WHERE id = %s",
                (chef_id,),
            )
            base = cur.fetchone() or {}

            cur.execute(
                "SELECT COUNT(*) AS cnt FROM recipe_master WHERE chef_id = %s", (chef_id,)
            )
            recipe_count = cur.fetchone()["cnt"]

            cur.execute(
                """
                SELECT COALESCE(SUM(l.cnt), 0) AS total_likes
                FROM recipe_master rm
                LEFT JOIN (
                  SELECT recipe_id, COUNT(*) AS cnt FROM likes GROUP BY recipe_id
                ) l ON l.recipe_id = rm.id
                WHERE rm.chef_id = %s
                """,
                (chef_id,),
            )
            total_likes = cur.fetchone()["total_likes"]

            cur.execute(
                "SELECT COUNT(*) AS cnt FROM videos WHERE user_id = %s AND status = 'approved'",
                (user_id,),
            )
            video_count = cur.fetchone()["cnt"]

            return {
                "profile_views": base.get("profile_views", 0),
                "total_recipe_views": 0,
                "total_likes": int(total_likes),
                "total_recipes": int(recipe_count),
                "total_videos": int(video_count),
                "follower_count": base.get("follower_count", 0),
                "review_count": base.get("review_count", 0),
                "rating": float(base["rating"]) if base.get("rating") else None,
            }


# ─── Admin repo functions ─────────────────────────────────────────────────────

def admin_list_chefs(
    q: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 15,
) -> Tuple[List[Dict], int]:
    conditions = ["u.user_type IN ('Chef', 'Restaurant/Foodcourt')"]
    params: list = []

    if q:
        like = f"%{q}%"
        conditions.append(
            "(u.full_name ILIKE %s OR u.email ILIKE %s OR cp.location ILIKE %s OR cp.cuisine_speciality ILIKE %s)"
        )
        params += [like, like, like, like]
    if status == "verified":
        conditions.append("cp.is_verified = TRUE")
    elif status == "featured":
        conditions.append("cp.is_featured = TRUE")
    elif status == "suspended":
        conditions.append("cp.is_active = FALSE")

    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*) AS cnt
                FROM users u
                LEFT JOIN chef_profile cp ON cp.user_id = u.id
                WHERE {where}
                """,
                params,
            )
            total = cur.fetchone()["cnt"]

            cur.execute(
                f"""
                SELECT cp.id, u.full_name, u.email, u.phone, cp.designation,
                  cp.cuisine_speciality, cp.experience_years, cp.location, cp.bio,
                  cp.is_verified, cp.is_featured, cp.is_active,
                  cp.rating, cp.review_count, cp.created_at,
                  (SELECT COUNT(*) FROM recipe_master rm WHERE rm.chef_id = cp.id) AS recipe_count
                FROM users u
                LEFT JOIN chef_profile cp ON cp.user_id = u.id
                WHERE {where}
                ORDER BY cp.is_verified DESC, u.full_name ASC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, offset],
            )
            return [dict(r) for r in cur.fetchall()], total


def toggle_verified(chef_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chef_profile SET is_verified = NOT is_verified, updated_at = NOW() WHERE id = %s",
                (chef_id,),
            )
            conn.commit()


def toggle_featured(chef_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chef_profile SET is_featured = NOT is_featured, updated_at = NOW() WHERE id = %s",
                (chef_id,),
            )
            conn.commit()


def toggle_active(chef_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE chef_profile SET is_active = NOT is_active, updated_at = NOW() WHERE id = %s",
                (chef_id,),
            )
            conn.commit()


def delete_chef(chef_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chef_profile WHERE id = %s", (chef_id,))
            conn.commit()


# ─── Chef Roles ───────────────────────────────────────────────────────────────

def get_all_roles() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, description, created_at FROM chef_roles ORDER BY name ASC")
            return [dict(r) for r in cur.fetchall()]


def get_role_by_id(role_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, description, created_at FROM chef_roles WHERE id = %s", (role_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def create_role(name: str, description: Optional[str] = None) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chef_roles (name, description) VALUES (%s, %s) RETURNING id",
                (name, description),
            )
            role_id = cur.fetchone()["id"]
            conn.commit()
            return role_id


def update_role(role_id: int, name: Optional[str], description: Optional[str]) -> None:
    fields = {}
    if name is not None:
        fields["name"] = name
    if description is not None:
        fields["description"] = description
    if not fields:
        return
    set_clauses = [f"{k} = %s" for k in fields]
    set_clauses.append("updated_at = NOW()")
    sql = f"UPDATE chef_roles SET {', '.join(set_clauses)} WHERE id = %s"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, list(fields.values()) + [role_id])
            conn.commit()


def delete_role(role_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chef_roles WHERE id = %s", (role_id,))
            conn.commit()


def assign_chef_roles(chef_id: int, role_ids: List[int]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chef_role_mapping WHERE chef_id = %s", (chef_id,))
            for rid in role_ids:
                cur.execute(
                    "INSERT INTO chef_role_mapping (chef_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (chef_id, rid),
                )
            conn.commit()


def get_chef_roles(chef_id: int) -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cr.id, cr.name, cr.description, cr.created_at
                FROM chef_role_mapping crm
                JOIN chef_roles cr ON cr.id = crm.role_id
                WHERE crm.chef_id = %s
                ORDER BY cr.name ASC
                """,
                (chef_id,),
            )
            return [dict(r) for r in cur.fetchall()]


# ─── Categories ───────────────────────────────────────────────────────────────

def get_all_categories() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, slug, parent_id, level, created_at FROM categories ORDER BY level ASC, name ASC"
            )
            return [dict(r) for r in cur.fetchall()]


def get_category_tree() -> List[Dict]:
    rows = get_all_categories()
    by_id = {r["id"]: {**r, "children": []} for r in rows}
    roots = []
    for r in rows:
        if r["parent_id"] is None:
            roots.append(by_id[r["id"]])
        elif r["parent_id"] in by_id:
            by_id[r["parent_id"]]["children"].append(by_id[r["id"]])
    return roots


def get_category_by_id(category_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, slug, parent_id, level, created_at FROM categories WHERE id = %s",
                (category_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def create_category(name: str, slug: str, parent_id: Optional[int] = None) -> int:
    level = 1
    if parent_id is not None:
        parent = get_category_by_id(parent_id)
        if parent:
            level = parent["level"] + 1
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO categories (name, slug, parent_id, level) VALUES (%s, %s, %s, %s) RETURNING id",
                (name, slug, parent_id, level),
            )
            cat_id = cur.fetchone()["id"]
            conn.commit()
            return cat_id


def update_category(category_id: int, name: Optional[str], slug: Optional[str]) -> None:
    fields = {}
    if name is not None:
        fields["name"] = name
    if slug is not None:
        fields["slug"] = slug
    if not fields:
        return
    set_clauses = [f"{k} = %s" for k in fields]
    set_clauses.append("updated_at = NOW()")
    sql = f"UPDATE categories SET {', '.join(set_clauses)} WHERE id = %s"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, list(fields.values()) + [category_id])
            conn.commit()


def delete_category(category_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM categories WHERE id = %s", (category_id,))
            conn.commit()


def get_chef_categories(chef_id: int) -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.parent_id, c.level
                FROM chef_category_mapping ccm
                JOIN categories c ON c.id = ccm.category_id
                WHERE ccm.chef_id = %s
                ORDER BY c.level ASC, c.name ASC
                """,
                (chef_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def assign_chef_categories(chef_id: int, category_ids: List[int]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chef_category_mapping WHERE chef_id = %s", (chef_id,))
            for cid in category_ids:
                cur.execute(
                    "INSERT INTO chef_category_mapping (chef_id, category_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (chef_id, cid),
                )
            conn.commit()


def get_recipe_categories(recipe_id: int) -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.name, c.slug, c.parent_id, c.level
                FROM recipe_category_map rcm
                JOIN categories c ON c.id = rcm.category_id
                WHERE rcm.recipe_id = %s
                ORDER BY c.level ASC, c.name ASC
                """,
                (recipe_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def set_recipe_categories(recipe_id: int, category_ids: List[int]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM recipe_category_map WHERE recipe_id = %s", (recipe_id,))
            for cid in category_ids:
                cur.execute(
                    "INSERT INTO recipe_category_map (recipe_id, category_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (recipe_id, cid),
                )
            conn.commit()


# ─── Chef Reels ───────────────────────────────────────────────────────────────

def _detect_platform(url: str) -> str:
    u = url.lower()
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "facebook.com" in u or "fb.watch" in u:
        return "facebook"
    if "instagram.com" in u:
        return "instagram"
    if "vimeo.com" in u:
        return "vimeo"
    if u.endswith(".mp4") or u.endswith(".webm") or u.endswith(".mov"):
        return "direct"
    return "other"


def create_reel(
    chef_id: int,
    title: str,
    description: Optional[str],
    hashtags: list,
    video_url: Optional[str],
    video_file_path: Optional[str],
    platform: Optional[str],
) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chef_reels (chef_id, title, description, hashtags, video_url, video_file_path, platform)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (chef_id, title, description, json.dumps(hashtags), video_url, video_file_path, platform),
            )
            reel_id = cur.fetchone()["id"]
            conn.commit()
            return reel_id


def get_reels_by_chef(chef_id: int, page: int = 1, per_page: int = 20) -> Tuple[List[Dict], int]:
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM chef_reels WHERE chef_id = %s", (chef_id,))
            total = cur.fetchone()["cnt"]
            cur.execute(
                """
                SELECT id, chef_id, title, description, hashtags, video_url, video_file_path,
                       platform, thumbnail, status, view_count, created_at
                FROM chef_reels WHERE chef_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (chef_id, per_page, offset),
            )
            return [dict(r) for r in cur.fetchall()], total


def get_reel_by_id(reel_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, chef_id, title, description, hashtags, video_url, video_file_path,
                       platform, thumbnail, status, view_count, created_at
                FROM chef_reels WHERE id = %s
                """,
                (reel_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def update_reel(reel_id: int, fields: Dict) -> None:
    if not fields:
        return
    set_clauses = []
    values = []
    for col, val in fields.items():
        set_clauses.append(f"{col} = %s")
        if isinstance(val, (list, dict)):
            values.append(json.dumps(val))
        else:
            values.append(val)
    set_clauses.append("updated_at = NOW()")
    values.append(reel_id)
    sql = f"UPDATE chef_reels SET {', '.join(set_clauses)} WHERE id = %s"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, values)
            conn.commit()


def delete_reel(reel_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chef_reels WHERE id = %s", (reel_id,))
            conn.commit()


def admin_list_reels(
    q: Optional[str] = None,
    chef_id: Optional[int] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Tuple[List[Dict], int]:
    conditions: list = []
    params: list = []
    if q:
        conditions.append("(cr.title ILIKE %s OR cr.description ILIKE %s)")
        like = f"%{q}%"
        params += [like, like]
    if chef_id:
        conditions.append("cr.chef_id = %s")
        params.append(chef_id)
    if status:
        conditions.append("cr.status = %s")
        params.append(status)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS cnt FROM chef_reels cr {where}", params)
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"""
                SELECT cr.id, cr.chef_id, cr.title, cr.description, cr.hashtags,
                       cr.video_url, cr.video_file_path, cr.platform, cr.thumbnail,
                       cr.status, cr.view_count, cr.created_at,
                       u.full_name AS chef_name, cp.slug AS chef_slug
                FROM chef_reels cr
                JOIN chef_profile cp ON cp.id = cr.chef_id
                JOIN users u ON u.id = cp.user_id
                {where}
                ORDER BY cr.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, offset],
            )
            return [dict(r) for r in cur.fetchall()], total
