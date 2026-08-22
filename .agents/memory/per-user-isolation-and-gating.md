---
name: Per-user data isolation & plan feature gating
description: How user-scoped data and free/paid feature gating work in the Bunny TTS API; the central plan config is the single source of truth.
---

# Per-user isolation & plan/feature gating

All plan logic lives in one backend module (`artifacts/api-server/src/lib/plans.ts`): credits, USD prices, exchange rates, feature gating, model gating, and the pricing-page plan definitions. Change plans there, not scattered across routes.

## Isolation rules
- Any endpoint that lists or mutates user-owned rows (generations, voice clones) MUST scope by the session/appUser id — never return or delete global rows.
- **Why:** the original bug leaked every user's generations and clones to everyone; the DELETE clone route was also an unauthenticated IDOR.
- **How to apply:** add the auth middleware AND a `where userId = ...` clause (or `and(id, userId)` for mutations). For deletes use `.returning()` and 404 when empty so cross-user ids can't be probed. Admins may use an id-only filter to act globally.

## Feature gating
- Free plan allows only Text-to-Speech and Fire TTS. Everything else (voice cloning, speech-to-speech, speech-to-text, audio-isolation, dubbing, sound-effects, music) is paid-only. Admins always bypass (`isUserAdmin`).
- Gate routes with the `requireFeature(feature)` middleware. On file-upload routes put `requireFeature` BEFORE `multer`'s `upload.single(...)` so unauthorized requests are rejected before file parsing.

## Exchange rates
- Rates (PKR/INR/EUR vs USD) live server-side only. The public `/api/plans` endpoint returns already-converted prices + currency metadata, never the raw rate table. The frontend must never hardcode rates.

## Free plan is a 7-day trial (Aug 2026, user directive)
Free users get planExpiresAt = signup + FREE_TRIAL_DAYS (plans.ts) at every free-signup point (register, register/verify, Google OAuth). After expiry requireActiveUser 402-blocks generation, and the 6-hourly sweeper (sweepExpiredFreeTrials, not gated on email config) zeroes leftover free credits. Legacy free users were backfilled from created_at via an idempotent ensureSchema UPDATE. Admins/resellers exempt.
