---
name: Railway hosting for OpenRadio
description: Production runs on Railway from GitHub main; Replit is code-editing only. Key deploy gotchas.
---

Production = Railway service built from repo root `Dockerfile` (builds frontend + API; API serves SPA on port 8080). `railway.json` forces the Dockerfile builder.

**Rules / gotchas:**
- Railway Root Directory must be EMPTY; if set to a subdir, root Dockerfile is ignored and pushes outside that dir are silently "skipped".
- Railway does not set `NODE_ENV`; Dockerfile sets `ENV NODE_ENV=production`, and the API serves the frontend whenever built files exist (not gated on NODE_ENV).
- Express 5 crash: `app.get("*")` throws PathError (path-to-regexp v8). SPA fallback must be plain `app.use` middleware skipping `/api`.
- `DATABASE_URL` on the app service must be the reference `${{Postgres.DATABASE_URL}}`; all provider secrets must be duplicated on Railway.
- If Railway stops picking up pushes, disconnect/reconnect the GitHub repo (webhook can go stale) or recreate the service.
- Deploy flow: edit on Replit → verify locally → commit → `git push github main` → Railway auto-builds.
