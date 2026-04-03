# Chefsy B2B — Multi-Organisation Platform Architecture

> **Version:** 2.0 — Full multi-org-type redesign
> **Last Updated:** March 2026
> **Status:** Architecture Design — Approved for implementation
> **Author:** Senior Architecture Review

---

## 1. Design Philosophy

### The Core Problem
Different organisation types (Corporate, Gym, Nutrition, Others) share ~60% of functionality but diverge significantly in their domain-specific workflows. A naive approach of one giant module with `if org_type == 'Gym':` branches everywhere creates unmaintainable spaghetti.

### The Solution: Shared Core + Type-Specific Extensions

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED PLATFORM CORE                        │
│  Member Management · Group Management · Meal Planning           │
│  Reels/Content · Compliance · Challenges · Notifications        │
│  Analytics Base · Dashboard Shell · Billing · Auth              │
└────────────┬──────────┬──────────────┬────────────┬────────────┘
             │          │              │            │
     ┌───────▼──┐  ┌────▼────┐  ┌─────▼────┐  ┌───▼──────┐
     │CORPORATE │  │  GYM    │  │NUTRITION │  │  OTHERS  │
     │Extension │  │Extension│  │Extension │  │Extension │
     │          │  │         │  │          │  │          │
     │Dept Mgmt │  │Workouts │  │Clinical  │  │Flexible  │
     │HR Report │  │Trainers │  │Protocols │  │Config    │
     │CSV Import│  │Body Comp│  │Health Tip│  │          │
     │GSTIN/Biz │  │Classes  │  │Consultat.│  │          │
     └──────────┘  └─────────┘  └──────────┘  └──────────┘
