---
name: OpenSpeaker-only policy
description: User directive — all TTS/voice features must route through the OpenSpeaker proxy, never direct provider APIs.
---

# OpenSpeaker-only policy (user directive, Aug 2026)

**Rule:** Every voice feature in the frontend (voice listing, TTS generation, history, voice cloning) must go through the OpenSpeaker proxy routes (`/api/os/*`). Never call the direct provider routes (`/api/minimax/*`, `/api/fishaudio/*`, `/api/edge-tts`, direct EL `/api/tts`) from any page.

**Why:** Direct MiniMax account ran out of balance; user then decided ("sirf OpenSpeaker hi use karna hai hamesha") that OpenSpeaker is the single upstream for everything — one billing path, persistent task history, one voice catalog.

**How to apply:**
- Studio platforms (ElevenLabs / Fire TTS / Fish Audio / Edge TTS) are just OS provider filters (`/voices?provider=elevenlabs|minimax|fishaudio|edge`); generation is always `POST /api/os/tts` (1 credit/char, speed clamped 0.5–1.5).
- Voice Library "Fire TTS" tab = OS minimax catalog (no separate local tab); clones come from `/api/os/voice-clones` only.
- Backend direct routes still exist in api-server but are legacy/unused by the frontend — don't wire new UI to them.
- Deep-link prefixes `mm:`/`fa:`/`edge:` are mapped to OS-prefixed ids (`minimax_x` etc.); OS ids use `os:`.
- Known gap: legacy MiniMax voice clones (provider='minimax' in voice_clones) are no longer listed anywhere and can't be used via OS. Dev DB has zero; prod (Railway) unchecked — flagged to user.

## White-label directive (user, Aug 2026)
Customers must NEVER see upstream branding — no OpenSpeaker, ai33/cdn.ai33.pro, or Replit anywhere user-facing (errors, filenames, URLs, tab titles). sanitizeProviderText in the openspeaker lib scrubs provider error text (applied at parse, at task settle, and on the way out for old rows); result files stream via the task-file proxy with OpenRadio-branded filenames. Any new user-facing surface that carries provider text must go through the same scrub.
