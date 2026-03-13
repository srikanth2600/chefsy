import json
from typing import Any

from app.core.redis import redis_client


async def publish_token(chat_id: int, token: str, *, block_id: int | None = None, seq: int | None = None, message_id: int | None = None) -> None:
    """
    Publish a structured token/chunk for a chat to Redis pubsub.
    Channel: f"chat:{chat_id}"
    Payload: JSON {
       "type": "token",
       "text": "<token>",
       "block_id": <int|null>,
       "seq": <int|null>,
       "message_id": <int|null>
    }
    """
    payload_obj = {
        "type": "token",
        "text": token,
        "block_id": block_id,
        "seq": seq,
        "message_id": message_id,
    }
    payload = json.dumps(payload_obj)
    try:
        await redis_client.publish(f"chat:{chat_id}", payload)
    except Exception:
        # best-effort fallback (synchronous publish)
        try:
            redis_client.publish(f"chat:{chat_id}", payload)
        except Exception:
            pass


async def publish_done(chat_id: int) -> None:
    """
    Notify subscribers that streaming is complete for the chat.
    Channel: f"chat:{chat_id}"
    Payload: JSON { "type": "done" }
    """
    payload = json.dumps({"type": "done"})
    try:
        await redis_client.publish(f"chat:{chat_id}", payload)
    except Exception:
        try:
            redis_client.publish(f"chat:{chat_id}", payload)
        except Exception:
            pass

