# Meal Plan Module — Implementation Status

> Last updated: 2026-03-23
> Reference plan: `C:\Users\Sam\.claude\plans\nifty-sauteeing-unicorn.md`

---

## ✅ Phase 1 — Database Schema (COMPLETE)

- [x] `meal_plan` table with SERIAL PK, user_id FK, name, description, week_start_date, servings, preferences_json (JSONB), status CHECK, timestamps
- [x] `meal_plan_slot` table with day_index (0–6), meal_type CHECK, recipe_id FK (nullable), meal_name, meal_json (JSONB), sort_order, UNIQUE(meal_plan_id, day_index, meal_type)
- [x] All indexes: idx_meal_plan_user_id, idx_meal_plan_status, idx_meal_plan_week_start, idx_meal_plan_slot_plan_id, idx_meal_plan_slot_recipe
- [x] `chat_content_block` CHECK constraint migrated to include `'meal_plan'`
- [x] `meal_plan_option` table seeded with dietary/allergy/cuisine options
- [x] All migrations wired into `run_startup_migrations()` in `backend/app/core/db.py`

---

## ✅ Phase 2 — Backend Module (COMPLETE)

**Files created:** `backend/app/meal_plan/__init__.py`, `schema.py`, `repository.py`, `service.py`, `router.py`

### API Endpoints — all implemented

| Method | Path | Status |
|--------|------|--------|
| GET | `/meal-plans/usage` | ✅ Returns daily/monthly usage vs limits |
| GET | `/meal-plans/options` | ✅ Returns dietary/allergy/cuisine options |
| GET | `/meal-plans` | ✅ Paginated list with status filter |
| POST | `/meal-plans` | ✅ Create blank plan (Premium gate) |
| POST | `/meal-plans/generate` | ✅ AI-generate 7-day plan (Premium gate) |
| GET | `/meal-plans/{id}` | ✅ Detail + slots + daily_summary + shopping_list |
| PUT | `/meal-plans/{id}` | ✅ Update name/description |
| DELETE | `/meal-plans/{id}` | ✅ Delete plan |
| PUT | `/meal-plans/{id}/slots/{slot_id}` | ✅ Swap one slot |
| POST | `/meal-plans/{id}/regenerate` | ✅ Re-run AI for plan |

### AI Generation Service
- [x] LLM prompt with structured JSON output (7 days × meal_types)
- [x] `extra_context` field — user's freetext prompt appended to LLM user message
- [x] `body_lifestyle` field — weight, height, DOB, gender, activity level, goal injected into LLM system prompt for calorie calibration
- [x] `lookup_recipe_by_query()` — matches LLM recipe_key hints to `recipe_master` rows
- [x] Shopping list computed server-side (deduplicated ingredients union)
- [x] Daily calorie summary computed per day_index
- [x] `_extract_json()` strips markdown fences from LLM response

### Premium Gate
- [x] Checks `users.user_type` (Developer/Admin bypass)
- [x] Checks `chef_profile.plan` via `get_user_plan()` + `has_feature_access()`
- [x] 403 response with `upgrade_url` and `feature` fields

### Router registered in `backend/app/main.py`
```python
app.include_router(meal_plan_module.router, prefix="/meal-plans")
```

---

## ✅ Phase 3 — Frontend Pages (COMPLETE)

### `/meal-plans` — List Page (`frontend/src/app/meal-plans/page.tsx`)
- [x] Plan cards: name, week start, slot count, dietary chips, View / Delete actions
- [x] Usage bar (today used / daily limit)
- [x] "Generate New Plan" button with Premium gate check
- [x] Empty state with CTA
- [x] **Search box** with freetext prompt textarea
- [x] **Body & Lifestyle icon button** — opens popup with weight, height, DOB, gender, activity level, goal fields; data persisted in `localStorage('meal_body_data')`
- [x] **Preferences modal** — dietary, allergies, cuisine, servings, plan name
- [x] **Two-step flow**: "Set in Search →" stores prefs as pendingForm + writes chip to textarea; "Generate Now" generates immediately
- [x] **Multi-week notice** — detects 2-week/fortnight/bi-weekly regex in prompt, shows dismissable yellow banner, still generates 1-week plan
- [x] Plan name is independent of prompt text (not auto-filled from search)
- [x] `body_lifestyle` and `extra_context` sent to backend on generate

