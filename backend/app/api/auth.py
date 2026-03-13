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
from psycopg.types.json import Json

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str | None = None
    phone: str | None = None
    user_type: str | None = None
    chef_slug: str | None = None  # Required when user_type is Chef or Restaurant/Foodcourt


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


@router.post("/register")
def register(req: RegisterRequest):
    # Register with optional password. If password provided, set it and mark verified.
    with get_connection() as conn:
        with conn.cursor() as cur:
            # If phone provided, ensure it isn't already taken by a DIFFERENT email
            if req.phone:
                cur.execute(
                    "SELECT email FROM users WHERE phone = %s LIMIT 1",
                    (req.phone,),
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
            # Create or update user record (email unique)
            try:
              cur.execute(
                """
                INSERT INTO users (full_name, email, phone, user_type, password_hash, password_salt, is_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (email) DO UPDATE
                  SET full_name = EXCLUDED.full_name,
                      phone = EXCLUDED.phone,
                      user_type = EXCLUDED.user_type,
                      password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
                      password_salt = COALESCE(EXCLUDED.password_salt, users.password_salt)
                RETURNING id, phone, email
                """,
                (req.full_name, req.email, req.phone, req.user_type, pw_hash, salt, bool(req.password)),
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

            # If password not provided, fall back to OTP registration flow (existing behavior)
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
                # Auto-create chef_profile if user is a chef/restaurant and provided a slug
                if req.user_type in ("Chef", "Restaurant/Foodcourt") and req.chef_slug:
                    try:
                        from app.chef.schema import ChefProfileCreate
                        from app.chef import service as chef_service
                        chef_data = ChefProfileCreate(
                            slug=req.chef_slug,
                            designation=req.user_type,
                        )
                        chef_service.create_profile(user_id, chef_data)
                        logger.info("Auto-created chef_profile for user %s with slug '%s'", user_id, req.chef_slug)
                    except Exception:
                        logger.exception("Failed to auto-create chef_profile for user %s (non-fatal)", user_id)
                return {"status": "ok", "email": email, "user_id": user_id}


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
    """Authenticate user via email+password and return token."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, password_hash, password_salt FROM users WHERE email = %s", (req.email,))
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
            token = str(uuid.uuid4())
            expires = datetime.utcnow() + timedelta(days=7)
            cur.execute("INSERT INTO user_token (token, user_id, expires_at) VALUES (%s, %s, %s)", (token, user_id, expires))
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

            # create token
            token = str(uuid.uuid4())
            expires = datetime.utcnow() + timedelta(days=7)
            cur.execute(
                """
                INSERT INTO user_token (token, user_id, expires_at)
                VALUES (%s, %s, %s)
                """,
                (token, user_id, expires),
            )
            conn.commit()
            return {"status": "ok", "token": token, "user_id": user_id}


@router.post("/logout")
def logout(request: Request):
    """Invalidate current bearer token (logout)."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_token WHERE token = %s", (token,))
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
    """Return authenticated user's profile based on Bearer token."""
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.full_name, u.email, u.phone, u.user_type, u.is_verified,
                       u.is_admin, u.designation, u.permissions_json, u.profile_pic,
                       u.gender, u.address, ut.expires_at
                FROM user_token ut
                JOIN users u ON u.id = ut.user_id
                WHERE ut.token = %s AND (ut.expires_at IS NULL OR ut.expires_at > NOW())
                """,
                (token,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
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
            }


def _get_user_id_from_token(request: Request) -> int:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth.split(None, 1)[1].strip()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM user_token WHERE token = %s AND (expires_at IS NULL OR expires_at > NOW())",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            return row["user_id"]


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None


@router.put("/me")
def update_me(req: UpdateProfileRequest, request: Request):
    """Update authenticated user's profile fields."""
    user_id = _get_user_id_from_token(request)
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
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

            # create token
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
