#!/usr/bin/env python3
import json, urllib.request, urllib.error, sys

API = "http://127.0.0.1:8005/chat"
TOKEN = "ca8f5812-6bd8-4577-807a-d6c49a951cc6"  # admin token created earlier (user id 24)

def post_chat(message: str):
    payload = {"chat_id": None, "message": message, "include_videos": False}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(API, data=data, headers={"Content-Type":"application/json", "Authorization":f"Bearer {TOKEN}"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.status
            headers = r.getheaders()
            x_cache = r.getheader("x-cache-hit")
            body = r.read().decode("utf-8")
            j = json.loads(body)
            return status, x_cache, j
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print("HTTPError", e.code, body)
        return e.code, None, None
    except Exception as exc:
        print("Error calling /chat:", exc)
        return None, None, None

def analyze_response(j):
    if not j:
        print("No JSON response")
        return
    messages = j.get("messages", [])
    print("messages count:", len(messages))
    for m in messages:
        if m.get("role") == "assistant":
            print("Assistant message keys:", list(m.keys()))
            recipe = m.get("recipe") or {}
            print("assistant.recipe keys:", list(recipe.keys()))
            print("assistant.recipe.cached:", recipe.get("cached"))
            return
    print("No assistant message found")

if __name__ == "__main__":
    tests = [
        "Paneer Butter Masala recipe",
        "Recipe for paneer butter masala",
        "paneer butter masala",
    ]
    for t in tests:
        print("\\n=== Testing message:", t)
        status, x_cache, j = post_chat(t)
        print("status:", status, "x-cache-hit:", x_cache)
        analyze_response(j)
    print("\\nDone.")

