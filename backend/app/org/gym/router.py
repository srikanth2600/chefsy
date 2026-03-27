"""
Gym org-type specific endpoints.

All endpoints call require_module_active('gym') so the entire Gym module
can be disabled from the admin panel instantly.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.org.modules import require_module_active
from app.org import repository
from app.core.db import get_connection

MODULE_KEY = "gym"
router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _require_gym_org(user_id: int) -> dict:
    require_module_active(MODULE_KEY)
    org = repository.get_org_by_admin(user_id)
    if not org:
        raise HTTPException(status_code=404, detail="Gym organisation not found")
    if org["org_type"] != MODULE_KEY:
        raise HTTPException(status_code=403, detail="This dashboard is only for Gym organisations")
    if not org["is_active"]:
        raise HTTPException(status_code=403, detail="Organisation account is suspended")
    return org


def _get_workout_plan(plan_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM gym_workout_plan WHERE id = %s AND org_id = %s",
                (plan_id, org_id),
            )
            return cur.fetchone()


def _get_class(class_id: int, org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM gym_class WHERE id = %s AND org_id = %s",
                (class_id, org_id),
            )
            return cur.fetchone()


def _get_member_id(user_id: int, org_id: int) -> Optional[int]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM org_member WHERE user_id = %s AND org_id = %s AND status = 'active'",
                (user_id, org_id),
            )
            row = cur.fetchone()
    return row["id"] if row else None


# ─── Dashboard Overview ──────────────────────────────────────────────────────

@router.get("/dashboard")
def gym_dashboard(request: Request):
    """Gym overview — members, groups (classes/PT), plan info."""
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
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


# ─── Fitness Groups ───────────────────────────────────────────────────────────

class FitnessGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    group_type: str = "fitness_class"   # 'fitness_class'|'personal_training'|'bootcamp'
    assigned_trainer_id: Optional[int] = None
    plan_cadence: Optional[str] = "weekly"


@router.post("/groups")
def create_fitness_group(request: Request, body: FitnessGroupCreate):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    group_id = repository.create_group(org["id"], {
        "name": body.name,
        "description": body.description,
        "group_type": body.group_type,
        "assigned_staff_id": body.assigned_trainer_id,
        "plan_cadence": body.plan_cadence,
    })
    return {"id": group_id, "status": "created"}


@router.get("/groups")
def list_fitness_groups(request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    return repository.list_groups(org["id"], active_only=True)


@router.delete("/groups/{group_id}")
def delete_fitness_group(group_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    group = repository.get_group_by_id(group_id)
    if not group or group["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Group not found.")
    repository.delete_group(group_id)
    return {"status": "deleted"}


# ─── Workout Plans ────────────────────────────────────────────────────────────
# DB columns: name, goal, level, duration_weeks, days_per_week, plan_json,
#             is_template, is_active, created_by, org_id

class WorkoutPlanCreate(BaseModel):
    name: str
    goal: Optional[str] = None           # weight_loss | muscle_gain | endurance | flexibility
    level: Optional[str] = "beginner"    # beginner | intermediate | advanced
    duration_weeks: Optional[int] = None
    days_per_week: Optional[int] = None
    plan_json: Optional[dict] = None     # {"week1": {"monday": [...]}}
    is_template: Optional[bool] = False
    group_id: Optional[int] = None       # stored in is_active; group via assignment


class WorkoutPlanUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    level: Optional[str] = None
    duration_weeks: Optional[int] = None
    days_per_week: Optional[int] = None
    plan_json: Optional[dict] = None
    is_active: Optional[bool] = None
    is_template: Optional[bool] = None


@router.post("/workout-plans")
def create_workout_plan(request: Request, body: WorkoutPlanCreate):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    from psycopg.types.json import Json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gym_workout_plan
                  (org_id, name, goal, level, duration_weeks,
                   days_per_week, plan_json, is_template)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org["id"],
                    body.name, body.goal, body.level,
                    body.duration_weeks, body.days_per_week,
                    Json(body.plan_json or {}),
                    body.is_template,
                ),
            )
            plan_id = cur.fetchone()["id"]
        conn.commit()
    return {"id": plan_id, "status": "created"}


@router.get("/workout-plans")
def list_workout_plans(
    request: Request,
    is_active: Optional[bool] = Query(None),
    is_template: Optional[bool] = Query(None),
):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    cond, params = "WHERE org_id = %s", [org["id"]]
    if is_active is not None:
        cond += " AND is_active = %s"
        params.append(is_active)
    if is_template is not None:
        cond += " AND is_template = %s"
        params.append(is_template)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM gym_workout_plan {cond} ORDER BY created_at DESC",
                params,
            )
            return cur.fetchall()


@router.get("/workout-plans/{plan_id}")
def get_workout_plan(plan_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    plan = _get_workout_plan(plan_id, org["id"])
    if not plan:
        raise HTTPException(status_code=404, detail="Workout plan not found.")
    return plan


@router.patch("/workout-plans/{plan_id}")
def update_workout_plan(plan_id: int, request: Request, body: WorkoutPlanUpdate):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    if not _get_workout_plan(plan_id, org["id"]):
        raise HTTPException(status_code=404, detail="Workout plan not found.")
    fields = body.model_dump(exclude_none=True)
    if fields:
        from psycopg.types.json import Json
        set_clauses = [f"{k} = %s" for k in fields]
        values = [Json(v) if k == "plan_json" else v for k, v in fields.items()]
        values.append(plan_id)
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE gym_workout_plan SET {', '.join(set_clauses)} WHERE id = %s",
                    values,
                )
            conn.commit()
    return {"status": "ok"}


@router.delete("/workout-plans/{plan_id}")
def delete_workout_plan(plan_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    if not _get_workout_plan(plan_id, org["id"]):
        raise HTTPException(status_code=404, detail="Workout plan not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gym_workout_plan WHERE id = %s", (plan_id,))
        conn.commit()
    return {"status": "deleted"}


# ─── Assign Workout Plan to Member ───────────────────────────────────────────

class AssignPlan(BaseModel):
    member_id: int
    workout_plan_id: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.post("/workout-plans/assign")
def assign_plan_to_member(request: Request, body: AssignPlan):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    if not _get_workout_plan(body.workout_plan_id, org["id"]):
        raise HTTPException(status_code=404, detail="Workout plan not found.")
    member = repository.get_member_by_id(body.member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gym_member_workout
                  (member_id, workout_plan_id, start_date, end_date)
                VALUES (%s,%s,%s,%s)
                ON CONFLICT (member_id, workout_plan_id) DO UPDATE
                   SET start_date = EXCLUDED.start_date,
                       end_date   = EXCLUDED.end_date,
                       is_active  = TRUE
                RETURNING id
                """,
                (body.member_id, body.workout_plan_id, body.start_date, body.end_date),
            )
            assignment_id = cur.fetchone()["id"]
        conn.commit()
    return {"id": assignment_id, "status": "assigned"}


