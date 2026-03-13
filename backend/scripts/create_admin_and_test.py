#!/usr/bin/env python3
"""
Create an admin user + token and run quick admin API checks.
Outputs:
  - admin_token (use as Bearer token)
  - sample /admin/recipes response (first 5 rows)

Usage:
  python backend/scripts/create_admin_and_test.py
"""
import uuid
import json
import urllib.request
from urllib.error import HTTPError
from datetime import datetime
from psycopg import connect
from psycopg.rows import dict_row
from pathlib import Path

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "gharka_chef",
    "user": "postgres",
    "password": "postgres123",
}

API_BASE = "http://127.0.0.1:8005"


def get_conn():
    return connect(**DB_CONFIG, row_factory=dict_row)


def ensure_admin_user(email="admin@local", full_name="Admin User"):
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Ensure is_admin column exists (some DBs may be older)
            cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin'"
            )
            if not cur.fetchone():
                try:
                    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE")
                    conn.commit()
                except Exception:
                    # best-effort; continue even if alter fails
                    pass

            cur.execute("SELECT id, is_admin FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            if row:
                uid = row["id"]
                try:
                    if not row.get("is_admin"):
                        cur.execute("UPDATE users SET is_admin = TRUE WHERE id = %s", (uid,))
                        conn.commit()
                except Exception:
                    pass
                return uid
            # insert new admin user
            cur.execute(
                "INSERT INTO users (full_name, email, is_verified, is_admin, created_at) VALUES (%s,%s,TRUE,TRUE,NOW()) RETURNING id",
                (full_name, email),
            )
            uid = cur.fetchone()["id"]
            conn.commit()
            return uid


def create_token_for_user(user_id: int):
    token = str(uuid.uuid4())
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO user_token (token, user_id, created_at, expires_at) VALUES (%s,%s,NOW(),NULL)", (token, user_id))
        conn.commit()
    return token


def call_admin_api(token: str, path: str):
    url = API_BASE.rstrip("/") + path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode("utf-8")
            return r.status, body
    except HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as exc:
        return None, str(exc)


def main():
    print("Ensuring admin user exists...")
    uid = ensure_admin_user()
    print("Admin user id:", uid)
    print("Creating token...")
    token = create_token_for_user(uid)
    print("\nADMIN TOKEN (use as Bearer token):\n", token, "\n")

    print("Calling GET /admin/recipes ...")
    status, body = call_admin_api(token, "/admin/recipes")
    print("Status:", status)
    try:
        j = json.loads(body)
        # show first 5 recipes
        sample = j.get("recipes", [])[:5]
        print("Sample recipes (first 5):")
        print(json.dumps(sample, indent=2) if sample else "(no recipes returned)")
    except Exception:
        print("Response body:", body)

    print("\nCalling GET /admin/videos ...")
    status2, body2 = call_admin_api(token, "/admin/videos")
    print("Status:", status2)
    try:
        j2 = json.loads(body2)
        sample2 = j2.get("videos", [])[:5]
        print("Sample videos (first 5):")
        print(json.dumps(sample2, indent=2) if sample2 else "(no videos returned)")
    except Exception:
        print("Response body:", body2)

    print("\nDone.")


if __name__ == "__main__":
    main()

