import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from psycopg.types.json import Json

import logging

from app.application.chat_block_service import add_block, get_blocks_for_chat
from app.application.chat_service import add_message, create_chat, get_chat_messages, get_chat_user_id
from app.application.chat_block_service import append_text_to_block
from app.application.recipe_retriever import build_recipe_text_for_index
from app.application.recipe_service import retriever, _extract_intent_keywords
from app.services import cache_service, recipe_persistence, ingredient_service
from app.services import search_service
from app.core.db import get_connection
from app.services.image_generator import generate_ingredient_image, generate_recipe_image
from app.services.recipe_generator import generate_recipe
from app.services.ingredient_emojis import get_ingredient_emojis
from app.services import cache_service, recipe_persistence, ingredient_service
from app.core.config import settings
import httpx
from app.domain.ingredient import normalize_ingredient_name, normalize_ingredient_alias_key
from app.domain.nutrition import aggregate_nutrition
import json
import subprocess
import threading
from app.core.redis import redis_client


router = APIRouter()
logger = logging.getLogger(__name__)
STOPWORD_TOKENS = {
    "vegetable", "mixed", "fresh", "easy", "quick", "recipe",
    "recipes", "classic", "indian", "asian", "dish",
}


def _token_set(s: str) -> set[str]:
    return set(re.findall(r"\w+", (s or "").lower()))


def _is_significant_match(query: str, recipe: dict) -> bool:
    """
    Return True when the recipe title or ingredient names contain at least
    one non-trivial token from the user's query.
    """
    try:
        q_tokens = _token_set(query) - STOPWORD_TOKENS
        if not q_tokens:
            return True
        title_tokens = _token_set(recipe.get("title") or "")
        ing_tokens = set()
        for ing in (recipe.get("ingredients") or []):
            if isinstance(ing, dict):
                ing_tokens.update(_token_set(ing.get("name") or ""))
            else:
                ing_tokens.update(_token_set(str(ing)))
        return bool(q_tokens & (title_tokens | ing_tokens))
    except Exception:
        return True


@router.get("/providers")
def list_providers() -> dict[str, Any]:
    """
    Return available provider modules and any provider-specific metadata (e.g., ollama models).
    """
    providers: list[dict[str, str]] = []
    # OpenAI / GPT entry (use friendly label)
    providers.append({"id": "openai", "label": settings.openai_model})
    # Groq (OpenAI-compatible) models
    for m in getattr(settings, "groq_models", []):
        providers.append({"id": f"groq:{m}", "label": m})
    # Include any configured ollama models as separate selectable providers
    for m in getattr(settings, "ollama_models", []):
        providers.append({"id": f"ollama:{m}", "label": m})
    # Determine default provider id. Prefer default_ollama_model when default_llm_provider is "ollama".
    default_id = None
    if getattr(settings, "default_llm_provider", "") == "ollama" and getattr(settings, "default_ollama_model", None):
        default_id = f"ollama:{settings.default_ollama_model}"
    if getattr(settings, "default_llm_provider", "") == "groq" and getattr(settings, "groq_model", None):
        default_id = f"groq:{settings.groq_model}"
    if not default_id:
        default = settings.default_llm_provider
        default_id = default
    # Fallback to first provider if default_id still unset
    if not default_id and providers:
        default_id = providers[0]["id"]
    return {
        "providers": providers,
        "default": default_id,
        "ollama_models": settings.ollama_models,
        "default_ollama_model": settings.default_ollama_model,
    }


class ChatRequest(BaseModel):
    chat_id: int | None = None  # null when new chat
    message: str
    include_videos: bool = False


# Common typos and variants → canonical form for recipe/vector search and cache
QUERY_NORMALIZE_MAP = {
    "recipt": "recipe",
    "reciepe": "recipe",
    "recepie": "recipe",
    "receipe": "recipe",
    "recipie": "recipe",
    "recepy": "recipe",
    "recipy": "recipe",
    "vegg": "veg",
    "vegitabel": "vegetable",
    "vegtabel": "vegetable",
    "briyani": "biryani",
    "biriyani": "biryani",
    "pulav": "pulao",
    "pulao": "pulao",
}


def sanitize_user_query(raw: str) -> str:
    """Normalize user message for recipe key and vector search: fix typos, trim, lowercase for matching."""
    if not raw or not isinstance(raw, str):
        return "Sample Recipe"
    s = raw.strip()
    if not s:
        return "Sample Recipe"
    s = s.lower()
    tokens = re.split(r"\s+", s)
    fixed = [QUERY_NORMALIZE_MAP.get(t, t) for t in tokens if t]
    return " ".join(fixed) if fixed else "Sample Recipe"


def normalize_recipe_key(message: str) -> str:
    """Build stable recipe_key from normalized query for DB/vector lookup."""
    cleaned = sanitize_user_query(message)
    cleaned = re.sub(r"[^a-z0-9\s\-]", "", cleaned)
    tokens = re.split(r"\s+", cleaned)
    alias_map = {
        "veg": "vegetable",
        "veggie": "vegetable",
        "briyani": "biryani",
        "biriyani": "biryani",
        "pulav": "pulao",
    }
    normalized = [alias_map.get(token, token) for token in tokens if token]
    cleaned = "-".join(normalized)
    cleaned = re.sub(r"-+", "-", cleaned)
    return cleaned or "sample-recipe"


def _fetch_youtube_sync(title: str, limit: int = 2) -> list[dict]:
    """Sync YouTube search for recipe title. Returns list of video dicts or empty list on failure."""
    key = getattr(settings, "youtube_api_key", None)
    if not key:
        return []
    api = "https://www.googleapis.com/youtube/v3/search"
    params = {"part": "snippet", "q": title, "type": "video", "maxResults": limit, "key": key}
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(api, params=params)
    except Exception:
        return []
    if resp.status_code != 200:
        return []
    data = resp.json()
    items = data.get("items", []) or []
    videos = []
    for it in items:
        id_obj = it.get("id", {})
        vid = id_obj.get("videoId") if isinstance(id_obj, dict) else None
        if not vid:
            continue
        sn = it.get("snippet", {})
        thumbnails = sn.get("thumbnails", {}) or {}
        thumb = thumbnails.get("medium", {}).get("url") or thumbnails.get("default", {}).get("url")
        videos.append({
            "title": sn.get("title"),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "watchUrl": f"https://www.youtube.com/watch?v={vid}",
            "thumbnail": thumb,
            "channel": sn.get("channelTitle"),
        })
    return videos


