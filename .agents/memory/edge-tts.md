---
name: Edge TTS package
description: Which npm package powers Edge TTS and why the old one broke with Microsoft 403
---

Edge TTS runs on the `msedge-tts` npm package server-side, without OpenSpeaker.

**Why:** The old `edge-tts@1.0.1` package stopped working (Aug 2026) — Microsoft added a Sec-MS-GEC DRM token to the WebSocket handshake, so unmaintained clients get "Unexpected server response: 403" (surfaced as our 500 error body). `@andresaya/edge-tts` was tried first but depends on the `fs` npm stub package, which the Replit package firewall blocks (ERR_PNPM_FETCH_403).

**How to apply:** If Edge TTS starts failing again with a 403-ish message, suspect Microsoft protocol drift first — upgrade/replace the client package rather than debugging the OpenSpeaker route. This is Edge Read Aloud, not a guaranteed official public TTS API. Keep zero user credits and the direct route limited to Edge; other engines retain their existing provider contracts.
