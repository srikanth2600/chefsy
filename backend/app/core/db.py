from pathlib import Path

import time

from psycopg import Connection, connect, OperationalError
from psycopg.rows import dict_row

from app.core.config import settings
import logging


def get_connection() -> Connection:
    return connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
        row_factory=dict_row,
    )


def _migrate_chat_message_to_chat_id(conn) -> None:
    """
    Normalize chat_message to use only chat_id (FK → chat_session.id).
    Handles: (1) only chat_session_id, (2) both columns, (3) only chat_id.
    Safe to run repeatedly; idempotent.
    """
    logger = logging.getLogger(__name__)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'chat_message'
            AND column_name IN ('chat_id', 'chat_session_id')
            """
        )
        rows = cur.fetchall()
    if not rows:
        return
    cols = {row["column_name"] for row in rows}
    has_session_id = "chat_session_id" in cols
    has_chat_id = "chat_id" in cols

    with conn.cursor() as cur:
        if not has_session_id and has_chat_id:
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON chat_message(chat_id)"
            )
            conn.commit()
            return

        if has_session_id and not has_chat_id:
            cur.execute(
                "ALTER TABLE chat_message ADD COLUMN chat_id INTEGER REFERENCES chat_session(id) ON DELETE CASCADE"
            )
            cur.execute(
                "UPDATE chat_message SET chat_id = chat_session_id WHERE chat_session_id IS NOT NULL"
            )
            cur.execute("ALTER TABLE chat_message ALTER COLUMN chat_id SET NOT NULL")
            cur.execute("ALTER TABLE chat_message DROP COLUMN IF EXISTS chat_session_id")
            cur.execute("DROP INDEX IF EXISTS idx_chat_message_session")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON chat_message(chat_id)"
            )
            conn.commit()
            logger.info(
                "Migrated chat_message: chat_session_id -> chat_id (added chat_id, dropped chat_session_id)"
            )
            return

        if has_session_id and has_chat_id:
            cur.execute(
                """
                UPDATE chat_message SET chat_id = COALESCE(chat_id, chat_session_id)
                WHERE chat_session_id IS NOT NULL
                """
            )
            cur.execute("ALTER TABLE chat_message DROP COLUMN IF EXISTS chat_session_id")
            cur.execute("DROP INDEX IF EXISTS idx_chat_message_session")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON chat_message(chat_id)"
            )
            conn.commit()
            logger.info("Migrated chat_message: dropped chat_session_id, using chat_id only")
            return


def init_db() -> None:
    if not settings.use_postgresql:
        return

    schema_path = Path(__file__).resolve().parents[2] / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    for attempt in range(10):
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)
                conn.commit()
            with get_connection() as conn:
                _migrate_chat_message_to_chat_id(conn)
            # Run additional lightweight startup migrations to ensure optional columns exist
            run_startup_migrations()
            return
        except OperationalError:
            time.sleep(2)
    raise RuntimeError("Database not ready after multiple attempts.")


def run_startup_migrations() -> None:
    """
    Apply non-destructive migrations that ensure older databases are compatible:
    - add otp_code.email column if missing
    - make users.phone nullable
    - backfill otp_code.email from users where possible
    This runs small ALTER/UPDATE statements and is safe to call repeatedly.
    """
    if not settings.use_postgresql:
        return
    logger = logging.getLogger(__name__)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Add email column to otp_code if missing
                try:
                    cur.execute("ALTER TABLE otp_code ADD COLUMN IF NOT EXISTS email TEXT;")
                    logger.info("Ensured otp_code.email column exists")
                except Exception:
                    logger.exception("Failed to add otp_code.email column (continuing)")

                # Make users.phone nullable if not already
                try:
                    cur.execute("ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;")
                    logger.info("Ensured users.phone is nullable")
                except Exception:
                    logger.exception("Failed to alter users.phone nullability (continuing)")

                # Ensure recipe_master has recipe_json column for structured LLM output
                try:
                    cur.execute("ALTER TABLE recipe_master ADD COLUMN IF NOT EXISTS recipe_json JSONB;")
                    logger.info("Ensured recipe_master.recipe_json column exists")
                except Exception:
                    logger.exception("Failed to add recipe_master.recipe_json column (continuing)")
                # Ensure pg_trgm extension and trigram index for fuzzy title search
                try:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_recipe_title_trgm ON recipe_master USING gin (title gin_trgm_ops);")
                    logger.info("Ensured pg_trgm extension and trigram index on recipe_master.title")
                except Exception:
                    logger.exception("Failed to ensure pg_trgm/index on recipe_master.title (continuing)")

                # Ensure recipe_aliases table for aliases and a trigram index on alias_text
                try:
                    cur.execute(
                        "CREATE TABLE IF NOT EXISTS recipe_aliases (id SERIAL PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipe_master(id) ON DELETE CASCADE, alias_text TEXT NOT NULL)"
                    )
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_recipe_alias_text ON recipe_aliases USING gin (alias_text gin_trgm_ops);")
                    logger.info("Ensured recipe_aliases table and index")
                except Exception:
                    logger.exception("Failed to ensure recipe_aliases table/index (continuing)")

                # Ensure chat_message has recipe_json column (some older DBs might not)
                try:
                    cur.execute("ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS recipe_json JSONB;")
                    logger.info("Ensured chat_message.recipe_json column exists")
                except Exception:
                    logger.exception("Failed to add chat_message.recipe_json column (continuing)")

                # Backfill otp_code.email from users via user_id
                try:
                    cur.execute(
                        """
                        UPDATE otp_code oc
                        SET email = u.email
                        FROM users u
                        WHERE oc.user_id IS NOT NULL
                          AND u.id = oc.user_id
                          AND (oc.email IS NULL OR oc.email = '')
                        """
                    )
                    logger.info("Backfilled otp_code.email from users by user_id")
                except Exception:
                    logger.exception("Failed to backfill otp_code.email from users by user_id (continuing)")

                # Backfill otp_code.email by matching phone where possible
                try:
                    cur.execute(
                        """
                        UPDATE otp_code oc
                        SET email = u.email
                        FROM users u
                        WHERE (oc.email IS NULL OR oc.email = '')
                          AND oc.phone IS NOT NULL
                          AND u.phone IS NOT NULL
                          AND oc.phone = u.phone
                        """
                    )
                    logger.info("Backfilled otp_code.email from users by phone match")
                except Exception:
                    logger.exception("Failed to backfill otp_code.email by phone (continuing)")

                # Add chef_id FK to recipe_master for chef-owned recipes
                try:
                    cur.execute(
                        "ALTER TABLE recipe_master ADD COLUMN IF NOT EXISTS chef_id INTEGER REFERENCES chef_profile(id) ON DELETE SET NULL;"
                    )
                    logger.info("Ensured recipe_master.chef_id column exists")
                except Exception:
                    logger.exception("Failed to add recipe_master.chef_id column (continuing)")

                # is_active + is_published columns for admin moderation and draft support
                try:
                    cur.execute("ALTER TABLE recipe_master ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;")
                    cur.execute("ALTER TABLE recipe_master ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;")
                    logger.info("Ensured recipe_master.is_active / is_published columns exist")
                except Exception:
                    logger.exception("Failed to add recipe_master is_active/is_published columns (continuing)")

                # View count for recipes
                try:
                    cur.execute("ALTER TABLE recipe_master ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;")
                    logger.info("Ensured recipe_master.view_count column exists")
                except Exception:
                    logger.exception("Failed to add recipe_master.view_count column (continuing)")

                # Chef roles tables
                try:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS chef_roles (
                          id SERIAL PRIMARY KEY,
                          name TEXT NOT NULL UNIQUE,
                          description TEXT,
                          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                    """)
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS chef_role_mapping (
                          id SERIAL PRIMARY KEY,
                          chef_id INTEGER NOT NULL REFERENCES chef_profile(id) ON DELETE CASCADE,
                          role_id INTEGER NOT NULL REFERENCES chef_roles(id) ON DELETE CASCADE,
                          UNIQUE (chef_id, role_id)
                        )
                    """)
                    logger.info("Ensured chef_roles and chef_role_mapping tables exist")
                except Exception:
                    logger.exception("Failed to create chef_roles tables (continuing)")

                # Category hierarchy tables
                try:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS categories (
                          id SERIAL PRIMARY KEY,
                          name TEXT NOT NULL,
                          slug TEXT NOT NULL UNIQUE,
                          parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                          level INTEGER NOT NULL DEFAULT 1,
                          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                    """)
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS recipe_category_map (
                          id SERIAL PRIMARY KEY,
                          recipe_id INTEGER NOT NULL REFERENCES recipe_master(id) ON DELETE CASCADE,
                          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                          UNIQUE (recipe_id, category_id)
                        )
                    """)
                    logger.info("Ensured categories and recipe_category_map tables exist")
                except Exception:
                    logger.exception("Failed to create category tables (continuing)")

                # Chef reels table
                try:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS chef_reels (
                          id               SERIAL PRIMARY KEY,
                          chef_id          INTEGER NOT NULL REFERENCES chef_profile(id) ON DELETE CASCADE,
                          title            TEXT NOT NULL,
                          description      TEXT,
                          hashtags         JSONB NOT NULL DEFAULT '[]',
                          video_url        TEXT,
                          video_file_path  TEXT,
                          platform         TEXT,
                          thumbnail        TEXT,
                          status           TEXT NOT NULL DEFAULT 'active',
                          view_count       INTEGER NOT NULL DEFAULT 0,
                          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                    """)
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_chef_reels_chef_id ON chef_reels(chef_id)")
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_chef_reels_status  ON chef_reels(status)")
                    logger.info("Ensured chef_reels table exists")
                except Exception:
                    logger.exception("Failed to create chef_reels table (continuing)")

                # Address & geo fields on chef_profile
                try:
                    for col in ["address_line1", "address_line2", "street", "city", "county", "postcode"]:
                        cur.execute(f"ALTER TABLE chef_profile ADD COLUMN IF NOT EXISTS {col} TEXT;")
                    cur.execute("ALTER TABLE chef_profile ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);")
                    cur.execute("ALTER TABLE chef_profile ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);")
                    cur.execute("ALTER TABLE chef_profile ADD COLUMN IF NOT EXISTS gender TEXT;")
                    logger.info("Ensured chef_profile address/geo/gender columns exist")
                except Exception:
                    logger.exception("Failed to add address columns to chef_profile (continuing)")

            try:
                with conn.cursor() as cur2:
                    cur2.execute("""
                        CREATE TABLE IF NOT EXISTS recipe_reviews (
                            id          SERIAL PRIMARY KEY,
                            user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                            recipe_id   INTEGER NOT NULL REFERENCES recipe_master(id) ON DELETE CASCADE,
                            rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                            review_text TEXT,
                            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            UNIQUE (user_id, recipe_id)
                        )
                    """)
                logger.info("Ensured recipe_reviews table exists")
            except Exception:
                logger.exception("Failed to create recipe_reviews table (continuing)")

            try:
                with conn.cursor() as cur3:
                    cur3.execute("""
                        CREATE TABLE IF NOT EXISTS chef_messages (
                            id           SERIAL PRIMARY KEY,
                            chef_id      INTEGER NOT NULL REFERENCES chef_profile(id) ON DELETE CASCADE,
                            user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
                            sender_name  TEXT,
                            sender_email TEXT,
                            subject      TEXT,
                            message      TEXT NOT NULL,
                            is_read      BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        )
                    """)
                    cur3.execute("CREATE INDEX IF NOT EXISTS idx_chef_messages_chef_id ON chef_messages(chef_id)")
                logger.info("Ensured chef_messages table exists")
            except Exception:
                logger.exception("Failed to create chef_messages table (continuing)")

            conn.commit()
    except OperationalError:
        logger.exception("Database not ready for startup migrations")

    # Meal plan tables
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS meal_plan (
                      id               SERIAL PRIMARY KEY,
                      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                      name             TEXT NOT NULL DEFAULT 'My Meal Plan',
                      description      TEXT,
                      week_start_date  DATE,
                      servings         INTEGER NOT NULL DEFAULT 2,
                      preferences_json JSONB,
                      status           TEXT NOT NULL DEFAULT 'active'
                                         CHECK (status IN ('active','archived')),
                      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_user_id    ON meal_plan(user_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_status     ON meal_plan(status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_week_start ON meal_plan(week_start_date)")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS meal_plan_slot (
                      id           SERIAL PRIMARY KEY,
                      meal_plan_id INTEGER NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
                      day_index    SMALLINT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
                      meal_type    TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
                      recipe_id    INTEGER REFERENCES recipe_master(id) ON DELETE SET NULL,
                      meal_name    TEXT,
                      meal_json    JSONB,
                      sort_order   SMALLINT NOT NULL DEFAULT 0,
                      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (meal_plan_id, day_index, meal_type)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_slot_plan_id ON meal_plan_slot(meal_plan_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_slot_recipe  ON meal_plan_slot(recipe_id)")
                conn.commit()
                logger.info("Ensured meal_plan and meal_plan_slot tables exist")
    except Exception:
        logger.exception("Failed to create meal_plan tables (continuing)")

    # Migrate chat_content_block CHECK constraint to allow 'meal_plan' block type
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT conname, pg_get_constraintdef(oid) AS condef
                    FROM pg_constraint
                    WHERE conrelid = 'chat_content_block'::regclass AND contype = 'c'
                    """
                )
                rows = cur.fetchall()
                for row in rows:
                    if "block_type" in (row.get("condef") or "") and "meal_plan" not in (row.get("condef") or ""):
                        conname = row["conname"]
                        cur.execute(f"ALTER TABLE chat_content_block DROP CONSTRAINT {conname}")
                        cur.execute(
                            "ALTER TABLE chat_content_block ADD CONSTRAINT chat_content_block_block_type_check "
                            "CHECK (block_type IN ('text','recipe','video','ad','cta','meal_plan'))"
                        )
                        conn.commit()
                        logger.info("Migrated chat_content_block block_type CHECK to include 'meal_plan'")
                        break
    except Exception:
        logger.exception("Failed to migrate chat_content_block block_type constraint (continuing)")

    # Create meal_plan_option table and seed default options
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS meal_plan_option (
                        id         SERIAL PRIMARY KEY,
                        category   TEXT NOT NULL CHECK (category IN ('dietary','allergy','cuisine')),
                        label      TEXT NOT NULL,
                        sort_order SMALLINT NOT NULL DEFAULT 0,
                        is_active  BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (category, label)
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_option_category ON meal_plan_option(category)")
                conn.commit()
                # Seed defaults only if table is empty
                cur.execute("SELECT COUNT(*) AS cnt FROM meal_plan_option")
                if cur.fetchone()["cnt"] == 0:
                    seeds = [
                        ("dietary", "Vegetarian", 0), ("dietary", "Vegan", 1),
                        ("dietary", "Gluten-Free", 2), ("dietary", "Dairy-Free", 3),
                        ("dietary", "High-Protein", 4), ("dietary", "Low-Carb", 5),
                        ("dietary", "Keto", 6), ("dietary", "Paleo", 7),
                        ("dietary", "Halal", 8), ("dietary", "Kosher", 9),
                        ("allergy", "Nuts", 0), ("allergy", "Peanuts", 1),
                        ("allergy", "Dairy", 2), ("allergy", "Eggs", 3),
                        ("allergy", "Shellfish", 4), ("allergy", "Fish", 5),
                        ("allergy", "Soy", 6), ("allergy", "Wheat / Gluten", 7),
                        ("allergy", "Sesame", 8),
                        ("cuisine", "Indian", 0), ("cuisine", "Italian", 1),
                        ("cuisine", "Mexican", 2), ("cuisine", "Chinese", 3),
                        ("cuisine", "Japanese", 4), ("cuisine", "Mediterranean", 5),
                        ("cuisine", "Thai", 6), ("cuisine", "Middle Eastern", 7),
                        ("cuisine", "American", 8), ("cuisine", "French", 9),
                        ("cuisine", "Korean", 10), ("cuisine", "Greek", 11),
                    ]
                    for category, label, sort_order in seeds:
                        cur.execute(
                            "INSERT INTO meal_plan_option (category, label, sort_order) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                            (category, label, sort_order),
                        )
                    conn.commit()
                    logger.info("Seeded meal_plan_option table with default options")
    except Exception:
        logger.exception("Failed to create meal_plan_option table (continuing)")

    # subscription_package and package_feature_limit tables
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS subscription_package (
                      id            SERIAL PRIMARY KEY,
                      name          TEXT NOT NULL UNIQUE,
                      display_name  TEXT NOT NULL,
                      description   TEXT,
                      price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
                      price_yearly  NUMERIC(10,2) NOT NULL DEFAULT 0,
                      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
                      sort_order    SMALLINT NOT NULL DEFAULT 0,
                      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS package_feature_limit (
                      id           SERIAL PRIMARY KEY,
                      package_id   INTEGER NOT NULL REFERENCES subscription_package(id) ON DELETE CASCADE,
                      feature      TEXT NOT NULL CHECK (feature IN ('ai_recipe','meal_plan','ai_video')),
                      period       TEXT NOT NULL CHECK (period IN ('daily','monthly')),
                      limit_value  INTEGER,
                      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (package_id, feature, period)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_pkg_feat_limit_pkg ON package_feature_limit(package_id)")
                conn.commit()
                # Seed free and pro packages only if table is empty
                cur.execute("SELECT COUNT(*) AS cnt FROM subscription_package")
                if cur.fetchone()["cnt"] == 0:
                    pkg_seeds = [
                        ("free", "Free",  "Basic access with limited AI features", 0,    0,     True,  0),
                        ("pro",  "Pro",   "Full access with AI meal planning & generation", 9.99, 99.99, True, 1),
                    ]
                    free_limits = [
                        ("ai_recipe", "daily",   3),
                        ("ai_recipe", "monthly", 10),
                        ("meal_plan", "monthly", 0),   # 0 = blocked for free users
                        ("ai_video",  "daily",   1),
                        ("ai_video",  "monthly", 3),
                    ]
                    pro_limits = [
                        ("ai_recipe", "daily",   25),
                        ("ai_recipe", "monthly", None),  # None = unlimited
                        ("meal_plan", "monthly", None),  # None = unlimited
                        ("ai_video",  "daily",   10),
                        ("ai_video",  "monthly", None),  # None = unlimited
                    ]
                    pkg_limits_map = {"free": free_limits, "pro": pro_limits}
                    for name, display_name, description, price_monthly, price_yearly, is_active, sort_order in pkg_seeds:
                        cur.execute(
                            "INSERT INTO subscription_package (name,display_name,description,price_monthly,price_yearly,is_active,sort_order) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                            (name, display_name, description, price_monthly, price_yearly, is_active, sort_order),
                        )
                        pkg_id = cur.fetchone()["id"]
                        for feature, period, limit_value in pkg_limits_map[name]:
                            cur.execute(
                                "INSERT INTO package_feature_limit (package_id,feature,period,limit_value) VALUES (%s,%s,%s,%s)",
                                (pkg_id, feature, period, limit_value),
                            )
                    conn.commit()
                    logger.info("Seeded subscription_package and package_feature_limit tables")
    except Exception:
        logger.exception("Failed to create subscription_package tables (continuing)")
