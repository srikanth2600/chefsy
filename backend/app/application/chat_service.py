"""
Chat session and message handling.
Uses existing db from app.core.db. Rows ordered by created_at ASC.
"""

from typing import Any

from psycopg.types.json import Json

from app.core.db import get_connection
import psycopg


def create_chat(user_id: int) -> int:
    """Create a new chat session for the user. Returns the new chat_id."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chat_session (user_id) VALUES (%s) RETURNING id",
                (user_id,),
            )
            row = cur.fetchone()
            conn.commit()
            return row["id"]


def add_message(
    chat_id: int,
    role: str,
    content: str | None = None,
    recipe_id: int | None = None,
    recipe_json: dict[str, Any] | None = None,
) -> int | None:
    """Append a message to a chat. role is 'user' or 'assistant'. Returns the new message id."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if role == "user":
                cur.execute(
                    "INSERT INTO chat_message (chat_id, role, content) VALUES (%s, %s, %s) RETURNING id",
                    (chat_id, role, content or ""),
                )
            else:
                # Standard assistant insert — requires `recipe_id` and `recipe_json` columns in chat_message.
                cur.execute(
                    """
                    INSERT INTO chat_message (chat_id, role, recipe_id, recipe_json)
                    VALUES (%s, 'assistant', %s, %s)
                    RETURNING id
                    """,
                    (chat_id, recipe_id, Json(recipe_json) if recipe_json is not None else None),
                )
            row = cur.fetchone()
            conn.commit()
            return row["id"] if row else None


def get_chat_messages(chat_id: int) -> list[dict[str, Any]]:
    """Return all messages for the chat, ordered by created_at ASC. Each row: id, role, content, recipe_json."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, role, content, recipe_json
                FROM chat_message
                WHERE chat_id = %s
                ORDER BY created_at ASC
                """,
                (chat_id,),
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]


def get_chat_user_id(chat_id: int) -> int | None:
    """Return user_id that owns the chat, or None if chat does not exist."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM chat_session WHERE id = %s", (chat_id,))
            row = cur.fetchone()
            return row["user_id"] if row else None
