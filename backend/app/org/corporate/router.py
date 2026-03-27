"""
Corporate org-type specific endpoints.

All endpoints here call require_module_active('corporate') so the entire
Corporate module can be disabled from the admin panel instantly.
"""
import csv
import io
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Query
from pydantic import BaseModel

from app.org.modules import require_module_active
from app.org import repository
from app.core.db import get_connection

MODULE_KEY = "corporate"
router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _require_corporate_org(user_id: int) -> dict:
    require_module_active(MODULE_KEY)
    org = repository.get_org_by_admin(user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Corporate organisation not found")
    if org["org_type"] != MODULE_KEY:
        raise HTTPException(status_code=403, detail="This dashboard is only for Corporate organisations")
    if not org["is_active"]:
        raise HTTPException(status_code=403, detail="Organisation account is suspended")
    return org


def _get_department(group_id: int, org_id: int) -> Optional[dict]:
    group = repository.get_group_by_id(group_id)
    if not group or group["org_id"] != org_id or group.get("group_type") != "department":
        return None
    return group


# ─── Dashboard Overview ──────────────────────────────────────────────────────

@router.get("/dashboard")
def corporate_dashboard(request: Request):
    """Corporate org overview — member count, groups, plan info."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    return {
        "org_id":         org["id"],
        "org_name":       org["org_name"],
        "member_count":   org["member_count"],
        "group_count":    org["group_count"],
        "plan":           org["plan"],
        "is_verified":    org["is_verified"],
        "active_modules": org["active_modules"],
        "org_type":       MODULE_KEY,
    }


# ─── Department Management ───────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    head_name: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    head_name: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/departments")
def create_department(request: Request, body: DepartmentCreate):
    """Create a department (maps to org_group with group_type='department')."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    group_id = repository.create_group(org["id"], {
        "name": body.name,
        "description": body.description,
        "group_type": "department",
        "group_rules_json": {"head_name": body.head_name} if body.head_name else {},
    })
    return {"id": group_id, "status": "created"}


@router.get("/departments")
def list_departments(request: Request):
    """List all departments for this corporate org."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    groups = repository.list_groups(org["id"], active_only=True)
    return [g for g in groups if g.get("group_type") == "department"]


@router.get("/departments/{dept_id}")
def get_department(dept_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    dept = _get_department(dept_id, org["id"])
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")
    members = repository.list_group_members(dept_id)
    return {**dept, "members": members}


@router.patch("/departments/{dept_id}")
def update_department(dept_id: int, request: Request, body: DepartmentUpdate):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    if not _get_department(dept_id, org["id"]):
        raise HTTPException(status_code=404, detail="Department not found.")
    fields = body.model_dump(exclude_none=True)
    if "head_name" in fields:
        # Store head_name inside group_rules_json
        existing = repository.get_group_by_id(dept_id)
        rules = dict(existing.get("group_rules_json") or {})
        rules["head_name"] = fields.pop("head_name")
        fields["group_rules_json"] = rules
    repository.update_group(dept_id, fields)
    return {"status": "ok"}


@router.delete("/departments/{dept_id}")
def delete_department(dept_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    if not _get_department(dept_id, org["id"]):
        raise HTTPException(status_code=404, detail="Department not found.")
    repository.delete_group(dept_id)
    return {"status": "deleted"}


@router.post("/departments/{dept_id}/members/{member_id}")
def add_to_department(dept_id: int, member_id: int, request: Request):
    """Assign a member to a department."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    if not _get_department(dept_id, org["id"]):
        raise HTTPException(status_code=404, detail="Department not found.")
    # Verify member belongs to same org
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    repository.add_member_to_group(dept_id, member_id, user_id)
    return {"status": "ok"}


