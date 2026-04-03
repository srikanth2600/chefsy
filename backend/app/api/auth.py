from datetime import datetime, timedelta
import logging
import random
import uuid
import smtplib
from email.message import EmailMessage
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, EmailStr
import pathlib

from app.core.db import get_connection
import psycopg
from app.core.config import settings
from app.core.security import create_access_token, decode_token
from psycopg.rows import dict_row
from psycopg.types.json import Json

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    # ── Account classification ────────────────────────────────────────────────
    account_type: str = "general"          # "general" | "organization"

    # ── Common fields ─────────────────────────────────────────────────────────
    full_name: str
    email: EmailStr
    password: str | None = None
    # Phone: 10-digit local number only (no country code, e.g. "9876543210")
    phone: str | None = None

    # ── General (Food Lover) fields ───────────────────────────────────────────
    gender: str | None = None              # Male / Female / Other / Prefer not to say

    # ── Organization fields ───────────────────────────────────────────────────
    organization_type_id: int | None = None   # FK → organization_type.id
    organization_name: str | None = None      # Trading / official name

    # ── Legacy / chef-specific ────────────────────────────────────────────────
    user_type: str | None = None
    chef_slug: str | None = None  # Required when org type maps to Chef/Restaurant


class OTPRequest(BaseModel):
    email: EmailStr
    purpose: str | None = "login"


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    code: str


def _generate_code() -> str:
    return f"{random.randint(100000, 999999)}"


def _generate_salt() -> str:
    return uuid.uuid4().hex


def _hash_password(password: str, salt: str) -> str:
    import hashlib

    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def _send_otp_via_email_or_log(phone: str | None, code: str, purpose: str, email: Optional[str] = None) -> None:
    """
    Send OTP via email when an email address is available and SMTP is configured.
    Falls back to logging the OTP (useful for development).
    """
    msg_text = f"Your Gharka Chef OTP for {purpose} is: {code}\nThis code expires in 10 minutes."

    # Try sending email if configured and an email address was provided
    if email and settings.smtp_enable and settings.smtp_host:
        try:
            msg = EmailMessage()
            msg["From"] = settings.smtp_from
            msg["To"] = email
            msg["Subject"] = "Gharka Chef OTP"
            msg.set_content(msg_text)

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_user and settings.smtp_password:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
            logger.info("Sent OTP email for %s to %s", purpose, email)
            return
        except Exception:
            logger.exception("Failed to send OTP email to %s; falling back to log", email)

    # Fallback logging for development or when email not available
    logger.info("OTP for %s to %s (email=%s): %s", purpose, phone, email, code)


def _validate_phone(phone: str) -> str:
    """
    Accepts a 10-digit local phone number (no country code).
    Strips spaces/hyphens/parentheses then enforces exactly 10 digits.
    Raises HTTPException 400 on failure; returns the cleaned 10-digit string.
    """
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not cleaned.isdigit() or len(cleaned) != 10:
        raise HTTPException(
            status_code=400,
            detail="Phone number must be exactly 10 digits (no country code, e.g. 9876543210).",
        )
    return cleaned


def _resolve_user_type(req: "RegisterRequest") -> str | None:
    """
    Derive the legacy user_type string from the new account_type/org fields.
    For organization accounts we look up the org type name to keep backward compat.
    """
    if req.account_type == "general":
        return req.user_type or "General"
    # organization — look up org type name to use as user_type
    if req.organization_type_id:
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT name FROM organization_type WHERE id = %s", (req.organization_type_id,))
                    row = cur.fetchone()
                    if row:
                        return row["name"]
        except Exception:
            pass
    return req.user_type or "Organization"


@router.get("/organization-types")
def list_organization_types():
    """Public endpoint: returns active organization types for the registration form."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, description, icon, sort_order
                FROM organization_type
                WHERE is_active = TRUE
                ORDER BY sort_order, name
                """
            )
            rows = cur.fetchall()
            return {"types": [dict(r) for r in rows]}


