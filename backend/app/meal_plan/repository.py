from typing import Any, Optional
from psycopg.types.json import Json
from app.core.db import get_connection


def create_meal_plan(user_id: int, data: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO meal_plan (user_id, name, description, week_start_date, servings, preferences_json, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'active')
                RETURNING id
                """,
                (
                    user_id,
                    data.get("name", "My Meal Plan"),
                    data.get("description"),
                    data.get("week_start_date"),
                    data.get("servings", 2),
                    Json(data["preferences_json"]) if data.get("preferences_json") else None,
                ),
            )
            plan_id = cur.fetchone()["id"]
            conn.commit()
            return plan_id


def get_meal_plans_for_user(user_id: int, page: int = 1, per_page: int = 20, status: str = "active"):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM meal_plan WHERE user_id = %s AND status = %s",
                (user_id, status),
            )
            total = cur.fetchone()["cnt"]
            cur.execute(
                """
                SELECT mp.id, mp.user_id, mp.name, mp.description, mp.week_start_date,
                       mp.servings, mp.preferences_json, mp.status,
                       mp.created_at, mp.updated_at,
                       COUNT(s.id) AS slot_count
                FROM meal_plan mp
                LEFT JOIN meal_plan_slot s ON s.meal_plan_id = mp.id
                WHERE mp.user_id = %s AND mp.status = %s
                GROUP BY mp.id
                ORDER BY mp.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (user_id, status, per_page, (page - 1) * per_page),
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows], total


def get_meal_plan_by_id(plan_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM meal_plan WHERE id = %s",
                (plan_id,),
            )
            r = cur.fetchone()
            return dict(r) if r else None


def get_slots_for_plan(plan_id: int) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, s.meal_plan_id, s.day_index, s.meal_type,
                       s.recipe_id, s.meal_name, s.meal_json, s.sort_order,
                       rm.title AS recipe_title, rm.recipe_key, rm.image_path
                FROM meal_plan_slot s
                LEFT JOIN recipe_master rm ON rm.id = s.recipe_id
                WHERE s.meal_plan_id = %s
                ORDER BY s.day_index ASC, s.sort_order ASC
                """,
                (plan_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def update_meal_plan(plan_id: int, data: dict) -> None:
    fields = []
    values = []
    for key in ("name", "description", "week_start_date", "status"):
        if key in data and data[key] is not None:
            fields.append(f"{key} = %s")
            values.append(data[key])
    if "preferences_json_raw" in data and data["preferences_json_raw"] is not None:
        fields.append("preferences_json = %s")
        values.append(Json(data["preferences_json_raw"]))
    if not fields:
        return
    fields.append("updated_at = NOW()")
    values.append(plan_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE meal_plan SET {', '.join(fields)} WHERE id = %s",
                values,
            )
            conn.commit()


def delete_meal_plan(plan_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meal_plan WHERE id = %s", (plan_id,))
            conn.commit()


def insert_slot(plan_id: int, slot: dict) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO meal_plan_slot
                  (meal_plan_id, day_index, meal_type, recipe_id, meal_name, meal_json, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (meal_plan_id, day_index, meal_type) DO UPDATE
                  SET recipe_id = EXCLUDED.recipe_id,
                      meal_name = EXCLUDED.meal_name,
                      meal_json = EXCLUDED.meal_json,
                      updated_at = NOW()
                RETURNING id
                """,
                (
                    plan_id,
                    slot["day_index"],
                    slot["meal_type"],
                    slot.get("recipe_id"),
                    slot.get("meal_name"),
                    Json(slot["meal_json"]) if slot.get("meal_json") else None,
                    slot.get("sort_order", 0),
                ),
            )
            row = cur.fetchone()
            conn.commit()
            return row["id"]


def bulk_insert_slots(plan_id: int, slots: list[dict]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            for slot in slots:
                cur.execute(
                    """
                    INSERT INTO meal_plan_slot
                      (meal_plan_id, day_index, meal_type, recipe_id, meal_name, meal_json, sort_order)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (meal_plan_id, day_index, meal_type) DO UPDATE
                      SET recipe_id = EXCLUDED.recipe_id,
                          meal_name = EXCLUDED.meal_name,
                          meal_json = EXCLUDED.meal_json,
                          updated_at = NOW()
                    """,
                    (
                        plan_id,
                        slot["day_index"],
                        slot["meal_type"],
                        slot.get("recipe_id"),
                        slot.get("meal_name"),
                        Json(slot["meal_json"]) if slot.get("meal_json") else None,
                        slot.get("sort_order", 0),
                    ),
                )
            conn.commit()


def update_slot(slot_id: int, data: dict) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            if "recipe_id" in data:
                cur.execute("UPDATE meal_plan_slot SET recipe_id = %s, updated_at = NOW() WHERE id = %s", (data["recipe_id"], slot_id))
            if "meal_name" in data:
                cur.execute("UPDATE meal_plan_slot SET meal_name = %s, updated_at = NOW() WHERE id = %s", (data["meal_name"], slot_id))
            if "meal_json" in data:
                cur.execute("UPDATE meal_plan_slot SET meal_json = %s, updated_at = NOW() WHERE id = %s", (Json(data["meal_json"]) if data["meal_json"] else None, slot_id))
            conn.commit()
            cur.execute("SELECT * FROM meal_plan_slot WHERE id = %s", (slot_id,))
            r = cur.fetchone()
            return dict(r) if r else None


def delete_slots_for_plan(plan_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM meal_plan_slot WHERE meal_plan_id = %s", (plan_id,))
            conn.commit()


def count_plans_for_user(user_id: int) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM meal_plan WHERE user_id = %s AND status = 'active'", (user_id,))
            return cur.fetchone()["cnt"]


def get_slot_by_id(slot_id: int) -> Optional[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM meal_plan_slot WHERE id = %s", (slot_id,))
            r = cur.fetchone()
            return dict(r) if r else None