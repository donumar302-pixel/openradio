---
name: Admin panel & startup migrations
description: How schema changes reach prod and admin-panel conventions
---

- **Prod schema changes:** Railway never runs `drizzle push`. Any additive schema change must ALSO be mirrored as idempotent SQL in the api-server startup `ensureSchema()` (runs before `app.listen`; server refuses to start on failure). Dev uses `pnpm --filter @workspace/db push-force`.
- **Why:** no migration files exist; the project is push-based and the prod DB is only reachable from Railway.
- Admin panel tabs: Overview, Users (paginated envelope `{total,page,pageSize,users}`), Orders, Keys, Generations, Clones, Analytics (recharts), Promo Codes, Notifications, Support, Abuse, Settings.
- Settings live in `app_settings` (key→JSON): `banner` and `features` kill-switches, ~30s server cache; enforced via `requireFeature()` middleware on /tts, /minimax, /fishaudio, /edge and voice-clone endpoints.
- User mutations (suspend/delete, single + bulk) must never touch effective admins (is_admin OR email allowlist) or the acting admin; promo redemption is a single transaction with a conditional counter update.
- Notifications are fanned out one row per user; support replies also insert a notification.
- Anti-abuse groups users by `signup_ip` (captured at register + Google signup).
