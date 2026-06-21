---
name: Session cookies & connect-pg-simple in this repo
description: Why sessions silently fail to persist (refresh logs users out) and the two required fixes
---

# Session persistence in the bundled Express API server

Two independent bugs both cause "user gets logged out on refresh" (session never persists). Both must be fixed.

## 1. connect-pg-simple `createTableIfMissing` breaks under esbuild bundling
The api-server is bundled by esbuild into `dist/index.mjs`. connect-pg-simple's `createTableIfMissing: true` reads its own `table.sql` via a path relative to the running file, which resolves to `dist/table.sql` in the bundle — it does not exist → `ENOENT ...dist/table.sql`, the session table is never created, every `store.set` fails silently, so `/me` always 401s after the in-memory login state is gone.

**Fix:** Define the session table in the Drizzle schema (`userSessionsTable` = `user_sessions`: `sid varchar pk`, `sess json`, `expire timestamp(6)`, index on expire) so `db push` creates it in **every** environment (dev AND production — prod has a separate DB). Set `createTableIfMissing: false`.

**Why:** Relying on the library to create the table only works for unbundled servers. Production uses a different database, so the table must come from schema/push, not runtime creation.

## 2. `secure` cookies need `trust proxy` behind the Replit reverse proxy
The Replit proxy terminates TLS; the Express app sees plain HTTP internally. With `cookie.secure: true` and no `app.set("trust proxy", 1)`, express-session thinks the connection is insecure and refuses to send Set-Cookie.

**Fix:** `app.set("trust proxy", 1)` so it trusts `X-Forwarded-Proto: https`.

**How to apply:** Cookie must be `secure: true; sameSite: "none"` for the Replit HTTPS iframe preview. Testing over `localhost:80` (plain HTTP) will NOT set the cookie — that is expected; test via `https://$REPLIT_DEV_DOMAIN`.
