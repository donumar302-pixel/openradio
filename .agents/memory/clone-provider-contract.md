---
name: Clone provider limits and dialogue
description: Provider documentation caveats for short clone samples and multi-speaker cloned dialogue.
---
OpenSpeaker's public cloning guidance lists 3–30 seconds, while the product owner requested accepting uploads from 1–30 seconds. Do not promise provider success for 1–2 second samples or promise failure-free cloning.

**Why:** On 2026-09-13, https://openspeaker.ai/services/voice-cloning stated “Sample length 3–30 seconds”; the API document only specified a 10 MB file limit.

**How to apply:** Keep upload acceptance distinct from provider recommendations and surface temporary provider failures separately from invalid recordings. Never silently pad or trim samples to claim support.

The official https://openspeaker.ai/app/api-document explicitly supports clone-prefixed voice IDs in dialogue; A>, B> labels map to the speakers array by index.

**Why:** Cloned dialogue is supported by the provider, not a separate cloning endpoint.

**How to apply:** Reuse the dialogue endpoint and owned clones rather than inventing a dialogue-clone API.