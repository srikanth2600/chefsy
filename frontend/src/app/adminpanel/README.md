# Chefsy — Admin Panel v2

## Stack
Next.js App Router · Tailwind CSS · React hooks · No extra UI libraries

## File Map → Drop into `src/app/adminpanel/`

```
adminpanel/
├── admin.css              ← Design system (import in layout.tsx)
├── layout.tsx             ← Sidebar + header shell
├── page.tsx               ← Entry point
├── adminpage.tsx          ← Dashboard content
├── login/page.tsx         ← Login page
├── users/page.tsx         ← Users CRUD
├── recipes/page.tsx       ← Recipes browser
├── videos/page.tsx        ← Videos + approval workflow
├── analytics/page.tsx     ← Charts + insights
├── chats/page.tsx         ← Chat log viewer
├── feedback/page.tsx      ← Likes/dislikes + top recipes
├── ads/page.tsx           ← Ad banner management
└── components/Shared.tsx  ← Modal, ConfirmDialog, Pagination, DetailRow
```

## New Backend APIs Required

### Dashboard
- `GET /admin/stats`           → users_total, users_new_7d, recipes_total, recipes_cached_pct, videos_total, videos_pending, chats_total, chats_today, likes_total
- `GET /admin/activity`        → { items: [{ type, message, created_at }] }
- `GET /admin/top-recipes`     → { items: [{ title, likes, chats }] }

### Analytics
- `GET /admin/analytics/overview?days=30` → daily_chats[], user_growth[], top_cuisines[], top_queries[], cache_hit_rate, avg_response_ms

### Chat Logs
- `GET /admin/chats?q=&page=&per_page=`   → { chats[], total }
- `GET /admin/chats/:chat_id`             → { chat_id, messages[], user{} }
- `DELETE /admin/chats/:chat_id`

### Feedback
- `GET /admin/feedback?type=&page=`       → { items[], total }
- `GET /admin/feedback/summary`           → { total_likes, total_dislikes, most_liked[], most_disliked[] }
- `DELETE /admin/feedback/:id`

### Ads
- `GET /admin/ads?page=`                  → { ads[], total }
- `POST /admin/ads`                       → create ad
- `PATCH /admin/ads/:id`                  → update / toggle active
- `DELETE /admin/ads/:id`

### Recipes (additions)
- `GET /admin/recipes?q=&cuisine=&page=`  → { recipes[], total }
- `POST /admin/recipes/:id/feature`       → toggle featured flag
- `DELETE /admin/recipes/:id`

### Users (additions)
- `POST /admin/users/:id/block`           → toggle block (existing endpoint)
- Response should now include: is_blocked, recipe_count, chat_count

## Existing APIs (unchanged)
- `POST /auth/login`, `GET /auth/me`
- `GET /admin/users`, `DELETE /admin/users/:id`
- `GET /admin/videos`, `POST /admin/videos/:id/approve`, `POST /admin/videos/:id/reject`

### Chefs / Professionals
- `GET  /admin/chefs?q=&status=&page=`    → { chefs[], total }
- `POST /admin/chefs/:id/verify`          → toggle verified badge
- `POST /admin/chefs/:id/feature`         → toggle featured on home
- `POST /admin/chefs/:id/activate`        → toggle active/suspended
- `DELETE /admin/chefs/:id`

### Admins
- `GET  /admin/admins?page=`              → { admins[], total }
- `POST /admin/admins`  body: { full_name, email, password }
- `DELETE /admin/admins/:id`              → revoke admin access
- `POST /admin/admins/:id/reset-password` body: { new_password }

### Settings
- `GET   /admin/settings`                 → { settings: { key: value } }
- `PATCH /admin/settings`  body: { key: value, ... }
- `POST  /admin/cache/clear`              → flush recipe cache
- `DELETE /admin/chats/flush`             → delete all chat logs
