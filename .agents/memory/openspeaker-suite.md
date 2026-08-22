---
name: OpenSpeaker tool suite
description: Durable quirks and guardrail decisions for the OpenSpeaker (api.openspeaker.ai) integration
---

# API quirks (not guessable from docs/code conventions)

- **Odd path prefixes are correct, not typos**: music uses a `/v1s/...` prefix and image generation `/v1i/...`, while other async tools use `/v1/...`.
- **ElevenLabs catalog is unbrowsable directly upstream** — `page` is echoed but ignored for most queries (with or without search; behavior is flaky per term), and `page_size` caps at ~100-120 results. Never trust the 16k+ total for paging. Solution in place: the API server builds an in-memory index by sweeping ~130 search terms (background crawler with shared in-flight promises, failure backoff, concurrency cap 2) and serves all ElevenLabs listing/search locally paginated; user searches trigger an on-demand crawl of their term. Index is memory-only, so it rebuilds after every restart (~8.7k voices in a few minutes).
- The provider reports `credit_cost` immediately after task creation, so one refresh right after submit reconciles the local reserve to the real cost. Verified with real dubbing/music/image runs: billed `credit_cost` equals the reserve/quote; ignore `metadata.providerCreditCost` — it is NOT the billed amount.
- Real task output shapes (verified live): image `metadata.result_images` is an array of OBJECTS (`{imageUrl, previewUrl, width, ...}`), not string URLs, and the provider mirrors the image URL into `audio_url` on image tasks (suppress audio rendering for tool "image"). Music (Suno) returns `all_audio_urls` (string array) + `suno_result.clips` (titles — often the same title for both clips), never a `songs` field. Dubbing returns flat `audio_url`/`srt_url`/`json_url`. Voice-changer, voice-isolation, sound-effects, and dialogue all return a flat `audio_url` (no `replacement_audio_url`). Speech-to-text returns `srt_url` + `json_url` only — no `transcript_url`, no inline `text`, and `audio_url` stays null.
- **Voice id format differs by endpoint family**: `/v3/...` endpoints (TTS, dialogue, clone) accept the app's prefixed `elevenlabs_<id>` form, but `/v1/task/...` endpoints (voice-changer, dubbing) forward the id raw to ElevenLabs — a prefixed id is ACCEPTED at creation, then fails during processing with `elevenlabs_voice_not_found` (and still reconciles the cost before erroring/refunding). Strip the `elevenlabs_` prefix for v1 endpoints (see `rawElevenVoiceId` in the openspeaker route).

# Guardrail decisions (keep these invariants when touching /api/os)

- Reserve → provider call → local insert is two-phase: refund ONLY when the provider call itself failed. After the provider accepted, tracking failures must not refund. **Why:** refunding after acceptance lets users recover credits for work the provider still bills.
- Deleting a still-processing task must confirm the provider-side cancel succeeded before refunding; on failure keep the row and return an error. **Why:** same credit-bypass risk.
- Generation payload references (dictionary ids, `clone_` voice ids) are ownership-checked server-side; uploads are MIME+size validated server-side (browser `accept` is not a control).
- Voice cloning requires an explicit `consent=true` field, rejected server-side otherwise, and the versioned attestation text + timestamp are persisted on the clone row. Cloning itself is intentionally free; charges happen only on generation.

## ElevenLabs voice index snapshot
The crawled EL voice index persists in el_voice_index (voice_id → raw JSON) with the sweep completion time in app_settings key el_index_meta.
**Why:** upstream pagination is broken, so the ~8.7k catalog is built by a ~130-term crawl; without persistence every restart re-fired hundreds of upstream requests and showed a shrunken list.
**How to apply:** boot loads the snapshot and skips the crawl when fresher than 24h and ≥1000 rows; incremental flushes persist on-demand search additions; any change here must keep the el_voice_index table mirrored in api-server ensureSchema() for Railway.

## Task history: insert before provider call
os_tasks rows are inserted BEFORE the provider call (status processing, externalTaskId null); provider failure settles the row to error via applyTaskState (atomic refund-once), and a create() response without task_id is settled error+refund instead of staying unpollable.
**Why:** dubbing uploads take minutes — tasks used to vanish from History if the user navigated away or the provider rejected the file, and failures were never recorded.
**How to apply:** never refund outside applyTaskState's row lock; known tradeoff — a transport timeout after provider acceptance still refunds (platform absorbs the cost, candidate for the stuck-credits sweep task).

## Dubbing: provider accepts audio only
OpenSpeaker /v1/task/dubbing rejects video files with "Invalid file" (verified live); it also requires receive_url or errors "expected string, received undefined". The api-server extracts the audio track from video uploads with system ffmpeg before submitting.
**Why:** the UI advertises MP4/MOV support, so video must keep working even though the provider is audio-only.
**How to apply:** ffmpeg must exist in the Railway Docker image (apk add ffmpeg in the root Dockerfile) — removing it silently breaks video dubbing in prod only.

## Dubbed video retention lives in Postgres, not disk
Video uploads for dubbing are retained as Postgres bytea rows (os_dub_videos: kind src/out) until the task settles, then the dubbed audio is muxed back into the video (ffmpeg -c:v copy, via temp files) and the result stored back as a bytea row; downloads stream from the DB. Sources age out after 24h, muxed results after 7d (periodic sweep). Internal ids live in underscore-prefixed task input keys stripped from client JSON.
**Why:** local tmp was wiped by every Railway redeploy — settling tasks fell back to audio-only and finished downloads 410'd. Replit object storage is unreachable from Railway, so the shared durable store is Postgres (bytea, same pattern as order payment proofs).
**How to apply:** table must stay mirrored in api-server ensureSchema() for Railway; only the settle-transition caller muxes (in-process Set guard) — keep it that way to avoid double ffmpeg runs. Legacy `_sourceVideoPath` disk entries are still read/cleaned for pre-migration in-flight tasks. Crash recovery: a task can settle final with the `_sourceVideoId` marker still in input (process died mid-mux) — the periodic sweep re-finalizes those idempotently; transient failures (audio fetch/DB) keep the source and retry, terminal ones (ffmpeg, missing source/audio url) settle audio-only. The unique (task_id, kind) index makes the result write an atomic upsert.