@router.post("/register")
def register(req: RegisterRequest):
    """
    Register a new user.

    account_type = 'general'      → Food Lover flow
                                    Required: full_name, email, password
                                    Optional: phone (10-digit), gender

    account_type = 'organization' → Organization flow
                                    Required: full_name, email, password,
                                              organization_type_id, organization_name
                                    Optional: phone (10-digit)
                                    If org type is Chef/Restaurant: chef_slug required
    """
    # ── Validation ────────────────────────────────────────────────────────────
    if req.account_type not in ("general", "organization"):
        raise HTTPException(status_code=400, detail="account_type must be 'general' or 'organization'.")

    if req.account_type == "organization":
        if not req.organization_type_id:
            raise HTTPException(status_code=400, detail="organization_type_id is required for organization accounts.")
        if not req.organization_name or not req.organization_name.strip():
            raise HTTPException(status_code=400, detail="organization_name is required for organization accounts.")

    # Clean & validate phone
    phone_clean: str | None = None
    if req.phone and req.phone.strip():
        phone_clean = _validate_phone(req.phone)

    # Derive user_type for backward compatibility
    user_type = _resolve_user_type(req)

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Ensure phone isn't already taken by a DIFFERENT email
            if phone_clean:
                cur.execute(
                    "SELECT email FROM users WHERE phone = %s LIMIT 1",
                    (phone_clean,),
                )
                existing = cur.fetchone()
                if existing and existing["email"] != req.email:
                    raise HTTPException(
                        status_code=400,
                        detail="This phone number is already registered to another account. Please use a different phone number.",
                    )

            salt = None
            pw_hash = None
            if req.password:
                salt = _generate_salt()
                pw_hash = _hash_password(req.password, salt)

            org_name = req.organization_name.strip() if req.organization_name else None

            try:
                cur.execute(
                    """
                    INSERT INTO users (
                        full_name, email, phone, user_type,
                        account_type, organization_type_id, organization_name,
                        gender,
                        password_hash, password_salt, is_verified
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (email) DO UPDATE
                      SET full_name            = EXCLUDED.full_name,
                          phone                = EXCLUDED.phone,
                          user_type            = EXCLUDED.user_type,
                          account_type         = EXCLUDED.account_type,
                          organization_type_id = EXCLUDED.organization_type_id,
                          organization_name    = EXCLUDED.organization_name,
                          gender               = EXCLUDED.gender,
                          password_hash        = COALESCE(EXCLUDED.password_hash, users.password_hash),
                          password_salt        = COALESCE(EXCLUDED.password_salt, users.password_salt)
                    RETURNING id, phone, email
                    """,
                    (
                        req.full_name, req.email, phone_clean, user_type,
                        req.account_type, req.organization_type_id, org_name,
                        req.gender,
                        pw_hash, salt, bool(req.password),
                    ),
                )
            except psycopg.errors.UniqueViolation:
                raise HTTPException(
                    status_code=400,
                    detail="This phone number is already registered to another account. Please use a different phone number.",
                )
            row = cur.fetchone()
            user_id = row["id"]
            phone = row["phone"]
            email = row.get("email")

            # If password not provided, fall back to OTP registration flow
            if not req.password:
                code = _generate_code()
                expires = datetime.utcnow() + timedelta(minutes=10)
                try:
                    cur.execute(
                        """
                        INSERT INTO otp_code (user_id, phone, email, code, purpose, expires_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (user_id, phone, email, code, "registration", expires),
                    )
                except psycopg.errors.UndefinedColumn:
                    logger.warning("otp_code.email column missing; falling back to legacy insert")
                    conn.rollback()
                    cur.execute(
                        """
                        INSERT INTO otp_code (user_id, phone, code, purpose, expires_at)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (user_id, phone, code, "registration", expires),
                    )
                conn.commit()
                _send_otp_via_email_or_log(phone, code, "registration", email=email)
                resp = {"status": "ok", "email": email}
                if settings.dev_return_otp_in_response:
                    resp["otp"] = code
                return resp
            else:
                conn.commit()
                # Auto-create chef_profile for Chef / Restaurant org types or legacy user_type
                _maybe_create_chef_profile(user_id, user_type, req.chef_slug)
                return {"status": "ok", "email": email, "user_id": user_id}


