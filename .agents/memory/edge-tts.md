---
name: Edge TTS package
description: Which npm package powers Edge TTS and why the old one broke with Microsoft 403
---

Edge TTS runs on the `msedge-tts` npm package (api-server, routes/edgetts.ts).

**Why:** The old `edge-tts@1.0.1` package stopped working (Aug 2026) — Microsoft added a Sec-MS-GEC DRM token to the WebSocket handshake, so unmaintained clients get "Unexpected server response: 403" (surfaced as our 500 error body). `@andresaya/edge-tts` was tried first but depends on the `fs` npm stub package, which the Replit package firewall blocks (ERR_PNPM_FETCH_403).

**How to apply:** If Edge TTS starts failing again with a 403-ish message, suspect Microsoft protocol drift first — upgrade/replace the client package rather than debugging our route. `msedge-tts` API: `new MsEdgeTTS()`, `setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)`, `toStream(text, prosody)` → collect stream to Buffer; `getVoices()` returns the same field names (ShortName/Locale/FriendlyName/Gender) the old package did.