# ─── Body Composition Logs ────────────────────────────────────────────────────
# DB columns: member_id, log_date, weight_kg, body_fat_pct, muscle_mass_kg,
#             waist_cm, chest_cm, arms_cm, notes

class BodyLog(BaseModel):
    org_id: int
    log_date: str
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    waist_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    arms_cm: Optional[float] = None
    notes: Optional[str] = None


@router.post("/body-logs")
def submit_body_log(request: Request, body: BodyLog):
    """Member submits body composition measurement."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, body.org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gym_body_log
                  (member_id, log_date, weight_kg, body_fat_pct,
                   muscle_mass_kg, waist_cm, chest_cm, arms_cm, notes)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (member_id, log_date) DO UPDATE
                   SET weight_kg      = EXCLUDED.weight_kg,
                       body_fat_pct   = EXCLUDED.body_fat_pct,
                       muscle_mass_kg = EXCLUDED.muscle_mass_kg,
                       waist_cm       = EXCLUDED.waist_cm,
                       chest_cm       = EXCLUDED.chest_cm,
                       arms_cm        = EXCLUDED.arms_cm,
                       notes          = EXCLUDED.notes
                RETURNING id, log_date
                """,
                (
                    member_id, body.log_date,
                    body.weight_kg, body.body_fat_pct, body.muscle_mass_kg,
                    body.waist_cm, body.chest_cm, body.arms_cm, body.notes,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    return {"id": row["id"], "log_date": str(row["log_date"]), "status": "saved"}


@router.get("/body-logs")
def my_body_logs(
    request: Request,
    org_id: int = Query(...),
    limit: int = Query(30, le=90),
):
    """Member views their own body composition history."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM gym_body_log WHERE member_id = %s ORDER BY log_date DESC LIMIT %s",
                (member_id, limit),
            )
            return cur.fetchall()


@router.get("/members/{member_id}/body-log")
def get_member_body_log(
    member_id: int,
    request: Request,
    limit: int = Query(30, le=90),
):
    """Staff/admin views a specific member's body composition history."""
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    member = repository.get_member_by_id(member_id)
    if not member or member["org_id"] != org["id"]:
        raise HTTPException(status_code=404, detail="Member not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM gym_body_log WHERE member_id = %s ORDER BY log_date DESC LIMIT %s",
                (member_id, limit),
            )
            return cur.fetchall()


# ─── Class Scheduling ─────────────────────────────────────────────────────────
# DB columns: name, class_type, scheduled_at, duration_min, capacity, location,
#             status ('scheduled'|'completed'|'cancelled'), trainer_id

class ClassCreate(BaseModel):
    name: str
    class_type: Optional[str] = None     # yoga|zumba|hiit|spinning|strength|pilates
    trainer_id: Optional[int] = None
    scheduled_at: str                    # ISO datetime string
    duration_min: Optional[int] = 60
    capacity: Optional[int] = 20
    location: Optional[str] = None


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    class_type: Optional[str] = None
    scheduled_at: Optional[str] = None
    duration_min: Optional[int] = None
    capacity: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = None        # scheduled | completed | cancelled


@router.post("/classes")
def create_class(request: Request, body: ClassCreate):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gym_class
                  (org_id, name, class_type, trainer_id,
                   scheduled_at, duration_min, capacity, location)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org["id"], body.name, body.class_type, body.trainer_id,
                    body.scheduled_at, body.duration_min, body.capacity, body.location,
                ),
            )
            class_id = cur.fetchone()["id"]
        conn.commit()
    return {"id": class_id, "status": "scheduled"}


