"""
Org Member Portal — /org/member/*

Endpoints for end users (Tier 3) to:
  - See all their org memberships
  - View their current meal plan from each org
  - Log compliance check-ins
  - View reels / health tips
  - View and enrol in challenges
  - View their body logs (gym)
  - View their workout plan (gym)
  - View their clinical summary (nutrition — self only)
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.core.db import get_connection
from app.org import repository

router = APIRouter()


def _require_user(req: Request) -> int:
    from app.core.security import get_user_id_from_bearer
    uid = get_user_id_from_bearer(req)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def _get_member(user_id: int, org_id: int) -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.*, o.org_name, o.org_type, o.logo_url, o.accent_color
                  FROM org_member m
                  JOIN org_profile o ON o.id = m.org_id
                 WHERE m.user_id = %s AND m.org_id = %s AND m.status = 'active'
                """,
                (user_id, org_id),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="You are not an active member of this organisation.")
    return row


# ─── My Org Memberships ───────────────────────────────────────────────────────

@router.get("/my-orgs")
def list_my_orgs(request: Request):
    """List all active org memberships for the logged-in user."""
    user_id = _require_user(request)
    return repository.get_user_memberships(user_id)


# ─── My Current Meal Plan ─────────────────────────────────────────────────────

@router.get("/my-orgs/{org_id}/plan")
def my_current_plan(org_id: int, request: Request):
    """Return the member's most recently published meal plan from this org."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.id, p.status, p.week_start_date,
                       b.batch_name, b.published_at,
                       p.meal_plan_id, p.staff_notes
                  FROM org_member_meal_plan p
                  JOIN org_meal_plan_batch b ON b.id = p.batch_id
                 WHERE p.member_id = %s AND b.status = 'published'
                 ORDER BY b.published_at DESC
                 LIMIT 1
                """,
                (member["id"],),
            )
            plan = cur.fetchone()
    if not plan:
        return {"message": "No published meal plan yet."}
    return plan


# ─── Compliance Check-in ──────────────────────────────────────────────────────

class ComplianceLog(BaseModel):
    log_date: str
    breakfast: Optional[str] = None    # yes | partial | no
    lunch: Optional[str] = None
    dinner: Optional[str] = None
    snack: Optional[str] = None
    weight_kg: Optional[float] = None
    mood_score: Optional[int] = None   # 1–5
    energy_score: Optional[int] = None
    workout_done: Optional[bool] = None
    workout_duration_min: Optional[int] = None
    clinical_notes: Optional[str] = None  # patient-only; never shown in admin aggregates


@router.post("/my-orgs/{org_id}/compliance")
def log_compliance(org_id: int, request: Request, body: ComplianceLog):
    """Member logs a daily compliance check-in for the given org."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_compliance_log
                  (member_id, log_date, breakfast, lunch, dinner, snack,
                   weight_kg, mood_score, energy_score,
                   workout_done, workout_duration_min, clinical_notes)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (member_id, log_date) DO UPDATE
                   SET breakfast            = EXCLUDED.breakfast,
                       lunch                = EXCLUDED.lunch,
                       dinner               = EXCLUDED.dinner,
                       snack                = EXCLUDED.snack,
                       weight_kg            = EXCLUDED.weight_kg,
                       mood_score           = EXCLUDED.mood_score,
                       energy_score         = EXCLUDED.energy_score,
                       workout_done         = EXCLUDED.workout_done,
                       workout_duration_min = EXCLUDED.workout_duration_min,
                       clinical_notes       = EXCLUDED.clinical_notes
                RETURNING id, log_date
                """,
                (
                    member["id"], body.log_date,
                    body.breakfast, body.lunch, body.dinner, body.snack,
                    body.weight_kg, body.mood_score, body.energy_score,
                    body.workout_done, body.workout_duration_min,
                    body.clinical_notes,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    return {"id": row["id"], "log_date": str(row["log_date"]), "status": "saved"}


@router.get("/my-orgs/{org_id}/compliance")
def my_compliance_history(
    org_id: int,
    request: Request,
    limit: int = Query(30, le=90),
):
    """Member views their own compliance history. Includes clinical_notes."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, log_date, breakfast, lunch, dinner, snack,
                       weight_kg, mood_score, energy_score,
                       workout_done, workout_duration_min,
                       clinical_notes, created_at
                  FROM org_compliance_log
                 WHERE member_id = %s
                 ORDER BY log_date DESC
                 LIMIT %s
                """,
                (member["id"], limit),
            )
            return cur.fetchall()


