---
name: Voice routing policy
description: Paid voice engines use OpenSpeaker; Edge TTS is a direct, zero-credit exception.
---

# Voice routing policy (updated Sep 2026)

**Rule:** Paid voice features use the OpenSpeaker proxy routes (`/api/os/*`); direct Edge TTS is the sole exception (newer user directive). Do not route Edge voice listing or Edge TTS generation through OpenSpeaker. Never call direct MiniMax/Fish/ElevenLabs APIs from the frontend.

**Why:** Direct MiniMax account ran out of balance; the user originally chose OpenSpeaker for all voices. They later explicitly changed only Edge TTS to direct Microsoft Edge Read Aloud at zero user credits, leaving the other engines alone.

**How to apply:**
- Studio still uses `/api/os/*` for unified task history; Edge voice listing and TTS there are direct Microsoft-backed branches with no OpenSpeaker upstream and zero credit charge. Other engines remain provider-backed with their existing prices.
- Voice Library "Fire TTS" tab = OS minimax catalog (no separate local tab); clones come from `/api/os/voice-clones` only.
- Backend direct routes still exist in api-server but are legacy/unused by the frontend — don't wire new UI to them.
- Deep-link prefixes `mm:`/`fa:`/`edge:` are mapped to OS-prefixed ids (`minimax_x` etc.); OS ids use `os:`.
- Known gap: legacy MiniMax voice clones (provider='minimax' in voice_clones) are no longer listed anywhere and can't be used via OS. Dev DB has zero; prod (Railway) unchecked — flagged to user.

## White-label directive (user, Aug 2026)
Customers must NEVER see upstream branding — no OpenSpeaker, ai33/cdn.ai33.pro, or Replit anywhere user-facing (errors, filenames, URLs, tab titles). sanitizeProviderText in the openspeaker lib scrubs provider error text (applied at parse, at task settle, and on the way out for old rows); result files stream via the task-file proxy with OpenRadio-branded filenames. Any new user-facing surface that carries provider text must go through the same scrub.
