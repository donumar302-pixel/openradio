import { Router } from "express";
import { db } from "@workspace/db";
import { generationsTable } from "@workspace/db";
import { desc, count, eq } from "drizzle-orm";
import { ListGenerationsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const userId = req.session.userId;

  const parsed = ListGenerationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }

  const { limit = 20, offset = 0 } = parsed.data;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.userId, userId))
      .orderBy(desc(generationsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(generationsTable).where(eq(generationsTable.userId, userId)),
  ]);

  res.json({
    items: items.map((g) => ({
      id: g.id,
      text: g.text,
      voiceId: g.voiceId,
      voiceName: g.voiceName,
      characterCount: g.characterCount,
      audioUrl: g.audioUrl,
      modelId: g.modelId ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
    total,
  });
});

export default router;
