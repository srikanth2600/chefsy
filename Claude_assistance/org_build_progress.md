# Org Module — Build Progress Tracker

> **Last Updated:** 2026-03-26
> **Design Reference:** `org_module_scope.md` (22 DB tables, ~27 module files, ~85 endpoints)

---

## Overall Status

| Phase | Description | Status |
|---|---|---|
| **Admin Enforcement** | Block/unblock orgs, audit log, mandatory reason | ✅ COMPLETE |
| **Phase 1** | Fix service stubs + untyped body params in router | ✅ COMPLETE |
| **Phase 2** | Add 15+ missing shared DB tables | ✅ COMPLETE |
| **Phase 3** | Shared module files (meal_batch, compliance, content, challenges, notifications) | ✅ COMPLETE |
| **Phase 4** | Corporate full CRUD | ✅ COMPLETE |
| **Phase 5** | Gym full CRUD | ✅ COMPLETE |
| **Phase 6** | Nutrition full CRUD | ✅ COMPLETE |
| **Phase 7** | Member portal (`member_router.py`) | ✅ COMPLETE |
| **SKILL.md** | Add ORG module test IDs + fix API_URL localhost path | ✅ COMPLETE |

---

## What's Built

### DB Tables (`backend/app/core/db.py`)

#### Core (pre-existing)
- [x] `org_profile`
- [x] `org_staff`
- [x] `org_member`
- [x] `org_group`
- [x] `org_group_member`
- [x] `platform_module`
- [x] `org_admin_action`
- [x] `org_profile.suspension_reason/suspended_at/suspended_by` columns

#### Shared Module Tables (Phase 2)
- [x] `org_meal_plan_batch`
- [x] `org_member_meal_plan`
- [x] `org_content`
- [x] `org_compliance_log`
- [x] `org_challenge`
- [x] `org_challenge_enrollment`
- [x] `org_notification_log`

#### Corporate (Phase 2)
- [x] `corporate_department`

#### Gym (Phase 2)
- [x] `gym_workout_plan`
- [x] `gym_member_workout`
- [x] `gym_body_log`
- [x] `gym_class`
- [x] `gym_class_booking`

#### Nutrition (Phase 2)
- [x] `nutrition_client_clinical`
- [x] `nutrition_protocol`
- [x] `nutrition_plan_review`
- [x] `nutrition_consultation`

#### Users
- [x] `users.primary_org_id` column

---

### Module Files (`backend/app/org/`)

#### Core (pre-existing + Phase 1 fixes)
- [x] `__init__.py`
- [x] `schema.py`
- [x] `repository.py` — added `delete_group`, `get_staff_by_id`, `remove_staff`, `get_user_by_email`
- [x] `service.py` — added `invite_staff`, `update_staff`, `remove_staff`, `get_member_profile`, `delete_group`
- [x] `router.py` — fixed untyped body params on staff routes
- [x] `modules/__init__.py` — `require_module_active()` guard

#### Phase 3 — Shared Modules (all registered in `main.py`)
- [x] `modules/meal_batch.py` → `/org/me/meal-batches`
- [x] `modules/compliance.py` → `/org/me/compliance`
- [x] `modules/content.py` → `/org/me/content`
- [x] `modules/challenges.py` → `/org/me/challenges`
- [x] `modules/notifications.py` → `/org/me/notifications`

#### Phase 4 — Corporate
- [x] `corporate/router.py` — full CRUD

#### Phase 5 — Gym
- [x] `gym/router.py` — full CRUD (column names match DB schema)

#### Phase 6 — Nutrition
- [x] `nutrition/router.py` — full CRUD

#### Phase 7 — Member Portal
- [x] `member_router.py` → `/org/member`

---

## Implemented Endpoints (85+)

### Admin Panel (`/admin/orgs`)
- `GET /admin/orgs` — list all orgs
- `GET /admin/orgs/:id` — get org
- `PATCH /admin/orgs/:id` — update (verified, plan, active)
- `POST /admin/orgs/:id/block` — suspend with reason
- `POST /admin/orgs/:id/unblock`
- `GET /admin/orgs/:id/actions` — audit trail

