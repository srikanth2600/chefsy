# Chef Module — Architecture & Development Reference

> **Last Updated:** March 2026
> **Status:** Backend fully implemented. Frontend dashboard wired to real API. Find-chef page still uses mock data.

---

## 1. Chef Module Purpose

The Chef module enables culinary professionals to create rich public profiles, manage their recipes, track analytics, and be discovered by users. It is a core monetised feature of Gharka Chef.

### User Entry Points

| URL | Purpose |
|-----|---------|
| `/find-chef` | Public discovery — browse/search chef list, top videos |
| `/chef/[slug]` | Individual public profile page (future: `slug.chefsy.ai` subdomain via wildcard SSL) |
| `/chef-dashboard` | Chef's own management studio — dashboard, recipes, analytics, profile editor |
| `/adminpanel/chefs` | Admin panel — manage, verify, feature, activate/deactivate chef profiles |

---

## 2. Database Schema

### `chef_profile` (core table)

```sql
CREATE TABLE IF NOT EXISTS chef_profile (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL UNIQUE,          -- e.g. "srikanth-chef"
  designation       TEXT,                           -- e.g. "Executive Chef"
  cuisine_speciality TEXT,
  cuisine_tags      JSONB NOT NULL DEFAULT '[]',   -- ["Indian","Continental"]
  experience_years  INTEGER,
  location          TEXT,
  bio               TEXT,
  certifications    JSONB NOT NULL DEFAULT '[]',   -- ["Le Cordon Bleu","FSSAI"]
  avatar_color      TEXT NOT NULL DEFAULT '#DA7756',
  avatar_url        TEXT,                           -- /media/chefs/<filename>
  banner_url        TEXT,                           -- /media/chefs/<filename>
  youtube_url       TEXT,
  instagram_url     TEXT,
  website_url       TEXT,
  appearance_theme  JSONB,                          -- { banner_color, accent_color, font }
  gender            TEXT,
  -- Address fields
  address_line1     TEXT,
  address_line2     TEXT,
  street            TEXT,
  city              TEXT,
  county            TEXT,
  postcode          TEXT,
  latitude          NUMERIC,
  longitude         NUMERIC,
  -- Plan & status
  plan              TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Stats (denormalised for performance)
  rating            NUMERIC(3,2),
  review_count      INTEGER NOT NULL DEFAULT 0,
  follower_count    INTEGER NOT NULL DEFAULT 0,
  profile_views     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `chef_follower`
```sql
CREATE TABLE IF NOT EXISTS chef_follower (
  id           SERIAL PRIMARY KEY,
  chef_id      INTEGER NOT NULL REFERENCES chef_profile(id) ON DELETE CASCADE,
  follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chef_id, follower_id)
);
```

### `chef_review`
```sql
CREATE TABLE IF NOT EXISTS chef_review (
  id         SERIAL PRIMARY KEY,
  chef_id    INTEGER NOT NULL REFERENCES chef_profile(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chef_id, user_id)     -- one review per user per chef
);
```

### `chef_role` & `chef_profile_role`
```sql
-- Roles catalogue (e.g. "Executive Chef", "Pastry Chef")
CREATE TABLE IF NOT EXISTS chef_role (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many: chef ↔ roles
CREATE TABLE IF NOT EXISTS chef_profile_role (
  chef_id INTEGER NOT NULL REFERENCES chef_profile(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES chef_role(id) ON DELETE CASCADE,
  PRIMARY KEY (chef_id, role_id)
);
```

### `recipe_category` & `recipe_category_map`
```sql
-- Hierarchical recipe categories (parent_id = NULL for top-level)
CREATE TABLE IF NOT EXISTS recipe_category (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES recipe_category(id) ON DELETE SET NULL,
  level     INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Many-to-many: recipe ↔ categories
CREATE TABLE IF NOT EXISTS recipe_category_map (
  recipe_id   INTEGER NOT NULL REFERENCES recipe_master(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES recipe_category(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, category_id)
);
```

### FK Migration on `recipe_master`
```sql
-- Added in run_startup_migrations():
ALTER TABLE recipe_master
  ADD COLUMN IF NOT EXISTS chef_id INTEGER REFERENCES chef_profile(id) ON DELETE SET NULL;
```

---

## 3. Backend Module Structure

```
backend/app/chef/
├── __init__.py          → empty
├── schema.py            → Pydantic models (all request/response shapes)
├── repository.py        → Raw SQL queries (no ORM)
├── service.py           → Business logic layer
└── router.py            → FastAPI APIRouter — ALL chef endpoints
```

### Plan Limits (service.py)

| Plan | Recipes | Videos |
|------|---------|--------|
| free | 3       | 1      |
| pro  | 10      | 5      |

---

## 4. API Endpoints (all under `/chefs` prefix)

### Public — no auth required

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/chefs` | List/search chefs (`q`, `featured`, `location`, `cuisine`, `page`, `per_page`) |
| `GET` | `/chefs/roles` | All chef roles catalogue |
| `GET` | `/chefs/categories` | All recipe categories (flat) |
| `GET` | `/chefs/categories/tree` | Hierarchical category tree |
| `GET` | `/chefs/{slug}` | Public chef profile (also used for slug availability check: 404 = available) |
| `GET` | `/chefs/{slug}/recipes` | Chef's public recipes |
| `GET` | `/chefs/{slug}/reviews` | Chef's reviews |
| `GET` | `/chefs/{slug}/roles` | Chef's assigned roles |

### Authenticated — user required

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/chefs/{slug}/follow` | Follow/unfollow toggle |
| `POST` | `/chefs/{slug}/reviews` | Post review (rating 1–5 + optional comment) |

### Chef Own Dashboard — chef auth required

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/chefs/me/profile` | Own full profile |
| `PUT` | `/chefs/me/profile` | Update profile fields (partial update) |
| `POST` | `/chefs/me/avatar` | Upload avatar image (max 2 MB, crops to 400×400) |
| `POST` | `/chefs/me/banner` | Upload banner image (max 5 MB, crops to 1200×400) |
| `GET` | `/chefs/me/analytics` | View/like/recipe stats |
| `GET` | `/chefs/me/recipes` | Own recipe list with stats |
| `GET` | `/chefs/me/plan-usage` | Recipe & video slot usage vs plan limits |
| `GET` | `/chefs/me/roles` | Own assigned roles |
| `POST` | `/chefs/me/roles` | Assign/replace roles (`{ role_ids: [1,2,3] }`) |

### Recipe Categories (admin/chef)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/chefs/recipes/{recipe_id}/categories` | Categories for a recipe |
| `POST` | `/chefs/recipes/{recipe_id}/categories` | Set categories for a recipe |

### Admin (require admin token)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/chefs/roles` | Create role |
| `PUT` | `/chefs/roles/{role_id}` | Update role |
| `DELETE` | `/chefs/roles/{role_id}` | Delete role |
| `POST` | `/chefs/categories` | Create category |
| `PUT` | `/chefs/categories/{category_id}` | Update category |
| `DELETE` | `/chefs/categories/{category_id}` | Delete category |

> **Admin chef management** (verify/feature/activate/delete) lives in `backend/app/api/admin.py` under `/admin/chefs/*`

---

## 5. Critical Route Ordering Rule

**FastAPI matches routes top-to-bottom.** The `/me/profile` and other `/me/` routes MUST be defined BEFORE `/{slug}` in `router.py`, or FastAPI will match `"me"` as the slug parameter and return 404.

```
CORRECT ORDER in router.py:
1. /roles, /categories (static prefixes)
2. /me/profile, /me/avatar, /me/banner, /me/analytics, /me/recipes, /me/plan-usage, /me/roles
3. /recipes/{recipe_id}/categories (static prefix)
4. GET "" (list)
5. /{slug}/recipes, /{slug}/reviews, /{slug}/follow, /{slug}/reviews, /{slug}/roles
6. GET /{slug}  ← MUST BE LAST
```

---

## 6. Registration Flow

When a user registers with `user_type = "Chef"`:

1. `POST /auth/register` creates a `users` row with `user_type = 'Chef'`
2. If `chef_slug` field is provided in the request body, `auth.py` calls `chef_service.create_profile(user_id, chef_slug)` automatically
3. This inserts the `chef_profile` row with the slug

> **Important:** If `chef_profile` row doesn't exist, ALL `/chefs/me/` endpoints return 404. This can happen if the user registered before the chef module existed or via a path that didn't provide a slug.

**Manual DB fix when chef_profile row is missing:**
```python
import json
cur.execute("UPDATE users SET user_type = 'Chef' WHERE email = 'user@example.com'")
cur.execute("""
    INSERT INTO chef_profile (user_id, slug, designation, cuisine_tags, certifications)
    VALUES (%s, %s, %s, %s, %s)
""", (user_id, 'desired-slug', 'Chef', json.dumps([]), json.dumps([])))
```

---

## 7. Frontend Dashboard Pages

All under `frontend/src/app/chef-dashboard/`:

| File | Purpose | API Used |
|------|---------|---------|
| `layout.tsx` | Sidebar shell — nav, logout, theme toggle | `GET /chefs/me/profile` (for name/plan) |
| `page.tsx` | Dashboard home — stats, recent recipes, plan usage | `GET /chefs/me/profile`, `/me/recipes`, `/me/plan-usage` |
| `profile/page.tsx` | Full profile editor | `GET /chefs/me/profile`, `PUT /chefs/me/profile`, `POST /me/avatar`, `POST /me/banner`, `GET /chefs/me/roles`, `POST /chefs/me/roles`, `GET /chefs/roles`, `GET /chefs/categories` |
| `recipes/page.tsx` | Recipe list + create/edit form | `GET /chefs/me/recipes` |
| `analytics/page.tsx` | Analytics view (Pro only) | `GET /chefs/me/analytics` |

### Dashboard Sidebar Nav Items

```
🏠 Dashboard    → /chef-dashboard
🍳 My Recipes   → /chef-dashboard/recipes
🤖 AI Recipe    → / (home page)
📊 Analytics    → /chef-dashboard/analytics  (PRO lock)
✏️ Edit Profile → /chef-dashboard/profile
👁 Public Page  → /chef/{slug} (opens new tab, shown when slug exists)
```

Bottom of sidebar: `✦ Upgrade to Pro` CTA (free plan only), `🚪 Log Out` button, `🌙 Toggle theme`.

---

## 8. Profile Editor Sections

`chef-dashboard/profile/page.tsx` has 6 collapsible sections:

1. **Account Information** — name (from users.full_name), email, phone, slug (read-only), gender
2. **Professional Details** — designation, experience years, cuisine speciality (textarea), bio
3. **Roles & Categories** — `MultiDropdown` for chef roles, `MultiDropdown` for recipe categories
4. **Social Links** — YouTube, Instagram, website URLs + embedded YouTube preview
5. **Certifications & Awards** — `TagList` component: add-by-typing + individual delete pills
6. **Profile Appearance** — banner colour picker, accent colour picker, font style selector

### Key UI Components (profile page)

**`CropModal`** — Image crop popup used for avatar and banner:
- Drag to pan image within viewport
- Zoom slider
- Outputs: avatar → 400×400 JPEG, banner → 1200×400 JPEG
- Uses HTML5 Canvas `drawImage()` at pixel coordinates

**`TagList`** — Certifications/awards input:
- Shows existing items as removable pills
- Text input + "Add" button to add new items
- Sends as `string[]` array to API

**`MultiDropdown`** — Roles & Categories picker:
- Searchable dropdown with checkboxes
- Shows selected count + "Clear All"
- Closes on outside click

**`UploadTile`** — Photo/banner upload with crop:
- File input → opens `CropModal`
- On confirm: POSTs cropped Blob to `/chefs/me/avatar` or `/chefs/me/banner`
- Shows existing image or placeholder with upload prompt

---

## 9. Media Storage

- Uploaded images stored in `backend/media/chefs/`
- Filename pattern: `chef_avatar_{chef_id}_{uuid8}.jpg` / `chef_banner_{chef_id}_{uuid8}.jpg`
- Served at `/media/chefs/<filename>` via FastAPI static files
- Size limits: avatar 2 MB, banner 5 MB

---

## 10. Known Pending Items

| Item | Status | Notes |
|------|--------|-------|
| `find-chef` page (`/find-chef`) | ⚠️ Mock data | Needs wiring to `GET /chefs` |
| `/chef/[slug]` public page | ⚠️ Mock data | Needs wiring to `GET /chefs/{slug}` |
| YouTube Videos management page | ❌ Not built | Planned as `/chef-dashboard/videos` with "Video" nav item |
| Chef profile subdomain | ❌ Not built | Future: `slug.chefsy.ai` via wildcard SSL |
| Admin chef panel wiring | ⚠️ Partial | Frontend exists in `/adminpanel/chefs`, needs `/admin/chefs` backend verification |
| Registration `chef_slug` field | ✅ Done | `auth.py` auto-creates chef_profile on Chef registration |
| Messaging (chef ↔ user) | ❌ Not started | Phase 2 feature |

---

## 11. Chef Module Test Account

| Field | Value |
|-------|-------|
| Email | `srikanthrao16@gmail.com` |
| Name | `srikanth` |
| user_id | `1` |
| chef_profile.id | `1` |
| slug | `srikanthrao16` |
| user_type | `Chef` |
| plan | `free` |
| Public profile URL | `/chef/srikanthrao16` |

> Token expires per session — user must log in at `/` to get a fresh token before testing dashboard.
