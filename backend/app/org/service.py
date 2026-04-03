"""
Core Org service — shared across all org types.
Type-specific logic lives in org/corporate/, org/gym/, org/nutrition/.
"""
from fastapi import HTTPException

from app.org import repository
from app.org.modules import require_module_active


# ─── Internal helpers ────────────────────────────────────────────────────────

def _require_org_admin(admin_user_id: int) -> dict:
    """Return the org or raise 404. Also guards against suspended orgs."""
    org = repository.get_org_by_admin(admin_user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    if not org["is_active"]:
        raise HTTPException(status_code=403, detail="Your organisation account is suspended.")
    return org


def _require_org_type(org: dict, expected_type: str) -> None:
    if org["org_type"] != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"This endpoint is only available for {expected_type} organisations.",
        )


# ─── Org Registration ────────────────────────────────────────────────────────

def register_org(admin_user_id: int, data: dict) -> dict:
    """
    Register a new organisation for the given admin user.
    Validates:
      1. The org type module is enabled on the platform (admin panel toggle).
      2. The user doesn't already own an org profile.
    """
    require_module_active(data["org_type"])

    existing = repository.get_org_by_admin(admin_user_id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an organisation registered. Contact support to create another.",
        )

    org_id = repository.create_org_profile(admin_user_id, data)
    return {"id": org_id, "status": "created"}


def get_my_org(admin_user_id: int) -> dict:
    org = repository.get_org_by_admin(admin_user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")
    return org


async def update_my_org(admin_user_id: int, fields: dict) -> None:
    org = repository.get_org_by_admin(admin_user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found.")

    _ADDRESS_FIELDS = {"address_line1", "address_line2", "city", "postcode", "country"}
    if _ADDRESS_FIELDS & fields.keys():
        from app.utils.geocoding import geocode_address
        # Merge incoming address with existing stored values so partial updates still geocode
        merged = {
            "address_line1": fields.get("address_line1") or org.get("address_line1"),
            "address_line2": fields.get("address_line2") or org.get("address_line2"),
            "city":          fields.get("city")          or org.get("city"),
            "postcode":      fields.get("postcode")      or org.get("postcode"),
            "country":       fields.get("country")       or org.get("country"),
        }
        coords = await geocode_address(**merged)
        if coords:
            fields["latitude"], fields["longitude"] = coords

    repository.update_org_profile(org["id"], fields)


# ─── Member Management ───────────────────────────────────────────────────────

def invite_member(admin_user_id: int, member_data: dict) -> dict:
    org = _require_org_admin(admin_user_id)
    require_module_active(org["org_type"])
    result = repository.create_member_invite(org["id"], member_data)
    return {"id": result["id"], "invite_token": result["invite_token"], "status": "invited"}


def list_members(
    admin_user_id: int,
    page: int,
    per_page: int,
    status=None,
) -> dict:
    org = _require_org_admin(admin_user_id)
    require_module_active(org["org_type"])
    return repository.list_members(org["id"], page, per_page, status)


def update_member(admin_user_id: int, member_id: int, fields: dict) -> None:
    org = _require_org_admin(admin_user_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    repository.update_member(member_id, fields)


def remove_member(admin_user_id: int, member_id: int) -> None:
    org = _require_org_admin(admin_user_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    repository.remove_member(member_id)


# ─── Group Management ────────────────────────────────────────────────────────

def create_group(admin_user_id: int, group_data: dict) -> dict:
    org = _require_org_admin(admin_user_id)
    require_module_active(org["org_type"])
    group_id = repository.create_group(org["id"], group_data)
    return {"id": group_id, "status": "created"}


def list_groups(admin_user_id: int) -> list:
    org = _require_org_admin(admin_user_id)
    require_module_active(org["org_type"])
    return repository.list_groups(org["id"])


def _require_group_owner(admin_user_id: int, group_id: int) -> tuple:
    org = _require_org_admin(admin_user_id)
    group = repository.get_group_by_id(group_id)
    if not group or group["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Group not found.")
    return org, group


def update_group(admin_user_id: int, group_id: int, fields: dict) -> None:
    _require_group_owner(admin_user_id, group_id)
    repository.update_group(group_id, fields)


def add_member_to_group(admin_user_id: int, group_id: int, member_id: int) -> None:
    org, _ = _require_group_owner(admin_user_id, group_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    repository.add_member_to_group(group_id, member_id, admin_user_id)


def remove_member_from_group(admin_user_id: int, group_id: int, member_id: int) -> None:
    _require_group_owner(admin_user_id, group_id)
    repository.remove_member_from_group(group_id, member_id)


def list_group_members(admin_user_id: int, group_id: int) -> list:
    _require_group_owner(admin_user_id, group_id)
    return repository.list_group_members(group_id)


# ─── Member profile (health summary — no compliance/clinical data) ───────────

def get_member_profile(admin_user_id: int, member_id: int) -> dict:
    org = _require_org_admin(admin_user_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    return {
        "id": member["id"],
        "email": member["email"],
        "full_name": member["full_name"],
        "phone": member["phone"],
        "status": member["status"],
        "member_meta": member["member_meta"],
        "joined_at": member["joined_at"],
        "created_at": member["created_at"],
    }


# ─── Group Management — delete ────────────────────────────────────────────────

def delete_group(admin_user_id: int, group_id: int) -> None:
    _require_group_owner(admin_user_id, group_id)
    repository.delete_group(group_id)


# ─── Staff ───────────────────────────────────────────────────────────────────

def list_staff(admin_user_id: int) -> list:
    org = _require_org_admin(admin_user_id)
    return repository.list_staff(org["id"])


def invite_staff(admin_user_id: int, staff_data: dict) -> dict:
    org = _require_org_admin(admin_user_id)
    staff_user = repository.get_user_by_email(staff_data["email"])
    if not staff_user:
        raise HTTPException(
            status_code=404,
            detail="No user found with that email. They must register on Chefsy first.",
        )
    staff_id = repository.create_staff(
        org["id"],
        staff_user["id"],
        staff_data["role"],
        staff_data.get("permissions") or {},
    )
    return {"id": staff_id, "status": "invited"}


def update_staff(admin_user_id: int, staff_id: int, fields: dict) -> None:
    org = _require_org_admin(admin_user_id)
    staff = repository.get_staff_by_id(staff_id)
    if not staff or staff["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    repository.update_staff(staff_id, fields)


def remove_staff(admin_user_id: int, staff_id: int) -> None:
    org = _require_org_admin(admin_user_id)
    staff = repository.get_staff_by_id(staff_id)
    if not staff or staff["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    repository.remove_staff(staff_id)


# ─── Multi-Org Membership (end user view) ────────────────────────────────────

def get_user_memberships(user_id: int) -> list:
    return repository.get_user_memberships(user_id)