### Shared Org Core (`/org`)
- `POST /org/register`
- `GET/PATCH /org/me`
- `GET/POST /org/me/staff`, `PATCH/DELETE /org/me/staff/:id`
- `POST /org/me/members/invite`, `POST /org/me/members/bulk-invite`
- `GET/PATCH/DELETE /org/me/members`, `GET /org/me/members/:id`
- `POST/GET /org/me/groups`, `PATCH/DELETE /org/me/groups/:id`
- `GET/POST/DELETE /org/me/groups/:id/members/:id`
- `GET /org/me/memberships`
- `POST /org/accept-invite/:token`
- `GET /org/:slug`

### Shared Modules
- `POST/GET /org/me/meal-batches`, `GET/PATCH /org/me/meal-batches/:id`, `GET /:id/plans`
- `POST/GET /org/me/compliance` (member self-service)
- `POST/GET /org/me/content`, `GET/PATCH/DELETE /org/me/content/:id`
- `POST/GET /org/me/challenges`, `GET/PATCH/DELETE /org/me/challenges/:id`
- `POST /org/me/challenges/:id/enroll`, `PATCH /:id/progress`, `GET /:id/leaderboard`
- `POST/GET /org/me/notifications`, `GET /org/me/notifications/my`

### Corporate (`/org/me/corporate`)
- `GET /dashboard`
- `POST/GET /departments`, `GET/PATCH/DELETE /departments/:id`
- `POST/DELETE /departments/:id/members/:member_id`
- `POST /employees/import` (CSV bulk)
- `GET/POST /wellness-cohorts`, `DELETE /wellness-cohorts/:id`
- `GET /analytics/overview`, `GET /analytics/departments`, `GET /analytics/engagement`

### Gym (`/org/me/gym`)
- `GET /dashboard`
- `POST/GET/DELETE /groups`, `GET/DELETE /groups/:id`
- `POST/GET /workout-plans`, `GET/PATCH/DELETE /workout-plans/:id`
- `POST /workout-plans/assign`
- `POST/GET /body-logs`, `GET /members/:id/body-log`
- `POST/GET /classes`, `GET/PATCH/DELETE /classes/:id`
- `POST/DELETE /classes/:id/book`, `GET /classes/:id/bookings`
- `GET /analytics/overview`, `GET /analytics/body-composition`

### Nutrition (`/org/me/nutrition`)
- `GET /dashboard`
- `POST/GET /condition-groups`, `DELETE /condition-groups/:id`
- `POST /clinical`, `GET /clinical/me`, `GET /clinical/:member_id`
- `POST/GET /protocols`, `GET/PATCH/DELETE /protocols/:id`
- `POST/GET /consultations`, `PATCH /consultations/:id`
- `POST /plan-reviews`, `GET /plan-reviews/:member_id`
- `GET /analytics/overview`, `GET /analytics/conditions`

### Member Portal (`/org/member`)
- `GET /my-orgs`
- `GET /my-orgs/:id/plan`
- `POST/GET /my-orgs/:id/compliance`
- `GET /my-orgs/:id/content`
- `GET /my-orgs/:id/challenges`
- `POST /my-orgs/:id/challenges/:cid/progress`
- `GET /my-orgs/:id/workout-plan` (gym only)
- `GET /my-orgs/:id/clinical` (nutrition only, self-view)

---

## Key Technical Decisions

1. **All DB migrations are idempotent** — `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
2. **`require_module_active(module_key)`** — called at top of every org-type endpoint; reads `platform_module`, raises 503 if disabled
3. **Privacy rule** — `org_compliance_log.clinical_notes` and `nutrition_client_clinical` never returned in admin aggregates; member/staff-only via direct lookup
4. **Admin audit log** — every block/unblock/plan-change in `org_admin_action` with mandatory reason
5. **Multi-org** — one `users` row can be in Corporate + Gym + Nutrition simultaneously via `org_member`
6. **`psycopg3` raw SQL** — `dict_row` factory, `%s` params, `psycopg.types.json.Json` for JSONB columns
7. **Inline repo pattern** — shared modules (challenges, notifications, etc.) keep DB calls inline rather than a separate `repository.py` for self-containment; core org CRUD still in `org/repository.py`

---

## Next Steps

- [ ] Write Playwright API tests for each phase (use test IDs from SKILL.md: ORG, ORGC, ORGG, ORGN, ORGM)
- [ ] Frontend pages for org admin dashboard (Corporate, Gym, Nutrition)
- [ ] Frontend member portal (`/my-orgs`)
- [ ] CSV import UI (Corporate)
- [ ] Bulk meal plan batch generation (trigger AI pipeline per member)
