"""
JWT utilities for Gharka Chef.

Strategy:
  - Issue signed HS256 JWT on login/OTP verify.
  - Embed user_id (sub), is_admin, and a unique jti (token ID) in the payload.
  - Store jti in user_token table — acts as the active-session registry.
  - On every authenticated request: verify signature + expiry (fast, no DB),
    then confirm jti still exists in user_token (revocation check).
  - Logout deletes the jti row, instantly invalidating the token.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import HTTPException, Request

from app.core.config import settings


def create_access_token(user_id: int, *, is_admin: bool = False) -> tuple[str, str]:
    """
    Create a signed JWT access token.

    Returns:
        (jti, encoded_jwt)
        - Store jti in user_token.token for revocation tracking.
        - Return encoded_jwt to the client.
    """
    jti = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_access_expire_days)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "admin": is_admin,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    encoded = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return jti, encoded


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Verifies signature and expiry. Raises HTTP 401 on any failure.
    Returns the decoded payload dict.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token. Please log in again.")


def get_user_id_from_bearer(req: Request) -> Optional[int]:
    """
    Extract and verify the user_id from an Authorization: Bearer <jwt> header.

    - Decodes the JWT and checks signature + expiry.
    - Confirms the jti still exists in user_token (revocation check).
    - Falls back to legacy opaque-token lookup so old sessions stay valid.
    - Returns None (not raises) when no/invalid token — callers decide whether to 401.
    """
    from app.core.db import get_connection

    auth = req.headers.get("authorization") or req.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    raw = auth.split(None, 1)[1].strip()

    # ── JWT path (new) ────────────────────────────────────────────────────────
    try:
        payload = decode_token(raw)
        jti = payload.get("jti")
        user_id = int(payload["sub"])
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())",
                    (jti,),
                )
                return user_id if cur.fetchone() else None
    except HTTPException:
        pass  # expired / invalid — fall through to legacy

    # ── Legacy opaque-token path (backward compat) ────────────────────────────
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())",
                (raw,),
            )
            r = cur.fetchone()
            return r["user_id"] if r else None
