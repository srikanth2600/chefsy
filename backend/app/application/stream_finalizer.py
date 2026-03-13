import json
import logging
from psycopg.types.json import Json

from app.core.db import get_connection
from app.services import recipe_persistence
from app.application.chat_block_service import add_block
from app.core.config import settings

logger = logging.getLogger(__name__)


def _publish_done(chat_id: int) -> None:
    """Publish 'done' event to Redis so SSE clients re-fetch the final snapshot."""
    try:
        import redis as _redis_mod
        rc = _redis_mod.from_url(settings.redis_url, decode_responses=True)
        rc.publish(f"chat:{chat_id}", json.dumps({"type": "done"}))
        logger.info("stream_finalizer: published done for chat_id=%s", chat_id)
    except Exception:
        logger.exception("stream_finalizer: failed to publish done for chat_id=%s", chat_id)


def finalize_streamed_recipe(
    chat_id: int,
    block_id: int | None,
    assistant_message_id: int | None,
    recipe_key: str,
    title: str,
    provider: str | None = None,
) -> int | None:
    """
    Read accumulated text from a text block, extract JSON, validate/coerce,
    persist recipe, update assistant message, add recipe block, THEN publish done.

    'done' is published AFTER all DB writes so the frontend snapshot always
    sees the fully structured recipe block (not raw text).

    Returns recipe_id on success, or None on failure.
    """
    try:
        print(f"[FINALIZE] starting chat_id={chat_id} block_id={block_id} "
              f"message_id={assistant_message_id} recipe_key={recipe_key}")

        # ── Step 1: Read full streamed text from the text block ───────────────
        final_text = ""
        if block_id is not None:
            try:
                with get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT content_json FROM chat_content_block WHERE id = %s",
                            (block_id,),
                        )
                        row = cur.fetchone()
                        if row:
                            cj = row.get("content_json") or {}
                            final_text = cj.get("text", "") if isinstance(cj, dict) else ""
            except Exception:
                logger.exception(
                    "stream_finalizer: failed to read block text for block_id=%s", block_id
                )

        print(f"[FINALIZE] text length={len(final_text)} first_200={final_text[:200]!r}")

        if not final_text:
            logger.warning(
                "stream_finalizer: empty text for block_id=%s chat_id=%s — skipping",
                block_id, chat_id,
            )
            _publish_done(chat_id)
            return None

        # ── Step 2: Parse and validate JSON ───────────────────────────────────
        validated = None
        try:
            from app.application.recipe_service import (
                _extract_json, _clean_json_for_parse, _validate_and_coerce
            )
            extracted = _extract_json(final_text)
            cleaned   = _clean_json_for_parse(extracted)
            print(f"[FINALIZE] cleaned JSON first 300: {cleaned[:300]!r}")
            parsed    = json.loads(cleaned)
            validated = _validate_and_coerce(parsed)
            # Preserve raw LLM text for debugging (truncate to avoid huge payloads)
            ai_ctx = validated.get("ai_context") if isinstance(validated.get("ai_context"), dict) else {}
            ai_ctx = dict(ai_ctx or {})
            ai_ctx.setdefault("raw_llm_text", final_text[:4000])
            validated["ai_context"] = ai_ctx
            # Ensure provider info is preserved for admin display
            if provider:
                meta = validated.get("meta") if isinstance(validated.get("meta"), dict) else {}
                meta = dict(meta or {})
                meta.setdefault("generated_by", provider)
                meta.setdefault("provider", provider)
                validated["meta"] = meta
            print(f"[FINALIZE] validated OK title={validated.get('title')!r} "
                  f"ingredients={len(validated.get('ingredients') or [])} "
                  f"steps={len(validated.get('steps') or [])}")
        except Exception as e:
            print(f"[FINALIZE] PARSE FAILED: {type(e).__name__}: {e}")
            logger.exception(
                "stream_finalizer: failed to parse/validate JSON for chat_id=%s. "
                "Raw text (first 500): %s", chat_id, final_text[:500],
            )
            _publish_done(chat_id)
            return None   # ← single except, always returns here on failure

        # ── Step 3: Persist recipe to recipe_master ───────────────────────────
        try:
            recipe_id = recipe_persistence.save_generated_recipe(
                recipe_key,
                validated,
                validated.get("title") or title,
                validated.get("servings") or 2,
            )
            print(f"[FINALIZE] persisted recipe_key={recipe_key} recipe_id={recipe_id}")
        except Exception:
            logger.exception(
                "stream_finalizer: failed to persist recipe_key=%s chat_id=%s",
                recipe_key, chat_id,
            )
            _publish_done(chat_id)
            return None

        # ── Step 4: Update chat_message with recipe_id + recipe_json ──────────
        if assistant_message_id is not None:
            try:
                with get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE chat_message SET recipe_id = %s, recipe_json = %s WHERE id = %s",
                            (recipe_id, Json(validated), assistant_message_id),
                        )
                        conn.commit()
                logger.info(
                    "stream_finalizer: updated message_id=%s with recipe_id=%s",
                    assistant_message_id, recipe_id,
                )
            except Exception:
                logger.exception(
                    "stream_finalizer: failed to update message id=%s", assistant_message_id
                )

        # ── Step 5: Add structured recipe content block ───────────────────────
        if assistant_message_id is not None:
            try:
                add_block(assistant_message_id, "recipe", {"recipe_id": recipe_id}, 2)
                logger.info(
                    "stream_finalizer: added recipe block for message_id=%s",
                    assistant_message_id,
                )
            except Exception:
                logger.exception(
                    "stream_finalizer: failed to add recipe block for message_id=%s",
                    assistant_message_id,
                )

        # ── Step 6: Replace raw text block with clean summary ─────────────────
        if block_id is not None:
            try:
                clean_title = validated.get("title") or title
                with get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE chat_content_block SET content_json = %s WHERE id = %s",
                            (Json({"text": f"Here's your recipe for {clean_title}!"}), block_id),
                        )
                        conn.commit()
            except Exception:
                logger.exception(
                    "stream_finalizer: failed to clean text block id=%s", block_id
                )

        # ── Step 7: Publish done AFTER all DB writes ───────────────────────────
        _publish_done(chat_id)
        return int(recipe_id)

    except Exception:
        logger.exception(
            "stream_finalizer: unexpected error for chat_id=%s", chat_id
        )
        _publish_done(chat_id)
        return None