def _maybe_create_chef_profile(user_id: int, user_type: str | None, chef_slug: str | None) -> None:
    """Create a chef_profile record when the account is a Chef or Restaurant type."""
    chef_types = {"Chef", "Restaurant", "Restaurant/Foodcourt"}
    if user_type in chef_types and chef_slug:
        try:
            from app.chef.schema import ChefProfileCreate
            from app.chef import service as chef_service
            chef_data = ChefProfileCreate(slug=chef_slug, designation=user_type)
            chef_service.create_profile(user_id, chef_data)
            logger.info("Auto-created chef_profile for user %s with slug '%s'", user_id, chef_slug)
        except Exception:
            logger.exception("Failed to auto-create chef_profile for user %s (non-fatal)", user_id)


@router.post("/request-otp")
def request_otp(req: OTPRequest):
    with get_connection() as conn:
        with conn.cursor() as cur:
            # find user by email (optional)
            cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            row = cur.fetchone()
            user_id = row["id"] if row else None
            email = req.email
            code = _generate_code()
            expires = datetime.utcnow() + timedelta(minutes=10)
            try:
                cur.execute(
                    """
                    INSERT INTO otp_code (user_id, phone, email, code, purpose, expires_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (user_id, None, req.email, code, req.purpose or "login", expires),
                )
            except psycopg.errors.UndefinedColumn:
                logger.warning("otp_code.email column missing; falling back to legacy insert")
                conn.rollback()
                cur.execute(
                    """
                    INSERT INTO otp_code (user_id, phone, code, purpose, expires_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (user_id, None, code, req.purpose or "login", expires),
                )
            conn.commit()
            _send_otp_via_email_or_log(None, code, req.purpose or "login", email=email)
            resp = {"status": "ok"}
            if settings.dev_return_otp_in_response:
                resp["otp"] = code
            return resp


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
def login(req: LoginRequest):
    """Authenticate user via email+password and return a signed JWT access token."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, password_hash, password_salt, is_admin FROM users WHERE email = %s",
                (req.email,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            stored_hash = row.get("password_hash")
            salt = row.get("password_salt")
            if not stored_hash or not salt:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            if _hash_password(req.password, salt) != stored_hash:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            user_id = row["id"]
            is_admin = bool(row.get("is_admin"))
            jti, token = create_access_token(user_id, is_admin=is_admin)
            expires = datetime.utcnow() + timedelta(days=settings.jwt_access_expire_days)
            cur.execute(
                "INSERT INTO user_token (token, user_id, expires_at) VALUES (%s, %s, %s)",
                (jti, user_id, expires),
            )
            conn.commit()
            return {"status": "ok", "token": token, "user_id": user_id}


@router.post("/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    with get_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    SELECT id, user_id, code, used, expires_at
                    FROM otp_code
                    WHERE email = %s AND code = %s AND used = FALSE
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (req.email, req.code),
                )
            except psycopg.errors.UndefinedColumn:
                # Older schema: no email column — roll back and fall back to searching by code only (dev fallback)
                logger.warning("otp_code.email column missing; falling back to code-only lookup")
                conn.rollback()
                cur.execute(
                    """
                    SELECT id, user_id, code, used, expires_at
                    FROM otp_code
                    WHERE code = %s AND used = FALSE
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (req.code,),
                )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid code")
            if row["expires_at"] < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Code expired")

            # mark used
            cur.execute("UPDATE otp_code SET used = TRUE WHERE id = %s", (row["id"],))

            user_id = row["user_id"]
            if not user_id:
                # create a user record for this email (anonymous)
                cur.execute(
                    """
                    INSERT INTO users (full_name, email)
                    VALUES (%s, %s)
                    RETURNING id
                    """,
                    ("", req.email),
                )
                user_id = cur.fetchone()["id"]

            # mark user verified
            cur.execute("UPDATE users SET is_verified = TRUE WHERE id = %s", (user_id,))

            # create JWT access token
            is_admin_flag = False
            try:
                cur.execute("SELECT is_admin FROM users WHERE id = %s", (user_id,))
                _r = cur.fetchone()
                is_admin_flag = bool(_r and _r.get("is_admin"))
            except Exception:
                pass
            jti, token = create_access_token(user_id, is_admin=is_admin_flag)
            expires = datetime.utcnow() + timedelta(days=settings.jwt_access_expire_days)
            cur.execute(
                """
                INSERT INTO user_token (token, user_id, expires_at)
                VALUES (%s, %s, %s)
                """,
                (jti, user_id, expires),
            )
            conn.commit()
            return {"status": "ok", "token": token, "user_id": user_id}


