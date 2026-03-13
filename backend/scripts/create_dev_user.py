#!/usr/bin/env python3
"""
Create a development test user and print a bearer token.

Usage:
  python backend/scripts/create_dev_user.py

This script inserts (or updates) a user with email dev+test@local and creates
a long-lived token in the user_token table. It prints the token to stdout.
"""
from datetime import datetime, timedelta
import uuid
from app.core.db import get_connection
from app.core.config import settings

def main():
    test_email = "dev+test@local"
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Ensure a user exists for the test email; older schemas may not have a UNIQUE
            # constraint on email, so avoid relying on ON CONFLICT.
            cur.execute("SELECT id FROM users WHERE email = %s", (test_email,))
            row = cur.fetchone()
            if row:
                user_id = row["id"]
            else:
                cur.execute(
                    """
                    INSERT INTO users (full_name, email, phone, user_type, is_verified)
                    VALUES (%s, %s, %s, %s, TRUE)
                    RETURNING id
                    """,
                    ("Dev User", test_email, None, "Developer"),
                )
                user_id = cur.fetchone()["id"]

            token = str(uuid.uuid4())
            expires = datetime.utcnow() + timedelta(days=30)
            cur.execute(
                """
                INSERT INTO user_token (token, user_id, expires_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (token) DO NOTHING
                """,
                (token, user_id, expires),
            )
            conn.commit()
    print(token)

if __name__ == "__main__":
    main()

