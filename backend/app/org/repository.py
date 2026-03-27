import re
import uuid
from typing import Optional

from psycopg.types.json import Json

from app.core.db import get_connection


# ─── Platform Module ──────────────────────────────────────────────────────────

def list_platform_modules() -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT module_key, display_name, description, is_active, updated_at "
                "FROM platform_module ORDER BY module_key"
            )
            return cur.fetchall()


def toggle_platform_module(module_key: str, is_active: bool, updated_by: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE platform_module
                   SET is_active = %s, updated_by = %s, updated_at = NOW()
                 WHERE module_key = %s
                RETURNING module_key, display_name, is_active, updated_at
                """,
                (is_active, updated_by, module_key),
            )
            row = cur.fetchone()
        conn.commit()
    return row


# ─── Org Profile ─────────────────────────────────────────────────────────────

def create_org_profile(admin_user_id: int, data: dict) -> int:
    slug = _generate_slug(data["org_name"])
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_profile
                  (admin_user_id, org_type, org_name, slug,
                   official_email, phone, city, state)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    admin_user_id,
                    data["org_type"],
                    data["org_name"],
                    slug,
                    data["official_email"],
                    data.get("phone"),
                    data.get("city"),
                    data.get("state"),
                ),
            )
            org_id = cur.fetchone()["id"]
        conn.commit()
    return org_id


def get_org_by_admin(admin_user_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM org_profile WHERE admin_user_id = %s",
                (admin_user_id,),
            )
            return cur.fetchone()


def get_org_by_id(org_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM org_profile WHERE id = %s", (org_id,))
            return cur.fetchone()


def get_org_by_slug(slug: str) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM org_profile WHERE slug = %s", (slug,))
            return cur.fetchone()


def update_org_profile(org_id: int, fields: dict) -> None:
    if not fields:
        return
    _JSON_FIELDS = {"org_rules_json", "active_modules"}
    set_clauses, values = [], []
    for k, v in fields.items():
        set_clauses.append(f"{k} = %s")
        values.append(Json(v) if k in _JSON_FIELDS else v)
    values.append(org_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_profile SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                values,
            )
        conn.commit()


def list_orgs(
    page: int = 1,
    per_page: int = 20,
    org_type: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> dict:
    conditions, params = [], []
    if org_type:
        conditions.append("org_type = %s")
        params.append(org_type)
    if is_active is not None:
        conditions.append("is_active = %s")
        params.append(is_active)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS cnt FROM org_profile {where}", params)
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"SELECT * FROM org_profile {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                params + [per_page, offset],
            )
            rows = cur.fetchall()
    return {"total": total, "page": page, "per_page": per_page, "items": rows}


# ─── Member ───────────────────────────────────────────────────────────────────

def create_member_invite(org_id: int, data: dict) -> dict:
    token = uuid.uuid4().hex
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_member
                  (org_id, email, full_name, phone, invite_token, invite_sent_at, member_meta)
                VALUES (%s, %s, %s, %s, %s, NOW(), %s)
                ON CONFLICT (org_id, email) DO UPDATE
                   SET full_name      = EXCLUDED.full_name,
                       invite_token   = EXCLUDED.invite_token,
                       invite_sent_at = NOW(),
                       updated_at     = NOW()
                RETURNING id, invite_token
                """,
                (
                    org_id,
                    data["email"],
                    data.get("full_name"),
                    data.get("phone"),
                    token,
                    Json(data.get("member_meta") or {}),
                ),
            )
            row = cur.fetchone()
        conn.commit()
    return {"id": row["id"], "invite_token": row["invite_token"]}


