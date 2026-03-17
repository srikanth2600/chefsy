"""
Package/subscription utilities.

Provides DB-backed per-feature limit lookup for packages (free, pro, etc.).
Falls back to hard-coded defaults if the DB is unavailable.
"""
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Hard-coded fallbacks (mirrors the seed data in db.py)
_FALLBACK: Dict[str, Dict[str, Dict[str, Optional[int]]]] = {
    "free": {
        "ai_recipe": {"daily": 3,    "monthly": 10},
        "meal_plan": {"monthly": 0},          # 0 = blocked
        "ai_video":  {"daily": 1,    "monthly": 3},
    },
    "pro": {
        "ai_recipe": {"daily": 25,   "monthly": None},  # None = unlimited
        "meal_plan": {"monthly": None},
        "ai_video":  {"daily": 10,   "monthly": None},
    },
}


def get_package_limits(plan_name: str) -> Dict[str, Dict[str, Optional[int]]]:
    """Return {feature: {period: limit_value}} for a package name.
    limit_value = None means unlimited; 0 means blocked."""
    try:
        from app.core.db import get_connection
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT pfl.feature, pfl.period, pfl.limit_value
                    FROM package_feature_limit pfl
                    JOIN subscription_package sp ON sp.id = pfl.package_id
                    WHERE sp.name = %s
                    """,
                    (plan_name,),
                )
                rows = cur.fetchall()
        if not rows:
            return _FALLBACK.get(plan_name, _FALLBACK["free"])
        result: Dict[str, Dict[str, Optional[int]]] = {}
        for row in rows:
            feat = row["feature"]
            if feat not in result:
                result[feat] = {}
            result[feat][row["period"]] = row["limit_value"]
        return result
    except Exception:
        logger.exception("Failed to fetch package limits; using fallback for '%s'", plan_name)
        return _FALLBACK.get(plan_name, _FALLBACK["free"])


def get_feature_limit(plan_name: str, feature: str, period: str) -> Optional[int]:
    """Return limit_value for a specific feature/period. None = unlimited."""
    return get_package_limits(plan_name).get(feature, {}).get(period)


def has_feature_access(plan_name: str, feature: str) -> bool:
    """True if the plan is allowed to use a feature.

    Logic:
    - If any configured limit is None (unlimited) → True
    - If any configured limit is > 0 (counted)   → True
    - If all configured limits are 0 (blocked)    → False
    - If no limits defined at all                 → False
    """
    limits = get_package_limits(plan_name)
    feat_limits = limits.get(feature)
    if not feat_limits:
        return False
    values = list(feat_limits.values())
    if not values:
        return False
    for val in values:
        if val is None or (isinstance(val, int) and val > 0):
            return True
    return False  # every configured limit is 0 → blocked


def get_user_plan(user_id: int) -> str:
    """Return the package name for a user (falls back to 'free')."""
    try:
        from app.core.db import get_connection
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT plan FROM chef_profile WHERE user_id = %s", (user_id,))
                r = cur.fetchone()
                return (r["plan"] or "free") if r and r.get("plan") else "free"
    except Exception:
        return "free"