### `/meal-plans/[id]` — Detail Page (`frontend/src/app/meal-plans/[id]/page.tsx`)
- [x] **Print-ready grid**: rows = meal types (Breakfast/Lunch/Dinner), columns = Mon–Sun
- [x] `id="mp-printable"` + `visibility: hidden` print CSS — only plan table prints, sidebar/nav hidden
- [x] `@page { size: A4 landscape }` for correct paper orientation
- [x] kcal + View + Swap **on one row** in each cell (space-efficient)
- [x] Print-only: ingredients list per cell, shopping list in 4-column grid
- [x] Per-row color tinting: breakfast=amber, lunch=blue, dinner=purple
- [x] Daily total calories in table footer row
- [x] Weekly kcal stats in header: Avg kcal/day · total kcal/week · servings
- [x] **Recipe popup** — ingredients, steps, notes (fetches full recipe from DB if recipe_key linked)
- [x] **"Ask AI Chef for full recipe →"** link — navigates to `/?q={meal name}`, home page reads `?q=` param via `useEffect` + `URLSearchParams` and pre-fills chat input
- [x] **Swap modal** — freetext replace, PUT slot endpoint
- [x] **Regenerate** button with confirmation
- [x] **ICS calendar download** — generates .ics events with meal times
- [x] **🖨️ Print** button
- [x] **🛒 Shopping** expandable list
- [x] Base64url encoded plan IDs (`chefsy:{id}` → btoa → URL-safe)

### `MealPlanContext.tsx` (`frontend/src/context/MealPlanContext.tsx`)
- [x] Provides: plans, currentPlan, loadPlans(), loadPlan(id), deletePlan(id), generatePlan(prefs), swapSlot(), loading/error states

---

## ✅ Phase 4 — Chat Block Integration (COMPLETE)

- [x] `ALLOWED_BLOCK_TYPES` in `chat_block_service.py` includes `'meal_plan'`
- [x] `chat_content_block` CHECK constraint migrated
- [x] `MealPlanBlock.tsx` created (`frontend/src/components/chat-blocks/MealPlanBlock.tsx`)
- [x] `ChatBlockRenderer.tsx` updated — imports `MealPlanBlock`, handles `case 'meal_plan'`
- [x] `ChatBlock` type union extended to include `'meal_plan'` in `app/page.tsx`

### ✅ Chat Intent Detection (COMPLETE)
**File:** `backend/app/api/routes.py`

Implemented as a pre-LLM intercept in `_chat_impl`:
- `_MEAL_PLAN_INTENT_RE` — compiled regex matching "meal plan", "weekly plan", "7-day plan", "generate a meal plan", "diet plan", etc.
- `_is_meal_plan_intent(message)` — returns True if user message matches
- `_handle_meal_plan_intent(chat_id, user_id, message)` — checks premium, calls `meal_plan.service.generate_meal_plan()`, adds text + `meal_plan` block to chat, returns response
- Non-premium users get an upgrade CTA block instead of the plan
- Plan ID is base64-encoded (`btoa('chefsy:{id}')`) so `MealPlanBlock.tsx` navigates correctly

---

## ✅ Phase 5 — Admin Panel (COMPLETE)

### Admin Backend (`backend/app/api/admin.py`)
- [x] `GET /admin/meal-plans` — paginated list with user search, status filter
- [x] `GET /admin/meal-plans/{id}` — detail with slots + recipe titles
- [x] `DELETE /admin/meal-plans/{id}` — hard delete
- [x] `GET /admin/meal-plan-options` — list options
- [x] All routes protected with `_ensure_admin()`

### Admin Frontend (`frontend/src/app/adminpanel/meal-plans/page.tsx`)
- [x] Table: Plan ID, User, Name, Week Start, Slots, Created, Status, Actions
- [x] Filters: user search, status, date range
- [x] Stats row: total plans this week, total AI-generated

---

## 🔴 Remaining / Pending Tasks

### P1 — High Priority

