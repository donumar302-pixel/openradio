import { Router } from "express";
import { db } from "@workspace/db";
import { generationsTable } from "@workspace/db";
import { desc, count } from "drizzle-orm";
import { ListGenerationsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
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
      .orderBy(desc(generationsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(generationsTable),
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
