---
name: Manual plan payments
description: Non-obvious authorization and integrity rules for the manual plan-payment workflow.
---

Renewal payment routes must authenticate and reject suspended accounts, but they must not require an unexpired plan. Expired users are the primary users of renewal checkout.

**Why:** Reusing the normal active-plan middleware made the renewal path impossible exactly when a paid plan had expired.

**How to apply:** Keep plan prices, credits, and duration server-derived; store immutable order/payment snapshots; allow only pending orders to be approved or rejected; never apply an entitlement transition twice.

Proof images are strictly bounded and validated, kept in PostgreSQL bytes because Railway's filesystem is ephemeral, and available only to the owning user or an admin.

**Why:** Payment evidence is sensitive and must survive Railway restarts without becoming public.

**How to apply:** Omit proof bytes from JSON lists, validate image signatures as well as MIME types, and keep proof responses private/no-store.