def get_member_by_id(member_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM org_member WHERE id = %s", (member_id,))
            return cur.fetchone()


def get_member_by_token(token: str) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM org_member WHERE invite_token = %s", (token,))
            return cur.fetchone()


def list_members(
    org_id: int,
    page: int = 1,
    per_page: int = 50,
    status: Optional[str] = None,
) -> dict:
    cond, params = "WHERE org_id = %s", [org_id]
    if status:
        cond += " AND status = %s"
        params.append(status)
    offset = (page - 1) * per_page
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS cnt FROM org_member {cond}", params)
            total = cur.fetchone()["cnt"]
            cur.execute(
                f"SELECT * FROM org_member {cond} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                params + [per_page, offset],
            )
            rows = cur.fetchall()
    return {"total": total, "page": page, "per_page": per_page, "items": rows}


def update_member(member_id: int, fields: dict) -> None:
    if not fields:
        return
    set_clauses, values = [], []
    for k, v in fields.items():
        set_clauses.append(f"{k} = %s")
        values.append(Json(v) if k == "member_meta" else v)
    values.append(member_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_member SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                values,
            )
        conn.commit()


def remove_member(member_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM org_member WHERE id = %s", (member_id,))
        conn.commit()


def get_user_memberships(user_id: int) -> list:
    """Return all active orgs the user belongs to (supports multi-org membership)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT o.id, o.org_name, o.org_type, o.slug, o.logo_url,
                       o.accent_color, o.plan, m.status, m.member_meta, m.joined_at
                  FROM org_member m
                  JOIN org_profile o ON o.id = m.org_id
                 WHERE m.user_id = %s
                   AND m.status = 'active'
                   AND o.is_active = TRUE
                 ORDER BY m.joined_at DESC
                """,
                (user_id,),
            )
            return cur.fetchall()


# ─── Group ────────────────────────────────────────────────────────────────────

def create_group(org_id: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_group
                  (org_id, name, description, group_type, color, icon,
                   meal_plan_type, medical_condition, plan_cadence, auto_publish,
                   assigned_staff_id, group_rules_json)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
                """,
                (
                    org_id,
                    data["name"],
                    data.get("description"),
                    data.get("group_type", "general"),
                    data.get("color", "#3B82F6"),
                    data.get("icon", "group"),
                    data.get("meal_plan_type", "general"),
                    data.get("medical_condition"),
                    data.get("plan_cadence", "weekly"),
                    data.get("auto_publish", False),
                    data.get("assigned_staff_id"),
                    Json(data.get("group_rules_json") or {}),
                ),
            )
            group_id = cur.fetchone()["id"]
        conn.commit()
    return group_id


def get_group_by_id(group_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM org_group WHERE id = %s", (group_id,))
            return cur.fetchone()


def list_groups(org_id: int, active_only: bool = True) -> list:
    cond, params = "WHERE org_id = %s", [org_id]
    if active_only:
        cond += " AND is_active = TRUE"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM org_group {cond} ORDER BY name", params)
            return cur.fetchall()


def update_group(group_id: int, fields: dict) -> None:
    if not fields:
        return
    set_clauses, values = [], []
    for k, v in fields.items():
        set_clauses.append(f"{k} = %s")
        values.append(Json(v) if k == "group_rules_json" else v)
    values.append(group_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_group SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                values,
            )
        conn.commit()


def delete_group(group_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM org_group WHERE id = %s", (group_id,))
        conn.commit()


def add_member_to_group(group_id: int, member_id: int, added_by: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO org_group_member (group_id, member_id, added_by) "
                "VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                (group_id, member_id, added_by),
            )
        conn.commit()


def remove_member_from_group(group_id: int, member_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM org_group_member WHERE group_id = %s AND member_id = %s",
                (group_id, member_id),
            )
        conn.commit()


def list_group_members(group_id: int) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.id, m.email, m.full_name, m.phone, m.status,
                       m.member_meta, m.joined_at, gm.added_at
                  FROM org_member m
                  JOIN org_group_member gm ON gm.member_id = m.id
                 WHERE gm.group_id = %s
                 ORDER BY m.full_name
                """,
                (group_id,),
            )
            return cur.fetchall()


# ─── Staff ────────────────────────────────────────────────────────────────────

def create_staff(org_id: int, user_id: int, role: str, permissions: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO org_staff (org_id, user_id, role, permissions, invited_at)
                VALUES (%s,%s,%s,%s,NOW())
                ON CONFLICT (org_id, user_id) DO UPDATE
                   SET role = EXCLUDED.role, is_active = TRUE, invited_at = NOW()
                RETURNING id
                """,
                (org_id, user_id, role, Json(permissions)),
            )
            staff_id = cur.fetchone()["id"]
        conn.commit()
    return staff_id


def list_staff(org_id: int) -> list:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, s.role, s.permissions, s.is_active,
                       s.invited_at, s.joined_at,
                       u.full_name, u.email
                  FROM org_staff s
                  JOIN users u ON u.id = s.user_id
                 WHERE s.org_id = %s
                 ORDER BY s.created_at
                """,
                (org_id,),
            )
            return cur.fetchall()


def get_staff_by_id(staff_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM org_staff WHERE id = %s", (staff_id,))
            return cur.fetchone()


def remove_staff(staff_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM org_staff WHERE id = %s", (staff_id,))
        conn.commit()


def get_user_by_email(email: str) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, full_name FROM users WHERE email = %s", (email,))
            return cur.fetchone()


def update_staff(staff_id: int, fields: dict) -> None:
    if not fields:
        return
    set_clauses, values = [], []
    for k, v in fields.items():
        set_clauses.append(f"{k} = %s")
        values.append(Json(v) if k == "permissions" else v)
    values.append(staff_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE org_staff SET {', '.join(set_clauses)} WHERE id = %s",
                values,
            )
        conn.commit()


# ─── Admin Enforcement ───────────────────────────────────────────────────────

def block_org(org_id: int, reason: str, admin_id: int) -> Optional[dict]:
    """Suspend an org for policy/standards violation. Records reason and logs the action."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE org_profile
                   SET is_active = FALSE,
                       suspension_reason = %s,
                       suspended_at = NOW(),
                       suspended_by = %s,
                       updated_at = NOW()
                 WHERE id = %s
                RETURNING id, org_name, is_active, suspension_reason, suspended_at
                """,
                (reason, admin_id, org_id),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    "INSERT INTO org_admin_action (org_id, action, reason, performed_by) VALUES (%s, %s, %s, %s)",
                    (org_id, "blocked", reason, admin_id),
                )
        conn.commit()
    return row


def unblock_org(org_id: int, note: Optional[str], admin_id: int) -> Optional[dict]:
    """Restore a blocked org — clears suspension fields and marks active."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE org_profile
                   SET is_active = TRUE,
                       suspension_reason = NULL,
                       suspended_at = NULL,
                       suspended_by = NULL,
                       updated_at = NOW()
                 WHERE id = %s
                RETURNING id, org_name, is_active
                """,
                (org_id,),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    "INSERT INTO org_admin_action (org_id, action, reason, performed_by) VALUES (%s, %s, %s, %s)",
                    (org_id, "unblocked", note, admin_id),
                )
        conn.commit()
    return row


def log_org_action(org_id: int, action: str, reason: Optional[str], admin_id: int) -> None:
    """Insert a generic admin action into the audit log."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO org_admin_action (org_id, action, reason, performed_by) VALUES (%s, %s, %s, %s)",
                (org_id, action, reason, admin_id),
            )
        conn.commit()


def get_org_action_log(org_id: int) -> list:
    """Return full audit trail of admin enforcement actions for an org, newest first."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id, a.action, a.reason, a.created_at,
                       u.full_name AS admin_name, u.email AS admin_email
                  FROM org_admin_action a
                  LEFT JOIN users u ON u.id = a.performed_by
                 WHERE a.org_id = %s
                 ORDER BY a.created_at DESC
                """,
                (org_id,),
            )
            return cur.fetchall()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _generate_slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    slug, counter = base, 1
    with get_connection() as conn:
        with conn.cursor() as cur:
            while True:
                cur.execute("SELECT 1 FROM org_profile WHERE slug = %s", (slug,))
                if not cur.fetchone():
                    break
                slug = f"{base}-{counter}"
                counter += 1
    return slug
