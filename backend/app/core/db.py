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

    # LLM model management tables
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS llm_model (
                        id          SERIAL PRIMARY KEY,
                        name        TEXT NOT NULL,
                        provider    TEXT NOT NULL,
                        model_id    TEXT NOT NULL,
                        api_key     TEXT,
                        base_url    TEXT,
                        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
                        is_default  BOOLEAN NOT NULL DEFAULT FALSE,
                        notes       TEXT,
                        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS package_llm_access (
                        id            SERIAL PRIMARY KEY,
                        package_id    INTEGER NOT NULL REFERENCES subscription_package(id) ON DELETE CASCADE,
                        llm_model_id  INTEGER NOT NULL REFERENCES llm_model(id) ON DELETE CASCADE,
                        is_default    BOOLEAN NOT NULL DEFAULT FALSE,
                        UNIQUE (package_id, llm_model_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_pkg_llm_pkg    ON package_llm_access(package_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_pkg_llm_model  ON package_llm_access(llm_model_id)")
                # Add features column if it doesn't exist (migration for existing installs)
                cur.execute("""
                    ALTER TABLE package_llm_access
                    ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '["ai_recipe","meal_plan"]'
                """)
                conn.commit()
                logger.info("Ensured llm_model and package_llm_access tables exist")
    except Exception:
        logger.exception("Failed to create llm_model tables (continuing)")

    # Seed default LLM models from config if table is empty
    try:
        from app.core.config import settings as _settings
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS cnt FROM llm_model")
                cnt = cur.fetchone()["cnt"]
                if cnt == 0:
                    seeds = []
                    # Groq models
                    for m in (_settings.groq_models or []):
                        seeds.append({
                            "name": m, "provider": "groq", "model_id": m,
                            "api_key": _settings.groq_api_key or "",
                            "base_url": _settings.groq_base_url,
                            "is_default": m == _settings.groq_model,
                        })
                    # OpenAI
                    if _settings.openai_api_key:
                        seeds.append({
                            "name": _settings.openai_model, "provider": "openai",
                            "model_id": _settings.openai_model,
                            "api_key": _settings.openai_api_key, "base_url": None,
                            "is_default": _settings.default_llm_provider == "openai",
                        })
                    # Ollama models
                    for m in (_settings.ollama_models or []):
                        seeds.append({
                            "name": m, "provider": "ollama", "model_id": m,
                            "api_key": None,
                            "base_url": _settings.ollama_http_url or "http://localhost:11434",
                            "is_default": m == _settings.default_ollama_model and _settings.default_llm_provider == "ollama",
                        })
                    # Ensure only one is_default=True
                    has_default = any(s["is_default"] for s in seeds)
                    if not has_default and seeds:
                        seeds[0]["is_default"] = True
                    for s in seeds:
                        cur.execute(
                            "INSERT INTO llm_model (name, provider, model_id, api_key, base_url, is_active, is_default) VALUES (%s,%s,%s,%s,%s,TRUE,%s)",
                            (s["name"], s["provider"], s["model_id"], s["api_key"], s["base_url"], s["is_default"])
                        )
                    conn.commit()
                    logger.info("Seeded %d default LLM models", len(seeds))
    except Exception:
        logger.exception("Failed to seed default LLM models (continuing)")

    # ── Organisation module tables ────────────────────────────────────────────
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # platform_module — Super Admin toggle: enable/disable entire org type
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS platform_module (
                      id           SERIAL PRIMARY KEY,
                      module_key   TEXT NOT NULL UNIQUE,
                      display_name TEXT NOT NULL,
                      description  TEXT,
                      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
                      updated_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                for key, name, desc in [
                    ("corporate", "Corporate", "B2B corporate wellness & meal planning"),
                    ("gym",       "Gym",       "Gym & fitness centre management"),
                    ("nutrition", "Nutrition", "Nutrition practice & clinical diet management"),
                    ("others",    "Others",    "General organisations & communities"),
                ]:
                    cur.execute(
                        "INSERT INTO platform_module (module_key, display_name, description) "
                        "VALUES (%s, %s, %s) ON CONFLICT (module_key) DO NOTHING",
                        (key, name, desc),
                    )

                # org_profile — one row per registered organisation
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_profile (
                      id              SERIAL PRIMARY KEY,
                      admin_user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                      org_type        TEXT NOT NULL
                                        CHECK (org_type IN ('corporate','gym','nutrition','others')),
                      org_name        TEXT NOT NULL,
                      slug            TEXT NOT NULL UNIQUE,
                      tagline         TEXT,
                      logo_url        TEXT,
                      banner_url      TEXT,
                      official_email  TEXT NOT NULL,
                      phone           TEXT,
                      website_url     TEXT,
                      address_line1   TEXT,
                      city            TEXT,
                      state           TEXT,
                      pincode         TEXT,
                      latitude        NUMERIC,
                      longitude       NUMERIC,
                      active_modules  JSONB NOT NULL DEFAULT '["meal_planning","compliance","notifications"]',
                      org_rules_json  JSONB NOT NULL DEFAULT '{}',
                      plan            TEXT NOT NULL DEFAULT 'starter',
                      is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
                      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
                      is_public       BOOLEAN NOT NULL DEFAULT FALSE,
                      subdomain       TEXT UNIQUE,
                      accent_color    TEXT DEFAULT '#3B82F6',
                      member_count    INTEGER NOT NULL DEFAULT 0,
                      group_count     INTEGER NOT NULL DEFAULT 0,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_profile_admin  ON org_profile(admin_user_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_profile_type   ON org_profile(org_type)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_profile_slug   ON org_profile(slug)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_profile_city   ON org_profile(city)")

                # org_staff — trainers, nutritionists, HR staff scoped to an org
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_staff (
                      id          SERIAL PRIMARY KEY,
                      org_id      INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                      role        TEXT NOT NULL,
                      permissions JSONB NOT NULL DEFAULT '{}',
                      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
                      invited_at  TIMESTAMPTZ,
                      joined_at   TIMESTAMPTZ,
                      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (org_id, user_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_staff_org  ON org_staff(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_staff_user ON org_staff(user_id)")

                # org_member — end users (employees/gym members/patients); many-to-many user ↔ org
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_member (
                      id             SERIAL PRIMARY KEY,
                      org_id         INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      email          TEXT NOT NULL,
                      full_name      TEXT,
                      phone          TEXT,
                      status         TEXT NOT NULL DEFAULT 'invited'
                                       CHECK (status IN ('invited','profile_incomplete','active','inactive','suspended')),
                      invite_token   TEXT UNIQUE,
                      invite_sent_at TIMESTAMPTZ,
                      joined_at      TIMESTAMPTZ,
                      member_meta    JSONB NOT NULL DEFAULT '{}',
                      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (org_id, email)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_member_org    ON org_member(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_member_user   ON org_member(user_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_member_status ON org_member(status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_member_token  ON org_member(invite_token)")

                # org_group — cohort/group within an org
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_group (
                      id                SERIAL PRIMARY KEY,
                      org_id            INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      name              TEXT NOT NULL,
                      description       TEXT,
                      group_type        TEXT NOT NULL DEFAULT 'general',
                      color             TEXT DEFAULT '#3B82F6',
                      icon              TEXT DEFAULT 'group',
                      meal_plan_type    TEXT DEFAULT 'general',
                      medical_condition TEXT,
                      plan_cadence      TEXT NOT NULL DEFAULT 'weekly',
                      auto_publish      BOOLEAN NOT NULL DEFAULT FALSE,
                      assigned_staff_id INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      group_rules_json  JSONB NOT NULL DEFAULT '{}',
                      is_active         BOOLEAN NOT NULL DEFAULT TRUE,
                      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_group_org  ON org_group(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_group_type ON org_group(group_type)")

                # org_group_member — member ↔ group (many-to-many; one member can be in multiple groups)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_group_member (
                      id        SERIAL PRIMARY KEY,
                      group_id  INTEGER NOT NULL REFERENCES org_group(id) ON DELETE CASCADE,
                      member_id INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      added_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (group_id, member_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_ogm_group  ON org_group_member(group_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_ogm_member ON org_group_member(member_id)")

                # Ensure suspension columns exist on org_profile (idempotent)
                for col_sql in [
                    "ALTER TABLE org_profile ADD COLUMN IF NOT EXISTS suspension_reason TEXT",
                    "ALTER TABLE org_profile ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ",
                    "ALTER TABLE org_profile ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id) ON DELETE SET NULL",
                ]:
                    cur.execute(col_sql)

                # org_admin_action — full audit log of admin enforcement actions on orgs
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_admin_action (
                      id           SERIAL PRIMARY KEY,
                      org_id       INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      action       TEXT NOT NULL,
                      reason       TEXT,
                      performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_oaa_org ON org_admin_action(org_id)")

                # users.primary_org_id — fast org-switcher default
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_org_id INTEGER REFERENCES org_profile(id) ON DELETE SET NULL"
                )

                conn.commit()
                logger.info("Ensured org module tables (platform_module, org_profile, org_staff, org_member, org_group, org_group_member, org_admin_action)")
    except Exception:
        logger.exception("Failed to create org module tables (continuing)")

    # ── Org shared module tables ────────────────────────────────────────────
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # org_meal_plan_batch — bulk AI plan generation run
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_meal_plan_batch (
                      id              SERIAL PRIMARY KEY,
                      org_id          INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      group_id        INTEGER REFERENCES org_group(id) ON DELETE SET NULL,
                      initiated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      batch_name      TEXT,
                      status          TEXT NOT NULL DEFAULT 'queued'
                                        CHECK (status IN ('queued','processing','partial_complete','review_pending','approved','published','failed')),
                      total_members   INTEGER NOT NULL DEFAULT 0,
                      processed_count INTEGER NOT NULL DEFAULT 0,
                      failed_count    INTEGER NOT NULL DEFAULT 0,
                      week_start_date DATE,
                      reviewed_by     INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      reviewed_at     TIMESTAMPTZ,
                      published_at    TIMESTAMPTZ,
                      notes           TEXT,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_batch_org    ON org_meal_plan_batch(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_batch_group  ON org_meal_plan_batch(group_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_batch_status ON org_meal_plan_batch(status)")

                # org_member_meal_plan — individual plan within a batch
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_member_meal_plan (
                      id           SERIAL PRIMARY KEY,
                      batch_id     INTEGER NOT NULL REFERENCES org_meal_plan_batch(id) ON DELETE CASCADE,
                      member_id    INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      meal_plan_id INTEGER REFERENCES meal_plan(id) ON DELETE SET NULL,
                      status       TEXT NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending','generated','review_pending','approved','published','failed')),
                      staff_notes  TEXT,
                      error_msg    TEXT,
                      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (batch_id, member_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_ommp_batch  ON org_member_meal_plan(batch_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_ommp_member ON org_member_meal_plan(member_id)")

                # org_content — reels / articles / health tips (shared across org types)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_content (
                      id            SERIAL PRIMARY KEY,
                      org_id        INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      staff_id      INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      content_type  TEXT NOT NULL
                                      CHECK (content_type IN ('reel','health_tip','article','workout_video','recipe_demo')),
                      title         TEXT NOT NULL,
                      description   TEXT,
                      hashtags      JSONB NOT NULL DEFAULT '[]',
                      video_url     TEXT,
                      video_file    TEXT,
                      thumbnail     TEXT,
                      platform      TEXT,
                      body_text     TEXT,
                      target_group  TEXT DEFAULT 'all',
                      status        TEXT NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('draft','active','archived')),
                      view_count    INTEGER NOT NULL DEFAULT 0,
                      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_content_org  ON org_content(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_org_content_type ON org_content(content_type)")

                # org_compliance_log — daily member check-ins (privacy-critical)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_compliance_log (
                      id                   SERIAL PRIMARY KEY,
                      member_id            INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      log_date             DATE NOT NULL,
                      breakfast            TEXT CHECK (breakfast IN ('yes','partial','no')),
                      lunch                TEXT CHECK (lunch IN ('yes','partial','no')),
                      dinner               TEXT CHECK (dinner IN ('yes','partial','no')),
                      snack                TEXT CHECK (snack IN ('yes','partial','no')),
                      weight_kg            NUMERIC(5,2),
                      mood_score           SMALLINT CHECK (mood_score BETWEEN 1 AND 5),
                      energy_score         SMALLINT CHECK (energy_score BETWEEN 1 AND 5),
                      workout_done         BOOLEAN,
                      workout_duration_min INTEGER,
                      clinical_notes       TEXT,
                      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (member_id, log_date)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_compliance_member ON org_compliance_log(member_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_compliance_date   ON org_compliance_log(log_date)")

                # org_challenge + enrollment
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_challenge (
                      id             SERIAL PRIMARY KEY,
                      org_id         INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      group_id       INTEGER REFERENCES org_group(id) ON DELETE SET NULL,
                      name           TEXT NOT NULL,
                      description    TEXT,
                      challenge_type TEXT,
                      start_date     DATE NOT NULL,
                      end_date       DATE NOT NULL,
                      rules_json     JSONB NOT NULL DEFAULT '{}',
                      is_anonymous   BOOLEAN NOT NULL DEFAULT TRUE,
                      status         TEXT NOT NULL DEFAULT 'draft'
                                       CHECK (status IN ('draft','active','completed')),
                      created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_challenge_org ON org_challenge(org_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_challenge_enrollment (
                      id           SERIAL PRIMARY KEY,
                      challenge_id INTEGER NOT NULL REFERENCES org_challenge(id) ON DELETE CASCADE,
                      member_id    INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      progress_pct SMALLINT NOT NULL DEFAULT 0,
                      completed_at TIMESTAMPTZ,
                      show_name    BOOLEAN NOT NULL DEFAULT TRUE,
                      enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (challenge_id, member_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_challenge_enroll ON org_challenge_enrollment(challenge_id)")

                # org_notification_log — broadcast messages
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS org_notification_log (
                      id              SERIAL PRIMARY KEY,
                      org_id          INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      sent_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
                      channel         TEXT NOT NULL CHECK (channel IN ('email','in_app','push')),
                      audience_type   TEXT NOT NULL CHECK (audience_type IN ('all','group','member')),
                      audience_ref_id INTEGER,
                      subject         TEXT,
                      body            TEXT NOT NULL,
                      scheduled_at    TIMESTAMPTZ,
                      sent_at         TIMESTAMPTZ,
                      recipient_count INTEGER DEFAULT 0,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_org ON org_notification_log(org_id)")

                conn.commit()
                logger.info("Ensured org shared module tables (batches, compliance, content, challenges, notifications)")
    except Exception:
        logger.exception("Failed to create org shared module tables (continuing)")

    # ── Corporate-specific tables ───────────────────────────────────────────
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS corporate_department (
                      id         SERIAL PRIMARY KEY,
                      org_id     INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      name       TEXT NOT NULL,
                      parent_id  INTEGER REFERENCES corporate_department(id) ON DELETE CASCADE,
                      head_email TEXT,
                      budget_inr NUMERIC(12,2),
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (org_id, name, parent_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_corp_dept_org ON corporate_department(org_id)")
                conn.commit()
                logger.info("Ensured corporate_department table")
    except Exception:
        logger.exception("Failed to create corporate_department table (continuing)")

    # ── Gym-specific tables ─────────────────────────────────────────────────
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gym_workout_plan (
                      id             SERIAL PRIMARY KEY,
                      org_id         INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      created_by     INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      name           TEXT NOT NULL,
                      goal           TEXT,
                      level          TEXT CHECK (level IN ('beginner','intermediate','advanced')),
                      duration_weeks INTEGER,
                      days_per_week  INTEGER,
                      plan_json      JSONB NOT NULL DEFAULT '{}',
                      is_template    BOOLEAN NOT NULL DEFAULT FALSE,
                      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
                      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_wplan_org ON gym_workout_plan(org_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gym_member_workout (
                      id              SERIAL PRIMARY KEY,
                      member_id       INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      workout_plan_id INTEGER NOT NULL REFERENCES gym_workout_plan(id) ON DELETE CASCADE,
                      trainer_id      INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      start_date      DATE,
                      end_date        DATE,
                      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (member_id, workout_plan_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_mworkout_member ON gym_member_workout(member_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gym_body_log (
                      id              SERIAL PRIMARY KEY,
                      member_id       INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      log_date        DATE NOT NULL,
                      weight_kg       NUMERIC(5,2),
                      body_fat_pct    NUMERIC(4,1),
                      muscle_mass_kg  NUMERIC(5,2),
                      waist_cm        NUMERIC(5,1),
                      chest_cm        NUMERIC(5,1),
                      arms_cm         NUMERIC(5,1),
                      notes           TEXT,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (member_id, log_date)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_bodylog_member ON gym_body_log(member_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gym_class (
                      id           SERIAL PRIMARY KEY,
                      org_id       INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      trainer_id   INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      name         TEXT NOT NULL,
                      class_type   TEXT,
                      scheduled_at TIMESTAMPTZ NOT NULL,
                      duration_min INTEGER NOT NULL DEFAULT 60,
                      capacity     INTEGER,
                      location     TEXT,
                      status       TEXT NOT NULL DEFAULT 'scheduled'
                                     CHECK (status IN ('scheduled','completed','cancelled')),
                      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_class_org ON gym_class(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_class_scheduled ON gym_class(scheduled_at)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gym_class_booking (
                      id        SERIAL PRIMARY KEY,
                      class_id  INTEGER NOT NULL REFERENCES gym_class(id) ON DELETE CASCADE,
                      member_id INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      status    TEXT NOT NULL DEFAULT 'booked'
                                  CHECK (status IN ('booked','attended','cancelled','no_show')),
                      booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                      UNIQUE (class_id, member_id)
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_booking_class  ON gym_class_booking(class_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_gym_booking_member ON gym_class_booking(member_id)")

                conn.commit()
                logger.info("Ensured gym-specific tables (workout_plan, member_workout, body_log, class, class_booking)")
    except Exception:
        logger.exception("Failed to create gym-specific tables (continuing)")

    # ── Nutrition-specific tables ───────────────────────────────────────────
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nutrition_client_clinical (
                      id                SERIAL PRIMARY KEY,
                      member_id         INTEGER NOT NULL UNIQUE REFERENCES org_member(id) ON DELETE CASCADE,
                      conditions        JSONB NOT NULL DEFAULT '[]',
                      medications       JSONB NOT NULL DEFAULT '[]',
                      lab_values_json   JSONB NOT NULL DEFAULT '{}',
                      food_intolerances JSONB NOT NULL DEFAULT '[]',
                      lifestyle_notes   TEXT,
                      clinical_goals    TEXT,
                      consent_given     BOOLEAN NOT NULL DEFAULT FALSE,
                      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_nutr_clinical_member ON nutrition_client_clinical(member_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nutrition_protocol (
                      id                      SERIAL PRIMARY KEY,
                      org_id                  INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      created_by              INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      name                    TEXT NOT NULL,
                      condition               TEXT NOT NULL,
                      description             TEXT,
                      rules_json              JSONB NOT NULL DEFAULT '{}',
                      system_prompt_injection TEXT,
                      is_active               BOOLEAN NOT NULL DEFAULT TRUE,
                      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_nutr_protocol_org ON nutrition_protocol(org_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nutrition_plan_review (
                      id              SERIAL PRIMARY KEY,
                      batch_plan_id   INTEGER NOT NULL REFERENCES org_member_meal_plan(id) ON DELETE CASCADE,
                      reviewed_by     INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      review_notes    TEXT,
                      override_json   JSONB,
                      status          TEXT NOT NULL DEFAULT 'pending'
                                        CHECK (status IN ('pending','approved','rejected','override')),
                      reviewed_at     TIMESTAMPTZ,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_nutr_review_plan ON nutrition_plan_review(batch_plan_id)")

                cur.execute("""
                    CREATE TABLE IF NOT EXISTS nutrition_consultation (
                      id              SERIAL PRIMARY KEY,
                      org_id          INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
                      member_id       INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
                      nutritionist_id INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
                      session_date    DATE NOT NULL,
                      notes           TEXT,
                      action_items    JSONB NOT NULL DEFAULT '[]',
                      next_session    DATE,
                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_nutr_consult_org    ON nutrition_consultation(org_id)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_nutr_consult_member ON nutrition_consultation(member_id)")

                conn.commit()
                logger.info("Ensured nutrition-specific tables (clinical, protocol, plan_review, consultation)")
    except Exception:
        logger.exception("Failed to create nutrition-specific tables (continuing)")