# ─── Org Content (Reels / Articles / Tips) ────────────────────────────────────

@router.get("/my-orgs/{org_id}/content")
def my_org_content(
    org_id: int,
    request: Request,
    content_type: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
):
    """Member browses published reels, articles, health tips from this org."""
    user_id = _require_user(request)
    _get_member(user_id, org_id)   # membership check
    cond, params = "WHERE org_id = %s AND status = 'active'", [org_id]
    if content_type:
        cond += " AND content_type = %s"
        params.append(content_type)
    params.append(limit)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, content_type, title, description, hashtags,
                       video_url, thumbnail, body_text, view_count, created_at
                  FROM org_content {cond}
                 ORDER BY created_at DESC LIMIT %s
                """,
                params,
            )
            return cur.fetchall()


# ─── Challenges ───────────────────────────────────────────────────────────────

@router.get("/my-orgs/{org_id}/challenges")
def my_org_challenges(org_id: int, request: Request):
    """Member sees active challenges for this org."""
    user_id = _require_user(request)
    _get_member(user_id, org_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, description, challenge_type,
                       start_date, end_date, target_value, unit,
                       reward_description, status, created_at
                  FROM org_challenge
                 WHERE org_id = %s AND status = 'active'
                 ORDER BY end_date ASC
                """,
                (org_id,),
            )
            return cur.fetchall()


class MyChallengeProgress(BaseModel):
    current_value: float
    notes: Optional[str] = None