@router.get("/classes")
def list_classes(
    request: Request,
    status: Optional[str] = Query(None),
):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    cond, params = "WHERE org_id = %s", [org["id"]]
    if status:
        cond += " AND status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM gym_class {cond} ORDER BY scheduled_at ASC",
                params,
            )
            return cur.fetchall()


@router.get("/classes/{class_id}")
def get_class(class_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    cls = _get_class(class_id, org["id"])
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")
    # include booking count
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS booked FROM gym_class_booking WHERE class_id = %s AND status = 'booked'",
                (class_id,),
            )
            booked = cur.fetchone()["booked"]
    return {**cls, "booked_count": booked}


@router.patch("/classes/{class_id}")
def update_class(class_id: int, request: Request, body: ClassUpdate):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    if not _get_class(class_id, org["id"]):
        raise HTTPException(status_code=404, detail="Class not found.")
    fields = body.model_dump(exclude_none=True)
    if fields:
        set_clauses = [f"{k} = %s" for k in fields]
        values = list(fields.values()) + [class_id]
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE gym_class SET {', '.join(set_clauses)} WHERE id = %s",
                    values,
                )
            conn.commit()
    return {"status": "ok"}


@router.delete("/classes/{class_id}")
def delete_class(class_id: int, request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    if not _get_class(class_id, org["id"]):
        raise HTTPException(status_code=404, detail="Class not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM gym_class WHERE id = %s", (class_id,))
        conn.commit()
    return {"status": "deleted"}


@router.post("/classes/{class_id}/book")
def book_class(class_id: int, request: Request, org_id: int = Query(...)):
    """Member books a spot in a class."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Check capacity
            cur.execute(
                """
                SELECT c.capacity,
                       (SELECT COUNT(*) FROM gym_class_booking
                         WHERE class_id = %s AND status = 'booked') AS booked
                  FROM gym_class c WHERE c.id = %s AND c.org_id = %s
                """,
                (class_id, class_id, org_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Class not found.")
            if row["capacity"] and row["booked"] >= row["capacity"]:
                raise HTTPException(status_code=409, detail="Class is fully booked.")
            cur.execute(
                """
                INSERT INTO gym_class_booking (class_id, member_id)
                VALUES (%s,%s)
                ON CONFLICT (class_id, member_id) DO UPDATE SET status = 'booked'
                RETURNING id
                """,
                (class_id, member_id),
            )
            result = cur.fetchone()
        conn.commit()
    return {"id": result["id"] if result else None, "status": "booked"}


@router.delete("/classes/{class_id}/book")
def cancel_booking(class_id: int, request: Request, org_id: int = Query(...)):
    """Member cancels their booking."""
    user_id = _require_user(request)
    member_id = _get_member_id(user_id, org_id)
    if not member_id:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE gym_class_booking SET status = 'cancelled' "
                "WHERE class_id = %s AND member_id = %s AND status = 'booked'",
                (class_id, member_id),
            )
        conn.commit()
    return {"status": "cancelled"}


@router.get("/classes/{class_id}/bookings")
def list_class_bookings(class_id: int, request: Request):
    """Staff views who is booked into a class."""
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    if not _get_class(class_id, org["id"]):
        raise HTTPException(status_code=404, detail="Class not found.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.full_name, m.email, m.phone, b.status, b.booked_at
                  FROM gym_class_booking b
                  JOIN org_member m ON m.id = b.member_id
                 WHERE b.class_id = %s
                 ORDER BY b.booked_at ASC
                """,
                (class_id,),
            )
            return cur.fetchall()


