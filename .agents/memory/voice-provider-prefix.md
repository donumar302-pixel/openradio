---
name: Voice provider prefix mapping (studio TTS)
description: Why the unified Text-to-Speech voice dropdown uses "el:"/"mm:" composite keys but the runtime provider value must be "el"/"minimax".
---

# Voice provider composite keys vs. runtime provider

The unified Text to Speech page combines ElevenLabs and Fire TTS (MiniMax) voices in one
voice dropdown. Each dropdown item carries a composite key prefixed by engine: `el:<id>`
for ElevenLabs and `mm:<id>` for MiniMax.

**The trap:** the runtime `voiceProvider` state is typed `"el" | "minimax"` — NOT `"mm"`.
The dropdown prefix `mm` must be mapped to `minimax` when a voice is selected. A naive
`composite.slice(0, colonIdx) as "el" | "minimax"` silently sets provider to the string
`"mm"`, which is neither branch — so the selected-voice label, the generate path
(`if (voiceProvider === "minimax")`), and any Fire-TTS-gated UI all break with no type error
(the `as` cast hides it).

**Why:** discovered when a provider-gated expression toolbar (Emotion/Pause/Sound Tag,
enabled only for Fire TTS voices) stayed permanently disabled — selecting a Fire TTS voice
set provider to `"mm"`, so `voiceProvider === "minimax"` was always false.

**How to apply:** whenever you read an engine prefix off a composite voice key, map it
explicitly (`raw === "mm" ? "minimax" : raw === "fa" ? "fishaudio" : "el"`). Never trust
the raw prefix as the provider value. A third engine (Fish Audio, prefix "fa:") was added.

**Related:** Fire TTS expression tags (`[happy]`, `<break time="1000ms"/>`, `[laughter]`)
only affect MiniMax output, so the toolbar is intentionally gated to `voiceProvider === "minimax"`.
The standalone Fire TTS page was removed and merged into Text to Speech; `/minimax` redirects to `/studio`.
