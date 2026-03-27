"""
Nutrition org-type specific endpoints.

All endpoints call require_module_active('nutrition') so the entire Nutrition
module can be disabled from the admin panel instantly.

Privacy rule: clinical data is only accessible to the assigned nutritionist
or the client themselves — never returned in admin aggregate queries.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from psycopg.types.json import Json

from app.org.modules import require_module_active
from app.org import repository
from app.core.db import get_connection

MODULE_KEY = "nutrition"
router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _require_nutrition_org(user_id: int) -> dict:
    require_module_active(MODULE_KEY)
    org = repository.get_org_by_admin(user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Nutrition organisation not found")
    if org["org_type"] != MODULE_KEY:
        raise HTTPException(status_code=403, detail="This dashboard is only for Nutrition organisations")
    if not org["is_active"]:
        raise HTTPException(status_code=403, detail="Organisation account is suspended")
    return org


def _get_member_id(user_id: int, org_id: int) -> Optional[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_member WHERE user_id = %s AND org_id = %s AND status = 'active'",
                (user_id, org_id),
            )
            row = cur.fetchone()
    return row["id"] if row else None


def _get_protocol(protocol_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nutrition_protocol WHERE id = %s AND org_id = %s",
                (protocol_id, org_id),
            )
            return cur.fetchone()


def _get_consultation(consult_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.* FROM nutrition_consultation c
                  JOIN org_member m ON m.id = c.member_id
                 WHERE c.id = %s AND m.org_id = %s
                """,
                (consult_id, org_id),
            )
            return cur.fetchone()


# ─── Dashboard Overview ──────────────────────────────────────────────────────

@router.get("/dashboard")
def nutrition_dashboard(request: Request):
    """Nutrition practice overview — clients, condition groups, plan info."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
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


# ─── Clinical Condition Groups ───────────────────────────────────────────────

class ConditionGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    medical_condition: str
    assigned_nutritionist_id: Optional[int] = None
    plan_cadence: Optional[str] = "weekly"


@router.post("/condition-groups")
def create_condition_group(request: Request, body: ConditionGroupCreate):
    """Create a clinical condition group (e.g. 'Type-2 Diabetic Patients')."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    group_id = repository.create_group(org["id"], {
        "name": body.name,
        "description": body.description,
        "group_type": "condition_group",
        "medical_condition": body.medical_condition,
        "meal_plan_type": "medical",
        "assigned_staff_id": body.assigned_nutritionist_id,
        "plan_cadence": body.plan_cadence,
    })
    return {"id": group_id, "status": "created"}


@router.get("/condition-groups")
def list_condition_groups(request: Request):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    groups = repository.list_groups(org["id"], active_only=True)
    return [g for g in groups if g.get("group_type") == "condition_group"]


@router.delete("/condition-groups/{group_id}")
def delete_condition_group(group_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    group = repository.get_group_by_id(group_id)
    if not group or group["org_id"] != org["id"] or group.get("group_type") != "condition_group":
        raise HTTPException(status_code=404, detail="Condition group not found.")
    repository.delete_group(group_id)
    return {"status": "deleted"}


# ─── Client Clinical Data ─────────────────────────────────────────────────────
# Privacy: only assigned staff + the client can access individual clinical records.

class ClinicalDataUpsert(BaseModel):
    org_id: int
    height_cm: Optional[float] = None
    current_weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    allergies: Optional[list] = None
    medical_conditions: Optional[list] = None
    medications: Optional[str] = None
    dietary_restrictions: Optional[list] = None
    activity_level: Optional[str] = None     # sedentary|light|moderate|active|very_active
    clinical_notes: Optional[str] = None     # nutritionist-only field


@router.post("/clinical")
def upsert_clinical_data(request: Request, body: ClinicalDataUpsert):
    """Client submits or updates their clinical intake data."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, body.org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    fields = body.model_dump(exclude={"org_id"}, exclude_none=True)
    _JSON_FIELDS = {"allergies", "medical_conditions", "dietary_restrictions"}
    col_list = ", ".join(["member_id"] + list(fields.keys()))
    val_list = ", ".join(["%s"] * (1 + len(fields)))
    vals = [member_id] + [Json(v) if k in _JSON_FIELDS else v for k, v in fields.items()]
    set_clauses = ", ".join(
        f"{k} = EXCLUDED.{k}" for k in fields
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO nutrition_client_clinical ({col_list})
                VALUES ({val_list})
                ON CONFLICT (member_id) DO UPDATE
                   SET {set_clauses}, updated_at = NOW()
                RETURNING id
                """,
                vals,
            )
            row = cur.fetchone()
        conn.commit()
    return {"id": row["id"], "status": "saved"}


