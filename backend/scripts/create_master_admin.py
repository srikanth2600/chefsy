#!/usr/bin/env python3
"""
Create or update a master admin user and print a bearer token.

Usage:
  python backend/scripts/create_master_admin.py --email master@chefsy.com --password 12345

If no args provided, defaults to email=master@chefsy.com and password=12345.
"""
import argparse
import uuid
from datetime import datetime, timedelta
from psycopg import connect
from psycopg.rows import dict_row

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "gharka_chef",
    "user": "postgres",
    "password": "postgres123",
}


def get_conn():
    return connect(**DB_CONFIG, row_factory=dict_row)


def _generate_salt() -> str:
    import uuid as _uuid
    return _uuid.uuid4().hex


def _hash_password(password: str, salt: str) -> str:
    import hashlib
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def ensure_admin(email: str, password: str, full_name: str = "Master Admin", phone: str | None = None, designation: str | None = "Master"):
    salt = _generate_salt()
    pw_hash = _hash_password(password, salt)
    with get_conn() as conn:
        with conn.cursor() as cur:
            # create or update user
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            if row:
                user_id = row["id"]
                cur.execute(
                    "UPDATE users SET full_name = %s, phone = %s, designation = %s, password_hash = %s, password_salt = %s, is_verified = TRUE, is_admin = TRUE WHERE id = %s",
                    (full_name, phone, designation, pw_hash, salt, user_id),
                )
            else:
                cur.execute(
                    "INSERT INTO users (full_name, email, phone, designation, password_hash, password_salt, is_verified, is_admin, created_at) VALUES (%s,%s,%s,%s,%s,%s,TRUE,TRUE,NOW()) RETURNING id",
                    (full_name, email, phone, designation, pw_hash, salt),
                )
                user_id = cur.fetchone()["id"]
            conn.commit()
    return user_id


def create_token_for_user(user_id: int, days_valid: int = 30):
    token = str(uuid.uuid4())
    expires = datetime.utcnow() + timedelta(days=days_valid)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO user_token (token, user_id, created_at, expires_at) VALUES (%s,%s,NOW(),%s)", (token, user_id, expires))
        conn.commit()
    return token


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--email", default="master@chefsy.com")
    p.add_argument("--password", default="12345")
    p.add_argument("--full-name", default="Master Admin")
    p.add_argument("--phone", default=None)
    p.add_argument("--designation", default="Master")
    args = p.parse_args()

    print(f"Creating/updating admin user {args.email} ...")
    uid = ensure_admin(args.email, args.password, args.full_name, args.phone, args.designation)
    print("Admin user id:", uid)
    token = create_token_for_user(uid)
    print("\nADMIN TOKEN (use as Bearer token):\n", token, "\n")
    print("Done. You can now login with the email/password or use the token in the frontend.")


if __name__ == "__main__":
    main()

