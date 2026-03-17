"""
Content blocks for chat messages (text, recipe, video, ad, cta).
"""

from typing import Any

from psycopg.types.json import Json

from app.core.db import get_connection
from app.core.config import settings
import redis

ALLOWED_BLOCK_TYPES = frozenset({"text", "recipe", "video", "ad", "cta", "meal_plan"})


def add_block(
    message_id: int,
    block_type: str,
    content_json: dict[str, Any],
    order: int,
) -> int:
    """Insert a content block for a message. Returns the new block id."""
    if block_type not in ALLOWED_BLOCK_TYPES:
        raise ValueError(f"block_type must be one of {ALLOWED_BLOCK_TYPES}")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chat_content_block (message_id, block_type, content_json, display_order)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (message_id, block_type, Json(content_json), order),
            )
            row = cur.fetchone()
            conn.commit()
            return row["id"]


def get_blocks_for_chat(chat_id: int) -> list[dict[str, Any]]:
    """Return all blocks for the chat, grouped by message, ordered by message created_at and display_order."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT b.id, b.message_id, b.block_type, b.content_json, b.display_order, b.created_at
                FROM chat_content_block b
                JOIN chat_message m ON m.id = b.message_id
                WHERE m.chat_id = %s
                ORDER BY m.created_at ASC, b.display_order ASC
                """,
                (chat_id,),
            )
            rows = cur.fetchall()
            return [dict(row) for row in rows]


def append_text_to_block(block_id: int, text_append: str) -> None:
    """Append text to an existing text block's content_json.text field."""
    if not text_append:
        return
    with get_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute("SELECT content_json FROM chat_content_block WHERE id = %s FOR UPDATE", (block_id,))
                row = cur.fetchone()
                if not row:
                    return
                content = row.get("content_json") or {}
                existing = content.get("text", "") if isinstance(content, dict) else ""
                new_text = (existing or "") + str(text_append)
                new_content = {"text": new_text}
                cur.execute("UPDATE chat_content_block SET content_json = %s WHERE id = %s", (Json(new_content), block_id))
                conn.commit()
                # Read back and log new length for debugging
                try:
                    cur.execute("SELECT content_json FROM chat_content_block WHERE id = %s", (block_id,))
                    updated = cur.fetchone()
                    updated_content = updated.get("content_json") if updated else {}
                    logger = logging.getLogger(__name__)
                    txt = (updated_content or {}).get("text", "") if isinstance(updated_content, dict) else ""
                    logger.info("append_text_to_block: updated block_id=%s new_len=%d", block_id, len(txt))
                except Exception:
                    pass
                # Publish update to Redis channel so SSE can push immediately
                try:
                    # determine chat_id for this block
                    cur.execute("SELECT m.chat_id FROM chat_content_block b JOIN chat_message m ON m.id = b.message_id WHERE b.id = %s", (block_id,))
                    r = cur.fetchone()
                    chat_id = r["chat_id"] if r else None
                    if chat_id:
                        try:
                            # publish structured block update
                            rc = redis.from_url(settings.redis_url, decode_responses=True)
                            payload = json.dumps({"type": "block_update", "chat_id": chat_id, "block_id": block_id, "content": new_content})
                            rc.publish(f"chat:{chat_id}", payload)
                        except Exception:
                            logger.exception("Failed to publish chat block update to Redis for chat_id=%s", chat_id)
                except Exception:
                    # ignore redis publish failures
                    pass
            except Exception:
                conn.rollback()
                raise
