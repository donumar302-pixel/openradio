---
name: Email notifications, Developer API & Script Writer
description: How transactional email, the public /api/v1 developer API, and the AI script writer are wired and gated.
---

- **Email (Resend)**: fail-soft sender in api-server lib/email.ts; needs RESEND_API_KEY (+ optional EMAIL_FROM, defaults to onboarding@resend.dev which only delivers to the account owner until a domain is verified in Resend). Order approve/reject emails fire after the admin tx commits; plan-expiry reminders run 6-hourly and claim idempotently via users.expiry_notified_at = plan_expires_at (renewal moves the date → new reminder). **Why:** email must never block or double-send on retries.
- **Developer API**: public /api/v1 (Bearer orv_ keys, sha256-hashed in user_api_keys, full key shown once). Paid plans only, checked on every request (status/plan/expiry). /api/v1/tts reuses the exported reserve→provider→refund helpers from routes/openspeaker.ts and inserts os_tasks rows (title prefixed [API]) so the abandoned-task sweep settles them. In-memory 60 req/min per key.
- **Script Writer**: /api/script/generate, flat 10 credits (admins free), OpenAI gpt-4o-mini via plain fetch (works on Railway); 503 before charging when OPENAI_API_KEY missing. Frontend hands the script to /studio via sessionStorage key "script-handoff".
- **How to apply:** any new schema here must also go in ensure-schema.ts (Railway never runs drizzle push). Railway needs RESEND_API_KEY / OPENAI_API_KEY set manually in its dashboard — Replit secrets don't propagate.