@router.post("/chat/{chat_id}/video_search")
def chat_video_search(chat_id: int, payload: dict, request: Request):
    """
    Lookup YouTube videos for a title and attach them as a 'video' content block
    to the given chat's latest assistant message (or specified message_id).
    Payload: { title: str, message_id?: int, limit?: int }
    Returns: messages snapshot for chat.
    """
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    title = (payload.get("title") or "").strip()
    limit = int(payload.get("limit") or 2)
    try:
        # Verify ownership of chat
        owner = get_chat_user_id(chat_id)
        if owner is None or owner != user_id:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Determine target assistant message to attach video block
        message_id = payload.get("message_id")
        if not message_id:
            # find latest assistant message id for this chat
            rows = get_chat_messages(chat_id)
            # rows ordered by created_at ASC, so find last assistant
            message_id = None
            for r in reversed(rows):
                if r.get("role") == "assistant":
                    message_id = r.get("id")
                    break

        if not message_id:
            # No assistant message yet — create one
            message_id = add_message(chat_id, "assistant", recipe_id=None, recipe_json=None)

        # Fetch videos (cached DB lookup or YouTube API)
        videos = _get_videos_for_keyword(title, limit)

        if videos:
            # attach as a content block and include video_ids for re-use
            try:
                # compute next display order for this message
                with get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT COALESCE(MAX(display_order), 0) AS max_order FROM chat_content_block WHERE message_id = %s", (message_id,))
                        r = cur.fetchone()
                        next_order = (r["max_order"] if r and r.get("max_order") is not None else 0) + 1
                video_ids = [v.get("id") for v in videos if v.get("id") is not None]
                block_id = add_block(message_id, "video", {"video_ids": video_ids, "videos": videos}, next_order)
            except Exception:
                logger.exception("[CHAT] failed to insert video block for chat_id=%s message_id=%s", chat_id, message_id)

        # publish a lightweight notification so SSE clients can refresh snapshot if subscribed
        try:
            import redis as _redis_mod
            rc = _redis_mod.from_url(settings.redis_url, decode_responses=True)
            rc.publish(f"chat:{chat_id}", json.dumps({"type": "block_insert", "chat_id": chat_id, "message_id": message_id}))
        except Exception:
            logger.exception("[CHAT] failed to publish video block insert for chat_id=%s", chat_id)

        messages = _messages_with_blocks(chat_id)
        return {"chat_id": chat_id, "messages": messages}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[CHAT] chat_video_search failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to search and attach videos") from exc


def _get_videos_for_keyword(keyword: str, limit: int = 2) -> list[dict]:
    """Return videos for keyword: from DB if stored, else fetch from YouTube API, store in DB, then return."""
    if not keyword or not keyword.strip():
        return []
    k = keyword.strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, url, title, thumbnail, channel
                FROM videos
                WHERE keyword = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (k, limit),
            )
            rows = cur.fetchall()
    if rows:
        return [
            {
                "id": r.get("id"),
                "title": r.get("title"),
                "url": r["url"],
                "watchUrl": r["url"],
                "thumbnail": r.get("thumbnail"),
                "channel": r.get("channel"),
            }
            for r in rows
        ]
    videos = _fetch_youtube_sync(k, limit)
    if not videos:
        return []
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Insert each video and capture inserted id so blocks can reference reusable video rows
            for v in videos:
                cur.execute(
                    """
                    INSERT INTO videos (keyword, url, title, thumbnail, channel, status)
                    VALUES (%s, %s, %s, %s, %s, 'approved')
                    RETURNING id
                    """,
                    (k, v.get("url") or v.get("watchUrl"), v.get("title"), v.get("thumbnail"), v.get("channel")),
                )
                row = cur.fetchone()
                if row:
                    v["id"] = row.get("id")
            conn.commit()
    # Ensure returned dicts include id where available
    return [{**v, "id": v.get("id")} for v in videos]


def _build_chat_response(chat_id: int, response_dict: dict, headers: dict, include_videos: bool = False) -> JSONResponse:
    """
    Insert assistant message + all content blocks in a SINGLE transaction.
    This replaces 5 separate DB round-trips with one, making cache hits fast.
    """
    from psycopg.types.json import Json as _Json
    recipe_id = response_dict.get("recipe_id")
    title = response_dict.get("title") or ""

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Insert assistant message
                cur.execute(
                    """
                    INSERT INTO chat_message (chat_id, role, recipe_id, recipe_json)
                    VALUES (%s, %s, %s, %s) RETURNING id
                    """,
                    (chat_id, "assistant", recipe_id, _Json(response_dict)),
                )
                row = cur.fetchone()
                message_id = row["id"] if row else None

                if message_id is not None:
                    # 2. Insert text + recipe blocks in same transaction
                    cur.execute(
                        "INSERT INTO chat_content_block (message_id, block_type, content_json, display_order) VALUES (%s, %s, %s, %s)",
                        (message_id, "text", _Json({"text": f"Here's your recipe for {title}!"}), 1),
                    )
                    cur.execute(
                        "INSERT INTO chat_content_block (message_id, block_type, content_json, display_order) VALUES (%s, %s, %s, %s)",
                        (message_id, "recipe", _Json({"recipe_id": recipe_id}), 2),
                    )
                    cur.execute(
                        "INSERT INTO chat_content_block (message_id, block_type, content_json, display_order) VALUES (%s, %s, %s, %s)",
                        (message_id, "ad", _Json({"ad_id": 1, "title": "Sponsored"}), 4),
                    )
                    cur.execute(
                        "INSERT INTO chat_content_block (message_id, block_type, content_json, display_order) VALUES (%s, %s, %s, %s)",
                        (message_id, "cta", _Json({"label": "Find a chef / restaurant", "url": "/find-chef"}), 5),
                    )
                conn.commit()
    except Exception as exc:
        logger.exception("[CHAT] _build_chat_response batch insert failed: %s", exc)
        # fallback: original approach
        message_id = add_message(chat_id, "assistant", recipe_id=recipe_id, recipe_json=response_dict)
        if message_id is not None:
            try:
                add_block(message_id, "text", {"text": f"Here's your recipe for {title}!"}, 1)
                add_block(message_id, "recipe", {"recipe_id": recipe_id}, 2)
                add_block(message_id, "ad", {"ad_id": 1, "title": "Sponsored"}, 4)
                add_block(message_id, "cta", {"label": "Find a chef / restaurant", "url": "/find-chef"}, 5)
            except Exception:
                logger.exception("[CHAT] fallback block inserts also failed for message_id=%s", message_id)

    messages = _messages_with_blocks(chat_id)
    return JSONResponse(content={"chat_id": chat_id, "messages": messages}, headers=headers)



@router.get("/health")
def health_check() -> dict:
    return {"status": "ok"}



