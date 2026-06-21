import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, generationsTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";
import {
  CreateApiKeyBody,
  UpdateApiKeyBody,
  UpdateApiKeyParams,
  DeleteApiKeyParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/keys", async (req, res) => {
  const keys = await db
    .select()
    .from(apiKeysTable)
    .orderBy(apiKeysTable.createdAt);

  res.json(
    keys.map((k) => ({
      id: k.id,
      label: k.label,
      keyPreview: maskKey(k.key),
      isActive: k.isActive,
      usageCount: k.usageCount,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    }))
  );
});

router.post("/keys", async (req, res) => {
  const parsed = CreateApiKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { label, key } = parsed.data;
  const [created] = await db
    .insert(apiKeysTable)
    .values({ label, key })
    .returning();

  res.status(201).json({
    id: created.id,
    label: created.label,
    keyPreview: maskKey(created.key),
    isActive: created.isActive,
    usageCount: created.usageCount,
    lastUsedAt: created.lastUsedAt?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
  });
});

router.patch("/keys/:id", async (req, res) => {
  const paramsParsed = UpdateApiKeyParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateApiKeyBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updates: Partial<{ label: string; isActive: boolean }> = {};
  if (bodyParsed.data.label !== undefined) updates.label = bodyParsed.data.label;
  if (bodyParsed.data.isActive !== undefined) updates.isActive = bodyParsed.data.isActive;

  const [updated] = await db
    .update(apiKeysTable)
    .set(updates)
    .where(eq(apiKeysTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.json({
    id: updated.id,
    label: updated.label,
    keyPreview: maskKey(updated.key),
    isActive: updated.isActive,
    usageCount: updated.usageCount,
    lastUsedAt: updated.lastUsedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/keys/:id", async (req, res) => {
  const paramsParsed = DeleteApiKeyParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, paramsParsed.data.id));
  res.status(204).send();
});

router.get("/stats", async (req, res) => {
  const [keyStats] = await db
    .select({
      totalKeys: count(),
    })
    .from(apiKeysTable);

  const [activeStats] = await db
    .select({ activeKeys: count() })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.isActive, true));

  const [genStats] = await db
    .select({
      totalGenerations: count(),
      totalCharacters: sum(generationsTable.characterCount),
    })
    .from(generationsTable);

  res.json({
    totalKeys: keyStats.totalKeys,
    activeKeys: activeStats.activeKeys,
    totalGenerations: genStats.totalGenerations,
    totalCharacters: Number(genStats.totalCharacters ?? 0),
  });
});

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export default router;
