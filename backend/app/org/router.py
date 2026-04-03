from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query

from app.org import repository, service
from app.org.schema import (
    GroupCreate, GroupUpdate,
    MemberBulkInvite, MemberInvite, MemberUpdate,
    OrgProfileUpdate, OrgRegisterRequest,
    StaffInvite, StaffUpdate,
)

router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


# ─── Org Registration ────────────────────────────────────────────────────────

@router.post("/register")
def register_org(request: Request, body: OrgRegisterRequest):
    """Register a new organisation. One per admin user."""
    user_id = _require_user(request)
    return service.register_org(user_id, body.model_dump())


@router.get("/me")
def get_my_org(request: Request):
    user_id = _require_user(request)
    return service.get_my_org(user_id)


@router.patch("/me")
async def update_my_org(request: Request, body: OrgProfileUpdate):
    user_id = _require_user(request)
    await service.update_my_org(user_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


# ─── Staff ───────────────────────────────────────────────────────────────────

@router.get("/me/staff")
def list_staff(request: Request):
    user_id = _require_user(request)
    return service.list_staff(user_id)


@router.post("/me/staff")
def invite_staff(request: Request, body: StaffInvite):
    user_id = _require_user(request)
    return service.invite_staff(user_id, body.model_dump())


@router.patch("/me/staff/{staff_id}")
def update_staff(staff_id: int, request: Request, body: StaffUpdate):
    user_id = _require_user(request)
    service.update_staff(user_id, staff_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


@router.delete("/me/staff/{staff_id}")
def remove_staff(staff_id: int, request: Request):
    user_id = _require_user(request)
    service.remove_staff(user_id, staff_id)
    return {"status": "ok"}


# ─── Member Management ───────────────────────────────────────────────────────

@router.post("/me/members/invite")
def invite_member(request: Request, body: MemberInvite):
    user_id = _require_user(request)
    return service.invite_member(user_id, body.model_dump())


@router.post("/me/members/bulk-invite")
def bulk_invite(request: Request, body: MemberBulkInvite):
    user_id = _require_user(request)
    results = [service.invite_member(user_id, m.model_dump()) for m in body.members]
    return {"invited": len(results), "results": results}


@router.get("/me/members")
def list_members(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
):
    user_id = _require_user(request)
    return service.list_members(user_id, page, per_page, status)


@router.patch("/me/members/{member_id}")
def update_member(member_id: int, request: Request, body: MemberUpdate):
    user_id = _require_user(request)
    service.update_member(user_id, member_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


@router.delete("/me/members/{member_id}")
def remove_member(member_id: int, request: Request):
    user_id = _require_user(request)
    service.remove_member(user_id, member_id)
    return {"status": "ok"}


@router.get("/me/members/{member_id}")
def get_member_profile(member_id: int, request: Request):
    """Member health summary — no individual compliance logs, no clinical data."""
    user_id = _require_user(request)
    return service.get_member_profile(user_id, member_id)


# ─── Group Management ────────────────────────────────────────────────────────

@router.post("/me/groups")
def create_group(request: Request, body: GroupCreate):
    user_id = _require_user(request)
    return service.create_group(user_id, body.model_dump())


@router.get("/me/groups")
def list_groups(request: Request):
    user_id = _require_user(request)
    return service.list_groups(user_id)


@router.patch("/me/groups/{group_id}")
def update_group(group_id: int, request: Request, body: GroupUpdate):
    user_id = _require_user(request)
    service.update_group(user_id, group_id, body.model_dump(exclude_none=True))
    return {"status": "ok"}


@router.delete("/me/groups/{group_id}")
def delete_group(group_id: int, request: Request):
    user_id = _require_user(request)
    service.delete_group(user_id, group_id)
    return {"status": "ok"}


@router.get("/me/groups/{group_id}/members")
def list_group_members(group_id: int, request: Request):
    user_id = _require_user(request)
    return service.list_group_members(user_id, group_id)


@router.post("/me/groups/{group_id}/members/{member_id}")
def add_to_group(group_id: int, member_id: int, request: Request):
    user_id = _require_user(request)
    service.add_member_to_group(user_id, group_id, member_id)
    return {"status": "ok"}


@router.delete("/me/groups/{group_id}/members/{member_id}")
def remove_from_group(group_id: int, member_id: int, request: Request):
    user_id = _require_user(request)
    service.remove_member_from_group(user_id, group_id, member_id)
    return {"status": "ok"}


# ─── End-User Multi-Org View ─────────────────────────────────────────────────

@router.get("/me/memberships")
def my_memberships(request: Request):
    """Return all organisations the authenticated user belongs to (for /my-orgs switcher)."""
    user_id = _require_user(request)
    return service.get_user_memberships(user_id)


# ─── Magic-link accept invite ────────────────────────────────────────────────

@router.post("/accept-invite/{token}")
def accept_invite(token: str, request: Request):
    """Called when a user clicks their invite link. Links their account to the org."""
    user_id = _require_user(request)
    member = repository.get_member_by_token(token)
    if not member:
        raise HTTPException(status_code=404, detail="Invite not found or already used.")
    if member["status"] not in ("invited", "profile_incomplete"):
        raise HTTPException(status_code=400, detail="This invite has already been accepted.")
    repository.update_member(
        member["id"],
        {"user_id": user_id, "status": "active", "joined_at": "NOW()", "invite_token": None},
    )
    return {"status": "joined", "org_id": member["org_id"]}


# ─── Public org profile ──────────────────────────────────────────────────────

@router.get("/{slug}")
def get_public_org(slug: str):
    """Public-facing org profile (only for is_public=True orgs)."""
    org = repository.get_org_by_slug(slug)
    if not org or not org["is_active"]:
        raise HTTPException(status_code=404, detail="Organisation not found")
    if not org["is_public"]:
        raise HTTPException(status_code=403, detail="This organisation profile is private")
    return {
        "id": org["id"],
        "org_name": org["org_name"],
        "org_type": org["org_type"],
        "slug": org["slug"],
        "tagline": org["tagline"],
        "logo_url": org["logo_url"],
        "banner_url": org["banner_url"],
        "city": org["city"],
        "state": org["state"],
        "member_count": org["member_count"],
        "accent_color": org["accent_color"],
    }
