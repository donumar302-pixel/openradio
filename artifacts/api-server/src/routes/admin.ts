import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  apiKeysTable, generationsTable, usersTable, voiceClonesTable, ordersTable,
  promoCodesTable, promoRedemptionsTable, notificationsTable,
  supportTicketsTable, supportMessagesTable, osTasksTable,
} from "@workspace/db";
import { getProviderCredits } from "../lib/openspeaker";
import { eq, count, sum, desc, and, sql, or, ilike, inArray, isNotNull, ne } from "drizzle-orm";
import { getSetting, setSetting, knownSettingKeys, normalizePaymentMethods } from "../lib/settings";
import { isUserAdmin } from "../middleware/require-active-user";
import { isAdminEmail } from "../lib/admin";
import { PLAN_PRICE_USD, type PlanId } from "../lib/plans";
import {
  CreateApiKeyBody,
  UpdateApiKeyBody,
  UpdateApiKeyParams,
  DeleteApiKeyParams,
} from "@workspace/api-zod";
import { planCredits, addDays, PLAN_DURATION_DAYS } from "../lib/plans";
import { sendEmail, orderApprovedEmail, orderRejectedEmail } from "../lib/email";

const router = Router();

/* ── Keys CRUD ─────────────────────────────────────────────────────── */
router.get("/keys", async (req, res) => {
  const keys = await db.select().from(apiKeysTable).orderBy(apiKeysTable.createdAt);
  res.json(keys.map((k) => ({
    id: k.id, label: k.label, keyPreview: maskKey(k.key),
    isActive: k.isActive, usageCount: k.usageCount, provider: k.provider,
    creditLimit: k.creditLimit, creditsUsed: k.creditsUsed,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  })));
});

router.post("/keys", async (req, res) => {
  const { label, key, provider, creditLimit } = req.body;
  if (!label || !key) { res.status(400).json({ error: "label and key required" }); return; }
  const [created] = await db.insert(apiKeysTable).values({
    label, key,
    provider: provider || "elevenlabs",
    creditLimit: creditLimit ?? null,
  }).returning();
  res.status(201).json({
    id: created.id, label: created.label, keyPreview: maskKey(created.key),
    isActive: created.isActive, usageCount: created.usageCount,
    provider: created.provider, creditLimit: created.creditLimit,
    creditsUsed: created.creditsUsed,
    lastUsedAt: created.lastUsedAt?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
  });
});

router.post("/keys/bulk", async (req, res) => {
  const { keys, provider, creditLimit, labelPrefix } = req.body as {
    keys?: string;
    provider?: string;
    creditLimit?: number | null;
    labelPrefix?: string;
  };
  if (!keys || typeof keys !== "string") {
    res.status(400).json({ error: "keys text required" });
    return;
  }

  const prefix = (labelPrefix && labelPrefix.trim()) || "Key";
  const parsed: { label: string; key: string }[] = [];
  const seen = new Set<string>();
  let idx = 0;

  for (const raw of keys.split(/[\r\n]+/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,\t]/).map((s) => s.trim()).filter(Boolean);
    let label: string | undefined;
    let key: string;
    if (parts.length >= 2) {
      label = parts[0];
      key = parts.slice(1).join("");
    } else {
      key = line;
    }
    if (!key || key.length < 8) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    idx++;
    parsed.push({ label: label || `${prefix} ${idx}`, key });
  }

  if (parsed.length === 0) {
    res.status(400).json({ error: "No valid keys found" });
    return;
  }

  const existing = await db.select({ key: apiKeysTable.key }).from(apiKeysTable);
  const existingSet = new Set(existing.map((e) => e.key));
  const toInsert = parsed.filter((p) => !existingSet.has(p.key));
  const skippedDuplicates = parsed.length - toInsert.length;

  let inserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK).map((p) => ({
      label: p.label,
      key: p.key,
      provider: provider || "elevenlabs",
      creditLimit: creditLimit ?? null,
    }));
    const r = await db.insert(apiKeysTable).values(chunk).returning({ id: apiKeysTable.id });
    inserted += r.length;
  }

  res.status(201).json({ inserted, skippedDuplicates, totalParsed: parsed.length });
});