@router.post("/chat_sessions")
def create_chat_session(http_request: Request):
    """
    Create a new chat session for the authenticated user and return the chat_id immediately.
    """
    user_id = _get_user_from_request(http_request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        chat_id = create_chat(user_id)
        logger.info("[CHAT] created new session via /chat_sessions chat_id=%s user_id=%s", chat_id, user_id)
        return {"chat_id": chat_id}
    except Exception as exc:
        logger.exception("[CHAT] create_chat_session failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create chat session") from exc


def _messages_with_blocks(chat_id: int) -> list[dict]:
    """Build messages list with blocks for assistant messages (for GET /chat/:id and POST /chat response)."""
    rows = get_chat_messages(chat_id)
    blocks_by_message: dict[int, list] = {}
    for b in get_blocks_for_chat(chat_id):
        mid = b["message_id"]
        if mid not in blocks_by_message:
            blocks_by_message[mid] = []
        # include block id so frontend can correlate streaming block_id with persisted block
        blocks_by_message[mid].append({
            "id": b.get("id"),
            "block_id": b.get("id"),
            "block_type": b["block_type"],
            "content_json": b["content_json"],
            "display_order": b["display_order"],
        })
    messages = []
    for row in rows:
        msg_id = row.get("id")
        if row["role"] == "user":
            messages.append({"role": "user", "content": row.get("content") or "", "id": msg_id})
        else:
            blocks = blocks_by_message.get(msg_id, []) if msg_id else []
            messages.append({
                "role": "assistant",
                "id": msg_id,
                "recipe": row.get("recipe_json") or {},
                "blocks": sorted(blocks, key=lambda x: x["display_order"]),
            })
    return messages


@router.get("/recipes/recent")
def recent_recipes(http_request: Request, limit: int = 8):
    """
    Return recently generated recipes from recipe_master for the home screen suggestion cards.
    No auth required — public endpoint for fast cold-start UX.
    Returns: [{ recipe_key, title, cuisine, difficulty, estimated_time, image_url }]
    """
    limit = min(max(limit, 1), 20)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        recipe_key,
                        title,
                        image_path,
                        recipe_json,
                        updated_at
                    FROM recipe_master
                    WHERE title IS NOT NULL AND title != ''
                    ORDER BY updated_at DESC NULLS LAST
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()

        results = []
        for r in rows:
            rj = r.get("recipe_json") or {}
            meta = rj.get("meta") or {}
            results.append({
                "recipe_key": r["recipe_key"],
                "title": r["title"],
                "cuisine": meta.get("cuisine") or rj.get("cuisine") or "",
                "difficulty": meta.get("difficulty") or rj.get("difficulty") or "",
                "estimated_time": meta.get("estimated_time") or rj.get("estimated_time") or "",
                "image_url": r.get("image_path") or "",
                "tags": rj.get("tags") or [],
            })
        return {"recipes": results}
    except Exception as exc:
        logger.exception("/recipes/recent failed: %s", exc)
        return {"recipes": []}


@router.get("/recipes/{recipe_key}")
def get_recipe_by_key(recipe_key: str):
    """Return full recipe JSON for a given recipe_key. Public endpoint."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT recipe_key, title, image_path, recipe_json FROM recipe_master WHERE recipe_key = %s",
                    (recipe_key,),
                )
                row = cur.fetchone()
        if not row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Recipe not found")
        return {"recipe_key": row["recipe_key"], "title": row["title"],
                "image_path": row.get("image_path"), "recipe": row.get("recipe_json") or {}}
    except Exception as exc:
        logger.exception("/recipes/%s failed: %s", recipe_key, exc)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to load recipe")


@router.get("/chats")
def list_chats(http_request: Request):
    """List recent chats for the authenticated user. Returns up to 20 chats with chat_id and title (first user message)."""
    user_id = _get_user_from_request(http_request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cs.id AS chat_id,
                  (SELECT content FROM chat_message WHERE chat_id = cs.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) AS title
                FROM chat_session cs
                WHERE cs.user_id = %s
                ORDER BY (SELECT MAX(created_at) FROM chat_message WHERE chat_id = cs.id) DESC NULLS LAST, cs.id DESC
                LIMIT 20
                """,
                (user_id,),
            )
            rows = cur.fetchall()
    return {"chats": [{"chat_id": r["chat_id"], "title": (r["title"] or "New chat")[:80]} for r in rows]}