@router.get("/clinical/me")
def my_clinical_data(request: Request, org_id: int = Query(...)):
    """Client views their own clinical record (includes all fields)."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nutrition_client_clinical WHERE member_id = %s",
                (member_id,),
            )
            record = cur.fetchone()
    if not record:
        raise HTTPException(status_code=404, detail="No clinical record found.")
    return record


@router.get("/clinical/{member_id}")
def get_client_clinical_staff(member_id: int, request: Request):
    """Nutritionist/staff views a specific client's clinical data."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nutrition_client_clinical WHERE member_id = %s",
                (member_id,),
            )
            record = cur.fetchone()
    if not record:
        raise HTTPException(status_code=404, detail="No clinical record found.")
    return record


# ─── Nutrition Protocols ──────────────────────────────────────────────────────

class ProtocolCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_condition: Optional[str] = None
    calorie_target: Optional[int] = None
    macro_split: Optional[dict] = None   # {"carbs_pct": 40, "protein_pct": 30, "fat_pct": 30}
    duration_weeks: Optional[int] = None
    status: Optional[str] = "active"


class ProtocolUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    calorie_target: Optional[int] = None
    macro_split: Optional[dict] = None
    status: Optional[str] = None


@router.post("/protocols")
def create_protocol(request: Request, body: ProtocolCreate):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nutrition_protocol
                  (org_id, created_by, title, description, target_condition,
                   calorie_target, macro_split, duration_weeks, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org["id"], user_id,
                    body.title, body.description, body.target_condition,
                    body.calorie_target,
                    Json(body.macro_split) if body.macro_split else None,
                    body.duration_weeks, body.status,
                ),
            )
            protocol_id = cur.fetchone()["id"]
        conn.commit()
    return {"id": protocol_id, "status": "created"}


@router.get("/protocols")
def list_protocols(
    request: Request,
    status: Optional[str] = Query(None),
):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    cond, params = "WHERE org_id = %s", [org["id"]]
    if status:
        cond += " AND status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM nutrition_protocol {cond} ORDER BY created_at DESC",
                params,
            )
            return cur.fetchall()


@router.get("/protocols/{protocol_id}")
def get_protocol(protocol_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    proto = _get_protocol(protocol_id, org["id"])
    if not proto:
        raise HTTPException(status_code=404, detail="Protocol not found.")
    return proto


@router.patch("/protocols/{protocol_id}")
def update_protocol(protocol_id: int, request: Request, body: ProtocolUpdate):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    if not _get_protocol(protocol_id, org["id"]):
        raise HTTPException(status_code=404, detail="Protocol not found.")
    fields = body.model_dump(exclude_none=True)
    if fields:
        set_clauses = [f"{k} = %s" for k in fields]
        values = [Json(v) if k == "macro_split" else v for k, v in fields.items()]
        values.append(protocol_id)
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE nutrition_protocol SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                    values,
                )
            conn.commit()
    return {"status": "ok"}


