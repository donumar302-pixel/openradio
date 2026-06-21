import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, generationsTable, usersTable, voiceClonesTable, ordersTable } from "@workspace/db";
import { eq, count, sum, desc, and } from "drizzle-orm";
import {
  CreateApiKeyBody,
  UpdateApiKeyBody,
  UpdateApiKeyParams,
  DeleteApiKeyParams,
} from "@workspace/api-zod";

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
  const id = parseInt(req.params.id);
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
  const id = parseInt(req.params.id);
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
router.get("/users", async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    plan: usersTable.plan,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.patch("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, plan } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (plan !== undefined) updates.plan = plan;
  const [updated] = await db.update(usersTable).set(updates)
    .where(eq(usersTable.id, id)).returning({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      plan: usersTable.plan, createdAt: usersTable.createdAt,
    });
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

/* ── Orders ─────────────────────────────────────────────────────────── */
router.get("/orders", async (req, res) => {
  const orders = await db.select({
    id: ordersTable.id,
    userId: ordersTable.userId,
    plan: ordersTable.plan,
    status: ordersTable.status,
    notes: ordersTable.notes,
    adminNote: ordersTable.adminNote,
    createdAt: ordersTable.createdAt,
    updatedAt: ordersTable.updatedAt,
  }).from(ordersTable).orderBy(desc(ordersTable.createdAt));

  const userIds = [...new Set(orders.map(o => o.userId))];
  let usersMap: Record<number, { name: string; email: string }> = {};
  if (userIds.length > 0) {
    const userRows = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable);
    for (const u of userRows) usersMap[u.id] = { name: u.name, email: u.email };
  }

  res.json(orders.map(o => ({
    ...o,
    userName: usersMap[o.userId]?.name ?? "Unknown",
    userEmail: usersMap[o.userId]?.email ?? "",
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  })));
});

router.post("/orders", async (req, res) => {
  const { userId, plan, notes } = req.body;
  if (!userId || !plan) { res.status(400).json({ error: "userId and plan required" }); return; }
  const [order] = await db.insert(ordersTable).values({ userId: Number(userId), plan, notes }).returning();
  res.status(201).json({ ...order, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString() });
});

router.patch("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { status, adminNote } = req.body;
  if (!status) { res.status(400).json({ error: "status required" }); return; }

  const updates: Record<string, any> = { status, updatedAt: new Date() };
  if (adminNote !== undefined) updates.adminNote = adminNote;

  if (status === "approved") {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (order) {
      await db.update(usersTable).set({ plan: order.plan }).where(eq(usersTable.id, order.userId));
    }
  }

  const [updated] = await db.update(ordersTable).set(updates)
    .where(eq(ordersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Order not found" }); return; }
  res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
});

router.delete("/orders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(ordersTable).where(eq(ordersTable.id, id));
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

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export default router;
