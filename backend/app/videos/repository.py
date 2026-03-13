from app.core.db import get_connection
from typing import Optional, List, Dict


def create_video(user_id: int, url: str, title: str | None, description: str | None, recipe_id: int | None, status: str = "approved") -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO videos (user_id, recipe_id, url, title, description, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (user_id, recipe_id, url, title, description, status),
            )
            vid = cur.fetchone()["id"]
            conn.commit()
            return vid


def get_video_by_id(video_id: int) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.url, v.title, v.description, v.recipe_id, rm.recipe_key, v.user_id
                FROM videos v
                LEFT JOIN recipe_master rm ON rm.id = v.recipe_id
                WHERE v.id = %s
                """,
                (video_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def list_user_videos(user_id: int, limit: int = 3) -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.id, v.url, v.title, rm.recipe_key
                FROM videos v
                LEFT JOIN recipe_master rm ON rm.id = v.recipe_id
                WHERE v.user_id = %s AND v.status IN ('approved', 'pending')
                ORDER BY v.id DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
            return [dict(r) for r in rows]