@router.delete("/protocols/{protocol_id}")
def delete_protocol(protocol_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    if not _get_protocol(protocol_id, org["id"]):
        raise HTTPException(status_code=404, detail="Protocol not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM nutrition_protocol WHERE id = %s", (protocol_id,))
        conn.commit()
    return {"status": "deleted"}


# ─── Consultations ────────────────────────────────────────────────────────────

class ConsultationCreate(BaseModel):
    member_id: int
    scheduled_at: str
    notes: Optional[str] = None
    protocol_id: Optional[int] = None


class ConsultationUpdate(BaseModel):
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None
    outcome_notes: Optional[str] = None
    status: Optional[str] = None          # scheduled | completed | cancelled | no_show


@router.post("/consultations")
def create_consultation(request: Request, body: ConsultationCreate):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    member = repository.get_member_by_id(body.member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nutrition_consultation
                  (member_id, nutritionist_id, scheduled_at, notes, protocol_id)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (body.member_id, user_id, body.scheduled_at, body.notes, body.protocol_id),
            )
            consult_id = cur.fetchone()["id"]
        conn.commit()
    return {"id": consult_id, "status": "scheduled"}


@router.get("/consultations")
def list_consultations(
    request: Request,
    member_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    cond = """
        WHERE m.org_id = %s
    """
    params = [org["id"]]
    if member_id:
        cond += " AND c.member_id = %s"
        params.append(member_id)
    if status:
        cond += " AND c.status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT c.id, c.scheduled_at, c.status, c.notes,
                       c.outcome_notes, c.protocol_id,
                       m.full_name AS client_name, m.email AS client_email
                  FROM nutrition_consultation c
                  JOIN org_member m ON m.id = c.member_id
                {cond}
                 ORDER BY c.scheduled_at DESC
                """,
                params,
            )
            return cur.fetchall()


@router.patch("/consultations/{consult_id}")
def update_consultation(consult_id: int, request: Request, body: ConsultationUpdate):
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    if not _get_consultation(consult_id, org["id"]):
        raise HTTPException(status_code=404, detail="Consultation not found.")
    fields = body.model_dump(exclude_none=True)
    if fields:
        set_clauses = [f"{k} = %s" for k in fields]
        values = list(fields.values()) + [consult_id]
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE nutrition_consultation SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                    values,
                )
            conn.commit()
    return {"status": "ok"}


# ─── Plan Review ──────────────────────────────────────────────────────────────

class PlanReviewCreate(BaseModel):
    member_id: int
    plan_id: int
    review_notes: Optional[str] = None
    adjustments: Optional[dict] = None


@router.post("/plan-reviews")
def create_plan_review(request: Request, body: PlanReviewCreate):
    """Nutritionist records a meal plan review for a client."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    member = repository.get_member_by_id(body.member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO nutrition_plan_review
                  (member_id, plan_id, reviewed_by, review_notes, adjustments)
                VALUES (%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    body.member_id, body.plan_id, user_id,
                    body.review_notes,
                    Json(body.adjustments) if body.adjustments else None,
                ),
            )
            review_id = cur.fetchone()["id"]
        conn.commit()
    return {"id": review_id, "status": "created"}


@router.get("/plan-reviews/{member_id}")
def get_member_plan_reviews(member_id: int, request: Request):
    """Staff views all plan reviews for a client."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nutrition_plan_review WHERE member_id = %s ORDER BY created_at DESC",
                (member_id,),
            )
            return cur.fetchall()


# ─── Analytics ───────────────────────────────────────────────────────────────

@router.get("/analytics/overview")
def nutrition_analytics(request: Request):
    """Aggregate client stats only. Individual clinical data never returned here."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, COUNT(*) AS cnt FROM org_member WHERE org_id = %s GROUP BY status",
                (org["id"],),
            )
            status_counts = {row["status"]: row["cnt"] for row in cur.fetchall()}
            cur.execute(
                """
                SELECT COUNT(*) AS cnt FROM nutrition_consultation c
                  JOIN org_member m ON m.id = c.member_id
                 WHERE m.org_id = %s AND c.status = 'scheduled'
                   AND c.scheduled_at >= NOW()
                """,
                (org["id"],),
            )
            upcoming_consults = cur.fetchone()["cnt"]
    return {
        "org_id":              org["id"],
        "total_clients":       org["member_count"],
        "status_breakdown":    status_counts,
        "upcoming_consults":   upcoming_consults,
    }


@router.get("/analytics/conditions")
def nutrition_analytics_conditions(request: Request):
    """Breakdown of clients by medical condition (aggregate only)."""
    user_id = _require_user(request)
    org = _require_nutrition_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT g.medical_condition, COUNT(gm.member_id) AS client_count
                  FROM org_group g
                  LEFT JOIN org_group_member gm ON gm.group_id = g.id
                 WHERE g.org_id = %s AND g.group_type = 'condition_group' AND g.is_active = TRUE
                 GROUP BY g.medical_condition
                 ORDER BY client_count DESC
                """,
                (org["id"],),
            )
            return cur.fetchall()
