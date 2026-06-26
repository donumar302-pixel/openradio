---
name: Fish Audio integration
description: How Fish Audio (3rd TTS engine) is integrated — API quirks, model header, voice fallback, env var name.
---

# Fish Audio Integration

## Route
`/api/fishaudio/tts` (POST) and `/api/fishaudio/voices` (GET)
File: `artifacts/api-server/src/routes/fishaudio.ts`

## API Quirks
- Fish Audio requires the model to be passed as an **HTTP header** (`model: s2.1-pro-free`), NOT in the JSON body. This is different from every other provider.
- Response is raw binary MP3 (like MiniMax), not a JSON envelope.
- `reference_id` in the body selects the voice. If `voiceId === "default"` or is falsy, omit `reference_id` entirely — the model uses its base voice.

**Why:** Fish Audio's API spec explicitly uses the `model` header. Putting it in the body is silently ignored, causing the API to use a default/fallback model unexpectedly.

## Credentials
Priority order:
1. `FISH_AUDIO_API_KEY` env var (set in Replit Secrets)
2. DB row in `apiKeysTable` with `provider = "fishaudio"`

No group ID needed (unlike MiniMax which needs groupId + apiKey).

## Models (FA_MODELS in studio.tsx + FISH_AUDIO_MODEL_IDS in plans.ts)
- `s2.1-pro-free` — FREE, available to all plans
- `s2.1-pro`, `s2-pro`, `s1` — paid, blocked on free plan

## Frontend provider value
`voiceProvider === "fishaudio"` — voice dropdown prefix is `"fa:"`, mapped in `handleVoiceSelect`.
Color theme: emerald green (bg-emerald-600) to distinguish from orange (EL) and violet (Fire TTS).

## Voice listing
GET /api/fishaudio/voices fetches top 30 hottest voices from Fish Audio API.
Falls back to `[{ id: "default", name: "Default Voice" }]` if API key is missing or fetch fails.
