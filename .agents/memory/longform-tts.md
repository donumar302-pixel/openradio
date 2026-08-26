---
name: Longform TTS pipeline
description: Design decisions for the chunked 10-30 min voiceover pipeline (/api/os/tts-long)
---

# Longform TTS (scripts > 5,000 chars)

The provider's single TTS task degrades/queues badly above ~5k chars, so long scripts are split (paragraph → sentence → word boundaries, ≤4.5k/chunk), each chunk runs as its own provider task with per-chunk retry (3 attempts, 5-min timeout, provider-side cancel on timeout), and parts are stitched with ffmpeg (`-f concat` + re-encode to mp3 128k so stream params always match).

**Key decisions:**
- The parent os_tasks row has NO externalTaskId (chunk tasks are ephemeral provider-side). That means the normal stuck-task sweep skips it — a dedicated orphan sweep settles `input ? '_longform'` rows stale >20 min (server crash mid-run) with a partial refund. The runner bumps `updatedAt` every ~15s while polling so live runs never look stale.
- Stitched MP3s are stored in the existing os_dub_videos blob table (kind "out", taskId = parent row) — reusing it avoids a prod schema migration (Railway never runs drizzle push; new tables must be mirrored in ensureSchema) and inherits the 7-day age-out. Served by `/api/os/tasks/:id/audio` with manual byte-range support (seeking on 30-min files).
- Credits: reserve full text.length upfront, track `credits_spent` per finished chunk in output.progress; settle reconciles to real cost (Edge is much cheaper per char — verified live: 5,215-char reserve reconciled down to 2,920). Failed/orphaned runs refund only the unfinished portion. Admin runs reserve 0 and are never adjusted.
- Cancellation (DELETE task) works because the runner re-checks the row status before each chunk and aborts when the row is gone/final; the delete route now removes kind-"out" blobs for ALL tools, not just dubbing.
- Client: studio auto-routes >5,000 chars to /tts-long; per-part progress comes from polling output.progress on the parent task (same useOsTask hook).

**Why:** users need 10-30 min voiceovers; single provider tasks that long get stuck in the queue.
**How to apply:** any new chunked/multi-call tool should follow the same pattern — parent row without externalTaskId + its own orphan-sweep clause + progress in output + result blob in os_dub_videos.