@router.post("/my-orgs/{org_id}/challenges/{challenge_id}/progress")
def log_challenge_progress(
    org_id: int,
    challenge_id: int,
    request: Request,
    body: MyChallengeProgress,
):
    """Member updates their progress in a challenge."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    member_id = member["id"]
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Verify challenge belongs to org
            cur.execute(
                "SELECT id FROM org_challenge WHERE id = %s AND org_id = %s AND status = 'active'",
                (challenge_id, org_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Challenge not found or not active.")
            # Enrol if not already enrolled
            cur.execute(
                """
                INSERT INTO org_challenge_enrollment (challenge_id, member_id)
                VALUES (%s,%s) ON CONFLICT (challenge_id, member_id) DO NOTHING
                """,
                (challenge_id, member_id),
            )
            # Update progress
            cur.execute(
                """
                UPDATE org_challenge_enrollment
                   SET current_value = %s, notes = %s, updated_at = NOW()
                 WHERE challenge_id = %s AND member_id = %s
                """,
                (body.current_value, body.notes, challenge_id, member_id),
            )
        conn.commit()
    return {"status": "ok"}


# ─── Gym-Specific: My Workout Plan ───────────────────────────────────────────

@router.get("/my-orgs/{org_id}/workout-plan")
def my_workout_plan(org_id: int, request: Request):
    """Gym member: view their active assigned workout plan."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    if member["org_type"] != "gym":
        raise HTTPException(status_code=400, detail="This endpoint is only available for Gym memberships.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT w.id AS assignment_id, w.start_date, w.end_date,
                       p.name, p.goal, p.level, p.duration_weeks,
                       p.days_per_week, p.plan_json
                  FROM gym_member_workout w
                  JOIN gym_workout_plan p ON p.id = w.workout_plan_id
                 WHERE w.member_id = %s AND w.is_active = TRUE
                 ORDER BY w.created_at DESC
                 LIMIT 1
                """,
                (member["id"],),
            )
            plan = cur.fetchone()
    if not plan:
        return {"message": "No workout plan assigned yet."}
    return plan


# ─── Custom Meal Planner — Invited Plans ─────────────────────────────────────

@router.get("/my-orgs/{org_id}/invited-plans")
def my_invited_plans(
    org_id: int,
    request: Request,
    status: Optional[str] = Query(None),
):
    """Member views all template meal plan invites from this org."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    cond, params = "WHERE i.member_id = %s", [member["id"]]
    if status:
        cond += " AND i.status = %s"
        params.append(status)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT i.id, i.status, i.invited_at, i.responded_at, i.adopted_plan_id,
                       t.name AS plan_name, t.description, t.week_start_date,
                       t.meal_types, t.target_prefs,
                       g.name AS group_name
                  FROM org_template_plan_invite i
                  JOIN org_template_meal_plan t ON t.id = i.template_plan_id
                  LEFT JOIN org_group g ON g.id = i.group_id
                 {cond}
                 ORDER BY i.invited_at DESC
                """,
                params,
            )
            return cur.fetchall()


@router.post("/my-orgs/{org_id}/invited-plans/{invite_id}/adopt")
def adopt_invited_plan(org_id: int, invite_id: int, request: Request):
    """
    Adopt a template plan: copies the template into the member's personal meal_plan.
    The adopted plan appears in the member's /meal-plans list.
    """
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)

    # Must have a linked user account to create a personal plan
    if not member.get("user_id"):
        raise HTTPException(
            status_code=400,
            detail="Please complete your account setup before adopting plans.",
        )

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Fetch and validate the invite
            cur.execute(
                """
                SELECT i.*, t.name AS plan_name, t.description, t.week_start_date,
                       t.meal_types, t.target_prefs
                  FROM org_template_plan_invite i
                  JOIN org_template_meal_plan t ON t.id = i.template_plan_id
                 WHERE i.id = %s AND i.member_id = %s
                """,
                (invite_id, member["id"]),
            )
            invite = cur.fetchone()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite["status"] != "pending":
        raise HTTPException(
            status_code=422,
            detail=f"This invite has already been '{invite['status']}'.",
        )

    # Fetch template slots
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT day_index, meal_type, recipe_id, meal_name, meal_json, sort_order
                  FROM org_template_meal_plan_slot
                 WHERE template_plan_id = %s
                 ORDER BY day_index, sort_order, meal_type
                """,
                (invite["template_plan_id"],),
            )
            template_slots = cur.fetchall()

    # Create personal meal_plan (reuses existing repository function)
    from app.meal_plan import repository as mp_repo
    plan_data = {
        "name": invite["plan_name"],
        "description": invite["description"],
        "week_start_date": str(invite["week_start_date"]) if invite.get("week_start_date") else None,
        "servings": 2,
        "preferences_json": invite.get("target_prefs") or {},
    }
    personal_plan_id = mp_repo.create_meal_plan(member["user_id"], plan_data)

    # Copy slots (reuses existing repository function)
    mp_repo.bulk_insert_slots(personal_plan_id, [dict(s) for s in template_slots])

    # Mark invite as adopted
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE org_template_plan_invite
                   SET status = 'adopted', adopted_plan_id = %s, responded_at = NOW()
                 WHERE id = %s
                """,
                (personal_plan_id, invite_id),
            )
        conn.commit()

    return {
        "status": "adopted",
        "personal_plan_id": personal_plan_id,
        "message": "Plan added to your Meal Plans.",
    }


@router.post("/my-orgs/{org_id}/invited-plans/{invite_id}/decline")
def decline_invited_plan(org_id: int, invite_id: int, request: Request):
    """Decline a template meal plan invite."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, status FROM org_template_plan_invite WHERE id = %s AND member_id = %s",
                (invite_id, member["id"]),
            )
            invite = cur.fetchone()

    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite["status"] != "pending":
        raise HTTPException(
            status_code=422,
            detail=f"This invite has already been '{invite['status']}'.",
        )

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE org_template_plan_invite SET status = 'declined', responded_at = NOW() WHERE id = %s",
                (invite_id,),
            )
        conn.commit()
    return {"status": "declined"}


# ─── Nutrition-Specific: My Clinical Summary (self-view) ─────────────────────

@router.get("/my-orgs/{org_id}/clinical")
def my_clinical_summary(org_id: int, request: Request):
    """Nutrition member: view their own clinical record (self only)."""
    user_id = _require_user(request)
    member = _get_member(user_id, org_id)
    if member["org_type"] != "nutrition":
        raise HTTPException(status_code=400, detail="This endpoint is only available for Nutrition memberships.")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM nutrition_client_clinical WHERE member_id = %s",
                (member["id"],),
            )
            record = cur.fetchone()
    if not record:
        return {"message": "No clinical record on file."}
    return record
