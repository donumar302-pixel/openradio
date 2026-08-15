# OpenRadio

AI voiceover platform (openradio.io): text-to-speech, voice cloning, Edge TTS, MiniMax Fire TTS, and Fish Audio TTS with plans and credits.

## Hosting — Replit is ONLY for code editing

- Production = **Railway**. Railway auto-deploys from GitHub repo `donumar302-pixel/openradio`, branch `main`. Never use Replit Publish for production.
- Deploy flow for every change: edit code on Replit → verify locally → commit → `git push github main` → Railway builds root `Dockerfile` → confirm on openradio.io.
- Root `Dockerfile` builds BOTH frontend (`@workspace/voiceover-tool`) and API (`@workspace/api-server`); the API serves the built frontend (SPA fallback) from one Railway service on port 8080.
- `railway.json` at repo root forces the Dockerfile builder. Railway service Root Directory must stay EMPTY.
- Production PostgreSQL runs on Railway (`DATABASE_URL = ${{Postgres.DATABASE_URL}}` reference variable on the app service). Replit local DB is dev-only — never diagnose production data from it.
- Production secrets (SESSION_SECRET, FISH_AUDIO_API_KEY, MINIMAX_API_KEY, MINIMAX_GROUP_ID, etc.) live on Railway's dashboard. Replit secrets only affect local dev; any new secret must also be added on Railway, then redeploy.
- Schema changes: edit `lib/db/src/schema/index.ts`, then `pnpm --filter @workspace/db run push` with `DATABASE_URL` pointed at the target DB (use Railway's public connection string for prod).

## Run & Operate (local dev)

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/voiceover-tool run dev` — Vite frontend dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (gotcha: `app.get("*")` crashes in Express 5 — use plain middleware for SPA fallback)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild for API, Vite for frontend

## Where things live

- `artifacts/voiceover-tool` — React + Vite frontend (pages: landing, tools, pricing, dashboard)
- `artifacts/api-server` — Express backend, all `/api` routes; serves frontend build in production
- `lib/db` — Drizzle ORM schema at `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/lib/plans.ts` — single source of truth for plans/credits/rates/gating

## User preferences

- Communicate in Roman Urdu, simple language.
- Replit = code editing only; server + database live on Railway (same model as user's BunnyFlow project).
