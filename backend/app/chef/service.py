from typing import Optional, Dict
from app.chef import repository
from app.chef.schema import (
    ChefProfileCreate, ChefProfileUpdate,
    ChefPublicOut, ChefListItem, ChefFollowOut,
    ChefAnalyticsOut, ChefPlanUsageOut,
)
from app.core.packages import get_package_limits

# Hard-coded fallbacks (used when DB package tables are unavailable)
_PLAN_LIMITS_FALLBACK = {
    "free": {"recipes": 3, "videos": 1},
    "pro":  {"recipes": 25, "videos": 10},
}


def create_profile(user_id: int, data: ChefProfileCreate) -> int:
    if repository.slug_exists(data.slug):
        raise ValueError(f"Profile name '{data.slug}' is already taken")
    return repository.create_chef_profile(
        user_id=user_id,
        slug=data.slug,
        designation=data.designation,
        cuisine_speciality=data.cuisine_speciality,
        cuisine_tags=data.cuisine_tags,
        experience_years=data.experience_years,
        location=data.location,
        bio=data.bio,
    )


def get_public_profile(slug: str) -> Optional[Dict]:
    row = repository.get_by_slug(slug)
    if not row:
        return None
    repository.increment_profile_views(row["id"])
    row["recipe_count"] = int(row.get("recipe_count", 0))
    row["name"] = row.get("name") or ""
    row["cuisine_tags"] = row.get("cuisine_tags") or []
    row["rating"] = float(row["rating"]) if row.get("rating") else None
    row["created_at"] = str(row["created_at"])
    return row


def get_my_profile(user_id: int) -> Optional[Dict]:
    row = repository.get_by_user_id(user_id)
    if not row:
        return None
    row["recipe_count"] = int(row.get("recipe_count", 0))
    row["name"] = row.get("name") or ""
    row["cuisine_tags"] = row.get("cuisine_tags") or []
    row["rating"] = float(row["rating"]) if row.get("rating") else None
    row["created_at"] = str(row["created_at"])
    return row


def update_profile(user_id: int, data: ChefProfileUpdate) -> None:
    fields = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    repository.update_profile(user_id, fields)


def list_chefs(
    q: Optional[str] = None,
    featured: Optional[bool] = None,
    location: Optional[str] = None,
    cuisine: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict:
    rows, total = repository.list_chefs(q, featured, location, cuisine, page, per_page)
    chefs = []
    for r in rows:
        r["recipe_count"] = int(r.get("recipe_count", 0))
        r["rating"] = float(r["rating"]) if r.get("rating") else None
        r["name"] = r.get("name") or ""
        chefs.append(r)
    return {"chefs": chefs, "total": total, "page": page, "per_page": per_page}


def follow_toggle(chef_slug: str, follower_user_id: int) -> ChefFollowOut:
    chef = repository.get_by_slug(chef_slug)
    if not chef:
        raise ValueError("Chef not found")
    if chef["user_id"] == follower_user_id:
        raise ValueError("Cannot follow yourself")
    chef_id = chef["id"]
    if repository.is_following(chef_id, follower_user_id):
        repository.unfollow(chef_id, follower_user_id)
        following = False
    else:
        repository.follow(chef_id, follower_user_id)
        following = True
    return ChefFollowOut(
        following=following,
        follower_count=repository.get_follower_count(chef_id),
    )


def add_review(chef_slug: str, user_id: int, rating: int, comment: Optional[str]) -> None:
    chef = repository.get_by_slug(chef_slug)
    if not chef:
        raise ValueError("Chef not found")
    if chef["user_id"] == user_id:
        raise ValueError("Cannot review yourself")
    repository.create_review(chef["id"], user_id, rating, comment)
    repository.recalc_rating(chef["id"])


def get_analytics(user_id: int) -> Optional[ChefAnalyticsOut]:
    chef = repository.get_by_user_id(user_id)
    if not chef:
        return None
    data = repository.get_analytics(chef["id"], user_id)
    return ChefAnalyticsOut(**data)


def get_plan_usage(user_id: int) -> Optional[ChefPlanUsageOut]:
    chef = repository.get_by_user_id(user_id)
    if not chef:
        return None
    plan = chef.get("plan", "free")

    # Fetch limits from DB packages; fall back to hard-coded values
    pkg_limits = get_package_limits(plan)
    fallback = _PLAN_LIMITS_FALLBACK.get(plan, _PLAN_LIMITS_FALLBACK["free"])

    # monthly recipe limit (None = unlimited represented as -1 for display)
    recipe_monthly = pkg_limits.get("ai_recipe", {}).get("monthly")
    recipes_limit = recipe_monthly if recipe_monthly is not None else fallback["recipes"]
    if recipes_limit is None:
        recipes_limit = 9999  # unlimited sentinel

    video_monthly = pkg_limits.get("ai_video", {}).get("monthly")
    videos_limit = video_monthly if video_monthly is not None else fallback["videos"]
    if videos_limit is None:
        videos_limit = 9999  # unlimited sentinel

    from app.core.db import get_connection
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM recipe_master WHERE chef_id = %s", (chef["id"],)
            )
            recipes_used = int(cur.fetchone()["cnt"])
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM videos WHERE user_id = %s AND status IN ('approved','pending')",
                (user_id,),
            )
            videos_used = int(cur.fetchone()["cnt"])

    return ChefPlanUsageOut(
        plan=plan,
        recipes_used=recipes_used,
        recipes_limit=recipes_limit,
        videos_used=videos_used,
        videos_limit=videos_limit,
        can_add_recipe=recipes_used < recipes_limit,
        can_add_video=videos_used < videos_limit,
    )