@router.get("/chat/{chat_id}")
def get_chat(chat_id: int, http_request: Request):
    """Get a single chat by id (messages with blocks). Auth required; chat must belong to user."""
    user_id = _get_user_from_request(http_request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    owner = get_chat_user_id(chat_id)
    if owner is None or owner != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")
    messages = _messages_with_blocks(chat_id)
    return {"chat_id": chat_id, "messages": messages}


@router.post("/chat")
def chat(request: ChatRequest, http_request: Request, module: str | None = None) -> dict:
    try:
        return _chat_impl(request, http_request, module)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[CHAT] uncaught error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _chat_impl(request: ChatRequest, http_request: Request, module: str | None = None) -> dict:
    logger.info("[CHAT] request body: chat_id=%s message=%r", getattr(request, "chat_id", None), (request.message or "")[:80])

    # Normalize user query so cache + vector search match (fix typos like "recipt" -> "recipe")
    raw_message = (request.message or "").strip()
    title = sanitize_user_query(raw_message or "Sample Recipe")
    recipe_key = normalize_recipe_key(title)
    logger.info("[CHAT] normalized title=%r recipe_key=%r", title, recipe_key)

    # Authenticate request using helper (keeps DB access out of this function)
    user_id = _get_user_from_request(http_request)
    if not user_id:
        logger.warning("[CHAT] auth failed: no user_id")
        raise HTTPException(status_code=401, detail="Authentication required")
    logger.info("[CHAT] user_id=%s", user_id)

    # If chat_id is missing or null → auto-create a session (ChatGPT-style)
    chat_id = getattr(request, "chat_id", None)
    if chat_id is None:
        try:
            chat_id = create_chat(user_id)
            logger.info("[CHAT] created new session chat_id=%s", chat_id)
        except Exception as exc:
            logger.exception("[CHAT] create_chat failed: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to create chat session") from exc
    else:
        owner = get_chat_user_id(chat_id)
        if owner is None or owner != user_id:
            logger.warning("[CHAT] chat_id=%s not owned by user_id=%s (owner=%s)", chat_id, user_id, owner)
            raise HTTPException(status_code=404, detail="Chat session not found")
        logger.info("[CHAT] using existing chat_id=%s", chat_id)

    try:
        add_message(chat_id, "user", content=raw_message or title)
        logger.info("[CHAT] user message inserted for chat_id=%s", chat_id)
    except Exception as exc:
        logger.exception("[CHAT] add_message(user) failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save message") from exc

    # Orchestrate via service layer (no direct SQL/cursor usage here)
    try:
        # Try cache first (inserts search log internally)
        # Try cache first (inserts search log internally). Provide title hint for fallback matching.
        cached = cache_service.get_cached_recipe(recipe_key, user_id, title_hint=title)
        if cached:
            logger.info("[CHAT] cache HIT recipe_key=%s recipe_id=%s", recipe_key, cached.get("recipe_id"))
            # Verify cached recipe actually matches user's requested dish
            if not _is_significant_match(title, cached):
                logger.info("[CHAT] cache HIT skipped due to token mismatch for title=%r", title)
            else:
                return _build_chat_response(chat_id, cached, {"x-cache-hit": "true"}, include_videos=request.include_videos)

        # If cache missed, run a faster DB/title lookup (exact/fuzzy/vector alias) before invoking LLM.
        try:
                found = search_service.lookup_recipe_by_query(title or raw_message)
                if found:
                    # build cached response from found recipe_key
                    try:
                        found_cached = cache_service.get_cached_recipe(found.get("recipe_key"), user_id)
                        if found_cached:
                            # Ensure the found recipe actually matches the user's requested dish
                            if not _is_significant_match(title, found_cached):
                                logger.info("[CHAT] fallback DB HIT skipped due to token mismatch for title=%r -> recipe_key=%s", title, found.get("recipe_key"))
                            else:
                                logger.info("[CHAT] fallback DB HIT for title=%r -> recipe_key=%s", title, found.get("recipe_key"))
                                return _build_chat_response(chat_id, found_cached, {"x-cache-hit": "true", "x-cache-fallback": "true"}, include_videos=request.include_videos)
                    except Exception:
                        logger.exception("[CHAT] failed to build cached response from found recipe")
        except Exception:
            logger.exception("[CHAT] search_service lookup failed")

        logger.info("[CHAT] cache MISS recipe_key=%s calling generate_recipe(module=%s)", recipe_key, module)
        # For Ollama providers, use streaming to engage the user.
        generated = None
        try:
            if module and module.startswith("ollama"):
                # Start background streaming generation using Ollama and persist deltas to DB.
                try:
                    assistant_message_id = add_message(chat_id, "assistant", recipe_id=None, recipe_json=None)
                except Exception:
                    assistant_message_id = None
                try:
                    if assistant_message_id is not None:
                        block_id = add_block(assistant_message_id, "text", {"text": ""}, 1)
                    else:
                        block_id = None
                except Exception:
                    block_id = None

                def _stream_worker():
                    try:
                        parts = module.split(":", 1)
                        model = parts[1] if len(parts) > 1 and parts[1] else settings.default_ollama_model
                        try:
                            from app.application.recipe_service import _make_system_prompt
                            system_prompt = _make_system_prompt()
                        except Exception:
                            system_prompt = "You are an expert chef and nutrition assistant. Return recipe as text."

                        prompt = f"{system_prompt}\nCreate a recipe for: {title}"

                        def _should_publish() -> bool:
                            try:
                                with get_connection() as _conn:
                                    with _conn.cursor() as _cur:
                                        _cur.execute(
                                            "SELECT id FROM chat_message WHERE chat_id = %s AND role = 'assistant' ORDER BY created_at DESC LIMIT 1",
                                            (chat_id,),
                                        )
                                        _r = _cur.fetchone()
                                        return bool(_r and _r.get("id") == assistant_message_id)
                            except Exception:
                                return True

                        used_http_stream = False
                        seq_counter = 0

                        # ✅ Create Redis client ONCE before the loop, not per token
                        try:
                            import redis as _redis_mod
                            rc = _redis_mod.from_url(settings.redis_url, decode_responses=True)
                        except Exception:
                            rc = None

                        # Try Ollama HTTP streaming
                        ollama_http_base = getattr(settings, "ollama_http_url", None) or "http://localhost:11434"
                        run_url = ollama_http_base.rstrip("/") + "/api/chat"
                        try:
                            logger.info("[CHAT] attempting HTTP stream to %s for model=%s", run_url, model)
                            messages_payload = []
                            if system_prompt:
                                messages_payload.append({"role": "system", "content": system_prompt})
                            messages_payload.append({"role": "user", "content": raw_message or title})
                            payload = {"model": model, "messages": messages_payload, "stream": True}
                            with httpx.Client(timeout=300.0) as client:
                                with client.stream("POST", run_url, json=payload, timeout=300.0) as resp:
                                    if resp.status_code == 200:
                                        used_http_stream = True
                                        buffer = ""
                                        for chunk in resp.iter_text(chunk_size=1024):
                                            if not chunk:
                                                continue
                                            buffer += chunk
                                            lines = buffer.splitlines(True)
                                            complete_lines = []
                                            # collect complete lines ending with newline
                                            for ln in lines:
                                                if ln.endswith("\n"):
                                                    complete_lines.append(ln.rstrip("\n"))
                                                else:
                                                    # keep remainder
                                                    buffer = ln
                                            for line in complete_lines:
                                                if not line.strip():
                                                    continue
                                                try:
                                                    obj = json.loads(line)
                                                    chunk_str = obj.get("message", {}).get("content", "") if isinstance(obj, dict) else line
                                                except Exception:
                                                    chunk_str = line
                                                if not chunk_str:
                                                    continue
                                                if block_id:
                                                    append_text_to_block(block_id, chunk_str)
                                                try:
                                                    payload_obj = {
                                                        "type": "token",
                                                        "source": "llm",
                                                        "text": chunk_str,
                                                        "block_id": block_id,
                                                        "seq": seq_counter,
                                                        "message_id": assistant_message_id,
                                                        "metadata": {},
                                                    }
                                                    if rc and _should_publish():
                                                        rc.publish(f"chat:{chat_id}", json.dumps(payload_obj))
                                                    seq_counter += 1
                                                except Exception:
                                                    logger.exception("[CHAT] failed to publish token to redis for chat_id=%s", chat_id)
                                    else:
                                        logger.warning("[CHAT] ollama http stream returned status %s; falling back to CLI", resp.status_code)
                        except Exception as exc:
                            logger.exception("[CHAT] ollama http stream attempt failed, will fallback to CLI: %s", exc)

                        # Finalize FIRST (persist recipe, update blocks),
                        # then finalize publishes 'done' so the frontend snapshot is always fresh.
                        if used_http_stream:
                            try:
                                from app.application.stream_finalizer import finalize_streamed_recipe
                                try:
                                    finalize_streamed_recipe(chat_id, block_id, assistant_message_id, recipe_key, title, module)
                                except Exception:
                                    logger.exception("[CHAT] finalize_streamed_recipe failed for chat_id=%s", chat_id)
                            except Exception:
                                logger.exception("[CHAT] failed to import finalize_streamed_recipe for chat_id=%s", chat_id)
                            return

                        # Fallback: run non-streaming CLI and simulate streaming by chunking output
                        try:
                            proc2 = subprocess.run(["ollama", "run", model, prompt], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
                            out = proc2.stdout or ""
                            if out and block_id:
                                append_text_to_block(block_id, out)
                                # split by sentences/newlines
                                import re
                                parts = [p for p in re.split(r'(\. |\n)', out) if p]
                                for p in parts:
                                    try:
                                        payload_obj = {
                                            "type": "token",
                                            "source": "llm",
                                            "text": p,
                                            "block_id": block_id,
                                            "seq": seq_counter,
                                            "message_id": assistant_message_id,
                                            "metadata": {},
                                        }
                                        if rc and _should_publish():
                                            rc.publish(f"chat:{chat_id}", json.dumps(payload_obj))
                                        seq_counter += 1
                                    except Exception:
                                        logger.exception("[CHAT] failed to publish fallback token to redis for chat_id=%s", chat_id)
                                try:
                                    from app.application.stream_finalizer import finalize_streamed_recipe
                                    try:
                                        finalize_streamed_recipe(chat_id, block_id, assistant_message_id, recipe_key, title, module)
                                    except Exception:
                                        logger.exception("[CHAT] finalize_streamed_recipe (fallback) failed for chat_id=%s", chat_id)
                                except Exception:
                                    logger.exception("[CHAT] failed to import finalize_streamed_recipe (fallback) for chat_id=%s", chat_id)
                        except Exception as exc:
                            logger.exception("[CHAT] ollama fallback run failed: %s", exc)
                    except Exception as exc:
                        logger.exception("[CHAT] ollama streaming worker failed: %s", exc)

                t = threading.Thread(target=_stream_worker, daemon=True)
                t.start()

                # Immediately return current messages; SSE subscriptions will stream updates as blocks change
                messages = _messages_with_blocks(chat_id)
                return JSONResponse(content={"chat_id": chat_id, "messages": messages}, headers={"x-llm-generation": "true"})
            else:
                # Non-ollama provider: generate synchronously (existing behavior)
                generated = generate_recipe(title, provider=module)
                logger.info("[CHAT] generate_recipe returned title=%r", (generated.get("title") or "")[:50])
        except Exception as exc:
            logger.exception("[CHAT] generate_recipe FAILED: %s", exc)
            # Insert an assistant error message via service call
            try:
                assistant_message_id = add_message(chat_id, "assistant", content="Sorry, I couldn't generate that recipe. Please try rephrasing.")
                try:
                    add_block(
                        assistant_message_id,
                        "text",
                        {"text": "⚠️ Recipe generation failed. Try simplifying your request."},
                        1,
                    )
                except Exception:
                    logger.exception("[CHAT] failed to insert error block for assistant message")
            except Exception:
                logger.exception("[CHAT] failed to persist assistant error message after generation failure")
            messages = _messages_with_blocks(chat_id)
            return JSONResponse(content={"chat_id": chat_id, "messages": messages})

        # Normalize generated fields
        steps = generated.get("steps") or []
        if not isinstance(steps, list):
            steps = []
        servings = generated.get("servings")
        if not isinstance(servings, int):
            servings = 2

        # Persist recipe + ingredients (service handles transactions)
        if module:
            meta = generated.get("meta") if isinstance(generated.get("meta"), dict) else {}
            meta = dict(meta or {})
            meta.setdefault("generated_by", module)
            meta.setdefault("provider", module)
            generated["meta"] = meta
        recipe_id = recipe_persistence.save_generated_recipe(recipe_key, generated, generated.get("title") or title, servings)
        logger.info("Stored recipe %s as id=%s", recipe_key, recipe_id)

        # Index recipe for semantic retrieval (best-effort)
        try:
            intent_tags = list(_extract_intent_keywords(title))
            recipe_text = build_recipe_text_for_index(generated)
            retriever.index_recipe(recipe_id, recipe_text, intent_tags=intent_tags)
        except Exception:
            pass

        # Generate recipe hero image asynchronously (best-effort) and update via service
        try:
            recipe_image_path = generate_recipe_image(generated.get("title") or title)
            if recipe_image_path:
                recipe_persistence.update_recipe_image(recipe_id, recipe_image_path)
                logger.info("Stored recipe image for %s -> %s", recipe_key, recipe_image_path)
        except Exception as exc:
            logger.exception("Recipe image generation failed for %s: %s", recipe_key, exc)

        # Fetch ingredients + nutrition via ingredient service
        resp_ingredients, nutrition_total = ingredient_service.get_recipe_ingredients(recipe_id)

        # Re-fetch stored recipe row via persistence service
        recipe_row = recipe_persistence.get_recipe_by_id(recipe_id) or {}

        response_dict = {
            "recipe_key": recipe_key,
            "recipe_id": recipe_id,
            "title": recipe_row.get("title") or generated.get("title") or title,
            "servings": recipe_row.get("servings") or servings,
            "steps": recipe_row.get("steps_json") or steps,
            "ingredients": resp_ingredients,
            "nutrition_total": nutrition_total,
            "tips": generated.get("tips") or [],
            "cached": False,
            "recipe_image_url": recipe_row.get("image_path") or "",
        }
        master_json = recipe_row.get("recipe_json") or {}
        if isinstance(master_json, dict):
            # Only fill in fields that are missing/empty — never overwrite fresh generated data
            # (master_json may be stale due to COALESCE keeping old recipe_json on conflict)
            for k in ("description", "meta", "nutrition", "tags", "ai_context"):
                if k in master_json and not response_dict.get(k):
                    response_dict[k] = master_json.get(k)
            # tips: fresh generated takes priority; only fall back to master_json if tips is empty
            if not response_dict.get("tips"):
                response_dict["tips"] = master_json.get("tips") or []
            # ingredients: prefer ingredient_map → fresh generated → stale master_json
            if not response_dict.get("ingredients"):
                response_dict["ingredients"] = (
                    generated.get("ingredients") or master_json.get("ingredients") or []
                )

        logger.info("[CHAT] returning generated recipe chat_id=%s recipe_id=%s", chat_id, recipe_id)
        return _build_chat_response(chat_id, response_dict, {"x-llm-generation": "true"}, include_videos=request.include_videos)
    except Exception as exc:
        logger.exception("[CHAT] unexpected error during chat processing: %s", exc)
        try:
            assistant_message_id = add_message(chat_id, "assistant", content="Sorry, something went wrong while processing your request. Please try again.")
            try:
                add_block(
                    assistant_message_id,
                    "text",
                    {"text": "⚠️ An internal error occurred while processing your request. Please try again."},
                    1,
                )
            except Exception:
                logger.exception("[CHAT] failed to insert error block after unexpected failure")
        except Exception:
            logger.exception("[CHAT] also failed to persist assistant error message after unexpected failure")
        messages = _messages_with_blocks(chat_id)
        return JSONResponse(content={"chat_id": chat_id, "messages": messages})


@router.get("/chat/{chat_id}/stream")
async def chat_stream(chat_id: int, request: Request):

    # ---- AUTH (keep your existing logic) ----
    token = request.query_params.get("token")
    user_id = None

    if token:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())",
                    (token,),
                )
                r = cur.fetchone()
                user_id = r["user_id"] if r else None
    else:
        user_id = _get_user_from_request(request)

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    owner = get_chat_user_id(chat_id)
    if owner is None or owner != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")

    from app.core.redis import redis_client
    import json

    async def event_generator():
        import asyncio
        channel = f"chat:{chat_id}"
        pubsub = redis_client.pubsub()

        # ✅ Subscribe BEFORE sending snapshot so we don't miss tokens published
        # between snapshot fetch and subscribe
        await pubsub.subscribe(channel)

        # ✅ Poll for snapshot until assistant message exists (or timeout)
        # This handles the race where SSE opens before /chat creates the assistant message
        snapshot = []
        deadline = asyncio.get_event_loop().time() + 10  # wait up to 10s
        while asyncio.get_event_loop().time() < deadline:
            snapshot = _messages_with_blocks(chat_id)
            has_assistant = any(m.get("role") == "assistant" for m in snapshot)
            if has_assistant:
                break
            await asyncio.sleep(0.3)

        yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"

        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                data = message["data"]

                if data == "[DONE]":
                    yield "event: done\ndata: done\n\n"
                    break

                # forward the publisher payload as a unified message event
                try:
                    # data is already a JSON string published by producers
                    # ensure it's valid JSON; if not, wrap as raw token
                    try:
                        parsed = json.loads(data)
                    except Exception:
                        parsed = {"type": "token", "source": "llm", "text": data}

                    # When done token arrives, send a final snapshot refresh then close
                    if parsed.get("type") == "done":
                        final_snapshot = _messages_with_blocks(chat_id)
                        yield f"event: snapshot\ndata: {json.dumps(final_snapshot)}\n\n"
                        yield "event: done\ndata: done\n\n"
                        break

                    yield f"event: message\ndata: {json.dumps(parsed)}\n\n"
                except Exception:
                    # fallback simple forward
                    yield f"event: message\ndata: {json.dumps({'type':'token','text':str(data)})}\n\n"

        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )


