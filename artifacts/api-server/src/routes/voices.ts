import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (req, res) => {
  const activeKeys = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.isActive, true));

  if (activeKeys.length === 0) {
    res.status(503).json({ error: "No active API keys configured" });
    return;
  }

  const key = activeKeys[0];

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": key.key,
      },
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "ElevenLabs voices fetch failed");
      res.status(502).json({ error: "Failed to fetch voices from ElevenLabs" });
      return;
    }

    const data = (await response.json()) as {
      voices: Array<{
        voice_id: string;
        name: string;
        category?: string;
        description?: string;
        preview_url?: string;
      }>;
    };

    const voices = data.voices.map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category ?? "general",
      description: v.description ?? null,
      previewUrl: v.preview_url ?? null,
    }));

    res.json(voices);
  } catch (err) {
    logger.error({ err }, "Error fetching voices");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
