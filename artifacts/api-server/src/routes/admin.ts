import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, generationsTable, usersTable, voiceClonesTable } from "@workspace/db";
import { eq, count, sum, desc } from "drizzle-orm";
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
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  })));
});

router.post("/keys", async (req, res) => {
  const parsed = CreateApiKeyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const { label, key } = parsed.data;
  const [created] = await db.insert(apiKeysTable).values({ label, key }).returning();
  res.status(201).json({
    id: created.id, label: created.label, keyPreview: maskKey(created.key),
    isActive: created.isActive, usageCount: created.usageCount,
    lastUsedAt: created.lastUsedAt?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
  });
});

router.patch("/keys/:id", async (req, res) => {
  const paramsParsed = UpdateApiKeyParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const bodyParsed = UpdateApiKeyBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const updates: Partial<{ label: string; isActive: boolean }> = {};
  if (bodyParsed.data.label !== undefined) updates.label = bodyParsed.data.label;
  if (bodyParsed.data.isActive !== undefined) updates.isActive = bodyParsed.data.isActive;
  const [updated] = await db.update(apiKeysTable).set(updates)
    .where(eq(apiKeysTable.id, paramsParsed.data.id)).returning();
  if (!updated) { res.status(404).json({ error: "Key not found" }); return; }
  res.json({
    id: updated.id, label: updated.label, keyPreview: maskKey(updated.key),
    isActive: updated.isActive, usageCount: updated.usageCount,
    lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/keys/:id", async (req, res) => {
  const paramsParsed = DeleteApiKeyParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, paramsParsed.data.id));
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

  res.json({
    totalKeys: keyStats.totalKeys,
    activeKeys: activeStats.activeKeys,
    totalGenerations: genStats.totalGenerations,
    totalCharacters: Number(genStats.totalCharacters ?? 0),
    totalUsers: userStats.totalUsers,
    totalClones: cloneStats.totalClones,
  });
});

/* ── Users ─────────────────────────────────────────────────────────── */
router.get("/users", async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(u => ({
    ...u, createdAt: u.createdAt.toISOString(),
  })));
});

/* ── Generations list ───────────────────────────────────────────────── */
router.get("/generations", async (req, res) => {
  const rows = await db.select().from(generationsTable)
    .orderBy(desc(generationsTable.createdAt)).limit(100);
  res.json(rows.map(g => ({
    id: g.id, text: g.text.slice(0, 80), voiceName: g.voiceName,
    characterCount: g.characterCount, modelId: g.modelId,
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
