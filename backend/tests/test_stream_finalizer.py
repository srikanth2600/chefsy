import json
import pytest

from app.core.db import init_db, get_connection
from app.application.chat_service import create_chat, add_message
from app.application.chat_block_service import add_block, append_text_to_block
from app.application.stream_finalizer import finalize_streamed_recipe


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    # Initialize schema (requires Postgres configured via env/settings)
    init_db()
    yield


def create_test_user():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (full_name, email) VALUES (%s, %s) RETURNING id", ("Test User", "test@example.com"))
            uid = cur.fetchone()["id"]
            conn.commit()
            return uid


def test_finalize_streamed_recipe_persists():
    user_id = create_test_user()

    # create chat
    chat_id = create_chat(user_id)

    # insert user message
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO chat_message (chat_id, role, content) VALUES (%s, %s, %s) RETURNING id", (chat_id, "user", "Please create a recipe"))
            cur.fetchone()
            conn.commit()

    # create assistant placeholder and text block
    assistant_id = add_message(chat_id, "assistant", recipe_id=None, recipe_json=None)
    block_id = add_block(assistant_id, "text", {"text": ""}, 1)

    # craft valid recipe JSON that matches domain.recipe.Recipe
    recipe_json = {
        "title": "Test Dish",
        "servings": 2,
        "steps": ["Step 1", "Step 2"],
        "ingredients": [{"name": "ingredient1", "quantity": "1"}],
        "ai_context": {"user_intent": "test"}
    }
    final_text = json.dumps(recipe_json)

    # simulate streaming final content appended to block
    append_text_to_block(block_id, final_text)

    # call finalizer
    recipe_key = "test-dish"
    recipe_id = finalize_streamed_recipe(chat_id, block_id, assistant_id, recipe_key, "Test Dish", "ollama:llama3.1:latest")
    assert recipe_id is not None, "finalize_streamed_recipe should return recipe_id"

    # verify recipe_master row exists
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, title FROM recipe_master WHERE id = %s", (recipe_id,))
            row = cur.fetchone()
            assert row and row.get("title") == "Test Dish"

    # verify chat_message updated with recipe_id
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT recipe_id, recipe_json FROM chat_message WHERE id = %s", (assistant_id,))
            r = cur.fetchone()
            assert r and r.get("recipe_id") == recipe_id
            # recipe_json should be present and parsable
            assert isinstance(r.get("recipe_json"), dict)

