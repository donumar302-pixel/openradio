---
name: Landing voice samples & MiniMax balance
description: How landing demo mp3s are produced and why MiniMax cannot be used for asset generation right now.
---

## Rule
The public landing page's playable demo mp3s live in `artifacts/voiceover-tool/public/voices/` (narrator/serena/soren/kai.mp3) and are referenced via `import.meta.env.BASE_URL + "voices/<file>.mp3"`. If they are missing, the demo fails silently — keep the visible "Sample coming soon" error state on the voice buttons.

**Why:** The files are gitignored-adjacent static assets that were once absent; an architect review caught the demo 404ing with the error swallowed. Also, the MiniMax account returned `status_code 1008 insufficient balance` (July 2026), so MiniMax cannot generate replacement assets; valid builtin voice IDs also differ from docs (several "not exist"). Samples were regenerated using Replit-managed TTS (code-execution `searchVoices` + `textToSpeech`) instead.

**How to apply:** When landing samples need refreshing, use Replit-managed TTS, write straight into `public/voices/`, and verify with `curl localhost:80/voices/<file>.mp3` (expect 200 audio/mpeg). Don't assume MiniMax has balance for internal asset generation.

## Framer-motion gotchas (Tailwind v4, this repo)
- Stagger parent variants must set `opacity: 1` in `visible`, or the whole section stays invisible.
- Cubic-bezier `ease: [..]` arrays need `as const` to satisfy Variants typing.
- `overflow-hidden` on the page root kills the sticky MarketingNav — use `overflow-x-clip`.