@router.get("/youtube")
async def youtube_lookup(title: str, limit: int = 2):
    """
    Async lookup YouTube videos for a given title. Returns up to `limit` video metadata.
    Uses YOUTUBE_API_KEY from settings.youtube_api_key.
    """
    key = settings.youtube_api_key
    if not key:
        raise HTTPException(status_code=400, detail="YouTube API key not configured")

    api = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": title,
        "type": "video",
        "maxResults": int(limit),
        "key": key,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(api, params=params)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"YouTube request failed: {exc}") from exc
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"YouTube API error: {resp.status_code}")
    data = resp.json()
    items = data.get("items", []) or []
    videos = []
    for it in items:
        vid = None
        id_obj = it.get("id", {})
        if isinstance(id_obj, dict):
            vid = id_obj.get("videoId")
        if not vid:
            continue
        sn = it.get("snippet", {})
        thumbnails = sn.get("thumbnails", {}) or {}
        thumb = thumbnails.get("medium", {}).get("url") or thumbnails.get("default", {}).get("url")
        videos.append(
            {
                "title": sn.get("title"),
                "url": f"https://www.youtube.com/watch?v={vid}",
                "watchUrl": f"https://www.youtube.com/watch?v={vid}",
                "thumbnail": thumb,
                "channel": sn.get("channelTitle"),
            }
        )
    # Persist returned videos for future reuse (best-effort). Skip if URL already exists.
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                for v in videos:
                    url = v.get("url")
                    if not url:
                        continue
                    # avoid duplicate inserts by URL
                    cur.execute("SELECT id FROM videos WHERE url = %s", (url,))
                    existing = cur.fetchone()
                    if existing and existing.get("id"):
                        v["id"] = existing.get("id")
                        continue
                    cur.execute(
                        """
                        INSERT INTO videos (keyword, url, title, thumbnail, channel, status)
                        VALUES (%s, %s, %s, %s, %s, 'approved')
                        RETURNING id
                        """,
                        (title, url, v.get("title"), v.get("thumbnail"), v.get("channel")),
                    )
                    row = cur.fetchone()
                    if row:
                        v["id"] = row.get("id")
                conn.commit()
    except Exception:
        # Don't fail the API if DB persistence fails; just return the lookup results.
        logger.exception("Failed to persist youtube lookup results")

    return videos


