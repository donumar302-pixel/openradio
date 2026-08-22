---
name: Credit enforcement & admin elevation
description: How TTS credit charging must be done (atomic reserve/refund) and the known admin-elevation security gap in Bunny TTS.
---

# Credit enforcement (Bunny TTS)

Rule: charge credits with an **atomic reserve before the provider call, refund on failure** —
never "check then deduct" as two separate statements.

**Why:** a `SELECT credits` check followed by a later `UPDATE ... credits - amount` lets two
concurrent generations both pass the check and overspend. An architect review failed the
first implementation for exactly this race.

**How to apply:**
- Reserve = single `UPDATE users SET credits = credits - n, creditsUsed = creditsUsed + n
  WHERE id = ? AND credits >= n RETURNING id`. Zero rows back ⇒ insufficient ⇒ 402.
- Do the reserve **after** cheap pre-flight checks (e.g. provider API key present → else 503)
  but **before** calling the upstream provider.
- On any failure after reserving (provider non-2xx, empty audio, thrown error) call
  `refundCredits` = `credits + n`, `creditsUsed = GREATEST(0, creditsUsed - n)`.
- Admins bypass entirely (`isUserAdmin`) — never reserve or refund for them.
- 1 credit = 1 character (`text.length`). Lives in tts.ts (`/`) and minimax.ts (`/tts`).
- Admin `creditsDelta` adjustments should also be atomic SQL
  (`GREATEST(0, credits + delta)`) unless combined with an absolute set in the same PATCH.

# Async provider task reconciliation

Rule: webhook/poll reconciliation must lock and reload the task row, then adjust the user
ledger and task status in one transaction. Refund only the amount actually collected.

**Why:** webhook and polling can process different provider states concurrently. Separate
compare-and-set updates can partially refund a failed task; recording a nominal cost when an
upward adjustment was only partly collectible can later refund more than the task deducted.

**How to apply:** finalize once under a task-row lock; store actual collected credits, not an
uncollectible nominal cost; apply customer markup consistently to both quote and final reported
provider cost; a provider failure refunds the task's current collected amount exactly once.

# Known security gap: admin by email allowlist

Admin status is granted by an email allowlist (`isAdminEmail`, STATIC_ADMIN_EMAILS) with **no
email-ownership verification**. Anyone who registers the allowlisted email becomes admin.
Architect flagged this critical; the user has repeatedly deferred it. Do not silently "fix"
with email infra — surface it and let the user decide. Real fix = verified email ownership
or a secure admin-bootstrap secret before elevation.