@router.post("/logout")
def logout(request: Request):
    """Revoke the current JWT by deleting its jti from the active sessions table."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    raw = auth.split(None, 1)[1].strip()
    try:
        payload = decode_token(raw)
        jti = payload.get("jti")
    except HTTPException:
        # Token already invalid — treat as already logged out
        return {"status": "ok"}
    if jti:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_token WHERE token = %s", (jti,))
                conn.commit()
    return {"status": "ok"}


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerify(BaseModel):
    email: EmailStr
    code: str
    new_password: str


@router.post("/request-password-reset")
def request_password_reset(req: PasswordResetRequest):
    """Create a one-time code for password reset and email/log it."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            row = cur.fetchone()
            user_id = row["id"] if row else None
            code = _generate_code()
            expires = datetime.utcnow() + timedelta(minutes=30)
            try:
                cur.execute(
                    "INSERT INTO otp_code (user_id, email, code, purpose, expires_at) VALUES (%s, %s, %s, %s, %s)",
                    (user_id, req.email, code, "password_reset", expires),
                )
            except psycopg.errors.UndefinedColumn:
                conn.rollback()
                cur.execute("INSERT INTO otp_code (user_id, phone, code, purpose, expires_at) VALUES (%s, %s, %s, %s, %s)", (user_id, None, code, "password_reset", expires))
            conn.commit()
            _send_otp_via_email_or_log(None, code, "password_reset", email=req.email)
            resp = {"status": "ok"}
            if settings.dev_return_otp_in_response:
                resp["otp"] = code
            return resp


@router.post("/verify-password-reset")
def verify_password_reset(req: PasswordResetVerify):
    """Verify reset code and set new password."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, user_id, code, used, expires_at FROM otp_code WHERE email = %s AND code = %s AND used = FALSE ORDER BY created_at DESC LIMIT 1", (req.email, req.code))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid code")
            if row["expires_at"] < datetime.utcnow():
                raise HTTPException(status_code=400, detail="Code expired")
            # mark used
            cur.execute("UPDATE otp_code SET used = TRUE WHERE id = %s", (row["id"],))
            user_id = row["user_id"]
            if not user_id:
                raise HTTPException(status_code=400, detail="User not found")
            salt = _generate_salt()
            pw_hash = _hash_password(req.new_password, salt)
            cur.execute("UPDATE users SET password_hash = %s, password_salt = %s, is_verified = TRUE WHERE id = %s", (pw_hash, salt, user_id))
            conn.commit()
            return {"status": "ok"}


@router.get("/me")
def me(request: Request):
    """Return authenticated user's profile based on JWT Bearer token."""
    user_id = _get_user_id_from_token(request)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.full_name, u.email, u.phone, u.user_type, u.is_verified,
                       u.is_admin, u.designation, u.permissions_json, u.profile_pic,
                       u.gender, u.address,
                       u.address_line1, u.address_line2, u.city, u.postcode,
                       u.latitude, u.longitude, u.body_info,
                       u.account_type, u.organization_type_id, u.organization_name,
                       ot.name AS organization_type_name,
                       ot.icon AS organization_type_icon
                FROM users u
                LEFT JOIN organization_type ot ON ot.id = u.organization_type_id
                WHERE u.id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="User not found")
            return {
                "id": row["id"],
                "full_name": row["full_name"],
                "email": row["email"],
                "phone": row["phone"],
                "user_type": row["user_type"],
                "is_verified": row["is_verified"],
                "is_admin": bool(row.get("is_admin")),
                "designation": row.get("designation"),
                "permissions": row.get("permissions_json") or {},
                "profile_pic": row.get("profile_pic"),
                "gender": row.get("gender"),
                "address": row.get("address"),
                "address_line1": row.get("address_line1"),
                "address_line2": row.get("address_line2"),
                "city": row.get("city"),
                "postcode": row.get("postcode"),
                "latitude": float(row["latitude"]) if row.get("latitude") is not None else None,
                "longitude": float(row["longitude"]) if row.get("longitude") is not None else None,
                "body_info": row.get("body_info") or {},
                "account_type": row.get("account_type") or "general",
                "organization_type_id": row.get("organization_type_id"),
                "organization_type_name": row.get("organization_type_name"),
                "organization_type_icon": row.get("organization_type_icon"),
                "organization_name": row.get("organization_name"),
            }


