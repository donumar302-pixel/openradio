---
name: Reseller system
description: How resellers work — flags on users table, credit pool accounting, panel routes
---

- Resellers are rows in `users` with `is_reseller=true` plus `reseller_credits` (pool), `reseller_expires_at`, and child users carry `reseller_id`. No separate table. Columns mirrored in api-server ensureSchema().
- Panel: frontend gate `/reseller` (isReseller from /api/auth/me, standalone layout — no SidebarLayout); admin manages resellers at `/adminarea/resellers`. Admin pages must NOT wrap themselves in AdminLayout — AdminRoutes already does.
- Credit accounting: every grant to a child user (create or top-up) is a transaction with a conditional pool decrement (`WHERE reseller_credits >= X`) — never check-then-deduct. Deleting a child user does NOT refund the pool (intentional).
- All reseller user mutations scope by `AND reseller_id = <reseller>` (IDOR-safe). Expired/blocked resellers get 403 from requireReseller (with `expired:true` flag the panel renders).
- **Security rule:** account-creation endpoints (reseller create-user, admin create-reseller) must reject emails on the admin allowlist — otherwise creating that email = instant admin (allowlist grants admin by email alone).

## Reseller panel routing (user directive, Aug 2026)
/reseller and every sub-path (including trailing slash) must ALWAYS resolve inside the reseller area: panel for logged-in resellers, reseller login page for everyone else — even devices logged in with a normal (non-reseller) account. Never redirect /reseller* to the main app home/login. Panel logout lands back on /reseller.
