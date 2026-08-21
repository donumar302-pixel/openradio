---
name: OpenSpeaker tool suite
description: Durable quirks and guardrail decisions for the OpenSpeaker (api.openspeaker.ai) integration
---

# API quirks (not guessable from docs/code conventions)

- **Odd path prefixes are correct, not typos**: music uses a `/v1s/...` prefix and image generation `/v1i/...`, while other async tools use `/v1/...`. Cheap existence check without spending credits: empty-body POST → 400 means the endpoint exists, 404 means wrong path.
- The provider reports `credit_cost` immediately after task creation, so one refresh right after submit reconciles the local reserve to the real cost.

# Guardrail decisions (keep these invariants when touching /api/os)

- Reserve → provider call → local insert is two-phase: refund ONLY when the provider call itself failed. After the provider accepted, tracking failures must not refund. **Why:** refunding after acceptance lets users recover credits for work the provider still bills.
- Deleting a still-processing task must confirm the provider-side cancel succeeded before refunding; on failure keep the row and return an error. **Why:** same credit-bypass risk.
- Generation payload references (dictionary ids, `clone_` voice ids) are ownership-checked server-side; uploads are MIME+size validated server-side (browser `accept` is not a control).
- Voice cloning requires an explicit `consent=true` field, rejected server-side otherwise, and the versioned attestation text + timestamp are persisted on the clone row. Cloning itself is intentionally free; charges happen only on generation.