def _get_user_id_from_token(request: Request) -> int:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    raw = auth.split(None, 1)[1].strip()
    payload = decode_token(raw)  # raises 401 if signature/expiry invalid
    jti = payload.get("jti")
    user_id = int(payload["sub"])
    # Confirm token hasn't been revoked via logout
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())",
                (jti,),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=401, detail="Token has been revoked. Please log in again.")
    return user_id


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None
    body_info: Optional[dict] = None


@router.put("/me")
async def update_me(req: UpdateProfileRequest, request: Request):
    """Update authenticated user's profile fields. Auto-geocodes address to lat/lng."""
    from psycopg.types.json import Json as _Json
    user_id = _get_user_id_from_token(request)
    fields: dict = {}
    for k, v in req.model_dump().items():
        if v is None:
            continue
        if k == "body_info" and isinstance(v, dict):
            fields[k] = _Json(v)
        else:
            fields[k] = v

    # Auto-geocode when any address field is provided
    _ADDRESS_FIELDS = {"address_line1", "address_line2", "city", "postcode", "country"}
    if _ADDRESS_FIELDS & fields.keys():
        from app.utils.geocoding import geocode_address
        # Fetch current stored values to fill gaps in partial updates
        with get_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT address_line1, address_line2, city, postcode, country FROM users WHERE id = %s",
                    (user_id,),
                )
                stored = cur.fetchone() or {}
        merged = {
            "address_line1": fields.get("address_line1") or stored.get("address_line1"),
            "address_line2": fields.get("address_line2") or stored.get("address_line2"),
            "city":          fields.get("city")          or stored.get("city"),
            "postcode":      fields.get("postcode")      or stored.get("postcode"),
            "country":       fields.get("country")       or stored.get("country"),
        }
        coords = await geocode_address(**merged)
        if coords:
            fields["latitude"], fields["longitude"] = coords

    if not fields:
        return {"status": "ok"}
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [user_id]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s", values)
            conn.commit()
    return {"status": "ok"}


_MEDIA_ROOT_AUTH = pathlib.Path(__file__).resolve().parents[3] / "media"
_ALLOWED_IMG_AUTH = {"image/jpeg", "image/png", "image/webp"}


@router.post("/me/avatar")
async def upload_me_avatar(request: Request, file: UploadFile = File(...)):
    """Upload a profile picture for the authenticated user."""
    user_id = _get_user_id_from_token(request)
    if file.content_type not in _ALLOWED_IMG_AUTH:
        raise HTTPException(status_code=400, detail="Only JPG/PNG/WebP allowed")
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 2 MB")
    dest = _MEDIA_ROOT_AUTH / "avatars"
    dest.mkdir(parents=True, exist_ok=True)
    ext = file.content_type.split("/")[1].replace("jpeg", "jpg")
    filename = f"user_{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    (dest / filename).write_bytes(data)
    url = f"/media/avatars/{filename}"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET profile_pic = %s WHERE id = %s", (url, user_id))
            conn.commit()
    return {"url": url}


class BecomeChefRequest(BaseModel):
    chef_slug: str


