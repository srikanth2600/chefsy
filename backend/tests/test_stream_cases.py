import json
import pytest

from fastapi.testclient import TestClient

from app.main import app
from app.core.db import init_db, get_connection
from app.application.chat_service import create_chat, add_message
from app.application.chat_block_service import add_block, append_text_to_block, get_blocks_for_chat
from app.application.stream_finalizer import finalize_streamed_recipe
from app.services import recipe_persistence


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()
    yield


def create_test_user_and_token():
    import uuid
    email = f"case+{uuid.uuid4().hex[:8]}@example.com"
    token = f"test-case-token-{uuid.uuid4().hex[:8]}"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (full_name, email) VALUES (%s, %s) RETURNING id", ("Case User", email))
            uid = cur.fetchone()["id"]
            # create a token for auth
            cur.execute("INSERT INTO user_token (token, user_id) VALUES (%s, %s)", (token, uid))
            conn.commit()
            return uid, token


def test_invalid_json_does_not_persist():
    uid, token = create_test_user_and_token()
    chat_id = create_chat(uid)

    assistant_id = add_message(chat_id, "assistant", recipe_id=None, recipe_json=None)
    block_id = add_block(assistant_id, "text", {"text": ""}, 1)

    # append invalid JSON
    append_text_to_block(block_id, "{invalid: this is not json}")

    recipe_key = "invalid-case"
    recipe_id = finalize_streamed_recipe(chat_id, block_id, assistant_id, recipe_key, "Invalid Case", "ollama:llama3.1:latest")
    assert recipe_id is None

    # ensure no recipe_master row exists for this key
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM recipe_master WHERE recipe_key = %s", (recipe_key,))
            assert cur.fetchone() is None


def test_partial_json_salvage_and_persist():
    uid, token = create_test_user_and_token()
    chat_id = create_chat(uid)

    assistant_id = add_message(chat_id, "assistant", recipe_id=None, recipe_json=None)
    block_id = add_block(assistant_id, "text", {"text": ""}, 1)

    # include extra text before and after valid JSON
    recipe_json = {
        "title": "Salvage Dish",
        "servings": 3,
        "steps": ["A", "B"],
        "ingredients": [{"name": "ing", "quantity": "1"}],
        "ai_context": {"user_intent": "salvage"}
    }
    text = "Note: please ignore\n" + json.dumps(recipe_json) + "\n-- end"
    append_text_to_block(block_id, text)

    recipe_key = "salvage-dish"
    recipe_id = finalize_streamed_recipe(chat_id, block_id, assistant_id, recipe_key, "Salvage Dish", "ollama:llama3.1:latest")
    assert recipe_id is not None

    # verify persisted
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title FROM recipe_master WHERE id = %s", (recipe_id,))
            row = cur.fetchone()
            assert row and row.get("title") == "Salvage Dish"


def test_video_attach_and_sequence_and_like():
    uid, token = create_test_user_and_token()
    client = TestClient(app)

    # create chat and assistant persisted recipe via finalizer
    chat_id = create_chat(uid)
    assistant_id = add_message(chat_id, "assistant", recipe_id=None, recipe_json=None)
    block_id = add_block(assistant_id, "text", {"text": ""}, 1)
    recipe_json = {
        "title": "Seq Dish",
        "servings": 2,
        "steps": ["One"],
        "ingredients": [{"name": "x", "quantity": "1"}],
        "ai_context": {"user_intent": "seq"}
    }
    append_text_to_block(block_id, json.dumps(recipe_json))
    recipe_key = "seq-dish"
    recipe_id = finalize_streamed_recipe(chat_id, block_id, assistant_id, recipe_key, "Seq Dish", "ollama:llama3.1:latest")
    assert recipe_id is not None

    # Attach video via endpoint (auth header required)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post(f"/chat/{chat_id}/video_search", json={"title": "Seq Dish"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data

    # Now create a second recipe (db cached) and an assistant message referencing it
    second = {
        "title": "Cached Burger",
        "servings": 1,
        "steps": ["cook"],
        "ingredients": [{"name": "bun", "quantity": "1"}],
        "ai_context": {"user_intent": "cached"}
    }
    second_key = "cached-burger"
    second_id = recipe_persistence.save_generated_recipe(second_key, second, second.get("title"), second.get("servings"))
    # create assistant message for the cached recipe and add recipe block
    second_msg = add_message(chat_id, "assistant", recipe_id=second_id, recipe_json=second)
    add_block(second_msg, "recipe", {"recipe_id": second_id}, 2)

    # Fetch messages via API and check ordering: first assistant message (with recipe + video), then second assistant message
    resp2 = client.get(f"/chat/{chat_id}", headers=headers)
    assert resp2.status_code == 200
    msgs = resp2.json().get("messages", [])
    # find assistant messages and ensure sequence
    assistant_ids = [m.get("id") for m in msgs if m.get("role") == "assistant"]
    assert assistant_ids and assistant_ids[0] == assistant_id
    assert assistant_ids[-1] == second_msg

    # Test like endpoint for persisted recipe (second)
    resp_like = client.post(f"/recipes/{second_key}/like", headers=headers)
    assert resp_like.status_code == 200
    # verify likes table row exists
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM likes WHERE recipe_id = %s", (second_id,))
            assert cur.fetchone() is not None

    # Return IDs so user can inspect
    print("Created IDs:", {"recipe1": recipe_id, "video_attached_to_message": assistant_id, "recipe2": second_id, "message2": second_msg})