router.patch("/keys/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { label, isActive, creditLimit, creditsUsed } = req.body;
  const updates: Record<string, any> = {};
  if (label !== undefined) updates.label = label;
  if (isActive !== undefined) updates.isActive = isActive;
  if (creditLimit !== undefined) updates.creditLimit = creditLimit === "" ? null : Number(creditLimit);
  if (creditsUsed !== undefined) updates.creditsUsed = Number(creditsUsed);
  const [updated] = await db.update(apiKeysTable).set(updates)
    .where(eq(apiKeysTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Key not found" }); return; }
  res.json({
    id: updated.id, label: updated.label, keyPreview: maskKey(updated.key),
    isActive: updated.isActive, usageCount: updated.usageCount,
    provider: updated.provider, creditLimit: updated.creditLimit,
    creditsUsed: updated.creditsUsed,
    lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/keys/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
  res.status(204).send();
});

/* ── Stats ─────────────────────────────────────────────────────────── */
router.get("/stats", async (req, res) => {
  const [keyStats] = await db.select({ totalKeys: count() }).from(apiKeysTable);
  const [activeStats] = await db.select({ activeKeys: count() }).from(apiKeysTable)
    .where(eq(apiKeysTable.isActive, true));
  const [genStats] = await db.select({
    totalGenerations: count(),
    totalCharacters: sum(generationsTable.characterCount),
  }).from(generationsTable);
  const [userStats] = await db.select({ totalUsers: count() }).from(usersTable);
  const [cloneStats] = await db.select({ totalClones: count() }).from(voiceClonesTable);
  const [orderStats] = await db.select({ totalOrders: count() }).from(ordersTable);
  const [pendingStats] = await db.select({ pendingOrders: count() }).from(ordersTable)
    .where(eq(ordersTable.status, "pending"));

  const allUsers = await db.select({ plan: usersTable.plan }).from(usersTable);
  const planCounts: Record<string, number> = {};
  for (const u of allUsers) {
    planCounts[u.plan] = (planCounts[u.plan] || 0) + 1;
  }

  res.json({
    totalKeys: keyStats.totalKeys,
    activeKeys: activeStats.activeKeys,
    totalGenerations: genStats.totalGenerations,
    totalCharacters: Number(genStats.totalCharacters ?? 0),
    totalUsers: userStats.totalUsers,
    totalClones: cloneStats.totalClones,
    totalOrders: orderStats.totalOrders,
    pendingOrders: pendingStats.pendingOrders,
    planCounts,
  });
});

/* ── Users CRUD ─────────────────────────────────────────────────────── */
function serializeUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    plan: u.plan,
    credits: u.credits,
    creditsUsed: u.creditsUsed,
    planExpiresAt: u.planExpiresAt ? u.planExpiresAt.toISOString() : null,
    status: u.status,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/users", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const plan = String(req.query.plan ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "25")) || 25));

  const conditions = [];
  if (search) conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`)));
  if (plan) conditions.push(eq(usersTable.plan, plan));
  if (status) conditions.push(eq(usersTable.status, status));
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(usersTable).where(where);
  const users = await db.select().from(usersTable).where(where)
    .orderBy(desc(usersTable.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);

  const ids = users.map(u => u.id);
  const stats = ids.length ? await db.select({
    userId: generationsTable.userId,
    genCount: count(),
    chars: sum(generationsTable.characterCount),
  }).from(generationsTable)
    .where(inArray(generationsTable.userId, ids))
    .groupBy(generationsTable.userId) : [];

  const statMap: Record<number, { genCount: number; chars: number }> = {};
  for (const s of stats) {
    if (s.userId != null) statMap[s.userId] = { genCount: Number(s.genCount), chars: Number(s.chars ?? 0) };
  }

  res.json({
    total: totalRow.n,
    page,
    pageSize,
    users: users.map(u => ({
      ...serializeUser(u),
      signupIp: u.signupIp,
      generationCount: statMap[u.id]?.genCount ?? 0,
      charactersUsed: statMap[u.id]?.chars ?? 0,
    })),
  });
});

router.post("/users/:id/reset-password", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const password = String(req.body?.password ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  const passwordHash = await bcrypt.hash(password, 10);
  const [updated] = await db.update(usersTable).set({ passwordHash })
    .where(eq(usersTable.id, id)).returning({ id: usersTable.id });
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ok: true });
});

// Effective admins include the email allowlist, not just is_admin — never
// let suspend/delete touch them (or the acting admin themself).
async function protectedUserIds(ids: number[], selfId: number | undefined): Promise<Set<number>> {
  const rows = ids.length
    ? await db.select({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin })
        .from(usersTable).where(inArray(usersTable.id, ids))
    : [];
  const protectedIds = new Set<number>();
  for (const r of rows) if (isUserAdmin(r) || r.id === selfId) protectedIds.add(r.id);
  if (selfId != null) protectedIds.add(selfId);
  return protectedIds;
}

router.post("/users/bulk", async (req, res) => {
  const rawIds: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  const action = String(req.body?.action ?? "");
  if (rawIds.length === 0) { res.status(400).json({ error: "ids required" }); return; }
  if (!["suspend", "unsuspend", "delete"].includes(action)) {
    res.status(400).json({ error: "action must be suspend, unsuspend or delete" }); return;
  }

  let ids = [...new Set(rawIds)];
  if (action !== "unsuspend") {
    const protectedIds = await protectedUserIds(ids, req.session.userId);
    ids = ids.filter(id => !protectedIds.has(id));
  }
  if (ids.length === 0) { res.json({ ok: true, count: 0, skippedAdmins: rawIds.length }); return; }

  if (action === "suspend") {
    await db.update(usersTable).set({ status: "blocked" }).where(inArray(usersTable.id, ids));
  } else if (action === "unsuspend") {
    await db.update(usersTable).set({ status: "active" }).where(inArray(usersTable.id, ids));
  } else {
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
  }
  res.json({ ok: true, count: ids.length, skippedAdmins: rawIds.length - ids.length });
});

router.patch("/users/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!current) { res.status(404).json({ error: "User not found" }); return; }

  const { name, plan, status, credits, creditsDelta, extendDays, planExpiresAt, applyPlanCredits } = req.body;
  const updates: Record<string, any> = {};

  if (name !== undefined) updates.name = name;
  if (plan !== undefined) updates.plan = plan;
  if (status !== undefined) {
    if (status !== "active" && status !== "blocked") { res.status(400).json({ error: "status must be 'active' or 'blocked'" }); return; }
    if (status === "blocked" && (isUserAdmin(current) || current.id === req.session.userId)) {
      res.status(400).json({ error: "Admin accounts cannot be suspended" }); return;
    }
    updates.status = status;
  }

  // Absolute credit set
  if (credits !== undefined) {
    const n = Number(credits);
    if (!Number.isFinite(n) || n < 0) { res.status(400).json({ error: "credits must be a non-negative number" }); return; }
    updates.credits = Math.floor(n);
  }

  // Relative credit add (+) / deduct (-).
  if (creditsDelta !== undefined) {
    const d = Number(creditsDelta);
    if (!Number.isFinite(d)) { res.status(400).json({ error: "creditsDelta must be a number" }); return; }
    if (updates.credits !== undefined) {
      // Combined with an absolute set in the same request — apply on top of it.
      updates.credits = Math.max(0, Number(updates.credits) + Math.floor(d));
    } else {
      // Atomic relative adjustment so concurrent admin actions don't lose updates.
      updates.credits = sql`GREATEST(0, ${usersTable.credits} + ${Math.floor(d)})`;
    }
  }

  // Grant the credits + 30d expiry that belong to a plan
  if (applyPlanCredits) {
    const targetPlan = (updates.plan ?? current.plan) as string;
    updates.plan = targetPlan;
    updates.credits = planCredits(targetPlan);
    updates.planExpiresAt = addDays(new Date(), PLAN_DURATION_DAYS);
  }

  // Extend expiry by N days (from the later of now / current expiry)
  if (extendDays !== undefined) {
    const days = Number(extendDays);
    if (!Number.isFinite(days)) { res.status(400).json({ error: "extendDays must be a number" }); return; }
    const start = current.planExpiresAt && current.planExpiresAt.getTime() > Date.now()
      ? current.planExpiresAt
      : new Date();
    updates.planExpiresAt = addDays(start, days);
  }

  // Explicit expiry set / clear
  if (planExpiresAt !== undefined) {
    updates.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
  }

  if (Object.keys(updates).length === 0) { res.json(serializeUser(current)); return; }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  res.json(serializeUser(updated));
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [target] = await db.select({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin })
    .from(usersTable).where(eq(usersTable.id, id));
  if (target && (isUserAdmin(target) || target.id === req.session.userId)) {
    res.status(400).json({ error: "Admin accounts cannot be deleted" }); return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

/* ── Orders ─────────────────────────────────────────────────────────── */
// Plans that may be purchased/ordered (free is never an order).
const PAID_PLANS = new Set(["starter", "pro", "max"]);

router.get("/orders", async (_req, res) => {
  // Never select proof_data (bytea) here; expose only a hasProof flag.
  const orders = await db.select({
    id: ordersTable.id,
    userId: ordersTable.userId,
    plan: ordersTable.plan,
    status: ordersTable.status,
    notes: ordersTable.notes,
    adminNote: ordersTable.adminNote,
    planCredits: ordersTable.planCredits,
    durationDays: ordersTable.durationDays,
    currency: ordersTable.currency,
    amountMinor: ordersTable.amountMinor,
    paymentMethodId: ordersTable.paymentMethodId,
    paymentMethodSnapshot: ordersTable.paymentMethodSnapshot,
    customerName: ordersTable.customerName,
    customerEmail: ordersTable.customerEmail,
    whatsapp: ordersTable.whatsapp,
    transactionReference: ordersTable.transactionReference,
    proofMime: ordersTable.proofMime,
    proofFilename: ordersTable.proofFilename,
    proofSize: ordersTable.proofSize,
    reviewedBy: ordersTable.reviewedBy,
    reviewedAt: ordersTable.reviewedAt,
    createdAt: ordersTable.createdAt,
    updatedAt: ordersTable.updatedAt,
  }).from(ordersTable).orderBy(desc(ordersTable.createdAt));

  const usersMap: Record<number, { name: string; email: string }> = {};
  if (orders.length > 0) {
    const userRows = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable);
    for (const u of userRows) usersMap[u.id] = { name: u.name, email: u.email };
  }

  res.json(orders.map(o => ({
    ...o,
    hasProof: o.proofSize != null && o.proofSize > 0,
    userName: usersMap[o.userId]?.name ?? "Unknown",
    userEmail: usersMap[o.userId]?.email ?? o.customerEmail ?? "",
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    reviewedAt: o.reviewedAt?.toISOString() ?? null,
  })));
});

router.post("/orders", async (req, res) => {
  const { userId, plan, notes } = req.body;
  if (!userId || !plan) { res.status(400).json({ error: "userId and plan required" }); return; }
  if (!PAID_PLANS.has(String(plan))) { res.status(400).json({ error: "Invalid plan" }); return; }
  const [order] = await db.insert(ordersTable).values({
    userId: Number(userId),
    plan: String(plan),
    notes: notes != null ? String(notes).slice(0, 2000) : null,
  }).returning();
  res.status(201).json({ ...order, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString() });
});

router.patch("/orders/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, adminNote } = req.body ?? {};
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    return;
  }
  const note = adminNote !== undefined
    ? (typeof adminNote === "string" ? adminNote.trim().slice(0, 2000) : null)
    : undefined;

  const reviewerId = req.appUser?.id ?? req.session.userId ?? null;

  try {
    const result = await db.transaction(async (tx) => {
      // Lock the order row; only a pending order may be finalized.
      const [order] = await tx.select().from(ordersTable)
        .where(eq(ordersTable.id, id))
        .for("update");
      if (!order) return { notFound: true as const };
      if (order.status !== "pending") return { conflict: true as const };

      const now = new Date();
      const updates: Record<string, unknown> = {
        status,
        reviewedBy: reviewerId,
        reviewedAt: now,
        updatedAt: now,
      };
      if (note !== undefined) updates.adminNote = note;

      if (status === "approved") {
        const credits = order.planCredits ?? planCredits(order.plan);
        const days = order.durationDays ?? PLAN_DURATION_DAYS;
        await tx.update(usersTable).set({
          plan: order.plan,
          credits,
          planExpiresAt: addDays(now, days),
          status: "active",
        }).where(eq(usersTable.id, order.userId));
      }

      const [updated] = await tx.update(ordersTable).set(updates)
        .where(and(eq(ordersTable.id, id), eq(ordersTable.status, "pending")))
        .returning();
      // If the conditional update matched nothing, another tx finalized it.
      if (!updated) return { conflict: true as const };
      return { updated };
    });

    if ("notFound" in result) { res.status(404).json({ error: "Order not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: "This order has already been reviewed" }); return; }
    const u = result.updated;

    // Notify the customer by email (fire-and-forget; must never block the API).
    (async () => {
      const [target] = await db.select().from(usersTable).where(eq(usersTable.id, u.userId));
      if (!target) return;
      const to = u.customerEmail || target.email;
      const t = status === "approved"
        ? orderApprovedEmail(target.name, u.plan, u.planCredits ?? planCredits(u.plan), target.planExpiresAt)
        : orderRejectedEmail(target.name, u.plan, u.adminNote ?? null);
      await sendEmail(to, t.subject, t.html);
    })().catch((err) => req.log.warn({ err }, "Order review email failed"));
    res.json({
      ...u,
      proofData: undefined,
      hasProof: u.proofSize != null && u.proofSize > 0,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      reviewedAt: u.reviewedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to review order");
    res.status(500).json({ error: "Failed to review order" });
  }
});

router.delete("/orders/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Never delete a pending order — it must be approved or rejected first.
  const deleted = await db.delete(ordersTable)
    .where(and(eq(ordersTable.id, id), ne(ordersTable.status, "pending")))
    .returning({ id: ordersTable.id });
  if (deleted.length === 0) {
    // Distinguish "not found" from "still pending".
    const [existing] = await db.select({ status: ordersTable.status })
      .from(ordersTable).where(eq(ordersTable.id, id));
    if (existing && existing.status === "pending") {
      res.status(409).json({ error: "Cannot delete a pending order. Approve or reject it first." });
      return;
    }
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.status(204).send();
});

/* ── Generations list ───────────────────────────────────────────────── */
router.get("/generations", async (req, res) => {
  const rows = await db.select().from(generationsTable)
    .orderBy(desc(generationsTable.createdAt)).limit(100);
  res.json(rows.map(g => ({
    id: g.id, text: g.text.slice(0, 80), voiceName: g.voiceName,
    characterCount: g.characterCount, modelId: g.modelId,
    provider: g.provider ?? "elevenlabs",
    createdAt: g.createdAt.toISOString(),
  })));
});

/* ── Voice clones list ──────────────────────────────────────────────── */
router.get("/clones", async (req, res) => {
  const rows = await db.select().from(voiceClonesTable)
    .orderBy(desc(voiceClonesTable.createdAt));
  res.json(rows.map(c => ({
    id: c.id, name: c.name, voiceId: c.voiceId,
    description: c.description,
    createdAt: c.createdAt.toISOString(),
  })));
});

/* ── Overview ───────────────────────────────────────────────────────── */
router.get("/overview", async (_req, res) => {
  const now = new Date();
  const dayAgo = new Date(Date.now() - 24 * 3600e3);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600e3);

  const [users] = await db.select({ n: count() }).from(usersTable);
  const [paidUsers] = await db.select({ n: count() }).from(usersTable)
    .where(and(ne(usersTable.plan, "free"), sql`(${usersTable.planExpiresAt} IS NULL OR ${usersTable.planExpiresAt} > ${now})`));
  const [suspended] = await db.select({ n: count() }).from(usersTable).where(eq(usersTable.status, "blocked"));
  const [newToday] = await db.select({ n: count() }).from(usersTable).where(sql`${usersTable.createdAt} > ${dayAgo}`);
  const [newWeek] = await db.select({ n: count() }).from(usersTable).where(sql`${usersTable.createdAt} > ${weekAgo}`);
  const [gens] = await db.select({ n: count(), chars: sum(generationsTable.characterCount) }).from(generationsTable);
  const [gens24h] = await db.select({ n: count() }).from(generationsTable).where(sql`${generationsTable.createdAt} > ${dayAgo}`);
  const [pendingOrders] = await db.select({ n: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [openTickets] = await db.select({ n: count() }).from(supportTicketsTable).where(eq(supportTicketsTable.status, "open"));
  const [activeKeys] = await db.select({ n: count() }).from(apiKeysTable).where(eq(apiKeysTable.isActive, true));

  // Revenue estimate from approved orders (plan price at approval time not stored,
  // so current USD prices are used).
  const approved = await db.select({ plan: ordersTable.plan, n: count() }).from(ordersTable)
    .where(eq(ordersTable.status, "approved")).groupBy(ordersTable.plan);
  let revenueUsd = 0;
  for (const r of approved) revenueUsd += (PLAN_PRICE_USD[r.plan as PlanId] ?? 0) * Number(r.n);

  const planRows = await db.select({ plan: usersTable.plan, n: count() }).from(usersTable).groupBy(usersTable.plan);
  const planCounts: Record<string, number> = {};
  for (const r of planRows) planCounts[r.plan] = Number(r.n);

  res.json({
    totalUsers: users.n,
    paidUsers: paidUsers.n,
    suspendedUsers: suspended.n,
    newUsersToday: newToday.n,
    newUsersWeek: newWeek.n,
    totalGenerations: gens.n,
    totalCharacters: Number(gens.chars ?? 0),
    generations24h: gens24h.n,
    pendingOrders: pendingOrders.n,
    openTickets: openTickets.n,
    activeKeys: activeKeys.n,
    revenueUsd: Math.round(revenueUsd * 100) / 100,
    planCounts,
  });
});

/* ── Analytics ──────────────────────────────────────────────────────── */
router.get("/analytics", async (_req, res) => {
  const signupsDaily = await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS n
    FROM users WHERE created_at > now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`);
  const signupsMonthly = await db.execute(sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS n
    FROM users WHERE created_at > now() - interval '12 months'
    GROUP BY 1 ORDER BY 1`);
  const gensDaily = await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           count(*)::int AS n, coalesce(sum(character_count),0)::bigint AS chars
    FROM generations WHERE created_at > now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`);
  const revenueMonthly = await db.execute(sql`
    SELECT to_char(date_trunc('month', updated_at), 'YYYY-MM') AS month, plan, count(*)::int AS n
    FROM orders WHERE status = 'approved' AND updated_at > now() - interval '12 months'
    GROUP BY 1, 2 ORDER BY 1`);

  const revenueByMonth: Record<string, number> = {};
  for (const r of revenueMonthly.rows as any[]) {
    revenueByMonth[r.month] = (revenueByMonth[r.month] ?? 0) + (PLAN_PRICE_USD[r.plan as PlanId] ?? 0) * Number(r.n);
  }

  const planRows = await db.select({ plan: usersTable.plan, n: count() }).from(usersTable).groupBy(usersTable.plan);

  res.json({
    signupsDaily: signupsDaily.rows,
    signupsMonthly: signupsMonthly.rows,
    generationsDaily: (gensDaily.rows as any[]).map(r => ({ day: r.day, n: r.n, chars: Number(r.chars) })),
    revenueMonthly: Object.entries(revenueByMonth).map(([month, usd]) => ({ month, usd: Math.round(usd * 100) / 100 })),
    planDistribution: planRows.map(r => ({ plan: r.plan, n: Number(r.n) })),
  });
});

