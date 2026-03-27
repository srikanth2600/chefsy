from typing import Optional, List
from pydantic import BaseModel, field_validator

_ALLOWED_ORG_TYPES = {"corporate", "gym", "nutrition", "others"}


# ─── Org Registration & Profile ──────────────────────────────────────────────

class OrgRegisterRequest(BaseModel):
    org_name: str
    org_type: str          # 'corporate' | 'gym' | 'nutrition' | 'others'
    official_email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

    @field_validator("org_type")
    @classmethod
    def validate_org_type(cls, v: str) -> str:
        v = v.lower()
        if v not in _ALLOWED_ORG_TYPES:
            raise ValueError(f"org_type must be one of: {', '.join(sorted(_ALLOWED_ORG_TYPES))}")
        return v


class OrgProfileUpdate(BaseModel):
    org_name: Optional[str] = None
    tagline: Optional[str] = None
    phone: Optional[str] = None
    website_url: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    accent_color: Optional[str] = None
    org_rules_json: Optional[dict] = None
    active_modules: Optional[List[str]] = None
    is_public: Optional[bool] = None


# ─── Member Management ───────────────────────────────────────────────────────

class MemberInvite(BaseModel):
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    member_meta: Optional[dict] = None


class MemberBulkInvite(BaseModel):
    members: List[MemberInvite]


class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    member_meta: Optional[dict] = None


# ─── Group Management ────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    group_type: str = "general"
    color: Optional[str] = "#3B82F6"
    icon: Optional[str] = "group"
    meal_plan_type: Optional[str] = "general"
    medical_condition: Optional[str] = None
    plan_cadence: Optional[str] = "weekly"
    auto_publish: Optional[bool] = False
    assigned_staff_id: Optional[int] = None
    group_rules_json: Optional[dict] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group_type: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    meal_plan_type: Optional[str] = None
    medical_condition: Optional[str] = None
    plan_cadence: Optional[str] = None
    auto_publish: Optional[bool] = None
    assigned_staff_id: Optional[int] = None
    group_rules_json: Optional[dict] = None
    is_active: Optional[bool] = None


# ─── Staff Management ────────────────────────────────────────────────────────

class StaffInvite(BaseModel):
    email: str
    role: str             # 'trainer' | 'nutritionist' | 'hr_staff' | 'manager'
    permissions: Optional[dict] = None


class StaffUpdate(BaseModel):
    role: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None