```

### User Multi-Membership (Critical Design Rule)

A single `users` row can belong to multiple organisations simultaneously:
- Ravi works at **Infosys** (Corporate) — gets a company meal plan
- Ravi trains at **FitZone Gym** (Gym) — gets a workout + nutrition plan
- Ravi sees **Dr. Priya** (Nutrition Practice) — gets a diabetic-specific plan

All three plans arrive under Ravi's account. He has **one login** and sees all his active org memberships in `/my-orgs`.

---

## 2. Organisation Types — Feature Matrix

| Feature / Module | Corporate 🏢 | Gym 🏋️ | Nutrition 🥗 | Chef 👨‍🍳 | Others 🏛️ |
|---|:---:|:---:|:---:|:---:|:---:|
| Member Management | ✅ | ✅ | ✅ | — | ✅ |
| Group / Cohort Mgmt | ✅ | ✅ | ✅ | — | ✅ |
| AI Meal Planning (bulk) | ✅ | ✅ | ✅ | — | ✅ |
| **Manual Meal Planner (templates)** | Optional | ✅ | ✅ | — | Optional |
| Reels / Video Content | ❌ | ✅ | ✅ | ✅ | Optional |
| Compliance / Check-ins | ✅ | ✅ | ✅ | — | Optional |
| Challenges / Gamification | ✅ | ✅ | ✅ | — | Optional |
| Notifications | ✅ | ✅ | ✅ | — | ✅ |
| **Department Management** | ✅ | ❌ | ❌ | — | ❌ |
| **HR Analytics / Cost Reports** | ✅ | ❌ | ❌ | — | ❌ |
| **Bulk CSV Employee Import** | ✅ | ❌ | ❌ | — | ❌ |
| **Workout Plans** | ❌ | ✅ | ❌ | — | ❌ |
| **Trainer Sub-accounts** | ❌ | ✅ | ❌ | — | ❌ |
| **Body Composition Tracking** | ❌ | ✅ | ✅ | — | ❌ |
| **Class / Session Scheduling** | ❌ | ✅ | ✅ | — | ❌ |
| **Clinical Meal Protocols** | ❌ | ❌ | ✅ | — | ❌ |
| **Nutritionist Override (AI plans)** | Add-on | ❌ | ✅ | — | ❌ |
| **Health Tips / Articles** | ❌ | ❌ | ✅ | — | ❌ |
| **Recipe Publishing** | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Public Profile / Discovery** | ❌ | Optional | ✅ | ✅ | ❌ |

---

## 3. Four-Tier Role Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tier 0 — Chefsy Super Admin                                        │
│  /adminpanel — Onboard orgs, manage billing, platform health        │
│  user.is_admin = TRUE                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  Tier 1 — Org Admin                                                 │
│  /org-dashboard — Owns the organisation account                     │
│  Corporate: HR Manager | Gym: Owner/Manager | Nutrition: Clinic Head│
│  users.user_type = 'Corporate'|'Gym'|'Nutrition'|'Others'           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  Tier 2 — Org Staff (Sub-admin)                                     │
│  Gym: Trainer | Nutrition: Individual Nutritionist | Corporate: HR  │
│  org_staff.role = 'trainer'|'nutritionist'|'hr_staff'               │
│  Limited dashboard access scoped to their assigned groups/clients   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  Tier 3 — End User (Member)                                         │
│  /my-orgs — See all org memberships, view plans, log compliance     │
│  Regular users.id, linked via org_member (one row per org)          │
│  Can be member of multiple orgs simultaneously                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Core Shared Tables

#### `org_profile` — Base organisation record

```sql
CREATE TABLE IF NOT EXISTS org_profile (
  id              SERIAL PRIMARY KEY,
  admin_user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  org_type        TEXT NOT NULL,          -- 'Corporate' | 'Gym' | 'Nutrition' | 'Others'
  org_name        TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,   -- e.g. 'fitzone-hyd', 'dr-priya-nutrition'
  tagline         TEXT,
  logo_url        TEXT,                   -- /media/orgs/<filename>
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
  -- Module configuration (which shared modules are active)
  active_modules  JSONB NOT NULL DEFAULT '[]',
    -- e.g. ["meal_planning","reels","compliance","challenges","notifications"]
  -- Org-level dietary rules injected into AI prompts
  org_rules_json  JSONB NOT NULL DEFAULT '{}',
    -- e.g. {"exclude": ["onion","garlic"], "cuisine": "South Indian"}
  -- Plan & status
  plan            TEXT NOT NULL DEFAULT 'starter',  -- 'starter'|'growth'|'enterprise'
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,   -- public listing on /find-org (Nutrition + Gym)
  -- White-label (Enterprise)
  subdomain       TEXT UNIQUE,
  accent_color    TEXT DEFAULT '#3B82F6',
  font_style      TEXT DEFAULT 'default',
  -- Denormalised stats
  member_count    INTEGER NOT NULL DEFAULT 0,
  group_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_profile_admin      ON org_profile(admin_user_id);
CREATE INDEX idx_org_profile_org_type   ON org_profile(org_type);
CREATE INDEX idx_org_profile_slug       ON org_profile(slug);
CREATE INDEX idx_org_profile_city       ON org_profile(city);
```

#### `org_staff` — Sub-admin accounts within an org (Trainers, Nutritionists, HR staff)

```sql
CREATE TABLE IF NOT EXISTS org_staff (
  id          SERIAL PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,       -- 'trainer'|'nutritionist'|'hr_staff'|'manager'
  permissions JSONB NOT NULL DEFAULT '{}',
    -- e.g. {"can_edit_plans": true, "can_view_compliance": true, "assigned_group_ids": [1,2]}
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  invited_at  TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_staff_org    ON org_staff(org_id);
CREATE INDEX idx_org_staff_user   ON org_staff(user_id);
```

#### `org_member` — End users belonging to an org (many-to-many: user ↔ org)

```sql
CREATE TABLE IF NOT EXISTS org_member (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL until registered
  email           TEXT NOT NULL,
  full_name       TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'invited',
    -- 'invited'|'profile_incomplete'|'active'|'inactive'|'suspended'
  invite_token    TEXT UNIQUE,   -- cryptographic UUID for magic-link registration
  invite_sent_at  TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ,
  -- Type-specific membership metadata
  member_meta     JSONB NOT NULL DEFAULT '{}',
    -- Corporate: {"department":"Engineering","designation":"SDE2","emp_id":"EMP001"}
    -- Gym:       {"membership_type":"premium","trainer_id":5}
    -- Nutrition: {"condition":"diabetic","assigned_nutritionist_id":3}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email)
);

CREATE INDEX idx_org_member_org    ON org_member(org_id);
CREATE INDEX idx_org_member_user   ON org_member(user_id);
CREATE INDEX idx_org_member_status ON org_member(status);
```

#### `org_group` — Cohort / group within an org

```sql
CREATE TABLE IF NOT EXISTS org_group (
  id                SERIAL PRIMARY KEY,
  org_id            INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  group_type        TEXT NOT NULL DEFAULT 'general',
    -- Shared: 'general'
    -- Corporate: 'department'|'wellness_cohort'
    -- Gym: 'fitness_class'|'personal_training'|'bootcamp'
    -- Nutrition: 'condition_group'|'weight_management'|'sports_nutrition'
  color             TEXT DEFAULT '#3B82F6',
  icon              TEXT DEFAULT '👥',
  -- Meal plan defaults for this group
  meal_plan_type    TEXT DEFAULT 'general',
    -- 'general'|'weight_loss'|'weight_gain'|'medical'|'performance'
  medical_condition TEXT,   -- if meal_plan_type = 'medical': 'diabetic'|'cardiac'|'gout'
  plan_cadence      TEXT NOT NULL DEFAULT 'weekly',   -- 'weekly'|'fortnightly'|'monthly'
  auto_publish      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Staff assignment
  assigned_staff_id INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
    -- Gym: trainer_id | Nutrition: nutritionist_id
  -- Group-specific org rules (overrides org-level)
  group_rules_json  JSONB NOT NULL DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_group_org  ON org_group(org_id);
CREATE INDEX idx_org_group_type ON org_group(group_type);
```

#### `org_group_member` — Member ↔ Group (many-to-many; member can be in multiple groups)

```sql
CREATE TABLE IF NOT EXISTS org_group_member (
  id         SERIAL PRIMARY KEY,
  group_id   INTEGER NOT NULL REFERENCES org_group(id) ON DELETE CASCADE,
  member_id  INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  added_by   INTEGER REFERENCES users(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, member_id)
);

CREATE INDEX idx_ogm_group  ON org_group_member(group_id);
CREATE INDEX idx_ogm_member ON org_group_member(member_id);
```

---

### 4.2 Shared Module Tables

#### `org_meal_plan_batch` — Bulk plan generation run

```sql
CREATE TABLE IF NOT EXISTS org_meal_plan_batch (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  group_id        INTEGER REFERENCES org_group(id) ON DELETE SET NULL,
  initiated_by    INTEGER REFERENCES users(id),
  batch_name      TEXT,
  status          TEXT NOT NULL DEFAULT 'queued',
    -- 'queued'|'processing'|'partial_complete'|'review_pending'|'approved'|'published'|'failed'
  total_members   INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE,
  reviewed_by     INTEGER REFERENCES org_staff(id),  -- nutritionist/trainer who reviewed
  reviewed_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_org   ON org_meal_plan_batch(org_id);
CREATE INDEX idx_batch_group ON org_meal_plan_batch(group_id);
CREATE INDEX idx_batch_status ON org_meal_plan_batch(status);
```

#### `org_member_meal_plan` — Individual plan within a batch

```sql
CREATE TABLE IF NOT EXISTS org_member_meal_plan (
  id           SERIAL PRIMARY KEY,
  batch_id     INTEGER NOT NULL REFERENCES org_meal_plan_batch(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  meal_plan_id INTEGER REFERENCES meal_plan(id) ON DELETE SET NULL,  -- links existing table
  status       TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'|'generated'|'review_pending'|'approved'|'published'|'failed'
  staff_notes  TEXT,       -- nutritionist / trainer override notes
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, member_id)
);

CREATE INDEX idx_ommp_batch  ON org_member_meal_plan(batch_id);
CREATE INDEX idx_ommp_member ON org_member_meal_plan(member_id);
```

#### `org_content` — Reels / Health Tips / Articles (shared content table for all org types)

```sql
CREATE TABLE IF NOT EXISTS org_content (
  id            SERIAL PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  staff_id      INTEGER REFERENCES org_staff(id) ON DELETE SET NULL,
  content_type  TEXT NOT NULL,
    -- 'reel'|'health_tip'|'article'|'workout_video'|'recipe_demo'
  title         TEXT NOT NULL,
  description   TEXT,
  hashtags      JSONB NOT NULL DEFAULT '[]',
  video_url     TEXT,             -- external embed (YouTube, Instagram)
  video_file    TEXT,             -- /media/org_content/<filename> (uploaded)
  thumbnail     TEXT,
  platform      TEXT,             -- 'youtube'|'instagram'|'direct'|'upload'
  body_text     TEXT,             -- for articles / health tips
  target_group  TEXT,             -- 'all'|specific condition tag
  status        TEXT NOT NULL DEFAULT 'active',   -- 'draft'|'active'|'archived'
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_content_org  ON org_content(org_id);
CREATE INDEX idx_org_content_type ON org_content(content_type);
```

#### `org_compliance_log` — Daily member check-ins

```sql
CREATE TABLE IF NOT EXISTS org_compliance_log (
  id           SERIAL PRIMARY KEY,
  member_id    INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  log_date     DATE NOT NULL,
  -- Meal compliance
  breakfast    TEXT,   -- 'yes'|'partial'|'no'
  lunch        TEXT,
  dinner       TEXT,
  snack        TEXT,
  -- Progress metrics (optional)
  weight_kg    NUMERIC(5,2),
  mood_score   SMALLINT CHECK (mood_score BETWEEN 1 AND 5),
  energy_score SMALLINT CHECK (energy_score BETWEEN 1 AND 5),
  -- Gym-specific
  workout_done BOOLEAN,
  workout_duration_min INTEGER,
  -- Nutrition-specific
  clinical_notes TEXT,   -- optional symptom/reading log (patient sees only; never shown to admin)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, log_date)
);

CREATE INDEX idx_compliance_member ON org_compliance_log(member_id);
CREATE INDEX idx_compliance_date   ON org_compliance_log(log_date);
```

#### `org_challenge` — Health / Fitness challenges

```sql
CREATE TABLE IF NOT EXISTS org_challenge (
  id             SERIAL PRIMARY KEY,
  org_id         INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  group_id       INTEGER REFERENCES org_group(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  challenge_type TEXT,  -- 'no_sugar'|'hydration'|'steps'|'workout_streak'|'weight_loss'|'custom'
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  rules_json     JSONB NOT NULL DEFAULT '{}',
  is_anonymous   BOOLEAN NOT NULL DEFAULT TRUE,
  status         TEXT NOT NULL DEFAULT 'draft',  -- 'draft'|'active'|'completed'
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_challenge_enrollment (
  id           SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES org_challenge(id) ON DELETE CASCADE,
  member_id    INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  progress_pct SMALLINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  show_name    BOOLEAN NOT NULL DEFAULT TRUE,
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, member_id)
);
```

#### `org_notification_log` — Broadcast messages

```sql
CREATE TABLE IF NOT EXISTS org_notification_log (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  sent_by         INTEGER REFERENCES users(id),
  channel         TEXT NOT NULL,   -- 'email'|'in_app'|'push'
  audience_type   TEXT NOT NULL,   -- 'all'|'group'|'member'
  audience_ref_id INTEGER,         -- group_id or member_id when not 'all'
  subject         TEXT,
  body            TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ,     -- NULL = send immediately
  sent_at         TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4.3 Corporate-Specific Tables

```sql
-- Department hierarchy (IT company: Engineering > Backend Team > Pod A)
CREATE TABLE IF NOT EXISTS corporate_department (
  id         SERIAL PRIMARY KEY,
  org_id     INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  parent_id  INTEGER REFERENCES corporate_department(id) ON DELETE CASCADE,
  head_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name, parent_id)
);

-- org_member.member_meta stores {"department_id": X, "emp_id": "...", "designation": "..."}
-- Denormalised for query performance; corporate_department used for org chart + analytics
```

---

### 4.4 Gym-Specific Tables

```sql
-- Workout plan templates created by gym/trainer
CREATE TABLE IF NOT EXISTS gym_workout_plan (
  id           SERIAL PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  created_by   INTEGER REFERENCES org_staff(id),    -- trainer
  name         TEXT NOT NULL,
  goal         TEXT,    -- 'weight_loss'|'muscle_gain'|'endurance'|'flexibility'
  level        TEXT,    -- 'beginner'|'intermediate'|'advanced'
  duration_weeks INTEGER,
  days_per_week  INTEGER,
  plan_json    JSONB NOT NULL DEFAULT '{}',
    -- { "week1": { "monday": [{"exercise":"Squats","sets":3,"reps":12}] } }
  is_template  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member's assigned workout plan
CREATE TABLE IF NOT EXISTS gym_member_workout (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  workout_plan_id INTEGER NOT NULL REFERENCES gym_workout_plan(id) ON DELETE CASCADE,
  trainer_id      INTEGER REFERENCES org_staff(id),
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, workout_plan_id)
);

-- Body composition tracking logs
CREATE TABLE IF NOT EXISTS gym_body_log (
  id            SERIAL PRIMARY KEY,
  member_id     INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  weight_kg     NUMERIC(5,2),
  body_fat_pct  NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,2),
  waist_cm      NUMERIC(5,1),
  chest_cm      NUMERIC(5,1),
  arms_cm       NUMERIC(5,1),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, log_date)
);

-- Class / session scheduling
CREATE TABLE IF NOT EXISTS gym_class (
  id           SERIAL PRIMARY KEY,
  org_id       INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  trainer_id   INTEGER REFERENCES org_staff(id),
  name         TEXT NOT NULL,
  class_type   TEXT,     -- 'yoga'|'zumba'|'hiit'|'spinning'|'strength'|'pilates'
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  capacity     INTEGER,
  location     TEXT,
  status       TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled'|'completed'|'cancelled'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_class_booking (
  id         SERIAL PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES gym_class(id) ON DELETE CASCADE,
  member_id  INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'booked',  -- 'booked'|'attended'|'cancelled'|'no_show'
  booked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, member_id)
);
```

---

### 4.5 Nutrition-Specific Tables

```sql
-- Clinical health data beyond basic body_info (medical detail)
CREATE TABLE IF NOT EXISTS nutrition_client_clinical (
  id               SERIAL PRIMARY KEY,
  member_id        INTEGER NOT NULL UNIQUE REFERENCES org_member(id) ON DELETE CASCADE,
  conditions       JSONB NOT NULL DEFAULT '[]',
    -- ["type2_diabetes","hypertension","hypothyroid","gout"]
  medications      JSONB NOT NULL DEFAULT '[]',
  lab_values_json  JSONB NOT NULL DEFAULT '{}',
    -- {"hba1c": 7.2, "fasting_glucose": 126, "cholesterol": 210, "bp_systolic": 140}
  food_intolerances JSONB NOT NULL DEFAULT '[]',
  lifestyle_notes  TEXT,
  clinical_goals   TEXT,
  consent_given    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Condition-specific meal protocol templates created by nutritionist
CREATE TABLE IF NOT EXISTS nutrition_protocol (
  id            SERIAL PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  created_by    INTEGER REFERENCES org_staff(id),
  name          TEXT NOT NULL,
  condition     TEXT NOT NULL,  -- 'diabetic'|'cardiac'|'gout'|'pcos'|'renal'|'celiac'
  description   TEXT,
  rules_json    JSONB NOT NULL DEFAULT '{}',
    -- {"max_calories": 1800, "carb_pct": 40, "exclude": ["sugar","refined_flour"],
    --  "prefer": ["oats","millets","dal"], "meal_timing": "small_frequent"}
  system_prompt_injection TEXT,   -- extra LLM context appended to meal plan prompts
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clinical review of AI-generated plans (nutritionist override)
CREATE TABLE IF NOT EXISTS nutrition_plan_review (
  id             SERIAL PRIMARY KEY,
  member_plan_id INTEGER NOT NULL REFERENCES org_member_meal_plan(id) ON DELETE CASCADE,
  reviewer_id    INTEGER NOT NULL REFERENCES org_staff(id),
  action         TEXT NOT NULL,   -- 'approved'|'rejected'|'modified'
  clinical_notes TEXT,            -- visible to admin + staff only
  patient_notes  TEXT,            -- visible to patient
  edits_json     JSONB NOT NULL DEFAULT '{}',  -- diff of what was changed
  reviewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consultation bookings (client ↔ nutritionist)
CREATE TABLE IF NOT EXISTS nutrition_consultation (
  id            SERIAL PRIMARY KEY,
  org_id        INTEGER NOT NULL REFERENCES org_profile(id) ON DELETE CASCADE,
  member_id     INTEGER NOT NULL REFERENCES org_member(id) ON DELETE CASCADE,
  nutritionist_id INTEGER NOT NULL REFERENCES org_staff(id),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 45,
  mode          TEXT DEFAULT 'video',   -- 'video'|'in_person'|'phone'
  status        TEXT NOT NULL DEFAULT 'scheduled',
    -- 'scheduled'|'completed'|'cancelled'|'no_show'
  session_notes TEXT,     -- post-session clinical notes (internal)
  follow_up_date DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4.6 Schema Additions to Existing Tables

```sql
-- Run in run_startup_migrations() in main.py:

-- Allow users to belong to orgs (Tier 3 end users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  primary_org_id INTEGER REFERENCES org_profile(id) ON DELETE SET NULL;
-- primary_org_id = most recently active org (for default redirect on login)

-- Auto-create org_profile on registration (like chef_profile auto-creation)
-- Handled in auth.py: if user_type IN ('Corporate','Gym','Nutrition','Others')
--   → call org_service.create_profile(user_id, org_data)
```

---

## 5. Backend Module Structure

```
backend/app/org/
│
├── __init__.py
│
├── schema.py               ← Shared Pydantic schemas
│   # OrgProfileBase, OrgMemberCreate, OrgGroupCreate,
│   # BatchStatusOut, ComplianceLogIn, ChallengeCreate, etc.
│
├── repository.py           ← Shared SQL (member CRUD, group CRUD, compliance, batch)
│
├── service.py              ← Shared business logic
│   # create_profile(), check_module_access(), batch_generate_plans(),
│   # get_compliance_summary(), get_kpi_cards()
│
├── router.py               ← Shared endpoints + module dispatcher
│   # /org/me/*, /org/member/*, /org/invite/*
│
├── modules/                ← Shared feature modules (used by multiple org types)
│   ├── meal_batch.py       # Bulk plan generation: queues jobs, calls meal_plan.service
│   ├── content.py          # Reels, health tips, workout videos
│   ├── compliance.py       # Daily check-in endpoints + aggregate queries
│   ├── challenges.py       # Challenge CRUD + enrollment + leaderboard
│   └── notifications.py    # Broadcast + scheduled messages
│
├── corporate/
│   ├── schema.py           # DepartmentCreate, HRReportOut, etc.
│   ├── repository.py       # Department SQL, HR analytics aggregates
│   ├── service.py          # CSV import parsing, executive PDF report generation
│   └── router.py           # /org/me/corporate/* endpoints
│
├── gym/
│   ├── schema.py           # WorkoutPlanCreate, BodyLogIn, ClassCreate, etc.
│   ├── repository.py       # Workout plan SQL, body log SQL, class booking SQL
│   ├── service.py          # Trainer assignment, class capacity checks
│   └── router.py           # /org/me/gym/* endpoints
│
└── nutrition/
    ├── schema.py           # ClinicalProfileIn, ProtocolCreate, ConsultationCreate
    ├── repository.py       # Clinical data SQL, protocol SQL, consultation SQL
    ├── service.py          # Protocol → LLM injection, plan review workflow
    └── router.py           # /org/me/nutrition/* endpoints
```

Register in `main.py`:
```python
from app.org import router as org_router
from app.org.corporate import router as corp_router
from app.org.gym import router as gym_router
from app.org.nutrition import router as nutrition_router

app.include_router(org_router.router,       prefix="/org",              tags=["org"])
app.include_router(corp_router.router,      prefix="/org/me/corporate", tags=["org-corporate"])
app.include_router(gym_router.router,       prefix="/org/me/gym",       tags=["org-gym"])
app.include_router(nutrition_router.router, prefix="/org/me/nutrition",  tags=["org-nutrition"])
```

---

## 6. Full API Endpoint Map

### 6.1 Public

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/org/directory` | Public org listing (Nutrition + Gym with is_public=true) |
| `GET` | `/org/{slug}` | Public org profile |
| `GET` | `/org/invite/{token}` | Validate magic link, return pre-fill data |

### 6.2 Shared Org Admin (`/org/me/*`)

| Method | Path | Purpose |
|---|---|---|
| `GET/PUT` | `/org/me/profile` | Own org profile |
| `POST` | `/org/me/logo` | Upload logo |
| `GET` | `/org/me/dashboard` | KPI cards (adapts to org_type) |
| `GET/POST` | `/org/me/members` | List members / Add single member |
| `POST` | `/org/me/members/import` | Bulk CSV import (Corporate only gate) |
| `PUT/DELETE` | `/org/me/members/{id}` | Update / deactivate member |
| `POST` | `/org/me/members/{id}/resend-invite` | Resend magic link |
| `GET` | `/org/me/members/{id}/profile` | Member health summary (no meal logs) |
| `GET/POST` | `/org/me/groups` | List / Create group |
| `PUT/DELETE` | `/org/me/groups/{id}` | Update / delete group |
| `GET/POST` | `/org/me/groups/{id}/members` | Group member list / Add to group |
| `DELETE` | `/org/me/groups/{id}/members/{mid}` | Remove from group |
| `POST` | `/org/me/groups/{id}/generate` | Trigger bulk meal plan generation |
| `GET` | `/org/me/batches` | All generation batches |
| `GET` | `/org/me/batches/{id}` | Batch detail + per-member status |
| `POST` | `/org/me/batches/{id}/publish` | Publish approved batch |
| `GET/POST` | `/org/me/staff` | List / Invite staff (trainers/nutritionists) |
| `PUT/DELETE` | `/org/me/staff/{id}` | Update / remove staff |
| `GET` | `/org/me/compliance` | Org aggregate compliance dashboard |
| `GET/POST` | `/org/me/challenges` | List / Create challenge |
| `PUT` | `/org/me/challenges/{id}` | Update challenge |
| `GET` | `/org/me/challenges/{id}/leaderboard` | Anonymised ranking |
| `POST` | `/org/me/notify` | Broadcast message |
| `GET` | `/org/me/content` | List org content (reels, tips, articles) |
| `POST` | `/org/me/content` | Create content item |
| `PUT/DELETE` | `/org/me/content/{id}` | Update / delete content |
| `GET` | `/org/me/reports/weekly` | Weekly PDF report |
| `GET` | `/org/me/reports/monthly` | Monthly summary PDF |

### 6.3 Corporate-Specific (`/org/me/corporate/*`)

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/org/me/corporate/departments` | List / Create departments |
| `PUT/DELETE` | `/org/me/corporate/departments/{id}` | Update / delete |
| `GET` | `/org/me/corporate/analytics` | Cost per meal, ROI, department breakdown |
| `GET` | `/org/me/corporate/reports/executive` | Board-level PDF summary |
| `POST` | `/org/me/corporate/members/import` | CSV upload (returns row-level errors) |
| `GET` | `/org/me/corporate/at-risk` | Employees not logged for 3+ days |

### 6.4 Gym-Specific (`/org/me/gym/*`)

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/org/me/gym/workout-plans` | List / Create workout plan templates |
| `PUT/DELETE` | `/org/me/gym/workout-plans/{id}` | Update / delete |
| `POST` | `/org/me/gym/members/{id}/assign-workout` | Assign plan to member |
| `GET` | `/org/me/gym/members/{id}/body-logs` | Member body composition history |
| `GET/POST` | `/org/me/gym/classes` | List / Schedule a class |
| `PUT/DELETE` | `/org/me/gym/classes/{id}` | Update / cancel class |
| `GET` | `/org/me/gym/classes/{id}/bookings` | Who booked this class |
| `GET` | `/org/me/gym/analytics` | Attendance, workout completion, body progress |

### 6.5 Nutrition-Specific (`/org/me/nutrition/*`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/org/me/nutrition/review-queue` | Pending plans requiring nutritionist review |
| `GET/PUT` | `/org/me/nutrition/review/{plan_id}` | View + edit a member's meal plan |
| `POST` | `/org/me/nutrition/review/{plan_id}/approve` | Approve with optional notes |
| `POST` | `/org/me/nutrition/review/{plan_id}/reject` | Reject + trigger regeneration |
| `GET/POST` | `/org/me/nutrition/protocols` | List / Create condition protocols |
| `PUT/DELETE` | `/org/me/nutrition/protocols/{id}` | Update / delete |
| `GET/PUT` | `/org/me/nutrition/clients/{id}/clinical` | View / update clinical profile |
| `GET/POST` | `/org/me/nutrition/consultations` | List / Book consultation |
| `PUT` | `/org/me/nutrition/consultations/{id}` | Update (add notes, mark complete) |
| `GET` | `/org/me/nutrition/analytics` | Client health outcomes, plan adherence |

### 6.6 Member (End User) — `/org/member/*`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/org/member/memberships` | All orgs this user belongs to |
| `GET` | `/org/member/{org_id}/plan` | My active meal plan from this org |
| `GET` | `/org/member/{org_id}/compliance` | My own compliance history |
| `POST` | `/org/member/{org_id}/compliance` | Log today's meals + optional metrics |
| `GET` | `/org/member/{org_id}/challenges` | Available challenges |
| `POST` | `/org/member/{org_id}/challenges/{id}/enroll` | Enroll in challenge |
| `GET` | `/org/member/{org_id}/content` | Org content (reels, tips, articles) |
| `GET` | `/org/member/{org_id}/workout` | My assigned workout plan (Gym only) |
| `POST` | `/org/member/{org_id}/body-log` | Log body composition (Gym/Nutrition) |
| `GET` | `/org/member/{org_id}/consultations` | My consultation schedule (Nutrition only) |

### 6.7 Super Admin — `/admin/orgs/*`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/orgs` | List all orgs with filters |
| `GET` | `/admin/orgs/{id}` | Org detail + member count |
| `PUT` | `/admin/orgs/{id}` | Verify, activate/deactivate, set plan |
| `DELETE` | `/admin/orgs/{id}` | Remove org |
| `GET` | `/admin/orgs/stats` | Platform-wide B2B metrics |

---

## 7. Frontend Page Architecture

```
frontend/src/app/
│
├── my-orgs/                             ← Member multi-org switcher
│   ├── page.tsx                         # "My Organisations" card grid
│   └── [org_slug]/
│       └── page.tsx                     # Member view for a specific org
│           # Adapts UI to org_type:
│           #   Corporate: my plan + check-in + challenge
│           #   Gym: my plan + workout + class bookings + body log
│           #   Nutrition: my plan + consultations + clinical tips
│
├── org-dashboard/                       ← Org Admin dashboard
│   ├── layout.tsx                       # Sidebar — nav items driven by org_type + active_modules
│   ├── page.tsx                         # Dashboard home (KPI cards adapt to org_type)
│   │
│   ├── members/page.tsx                 # Shared: member table + invite + status
│   ├── groups/
│   │   ├── page.tsx                     # Shared: group list + create
│   │   └── [group_id]/page.tsx          # Group detail + generate plans
│   ├── plans/page.tsx                   # Shared: batch generation history + status
│   ├── content/page.tsx                 # Shared: reels / articles / videos
│   ├── compliance/page.tsx              # Shared: aggregate compliance charts
│   ├── challenges/page.tsx              # Shared: challenge management
│   ├── notifications/page.tsx           # Shared: broadcast + log
│   ├── profile/page.tsx                 # Shared: org profile editor
│   │                                    # (fields adapt: Corporate adds GSTIN, Gym adds gym type)
│   │
│   ├── corporate/                       ← Corporate-ONLY pages
│   │   ├── departments/page.tsx         # Department tree management
│   │   ├── analytics/page.tsx           # HR cost analytics + ROI
│   │   └── reports/page.tsx             # Executive PDF generation
│   │
│   ├── gym/                             ← Gym-ONLY pages
│   │   ├── workouts/page.tsx            # Workout plan templates
│   │   ├── trainers/page.tsx            # Trainer sub-accounts
│   │   ├── classes/page.tsx             # Class scheduling + bookings
│   │   └── body-tracking/page.tsx       # Member body composition overview
│   │
│   └── nutrition/                       ← Nutrition-ONLY pages
│       ├── review-queue/page.tsx        # Meal plan review + inline edit
│       ├── protocols/page.tsx           # Condition-specific protocol builder
│       ├── clients/page.tsx             # Client clinical profiles
│       └── consultations/page.tsx       # Consultation calendar
│
└── org-register/
    └── page.tsx                         # Organisation registration + onboarding wizard
```

### Dynamic Sidebar Navigation

The sidebar `layout.tsx` reads `org_type` and `active_modules` from the profile and builds the nav dynamically:

```typescript
const NAV_CONFIG = {
  shared: [
    { label: 'Dashboard', icon: '🏠', path: '/org-dashboard' },
    { label: 'Members',   icon: '👥', path: '/org-dashboard/members' },
    { label: 'Groups',    icon: '📁', path: '/org-dashboard/groups' },
    { label: 'Meal Plans',icon: '🍱', path: '/org-dashboard/plans',       module: 'meal_planning' },
    { label: 'Content',   icon: '🎬', path: '/org-dashboard/content',     module: 'reels' },
    { label: 'Compliance',icon: '📊', path: '/org-dashboard/compliance',  module: 'compliance' },
    { label: 'Challenges',icon: '🏆', path: '/org-dashboard/challenges',  module: 'challenges' },
    { label: 'Notify',    icon: '📢', path: '/org-dashboard/notifications'},
    { label: 'Profile',   icon: '✏️', path: '/org-dashboard/profile' },
  ],
  Corporate: [
    { label: 'Departments', icon: '🏛️',  path: '/org-dashboard/corporate/departments' },
    { label: 'HR Analytics',icon: '💰', path: '/org-dashboard/corporate/analytics' },
    { label: 'Reports',     icon: '📄', path: '/org-dashboard/corporate/reports' },
  ],
  Gym: [
    { label: 'Workouts',     icon: '🏋️', path: '/org-dashboard/gym/workouts' },
    { label: 'Trainers',     icon: '🧑‍🏫', path: '/org-dashboard/gym/trainers' },
    { label: 'Classes',      icon: '🗓️', path: '/org-dashboard/gym/classes' },
    { label: 'Body Tracking',icon: '📏', path: '/org-dashboard/gym/body-tracking' },
  ],
  Nutrition: [
    { label: 'Review Queue',  icon: '🔍', path: '/org-dashboard/nutrition/review-queue' },
    { label: 'Protocols',     icon: '📋', path: '/org-dashboard/nutrition/protocols' },
    { label: 'Clients',       icon: '🩺', path: '/org-dashboard/nutrition/clients' },
    { label: 'Consultations', icon: '📅', path: '/org-dashboard/nutrition/consultations' },
  ],
};
```

---

## 8. Registration Flow (All Org Types)

```
POST /auth/register  { user_type: 'Gym', org_name: 'FitZone Hyd', org_slug: 'fitzone-hyd', ... }
  1. INSERT users (user_type = 'Gym')
  2. org_service.create_profile(user_id, {org_type: 'Gym', org_name, slug, ...})
       → INSERT org_profile row
       → Set active_modules based on org_type defaults:
           Corporate: ["meal_planning","compliance","challenges","notifications"]
           Gym:       ["meal_planning","reels","compliance","challenges","notifications"]
           Nutrition: ["meal_planning","reels","compliance","notifications"]
           Others:    ["meal_planning","notifications"]
  3. create_access_token(user_id) → (jti, JWT)
  4. INSERT user_token(token = jti)
  5. Return JWT

Member (Tier 3) onboarding via magic link:
  POST /auth/register { invite_token: 'abc123' }
    → Validate invite_token in org_member
    → INSERT users (user_type = 'User')
    → UPDATE org_member SET user_id = new_id, status = 'profile_incomplete'
    → If user already exists (same email registered elsewhere):
         Just UPDATE org_member.user_id = existing_user.id
         → This is how multi-org membership works: user gets new org_member row
    → Return JWT
```

---

## 9. Multi-Org Context on the Frontend

```
On login → GET /org/member/memberships
  Returns: [
    { org_id: 1, org_name: "Infosys Hyderabad", org_type: "Corporate", slug: "infosys-hyd" },
    { org_id: 4, org_name: "FitZone Gym",        org_type: "Gym",       slug: "fitzone-hyd" },
    { org_id: 7, org_name: "Dr. Priya Clinic",   org_type: "Nutrition", slug: "dr-priya" },
  ]

If 0 orgs  → show regular user home (/, existing behaviour unchanged)
If 1 org   → redirect to /my-orgs/{slug}
If 2+ orgs → show /my-orgs card grid to choose which to view
```

Existing users not in any org are completely unaffected — no UI change for them.

---

## 10. Bulk Meal Plan Generation — Architecture

```
POST /org/me/groups/{group_id}/generate
  Service: meal_batch.generate_for_group(group_id)

  1. Fetch group + all active members with user_id + body_info
  2. Build shared org rules context:
       org_rules = org_profile.org_rules_json
       group_rules = org_group.group_rules_json   ← overrides org
       protocol_injection = nutrition_protocol.system_prompt_injection (Nutrition only)
  3. Create org_meal_plan_batch (status = 'processing')
  4. For each member:
       extra_context = merge(org_rules, group_rules, protocol_injection, member_conditions)
       plan = meal_plan_service.generate_meal_plan(
                user_id = member.user_id,
                prefs = { plan_type: group.meal_plan_type, ...member.body_info },
                extra_context = extra_context
              )
       INSERT org_member_meal_plan(batch_id, member_id, meal_plan_id)
  5. batch.status =
       'review_pending'  if org_type='Nutrition' or group.auto_publish=False
       'published'       if group.auto_publish=True
  6. Return { batch_id, total, queued }
```

> **MVP limit:** Synchronous generation, max 25 members per batch.
> **Phase 2:** Move to Redis queue (BullMQ equivalent in Python: `celery` or `rq`).

---

## 11. Privacy Architecture (Non-negotiable)

| Data | Who Can See It |
|---|---|
| Individual meal log rows (`org_compliance_log`) | Member themselves only |
| Clinical notes (`clinical_notes` in compliance_log) | Member + assigned nutritionist only |
| Lab values (`nutrition_client_clinical.lab_values_json`) | Member + assigned nutritionist only |
| Body composition logs | Member + assigned trainer (Gym) |
| Compliance aggregate (% completed this week) | Org admin (aggregate only, no names) |
| At-risk member list (not logged in 3 days) | Org admin (names + dept, no meal content) |
| Member health summary (allergies, goal, condition) | Org admin (read-only, no logging) |

**Hard rule in repository.py:** Admin compliance queries must use `GROUP BY` — never return individual `org_compliance_log` rows to admin endpoints.

---

## 12. Plan Gating per Org Type

Add to `backend/app/core/packages.py`:

```python
ORG_PLAN_LIMITS = {
    "starter": {
        "max_members": 50,
        "max_groups": 3,
        "meal_plan_types": ["general", "weight_loss"],
        "nutritionist_review": False,
        "challenges": False,
        "reels": False,
        "bulk_generate_limit": 25,
    },
    "growth": {
        "max_members": 500,
        "max_groups": None,
        "meal_plan_types": ["general", "weight_loss", "weight_gain", "medical", "performance"],
        "nutritionist_review": True,
        "challenges": True,
        "reels": True,
        "bulk_generate_limit": 100,
    },
    "enterprise": {
        "max_members": None,
        "max_groups": None,
        "meal_plan_types": "__all__",
        "nutritionist_review": True,
        "challenges": True,
        "reels": True,
        "bulk_generate_limit": 500,
        "white_label": True,
        "api_access": True,
    },
}
```

---

## 13. Development Timeline — Phased Build

### Phase 1 — Foundation (Weeks 1–2)
- DB schema: all new tables via `run_startup_migrations()`
- Auth: update `auth.py` to auto-create `org_profile` + set `active_modules`
- Core module: `backend/app/org/` — schema, repository, service, router (shared endpoints only)
- Frontend: `org-register/page.tsx` onboarding wizard, `org-dashboard/layout.tsx` dynamic sidebar
- Admin panel: `/admin/orgs` list + verify + activate

### Phase 2 — Shared Modules (Weeks 3–5)
- Member management (invite, CSV import for Corporate, magic link)
- Group management + meal plan batch generation
- `org-dashboard/members/` + `org-dashboard/groups/` + `org-dashboard/plans/`

### Phase 3 — Corporate Extension (Weeks 6–7)
- Department management, HR analytics, executive reports
- `org-dashboard/corporate/` pages

### Phase 4 — Gym Extension (Weeks 8–9)
- Workout plans, trainer sub-accounts, class scheduling, body composition
- `org-dashboard/gym/` pages

### Phase 5 — Nutrition Extension (Weeks 10–11)
- Clinical profiles, condition protocols, nutritionist review queue, consultations
- `org-dashboard/nutrition/` pages

### Phase 6 — Member Experience (Week 12)
- `/my-orgs/` multi-org switcher
- Per-org member views with daily check-in
- Compliance, challenges, content viewing

### Phase 7 — Polish & Launch (Weeks 13–14)
- PDF report generation, push notifications
- Billing integration (Razorpay)
- White-label subdomain infrastructure
- Beta onboarding of first 3 clients

---

## 14. Files to Create / Modify

| File | Action |
|---|---|
| `backend/app/org/__init__.py` | Create |
| `backend/app/org/schema.py` | Create |
| `backend/app/org/repository.py` | Create |
| `backend/app/org/service.py` | Create |
| `backend/app/org/router.py` | Create |
| `backend/app/org/modules/meal_batch.py` | Create |
| `backend/app/org/modules/content.py` | Create |
| `backend/app/org/modules/compliance.py` | Create |
| `backend/app/org/modules/challenges.py` | Create |
| `backend/app/org/modules/notifications.py` | Create |
| `backend/app/org/corporate/` (schema, repo, service, router) | Create |
| `backend/app/org/gym/` (schema, repo, service, router) | Create |
| `backend/app/org/nutrition/` (schema, repo, service, router) | Create |
| `backend/app/main.py` | Modify: register 4 org routers + DDL |
| `backend/app/api/auth.py` | Modify: auto-create org_profile on register |
| `backend/app/api/admin.py` | Modify: add /admin/orgs/* endpoints |
| `backend/app/core/packages.py` | Modify: add ORG_PLAN_LIMITS |
| `backend/schema.sql` | Modify: add all 14 new org tables |
| `frontend/src/app/org-dashboard/` | Create: all pages |
| `frontend/src/app/my-orgs/` | Create: multi-org switcher |
| `frontend/src/app/org-register/` | Create: onboarding wizard |

---

---

## Phase 8 — Custom Manual Meal Planner (COMPLETE — 2026-03-30)

### New DB Tables (added to `run_startup_migrations()`)

| Table | Purpose |
|---|---|
| `org_template_meal_plan` | Template plans created by org admin/staff. Status: `draft → published → archived` |
| `org_template_meal_plan_slot` | 7-day grid slots (identical structure to `meal_plan_slot`) |
| `org_template_plan_invite` | Tracks per-member invites: `pending → adopted | declined`. Stores `adopted_plan_id` FK to personal `meal_plan` |

Also seeded: `platform_module` row for `org_custom_meal_planner`.

### Module Toggle
- Global: `platform_module.is_active` for `org_custom_meal_planner` (super admin controlled)
- Per-org: `org_profile.active_modules` JSONB includes `"org_custom_meal_planner"` (set by admin via `PATCH /admin/orgs/{id}/modules`)
- Guard: `require_org_module_active(org, 'org_custom_meal_planner')` (new function in `org/modules/__init__.py`)

### New Backend Files
- `backend/app/org/modules/custom_meal_planner.py` — 11 endpoints at `/org/me/custom-meal-planner`
- 3 new routes added to `backend/app/org/member_router.py` (`/my-orgs/{id}/invited-plans`, `/adopt`, `/decline`)
- 1 new endpoint in `backend/app/api/admin.py` (`PATCH /admin/orgs/{id}/modules`)

### New Frontend Files
- `frontend/src/app/adminpanel/orgs/page.tsx` — org list + per-org Custom Meal Planner toggle
- `frontend/src/app/org-dashboard/layout.tsx` — org dashboard shell
- `frontend/src/app/org-dashboard/meal-planner/page.tsx` — template plan list
- `frontend/src/app/org-dashboard/meal-planner/[planId]/page.tsx` — 7-day grid editor + assign side-panel
- `frontend/src/app/my-orgs/[orgId]/invited-plans/page.tsx` — member invite list + adopt/decline flow

### Adoption Flow
1. Org admin creates template plan (draft)
2. Fills 7-day grid manually (type meals or pick from recipe_master)
3. Publishes plan
4. Assigns to members or groups (snapshot at time of assignment)
5. Members see invites in `/my-orgs/{orgId}/invited-plans`
6. Member adopts → `create_meal_plan()` + `bulk_insert_slots()` copies template into personal `meal_plan` table
7. Adopted plan appears in member's `/meal-plans` list

---

## 15. Key Architectural Decisions (Rationale)

| Decision | Alternative Considered | Why This Choice |
|---|---|---|
| Shared `org_profile` base + type-specific extension tables | One table per org type | Extension tables keep shared queries clean; avoids wide table with 80% NULLs |
| `org_member.member_meta JSONB` for type-specific member fields | Separate `corporate_member`, `gym_member` tables | Type-specific fields are small; JSONB avoids a JOIN on every member list query |
| `org_content` single table with `content_type` discriminator | Separate `org_reels`, `org_health_tips`, `gym_workout_videos` | All content types share the same media handling pipeline; easy to add types |
| `active_modules JSONB` array on org_profile | Hard-coded `if org_type == 'Gym'` checks everywhere | Module activation is a data-driven config — easy to grant/revoke per org without code change |
| Multi-membership via `org_member` (one row per org per user) | `users.org_id` FK (single org) | Business requirement: one user at gym + corporate + nutritionist simultaneously |
| Sync generation in Phase 1, async in Phase 2 | Async from day 1 | Reduces Phase 1 complexity; sync is acceptable for ≤25 members; migrate when needed |