/* ── Promo codes ────────────────────────────────────────────────────── */
router.get("/promos", async (_req, res) => {
  const rows = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  res.json(rows.map(p => ({
    id: p.id, code: p.code, credits: p.credits,
    maxRedemptions: p.maxRedemptions, redemptionCount: p.redemptionCount,
    isActive: p.isActive,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/promos", async (req, res) => {
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const credits = Math.floor(Number(req.body?.credits));
  const maxRedemptions = req.body?.maxRedemptions != null && req.body.maxRedemptions !== ""
    ? Math.floor(Number(req.body.maxRedemptions)) : null;
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  if (!code || code.length < 3) { res.status(400).json({ error: "Code must be at least 3 characters" }); return; }
  if (!Number.isFinite(credits) || credits <= 0) { res.status(400).json({ error: "Credits must be a positive number" }); return; }
  try {
    const [created] = await db.insert(promoCodesTable)
      .values({ code, credits, maxRedemptions, expiresAt }).returning();
    res.status(201).json({ id: created.id, code: created.code });
  } catch {
    res.status(400).json({ error: "This code already exists" });
  }
});

router.patch("/promos/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const updates: Record<string, any> = {};
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
  if (req.body?.credits !== undefined) updates.credits = Math.floor(Number(req.body.credits));
  if (req.body?.maxRedemptions !== undefined) {
    updates.maxRedemptions = req.body.maxRedemptions === "" || req.body.maxRedemptions == null
      ? null : Math.floor(Number(req.body.maxRedemptions));
  }
  if (req.body?.expiresAt !== undefined) updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
  const [updated] = await db.update(promoCodesTable).set(updates).where(eq(promoCodesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

router.delete("/promos/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
  await db.delete(promoRedemptionsTable).where(eq(promoRedemptionsTable.codeId, id));
  res.status(204).send();
});

router.get("/promos/:id/redemptions", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select({
    id: promoRedemptionsTable.id,
    userId: promoRedemptionsTable.userId,
    createdAt: promoRedemptionsTable.createdAt,
    name: usersTable.name,
    email: usersTable.email,
  }).from(promoRedemptionsTable)
    .leftJoin(usersTable, eq(usersTable.id, promoRedemptionsTable.userId))
    .where(eq(promoRedemptionsTable.codeId, id))
    .orderBy(desc(promoRedemptionsTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id, userId: r.userId, name: r.name ?? "Deleted user", email: r.email ?? "",
    createdAt: r.createdAt.toISOString(),
  })));
});

/* ── Notifications (admin send) ─────────────────────────────────────── */
router.post("/notifications", async (req, res) => {
  const title = String(req.body?.title ?? "").trim().slice(0, 200);
  const body = String(req.body?.body ?? "").trim().slice(0, 2000);
  const target = req.body?.target; // "all" | number[] (user ids)
  if (!title) { res.status(400).json({ error: "Title required" }); return; }

  let userIds: number[];
  if (target === "all") {
    const rows = await db.select({ id: usersTable.id }).from(usersTable);
    userIds = rows.map(r => r.id);
  } else if (Array.isArray(target)) {
    // Deduplicate and keep only ids that actually exist.
    const requested = [...new Set(target.map(Number).filter(Number.isFinite))] as number[];
    const rows = requested.length
      ? await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, requested))
      : [];
    userIds = rows.map(r => r.id);
  } else {
    res.status(400).json({ error: "target must be 'all' or an array of user ids" }); return;
  }
  if (userIds.length === 0) { res.status(400).json({ error: "No matching users found" }); return; }

  const CHUNK = 500;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    await db.insert(notificationsTable).values(
      userIds.slice(i, i + CHUNK).map(userId => ({ userId, title, body })),
    );
  }
  res.status(201).json({ ok: true, sent: userIds.length });
});