def _get_user_from_request(req: Request) -> int | None:
    auth_header = req.headers.get("authorization") or req.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())", (token,))
            r = cur.fetchone()
            return r["user_id"] if r else None


@router.get("/recipes/{recipe_key}/steps/{step_index}/reactions")
def get_step_reactions(recipe_key: str, step_index: int):
    """Return aggregated like/dislike counts for a given recipe step."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = r["id"]
            cur.execute("SELECT likes, dislikes FROM step_reaction_count WHERE recipe_id = %s AND step_index = %s", (recipe_id, step_index))
            row = cur.fetchone()
            if not row:
                return {"likes": 0, "dislikes": 0}
            return {"likes": row["likes"], "dislikes": row["dislikes"]}


@router.post("/recipes/{recipe_key}/steps/{step_index}/react")
async def react_step(recipe_key: str, step_index: int, request: Request):
    # Read JSON body manually to avoid FastAPI body parsing issues on some clients
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    # If body parsing failed, try raw body fallback
    if not payload:
        try:
            raw = await request.body()
            if raw:
                payload = json.loads(raw.decode('utf-8'))
        except Exception:
            payload = {}
    """
    React to a recipe step. Payload: { action: 'like' | 'dislike' }.
    Auth required.
    """
    action = (payload.get("action") or "").lower()
    if not action:
        action = (request.query_params.get("action") or "").lower()
    if action not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="Invalid action")
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = r["id"]
            try:
                # insert or update user's reaction
                cur.execute(
                    """
                    INSERT INTO step_reaction_user (user_id, recipe_id, step_index, reaction)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id, recipe_id, step_index) DO UPDATE
                      SET reaction = EXCLUDED.reaction, created_at = NOW()
                    """,
                    (user_id, recipe_id, step_index, action),
                )
            except Exception:
                # older psycopg versions might reject ON CONFLICT if constraint absent; fallback to upsert-like logic
                try:
                    cur.execute("SELECT id, reaction FROM step_reaction_user WHERE user_id = %s AND recipe_id = %s AND step_index = %s", (user_id, recipe_id, step_index))
                    existing = cur.fetchone()
                    if existing:
                        cur.execute("UPDATE step_reaction_user SET reaction = %s, created_at = NOW() WHERE id = %s", (action, existing["id"]))
                    else:
                        cur.execute("INSERT INTO step_reaction_user (user_id, recipe_id, step_index, reaction) VALUES (%s, %s, %s, %s)", (user_id, recipe_id, step_index, action))
                except Exception:
                    conn.rollback()
                    raise

            # recompute counts and update aggregated table
            cur.execute("SELECT COUNT(*) FROM step_reaction_user WHERE recipe_id = %s AND step_index = %s AND reaction = 'like'", (recipe_id, step_index))
            likes = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM step_reaction_user WHERE recipe_id = %s AND step_index = %s AND reaction = 'dislike'", (recipe_id, step_index))
            dislikes = cur.fetchone()[0]
            cur.execute("SELECT 1 FROM step_reaction_count WHERE recipe_id = %s AND step_index = %s", (recipe_id, step_index))
            if cur.fetchone():
                cur.execute("UPDATE step_reaction_count SET likes = %s, dislikes = %s WHERE recipe_id = %s AND step_index = %s", (likes, dislikes, recipe_id, step_index))
            else:
                cur.execute("INSERT INTO step_reaction_count (recipe_id, step_index, likes, dislikes) VALUES (%s, %s, %s, %s)", (recipe_id, step_index, likes, dislikes))
            conn.commit()
            return {"likes": likes, "dislikes": dislikes}


@router.get("/recipes/{recipe_key}/reactions")
def get_recipe_reactions(recipe_key: str, request: Request):
    """Return aggregated like/dislike counts and user's reaction (if authenticated)."""
    user_id = _get_user_from_request(request)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            r = cur.fetchone()
            if not r:
                return {"likes": 0, "dislikes": 0, "user_reaction": None}
            recipe_id = r["id"]
            cur.execute("SELECT likes, dislikes FROM recipe_reaction_count WHERE recipe_id = %s", (recipe_id,))
            row = cur.fetchone() or {"likes": 0, "dislikes": 0}
            likes = row.get("likes", 0)
            dislikes = row.get("dislikes", 0)
            reaction = None
            if user_id:
                cur.execute("SELECT reaction FROM recipe_reaction_user WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
                r2 = cur.fetchone()
                if r2:
                    reaction = r2.get("reaction")
            return {"likes": likes, "dislikes": dislikes, "user_reaction": reaction}


@router.post("/recipes/{recipe_key}/react")
async def react_recipe(recipe_key: str, request: Request):
    """
    React to a recipe as a whole. Body: { action: 'like'|'dislike' }.
    Auth required.
    """
    # Parse JSON body safely (await async request.json / request.body)
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    # Fallback to raw body if json() returned empty or failed
    if not payload:
        try:
            raw = await request.body()
            if raw:
                payload = json.loads(raw.decode("utf-8"))
        except Exception:
            payload = {}
    action = (payload.get("action") or "").lower() if isinstance(payload, dict) else ""
    if not action:
        action = (request.query_params.get("action") or "").lower()
    if action not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="Invalid action")
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = r["id"]
            try:
                cur.execute(
                    """
                    INSERT INTO recipe_reaction_user (user_id, recipe_id, reaction)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, recipe_id) DO UPDATE
                      SET reaction = EXCLUDED.reaction, created_at = NOW()
                    """,
                    (user_id, recipe_id, action),
                )
            except Exception:
                # fallback upsert
                cur.execute("SELECT id FROM recipe_reaction_user WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
                ex = cur.fetchone()
                if ex:
                    cur.execute("UPDATE recipe_reaction_user SET reaction = %s, created_at = NOW() WHERE id = %s", (action, ex["id"]))
                else:
                    cur.execute("INSERT INTO recipe_reaction_user (user_id, recipe_id, reaction) VALUES (%s, %s, %s)", (user_id, recipe_id, action))

            # recompute aggregated counts
            cur.execute("SELECT COUNT(*) AS cnt FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'like'", (recipe_id,))
            row = cur.fetchone() or {}
            likes = row.get("cnt", 0)
            cur.execute("SELECT COUNT(*) AS cnt FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'dislike'", (recipe_id,))
            row = cur.fetchone() or {}
            dislikes = row.get("cnt", 0)
            cur.execute("SELECT 1 FROM recipe_reaction_count WHERE recipe_id = %s", (recipe_id,))
            if cur.fetchone():
                cur.execute("UPDATE recipe_reaction_count SET likes = %s, dislikes = %s WHERE recipe_id = %s", (likes, dislikes, recipe_id))
            else:
                cur.execute("INSERT INTO recipe_reaction_count (recipe_id, likes, dislikes) VALUES (%s, %s, %s)", (recipe_id, likes, dislikes))
            conn.commit()
            return {"likes": likes, "dislikes": dislikes}


@router.delete("/recipes/{recipe_key}/react")
def delete_reaction(recipe_key: str, request: Request):
    """
    Remove current user's reaction (like/dislike) for a recipe and return updated counts.
    """
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = row["id"]
            cur.execute("DELETE FROM recipe_reaction_user WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
            # recompute aggregated counts
            cur.execute("SELECT COUNT(*) AS cnt FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'like'", (recipe_id,))
            row = cur.fetchone() or {}
            likes = row.get("cnt", 0)
            cur.execute("SELECT COUNT(*) AS cnt FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'dislike'", (recipe_id,))
            row = cur.fetchone() or {}
            dislikes = row.get("cnt", 0)
            cur.execute("SELECT 1 FROM recipe_reaction_count WHERE recipe_id = %s", (recipe_id,))
            if cur.fetchone():
                cur.execute("UPDATE recipe_reaction_count SET likes = %s, dislikes = %s WHERE recipe_id = %s", (likes, dislikes, recipe_id))
            else:
                cur.execute("INSERT INTO recipe_reaction_count (recipe_id, likes, dislikes) VALUES (%s, %s, %s)", (recipe_id, likes, dislikes))
            conn.commit()
            return {"status": "ok", "likes": likes, "dislikes": dislikes}



@router.post("/recipes/{recipe_key}/review")
async def post_recipe_review(recipe_key: str, request: Request):
    """Submit or update a recipe review (rating 1-5 + optional text). Auth required. One review per user per recipe."""
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    rating = payload.get("rating")
    review_text = (payload.get("review_text") or "").strip()
    if not rating or not (1 <= int(rating) <= 5):
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = r["id"]
            cur.execute(
                """
                INSERT INTO recipe_reviews (user_id, recipe_id, rating, review_text)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id, recipe_id) DO UPDATE
                  SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text, updated_at = NOW()
                """,
                (user_id, recipe_id, int(rating), review_text or None),
            )
            cur.execute(
                "SELECT ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS cnt FROM recipe_reviews WHERE recipe_id = %s",
                (recipe_id,),
            )
            row = cur.fetchone() or {}
            conn.commit()
            return {
                "avg_rating": float(row["avg"]) if row.get("avg") else float(rating),
                "review_count": row.get("cnt", 1),
            }


@router.get("/recipes/{recipe_key}/reviews")
def get_recipe_reviews(recipe_key: str):
    """Get all reviews for a recipe (public)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = r["id"]
            cur.execute(
                """
                SELECT rr.rating, rr.review_text, rr.created_at,
                       COALESCE(u.username, 'Anonymous') AS user_name
                FROM recipe_reviews rr
                LEFT JOIN users u ON u.id = rr.user_id
                WHERE rr.recipe_id = %s
                ORDER BY rr.created_at DESC
                LIMIT 50
                """,
                (recipe_id,),
            )
            reviews = [dict(row) for row in cur.fetchall()]
            for rv in reviews:
                rv["created_at"] = str(rv.get("created_at", ""))
            cur.execute(
                "SELECT ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS cnt FROM recipe_reviews WHERE recipe_id = %s",
                (recipe_id,),
            )
            row = cur.fetchone() or {}
            return {
                "reviews": reviews,
                "avg_rating": float(row["avg"]) if row.get("avg") else None,
                "review_count": row.get("cnt", 0),
            }


@router.post("/recipes/{recipe_key}/view")
def increment_recipe_view(recipe_key: str):
    """Increment view count for a recipe. No auth required — fire-and-forget."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE recipe_master SET view_count = view_count + 1 WHERE recipe_key = %s RETURNING id, view_count",
                (recipe_key,),
            )
            row = cur.fetchone()
            conn.commit()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            return {"view_count": row["view_count"]}


@router.post("/youtube/save")
def youtube_save(request: Request, payload: dict):
    """
    Save a YouTube video URL linked to a recipe. Auth required.
    Payload: { url, title?, description?, recipe_key? }
    """
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Missing url")
    title = payload.get("title")
    description = payload.get("description")
    recipe_key = payload.get("recipe_key")
    recipe_id = None
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                if recipe_key:
                    cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
                    r = cur.fetchone()
                    recipe_id = r["id"] if r else None
                # delegate to videos service
                from app.videos.service import create_video as create_vid
                vid = create_vid(user_id, url, title, description, recipe_id)
                return {"status": "ok", "video_id": vid}
    except Exception as exc:
        logger.exception("Failed to save youtube video: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save video") from exc


@router.get("/user/videos")
def list_user_videos(request: Request):
    """
    List videos submitted by the authenticated user.
    Returns [{ id, url, title, thumbnail, recipe_key }]
    """
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                from app.videos.service import list_user_videos as luv
                return luv(user_id, limit=100)
    except Exception as exc:
        logger.exception("Failed to list user videos: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to list videos") from exc


@router.post("/recipes/{recipe_key}/like")
def like_recipe(recipe_key: str, request: Request):
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    # Read optional payload to capture chat_id context
    try:
        payload = request.json() if hasattr(request, "json") else {}
    except Exception:
        payload = {}
    if not payload:
        try:
            raw = request.body()
            if raw:
                import json as _json
                payload = _json.loads(raw.decode('utf-8'))
        except Exception:
            payload = {}
    chat_id = payload.get("chat_id")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = row["id"]
            # Build insert/upsert with optional chat_id
            try:
                if chat_id:
                    cur.execute(
                        """
                        INSERT INTO recipe_reaction_user (user_id, recipe_id, reaction, chat_id)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (user_id, recipe_id) DO UPDATE
                          SET reaction = EXCLUDED.reaction, chat_id = EXCLUDED.chat_id, created_at = NOW()
                        """,
                        (user_id, recipe_id, 'like', chat_id),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO recipe_reaction_user (user_id, recipe_id, reaction)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (user_id, recipe_id) DO UPDATE
                          SET reaction = EXCLUDED.reaction, created_at = NOW()
                        """,
                        (user_id, recipe_id, 'like'),
                    )
            except Exception:
                # fallback upsert
                cur.execute("SELECT id FROM recipe_reaction_user WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
                ex = cur.fetchone()
                if ex:
                    if chat_id:
                        cur.execute("UPDATE recipe_reaction_user SET reaction = %s, chat_id = %s, created_at = NOW() WHERE id = %s", ('like', chat_id, ex["id"]))
                    else:
                        cur.execute("UPDATE recipe_reaction_user SET reaction = %s, created_at = NOW() WHERE id = %s", ('like', ex["id"]))
                else:
                    if chat_id:
                        cur.execute("INSERT INTO recipe_reaction_user (user_id, recipe_id, reaction, chat_id) VALUES (%s, %s, %s, %s)", (user_id, recipe_id, 'like', chat_id))
                    else:
                        cur.execute("INSERT INTO recipe_reaction_user (user_id, recipe_id, reaction) VALUES (%s, %s, %s)", (user_id, recipe_id, 'like'))
            # recompute aggregated counts
            cur.execute("SELECT COUNT(*) AS cnt FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'like'", (recipe_id,))
            row = cur.fetchone() or {}
            likes = row.get("cnt", 0)
            cur.execute("SELECT COUNT(*) AS cnt FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'dislike'", (recipe_id,))
            row = cur.fetchone() or {}
            dislikes = row.get("cnt", 0)
            cur.execute("SELECT 1 FROM recipe_reaction_count WHERE recipe_id = %s", (recipe_id,))
            if cur.fetchone():
                cur.execute("UPDATE recipe_reaction_count SET likes = %s, dislikes = %s WHERE recipe_id = %s", (likes, dislikes, recipe_id))
            else:
                cur.execute("INSERT INTO recipe_reaction_count (recipe_id, likes, dislikes) VALUES (%s, %s, %s)", (recipe_id, likes, dislikes))
            conn.commit()
            return {"status": "ok", "liked": True, "likes": likes, "dislikes": dislikes}


@router.delete("/recipes/{recipe_key}/like")
def unlike_recipe(recipe_key: str, request: Request):
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = row["id"]
            cur.execute("DELETE FROM recipe_reaction_user WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
            # recompute aggregated counts
            cur.execute("SELECT COUNT(*) FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'like'", (recipe_id,))
            likes = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM recipe_reaction_user WHERE recipe_id = %s AND reaction = 'dislike'", (recipe_id,))
            dislikes = cur.fetchone()[0]
            cur.execute("SELECT 1 FROM recipe_reaction_count WHERE recipe_id = %s", (recipe_id,))
            if cur.fetchone():
                cur.execute("UPDATE recipe_reaction_count SET likes = %s, dislikes = %s WHERE recipe_id = %s", (likes, dislikes, recipe_id))
            else:
                cur.execute("INSERT INTO recipe_reaction_count (recipe_id, likes, dislikes) VALUES (%s, %s, %s)", (recipe_id, likes, dislikes))
            conn.commit()
            return {"status": "ok", "liked": False, "likes": likes, "dislikes": dislikes}


@router.get("/recipes/{recipe_key}/reaction")
def get_recipe_reaction(recipe_key: str, request: Request):
    """
    Return aggregated likes/dislikes and the current user's reaction (if authenticated).
    Response: { likes, dislikes, reaction: 'like'|'dislike'|None }
    """
    user_id = _get_user_from_request(request)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = row["id"]
            cur.execute("SELECT likes, dislikes FROM recipe_reaction_count WHERE recipe_id = %s", (recipe_id,))
            agg = cur.fetchone() or {"likes": 0, "dislikes": 0}
            likes = agg.get("likes", 0) if isinstance(agg, dict) else (agg[0] if agg else 0)
            dislikes = agg.get("dislikes", 0) if isinstance(agg, dict) else (agg[1] if agg else 0)
            reaction = None
            if user_id:
                cur.execute("SELECT reaction FROM recipe_reaction_user WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
                r = cur.fetchone()
                if r:
                    reaction = r.get("reaction")
            return {"likes": likes, "dislikes": dislikes, "reaction": reaction}


@router.post("/recipes/{recipe_key}/bookmark")
def bookmark_recipe(recipe_key: str, request: Request):
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = row["id"]
            cur.execute("INSERT INTO bookmarks (user_id, recipe_id) VALUES (%s, %s) ON CONFLICT (user_id, recipe_id) DO NOTHING", (user_id, recipe_id))
            conn.commit()
            return {"status": "ok", "bookmarked": True}


@router.delete("/recipes/{recipe_key}/bookmark")
def unbookmark_recipe(recipe_key: str, request: Request):
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Recipe not found")
            recipe_id = row["id"]
            cur.execute("DELETE FROM bookmarks WHERE user_id = %s AND recipe_id = %s", (user_id, recipe_id))
            conn.commit()
            return {"status": "ok", "bookmarked": False}


@router.post("/videos")
def submit_video(request: Request, payload: dict):
    """
    Submit a video URL with metadata. Expected payload: { url, title?, description?, keywords?, recipe_key? }
    """
    user_id = _get_user_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Missing url")
    title = payload.get("title")
    description = payload.get("description")
    keywords = payload.get("keywords")
    recipe_id = None
    recipe_key = payload.get("recipe_key")
    with get_connection() as conn:
        with conn.cursor() as cur:
            if recipe_key:
                cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
                r = cur.fetchone()
                recipe_id = r["id"] if r else None
            cur.execute(
                """
                INSERT INTO videos (user_id, recipe_id, url, title, description, keywords, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (user_id, recipe_id, url, title, description, keywords, "pending"),
            )
            vid = cur.fetchone()["id"]
            conn.commit()
            return {"status": "ok", "video_id": vid, "status": "pending"}
