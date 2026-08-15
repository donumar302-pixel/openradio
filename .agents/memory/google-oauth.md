---
name: Google OAuth login
description: How Google sign-in works in the voiceover app and its residual risks/config needs
---

- Google OAuth is hand-rolled in the auth routes (no passport): `/api/auth/google` → consent → `/api/auth/google/callback` → find-or-create user **by verified Google email** (no googleId column; Google-only users get a random bcrypt password hash).
- **Why:** avoiding a schema change meant no prod DB migration on Railway.
- Session is **regenerated on every login/register/OAuth success** (session-fixation fix from review). Keep this pattern for any new auth path.
- Redirect URI prefers `APP_ORIGIN` env (canonical https origin) and falls back to request host. When the custom domain goes live, set `APP_ORIGIN=https://www.openradio.io` on Railway and keep that URI registered in Google Console.
- **Residual risk (accepted):** password registrations are not email-verified, so an attacker could pre-register a victim's email and the victim's first Google login links to that row (account pre-hijack). Full fix requires email verification for password signups.
- Prod needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set as Railway service variables — Replit secrets do not propagate to Railway.