router.get("/notifications", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT title, body, count(*)::int AS recipients,
           count(read_at)::int AS read,
           max(created_at) AS created_at
    FROM notifications
    GROUP BY title, body ORDER BY max(created_at) DESC LIMIT 50`);
  res.json((rows.rows as any[]).map(r => ({
    title: r.title, body: r.body, recipients: r.recipients, read: r.read,
    createdAt: new Date(r.created_at).toISOString(),
  })));
});

/* ── Support (admin side) ───────────────────────────────────────────── */
router.get("/support", async (req, res) => {
  const status = String(req.query.status ?? "").trim();
  const where = status ? eq(supportTicketsTable.status, status) : undefined;
  const rows = await db.select({
    id: supportTicketsTable.id,
    subject: supportTicketsTable.subject,
    status: supportTicketsTable.status,
    createdAt: supportTicketsTable.createdAt,
    updatedAt: supportTicketsTable.updatedAt,
    userId: supportTicketsTable.userId,
    name: usersTable.name,
    email: usersTable.email,
  }).from(supportTicketsTable)
    .leftJoin(usersTable, eq(usersTable.id, supportTicketsTable.userId))
    .where(where)
    .orderBy(desc(supportTicketsTable.updatedAt)).limit(200);
  res.json(rows.map(t => ({
    id: t.id, subject: t.subject, status: t.status, userId: t.userId,
    userName: t.name ?? "Deleted user", userEmail: t.email ?? "",
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  })));
});

router.get("/support/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, ticket.userId));
  const messages = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id)).orderBy(supportMessagesTable.createdAt);
  res.json({
    id: ticket.id, subject: ticket.subject, status: ticket.status,
    userName: user?.name ?? "Deleted user", userEmail: user?.email ?? "",
    createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
    messages: messages.map(m => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() })),
  });
});

router.post("/support/:id/reply", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = String(req.body?.message ?? "").trim().slice(0, 5000);
  if (isNaN(id) || !body) { res.status(400).json({ error: "Message required" }); return; }
  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(supportMessagesTable).values({ ticketId: id, sender: "admin", body });
  await db.update(supportTicketsTable).set({ status: "answered", updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  // Notify the user in-app.
  await db.insert(notificationsTable).values({
    userId: ticket.userId,
    title: `Support replied: ${ticket.subject}`.slice(0, 200),
    body: body.slice(0, 500),
  });
  res.status(201).json({ ok: true });
});

router.patch("/support/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const status = String(req.body?.status ?? "");
  if (isNaN(id) || !["open", "answered", "closed"].includes(status)) {
    res.status(400).json({ error: "status must be open, answered or closed" }); return;
  }
  await db.update(supportTicketsTable).set({ status, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  res.json({ ok: true });
});

router.delete("/support/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(supportTicketsTable).where(eq(supportTicketsTable.id, id));
  await db.delete(supportMessagesTable).where(eq(supportMessagesTable.ticketId, id));
  res.status(204).send();
});

/* ── Settings ───────────────────────────────────────────────────────── */
router.get("/settings", async (_req, res) => {
  const out: Record<string, unknown> = {};
  for (const key of knownSettingKeys()) out[key] = await getSetting(key);
  res.json(out);
});

router.put("/settings/:key", async (req, res) => {
  const key = req.params.key;
  if (!knownSettingKeys().includes(key)) { res.status(400).json({ error: "Unknown setting" }); return; }
  let value = req.body?.value;
  if (key === "payment_methods") {
    try {
      value = normalizePaymentMethods(value);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid payment methods" });
      return;
    }
  }
  await setSetting(key, value);
  res.json({ ok: true, [key]: await getSetting(key) });
});

/* ── OpenSpeaker: task inspection + provider balance ─────────────────── */
router.get("/os/tasks", async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50")) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0")) || 0);
  const tool = typeof req.query.tool === "string" && req.query.tool ? req.query.tool : null;
  const where = tool ? eq(osTasksTable.tool, tool) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db.select({
      id: osTasksTable.id,
      tool: osTasksTable.tool,
      status: osTasksTable.status,
      title: osTasksTable.title,
      creditsCharged: osTasksTable.creditsCharged,
      refunded: osTasksTable.refunded,
      error: osTasksTable.error,
      createdAt: osTasksTable.createdAt,
      userId: osTasksTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
    }).from(osTasksTable)
      .leftJoin(usersTable, eq(osTasksTable.userId, usersTable.id))
      .where(where)
      .orderBy(desc(osTasksTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(osTasksTable).where(where),
  ]);
  res.json({
    items: items.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
    total,
  });
});

router.get("/os/credits", async (_req, res) => {
  res.json({ credits: await getProviderCredits() });
});

/* ── Anti-abuse: multiple accounts from the same signup IP ──────────── */
router.get("/abuse", async (_req, res) => {
  const groups = await db.execute(sql`
    SELECT signup_ip, count(*)::int AS n
    FROM users WHERE signup_ip IS NOT NULL AND signup_ip <> ''
    GROUP BY signup_ip HAVING count(*) > 1
    ORDER BY count(*) DESC LIMIT 100`);
  const ips = (groups.rows as any[]).map(g => g.signup_ip as string);
  let members: any[] = [];
  if (ips.length > 0) {
    members = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      plan: usersTable.plan, status: usersTable.status,
      signupIp: usersTable.signupIp, createdAt: usersTable.createdAt,
    }).from(usersTable).where(and(isNotNull(usersTable.signupIp), inArray(usersTable.signupIp, ips)));
  }
  const byIp: Record<string, any[]> = {};
  for (const m of members) {
    (byIp[m.signupIp!] ??= []).push({
      id: m.id, name: m.name, email: m.email, plan: m.plan, status: m.status,
      createdAt: m.createdAt.toISOString(),
    });
  }
  res.json((groups.rows as any[]).map(g => ({
    ip: g.signup_ip, count: g.n,
    users: (byIp[g.signup_ip] ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  })));
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

/* ═══════════════ Resellers ═══════════════ */

router.get("/resellers", async (_req, res) => {
  const resellers = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    resellerCredits: usersTable.resellerCredits,
    resellerExpiresAt: usersTable.resellerExpiresAt,
    status: usersTable.status,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.isReseller, true)).orderBy(desc(usersTable.createdAt));

  const counts = await db.select({ resellerId: usersTable.resellerId, n: count() })
    .from(usersTable).where(sql`${usersTable.resellerId} IS NOT NULL`).groupBy(usersTable.resellerId);
  const countMap = new Map(counts.map(c => [c.resellerId, Number(c.n)]));
  res.json(resellers.map(r => ({ ...r, userCount: countMap.get(r.id) ?? 0 })));
});

router.post("/resellers", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const credits = Number(req.body?.credits);
  const expiresAt = req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : null;

  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) { res.status(400).json({ error: "Valid name and email required" }); return; }
  if (isAdminEmail(email)) { res.status(400).json({ error: "This email is reserved for an admin account" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  if (!Number.isFinite(credits) || credits <= 0 || !Number.isInteger(credits)) {
    res.status(400).json({ error: "Credits must be a positive whole number" }); return;
  }
  if (expiresAt && isNaN(expiresAt.getTime())) { res.status(400).json({ error: "Invalid expiry date" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const [reseller] = await db.insert(usersTable).values({
      name, email, passwordHash,
      isReseller: true,
      resellerCredits: credits,
      resellerExpiresAt: expiresAt,
      plan: "free",
      credits: 0,
    }).returning();
    res.status(201).json({ id: reseller.id, name: reseller.name, email: reseller.email, resellerCredits: reseller.resellerCredits });
  } catch (e: any) {
    // drizzle wraps pg errors — the code lives on e.cause, not e itself
    const code = e?.code ?? e?.cause?.code;
    if (code === "23505" || String(e?.cause?.message ?? e?.message ?? "").includes("users_email_idx")) {
      res.status(400).json({ error: "This email is already registered" }); return;
    }
    throw e;
  }
});

/* Add (or subtract with negative) credits to a reseller's pool */
router.post("/resellers/:id/credits", async (req, res) => {
  const id = parseInt(String(req.params.id));
  const credits = Number(req.body?.credits);
  if (isNaN(id) || !Number.isFinite(credits) || !Number.isInteger(credits) || credits === 0) {
    res.status(400).json({ error: "Credits must be a non-zero whole number" }); return;
  }
  const updated = await db.update(usersTable)
    .set({ resellerCredits: sql`GREATEST(${usersTable.resellerCredits} + ${credits}, 0)` })
    .where(and(eq(usersTable.id, id), eq(usersTable.isReseller, true)))
    .returning({ resellerCredits: usersTable.resellerCredits });
  if (updated.length === 0) { res.status(404).json({ error: "Reseller not found" }); return; }
  res.json({ ok: true, resellerCredits: updated[0].resellerCredits });
});

/* Update reseller expiry */
router.patch("/resellers/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const updates: Record<string, unknown> = {};
  if ("expiresAt" in (req.body ?? {})) {
    const expiresAt = req.body.expiresAt ? new Date(String(req.body.expiresAt)) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) { res.status(400).json({ error: "Invalid expiry date" }); return; }
    updates.resellerExpiresAt = expiresAt;
  }
  if (req.body?.status === "active" || req.body?.status === "blocked") updates.status = req.body.status;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const updated = await db.update(usersTable).set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.isReseller, true)))
    .returning({ id: usersTable.id });
  if (updated.length === 0) { res.status(404).json({ error: "Reseller not found" }); return; }
  res.json({ ok: true });
});

export default router;