@router.delete("/departments/{dept_id}/members/{member_id}")
def remove_from_department(dept_id: int, member_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    if not _get_department(dept_id, org["id"]):
        raise HTTPException(status_code=404, detail="Department not found.")
    repository.remove_member_from_group(dept_id, member_id)
    return {"status": "removed"}


# ─── CSV Employee Import ──────────────────────────────────────────────────────

@router.post("/employees/import")
async def import_employees_csv(request: Request, file: UploadFile = File(...)):
    """
    Bulk import employees from CSV.
    Expected columns: email, full_name, phone (optional), department_name (optional)

    Returns a summary of imported, skipped, and failed rows.
    """
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=422, detail="Only CSV files are accepted.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM
        reader = csv.DictReader(io.StringIO(text))
    except Exception:
        raise HTTPException(status_code=422, detail="Could not parse CSV file.")

    required_cols = {"email"}
    if not reader.fieldnames or not required_cols.issubset(set(f.strip() for f in reader.fieldnames)):
        raise HTTPException(status_code=422, detail="CSV must have at least an 'email' column.")

    imported, skipped, failed = 0, 0, []
    dept_cache: dict = {}  # name → group_id

    for i, row in enumerate(reader, start=2):
        email = (row.get("email") or "").strip().lower()
        if not email:
            skipped += 1
            continue
        try:
            invite = repository.create_member_invite(org["id"], {
                "email": email,
                "full_name": (row.get("full_name") or "").strip() or None,
                "phone": (row.get("phone") or "").strip() or None,
            })
            member_id = invite["id"]

            dept_name = (row.get("department_name") or "").strip()
            if dept_name:
                if dept_name not in dept_cache:
                    # look up or create department
                    groups = repository.list_groups(org["id"], active_only=False)
                    existing = next(
                        (g for g in groups
                         if g.get("group_type") == "department" and g["name"] == dept_name),
                        None,
                    )
                    if existing:
                        dept_cache[dept_name] = existing["id"]
                    else:
                        dept_cache[dept_name] = repository.create_group(org["id"], {
                            "name": dept_name,
                            "group_type": "department",
                        })
                repository.add_member_to_group(dept_cache[dept_name], member_id, user_id)

            imported += 1
        except Exception as exc:
            failed.append({"row": i, "email": email, "error": str(exc)})

    return {
        "imported": imported,
        "skipped": skipped,
        "failed_count": len(failed),
        "failures": failed[:20],   # cap at 20 for readability
    }


# ─── Wellness Cohort Management ───────────────────────────────────────────────

class WellnessCohortCreate(BaseModel):
    name: str
    description: Optional[str] = None


@router.get("/wellness-cohorts")
def list_wellness_cohorts(request: Request):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    groups = repository.list_groups(org["id"], active_only=True)
    return [g for g in groups if g.get("group_type") == "wellness_cohort"]


@router.post("/wellness-cohorts")
def create_wellness_cohort(request: Request, body: WellnessCohortCreate):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    group_id = repository.create_group(org["id"], {
        "name": body.name,
        "description": body.description,
        "group_type": "wellness_cohort",
    })
    return {"id": group_id, "status": "created"}


@router.delete("/wellness-cohorts/{cohort_id}")
def delete_wellness_cohort(cohort_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    group = repository.get_group_by_id(cohort_id)
    if not group or group["org_id"] != org["id"] or group.get("group_type") != "wellness_cohort":
        raise HTTPException(status_code=404, detail="Wellness cohort not found.")
    repository.delete_group(cohort_id)
    return {"status": "deleted"}


# ─── HR Analytics ─────────────────────────────────────────────────────────────

@router.get("/analytics/overview")
def hr_analytics_overview(request: Request):
    """Aggregate-only analytics for corporate HR. No individual data returned."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, COUNT(*) AS cnt FROM org_member WHERE org_id = %s GROUP BY status",
                (org["id"],),
            )
            status_counts = {row["status"]: row["cnt"] for row in cur.fetchall()}
    return {
        "org_id":           org["id"],
        "total_members":    org["member_count"],
        "status_breakdown": status_counts,
    }


@router.get("/analytics/departments")
def hr_analytics_departments(request: Request):
    """Member count per department — aggregate only."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT g.name AS department, COUNT(gm.member_id) AS member_count
                  FROM org_group g
                  LEFT JOIN org_group_member gm ON gm.group_id = g.id
                 WHERE g.org_id = %s AND g.group_type = 'department' AND g.is_active = TRUE
                 GROUP BY g.id, g.name
                 ORDER BY g.name
                """,
                (org["id"],),
            )
            rows = cur.fetchall()
    return {"org_id": org["id"], "departments": rows}


@router.get("/analytics/engagement")
def hr_analytics_engagement(request: Request):
    """Compliance engagement rate over last 30 days — aggregate only."""
    user_id = _require_user(request)
    org = _require_corporate_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(DISTINCT cl.member_id) AS active_loggers,
                    COUNT(cl.id) AS total_log_entries,
                    ROUND(
                        100.0 * COUNT(DISTINCT cl.member_id)
                        / NULLIF(
                            (SELECT COUNT(*) FROM org_member
                              WHERE org_id = %s AND status = 'active'), 0
                        ), 1
                    ) AS engagement_pct
                  FROM org_compliance_log cl
                  JOIN org_member m ON m.id = cl.member_id
                 WHERE m.org_id = %s
                   AND cl.log_date >= CURRENT_DATE - INTERVAL '30 days'
                """,
                (org["id"], org["id"]),
            )
            row = cur.fetchone()
    return {"org_id": org["id"], "period_days": 30, **row}