@router.post("/become-chef")
def become_chef(req: BecomeChefRequest, request: Request):
    """
    Change the authenticated user's profession to Chef and auto-create a chef_profile.
    Safe to call even if user_type is already Chef (idempotent slug check).
    """
    user_id = _get_user_id_from_token(request)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_type FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")

    # Validate slug and create chef profile first (before changing user_type)
    try:
        from app.chef.schema import ChefProfileCreate
        from app.chef import service as chef_service
        chef_data = ChefProfileCreate(slug=req.chef_slug, designation="Chef")
        chef_service.create_profile(user_id, chef_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Only update user_type after successful chef_profile creation
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET user_type = 'Chef' WHERE id = %s", (user_id,))
            conn.commit()

    return {"status": "ok", "slug": req.chef_slug}


@router.post("/dev-setup")
def dev_setup(email: EmailStr | None = None):
    """
    Dev helper: create a test user, return a token, and insert a sample recipe (veg biryani).
    Enabled only when DEV_RETURN_OTP_IN_RESPONSE is true.
    """
    if not settings.dev_return_otp_in_response:
        raise HTTPException(status_code=403, detail="Dev setup disabled")

    test_email = email or "dev+test@local"
    with get_connection() as conn:
        with conn.cursor() as cur:
            # create or get user
            cur.execute(
                """
                INSERT INTO users (full_name, email, phone, user_type, is_verified)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (email) DO UPDATE
                  SET full_name = EXCLUDED.full_name
                RETURNING id
                """,
                ("Dev User", test_email, None, "Developer"),
            )
            user_id = cur.fetchone()["id"]

            # create JWT token
            jti, token = create_access_token(user_id)
            expires = datetime.utcnow() + timedelta(days=30)
            cur.execute(
                """
                INSERT INTO user_token (token, user_id, expires_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (token) DO NOTHING
                """,
                (jti, user_id, expires),
            )

            # insert sample recipe (veg-biryani)
            recipe_key = "vegetable-biryani"
            steps = [
                "Rinse and soak basmati rice for 30 minutes.",
                "Sauté onions, tomatoes and spices. Add mixed vegetables and cook until tender.",
                "Layer rice and vegetables, add water, and cook on low heat until rice is done.",
            ]
            ingredients = [
                {"name": "basmati rice", "quantity": "2", "unit": "cups"},
                {"name": "onion", "quantity": "1", "unit": "large"},
                {"name": "tomato", "quantity": "2", "unit": "medium"},
                {"name": "mixed vegetables", "quantity": "2", "unit": "cups"},
            ]
            cur.execute(
                """
                INSERT INTO recipe_master (recipe_key, title, steps_json, servings)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (recipe_key) DO UPDATE
                  SET title = EXCLUDED.title,
                      steps_json = COALESCE(recipe_master.steps_json, EXCLUDED.steps_json),
                      servings = EXCLUDED.servings,
                      updated_at = NOW()
                RETURNING id
                """,
                (recipe_key, "Vegetable Biryani (Dev Sample)", Json(steps), 4),
            )
            recipe_id = cur.fetchone()["id"]

            # ensure ingredients exist and map them
            for item in ingredients:
                name = item["name"]
                cur.execute("SELECT id FROM ingredient_master WHERE name = %s", (name,))
                row = cur.fetchone()
                if row:
                    ingredient_id = row["id"]
                else:
                    cur.execute(
                        "INSERT INTO ingredient_master (name, category, image_path, nutrition_json) VALUES (%s, %s, %s, %s) RETURNING id",
                        (name, None, "", Json({})),
                    )
                    ingredient_id = cur.fetchone()["id"]

                # upsert map (avoid duplicates)
                cur.execute(
                    """
                    INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id, quantity, unit)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (recipe_id, ingredient_id) DO NOTHING
                    """,
                    (recipe_id, ingredient_id, item.get("quantity", ""), item.get("unit", "")),
                )

            conn.commit()
    return {"status": "ok", "token": token, "user_id": user_id, "recipe_key": recipe_key}