# ─── Analytics ───────────────────────────────────────────────────────────────

@router.get("/analytics/overview")
def gym_analytics(request: Request):
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status, COUNT(*) AS cnt FROM org_member WHERE org_id = %s GROUP BY status",
                (org["id"],),
            )
            status_counts = {row["status"]: row["cnt"] for row in cur.fetchall()}
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM gym_class WHERE org_id = %s AND status = 'scheduled'",
                (org["id"],),
            )
            upcoming_classes = cur.fetchone()["cnt"]
    return {
        "org_id":           org["id"],
        "total_members":    org["member_count"],
        "status_breakdown": status_counts,
        "upcoming_classes": upcoming_classes,
    }


@router.get("/analytics/body-composition")
def analytics_body_composition(request: Request):
    """Aggregate body composition progress — average weight/fat/muscle per month.
    Aggregate only — no individual records returned."""
    user_id = _require_user(request)
    org = _require_gym_org(user_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    DATE_TRUNC('month', b.log_date) AS month,
                    COUNT(DISTINCT b.member_id)     AS members_logged,
                    ROUND(AVG(b.weight_kg)::NUMERIC, 2)      AS avg_weight_kg,
                    ROUND(AVG(b.body_fat_pct)::NUMERIC, 1)   AS avg_body_fat_pct,
                    ROUND(AVG(b.muscle_mass_kg)::NUMERIC, 2) AS avg_muscle_mass_kg
                  FROM gym_body_log b
                  JOIN org_member m ON m.id = b.member_id
                 WHERE m.org_id = %s
                   AND b.log_date >= CURRENT_DATE - INTERVAL '6 months'
                 GROUP BY DATE_TRUNC('month', b.log_date)
                 ORDER BY month DESC
                """,
                (org["id"],),
            )
            monthly = cur.fetchall()
    return {"org_id": org["id"], "monthly_trends": monthly}