| # | Task | File(s) | Notes |
|---|------|---------|-------|
| 1 | ~~Chat intent detection for meal plan~~ | `routes.py` | ✅ DONE — `_is_meal_plan_intent` regex + `_handle_meal_plan_intent` intercept in `_chat_impl` |
| 2 | ~~Redis rate limit on /generate~~ | `router.py` | ✅ DONE — 30s `setex` on `meal_plan:generate:{user_id}` before generation; 429 if key exists |

### P2 — Medium Priority

| # | Task | File(s) | Notes |
|---|------|---------|-------|
| 3 | **week_start_date in Generate form** | `page.tsx` (list) | UI currently doesn't let user pick the week start date; backend supports it |
| 4 | **Meal type toggle in Generate form** | `page.tsx` (list) | User can't choose Breakfast only / skip lunch etc. from UI (backend supports `meal_types` array) |
| 5 | **Swap with recipe search** | `[id]/page.tsx` | Swap modal is freetext only; could show recipe search results from `/recipes/search` |
| 6 | **Archive / restore plan** | `[id]/page.tsx` | Backend supports `status='archived'` but no UI button |

### P3 — Nice to Have

| # | Task | File(s) | Notes |
|---|------|---------|-------|
| 7 | **Nutrition breakdown per day** | `[id]/page.tsx` | Macro split (protein/carbs/fat) if available in meal_json |
| 8 | **Share meal plan** | `[id]/page.tsx` | Public share link (read-only view without auth) |
| 9 | **Duplicate plan** | `page.tsx` (list) | Clone an existing plan as starting point |
| 10 | **Admin: meal-plan-options CRUD** | `adminpanel/` | Manage dietary/allergy/cuisine options from admin UI |

---

## UX Improvements Done (Post-Plan)

| Feature | Session |
|---------|---------|
| Body & Lifestyle icon + popup in search bar | Session 1 |
| Two-step modal flow (Set in Search → / Generate Now) | Session 1 |
| Remove extra hamburger toggle from header | Session 1 |
| Print-ready rows × columns grid with `visibility` trick | Session 2 |
| Plan name independent from prompt text (bug fix) | Session 2 |
| Body & Lifestyle data sent to LLM | Session 1 |
| Multi-week plan notice banner | Session 2 |
| kcal + View + Swap on one line | Session 3 |
| Print only plan area (not full page) | Session 3 |
| "Ask AI Chef" link pre-fills chat input via `?q=` param | Session 3 |

---

## Key File Locations

```
backend/app/meal_plan/
  __init__.py         exports router
  schema.py           Pydantic models (MealPlanGenerateRequest includes extra_context + body_lifestyle)
  repository.py       Raw SQL CRUD (create_meal_plan, bulk_insert_slots, get_slots_for_plan, etc.)
  service.py          AI generation (_generate_slots), shopping list, daily summary
  router.py           FastAPI routes + auth helpers + /usage + /options

frontend/src/
  app/meal-plans/page.tsx          List page (generate modal, body modal, two-step flow)
  app/meal-plans/[id]/page.tsx     Detail page (grid, print, ICS, recipe popup, swap)
  app/adminpanel/meal-plans/page.tsx  Admin table
  context/MealPlanContext.tsx      React context
  components/chat-blocks/MealPlanBlock.tsx   Chat block renderer
```

---

## Testing Checklist

- [ ] Unauthenticated `GET /meal-plans` → 401
- [ ] Free user `POST /meal-plans/generate` → 403 with upgrade_url
- [ ] Premium user generate → 21 slots (7 days × 3 meal types)
- [ ] Some slots have `recipe_id` populated (lookup matched DB recipe)
- [ ] `GET /meal-plans/{id}` includes `shopping_list` and `daily_summary`
- [ ] Slot swap `PUT` reflects in next GET
- [ ] Body & Lifestyle data appears in LLM calorie output (higher protein for muscle goal)
- [ ] Multi-week prompt shows yellow notice banner
- [ ] Print opens only the plan grid (not sidebar/nav)
- [ ] ICS download opens in calendar app
- [ ] "Ask AI Chef" link lands on home page with recipe pre-filled in chat input
- [ ] Admin `GET /admin/meal-plans` returns all users' plans; non-admin → 403
