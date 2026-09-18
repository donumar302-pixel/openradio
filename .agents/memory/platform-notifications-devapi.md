---
name: Email notifications, Developer API & Script Writer
description: How transactional email, the public /api/v1 developer API, and the AI script writer are wired and gated.
---

- **Email (Resend)**: fail-soft sender in api-server lib/email.ts; needs RESEND_API_KEY (+ optional EMAIL_FROM, defaults to onboarding@resend.dev which only delivers to the account owner until a domain is verified in Resend). Order approve/reject emails fire after the admin tx commits; plan-expiry reminders run 6-hourly and claim idempotently via users.expiry_notified_at = plan_expires_at (renewal moves the date → new reminder). **Why:** email must never block or double-send on retries.
- **Developer API**: public /api/v1 (Bearer orv_ keys, sha256-hashed in user_api_keys, full key shown once). Paid plans only, checked on every request (status/plan/expiry). /api/v1/tts reuses the exported reserve→provider→refund helpers from routes/openspeaker.ts and inserts os_tasks rows (title prefixed [API]) so the abandoned-task sweep settles them. In-memory 60 req/min per key.
- **Script Writer**: flat 10 credits (admins free), preferring Replit OpenAI integration with direct OpenAI fallback; 503 before charging when neither is configured. GPT-5 chat requests require `max_completion_tokens`, reject custom temperature, and need headroom because reasoning consumes the same budget. Frontend hands the result to Studio.
- **How to apply:** any new schema here must also go in ensure-schema.ts (Railway never runs drizzle push). Railway needs RESEND_API_KEY / OPENAI_API_KEY set manually in its dashboard — Replit secrets don't propagate.
