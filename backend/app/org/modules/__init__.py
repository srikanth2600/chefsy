"""
Platform module guard — checks if an org type is enabled in the admin panel.

Call require_module_active('gym') at the top of any gym-specific service or endpoint.
When a Super Admin disables a module (e.g. 'gym'), all gym routes immediately return 503.
"""
from fastapi import HTTPException
from app.core.db import get_connection


def require_module_active(module_key: str) -> None:
    """Raise HTTP 503 if the platform module has been disabled by a Super Admin."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT is_active, display_name FROM platform_module WHERE module_key = %s",
                (module_key,),
            )
            row = cur.fetchone()
    if not row or not row["is_active"]:
        display = row["display_name"] if row else module_key.title()
        raise HTTPException(
            status_code=503,
            detail=f"The {display} module is currently disabled. Please contact your administrator.",
        )


def require_org_module_active(org: dict, module_key: str) -> None:
    """Raise HTTP 403 if this specific org has not enabled the given module in active_modules."""
    modules = org.get("active_modules") or []
    if module_key not in modules:
        raise HTTPException(
            status_code=403,
            detail=f"The '{module_key}' module is not enabled for your organisation. Contact your Super Admin.",
        )


def get_all_module_status() -> list:
    """Return all platform modules with their active status. Used by admin panel."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT module_key, display_name, description, is_active, updated_at "
                "FROM platform_module ORDER BY module_key"
            )
            return cur.fetchall()
