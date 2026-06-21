import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, generationsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { logger } from "../lib/logger";
import { GenerateSpeechBody } from "@workspace/api-zod";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const audioDir = path.resolve(workspaceRoot, "artifacts/api-server/audio");

async function ensureAudioDir() {
  await fs.mkdir(audioDir, { recursive: true });
}

async function getNextActiveKey() {
  const keys = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.isActive, true))
    .orderBy(asc(apiKeysTable.usageCount));

  return keys[0] ?? null;
}

router.post("/", async (req, res) => {
  const parsed = GenerateSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { text, voiceId, stability, similarityBoost, modelId } = parsed.data;

  const apiKey = await getNextActiveKey();
  if (!apiKey) {
    res.status(503).json({ error: "No active API keys configured. Please ask the admin to add an API key." });
    return;
  }

  const model = modelId ?? "eleven_multilingual_v2";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey.key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: stability ?? 0.5,
            similarity_boost: similarityBoost ?? 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({ status: response.status, errorText }, "ElevenLabs TTS failed");
      res.status(502).json({ error: "ElevenLabs API error. Please check your API key." });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    await ensureAudioDir();
    const filename = `gen_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`;
    const filePath = path.join(audioDir, filename);
    await fs.writeFile(filePath, Buffer.from(audioBuffer));

    const audioUrl = `/api/audio/${filename}`;

    const voiceName = req.body.voiceName ?? voiceId;

    const [gen] = await db
      .insert(generationsTable)
      .values({
        text,
        voiceId,
        voiceName,
        characterCount: text.length,
        audioUrl,
        modelId: model,
        apiKeyId: apiKey.id,
      })
      .returning();

    await db
      .update(apiKeysTable)
      .set({
        usageCount: apiKey.usageCount + 1,
        lastUsedAt: new Date(),
      })
      .where(eq(apiKeysTable.id, apiKey.id));

    res.json({
      generationId: gen.id,
      audioUrl,
      characterCount: text.length,
    });
  } catch (err) {
    logger.error({ err }, "TTS generation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
