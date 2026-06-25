import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { apiKeysTable, generationsTable, usersTable } from "@workspace/db";
import { eq, asc, sql, and, gte } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { logger } from "../lib/logger";
import { GenerateSpeechBody } from "@workspace/api-zod";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";
import { planAllowsFeature, modelAllowedForPlan, type FeatureKey } from "../lib/plans";

const router = Router();

router.use(requireActiveUser);

// Block free-plan users from paid-only features. Admins always pass.
function requireFeature(feature: FeatureKey) {
  return (req: any, res: any, next: any) => {
    const user = req.appUser!;
    if (!isUserAdmin(user) && !planAllowsFeature(user.plan, feature)) {
      res.status(403).json({ error: "This is a paid feature. Please upgrade your plan to use it." });
      return;
    }
    next();
  };
}

// Atomically reserve credits before calling the provider so concurrent
// requests can never overspend. Returns false if the balance is insufficient.
async function reserveCredits(userId: number, amount: number): Promise<boolean> {
  const rows = await db.update(usersTable).set({
    credits: sql`${usersTable.credits} - ${amount}`,
    creditsUsed: sql`${usersTable.creditsUsed} + ${amount}`,
  }).where(and(eq(usersTable.id, userId), gte(usersTable.credits, amount)))
    .returning({ id: usersTable.id });
  return rows.length > 0;
}

async function refundCredits(userId: number, amount: number) {
  await db.update(usersTable).set({
    credits: sql`${usersTable.credits} + ${amount}`,
    creditsUsed: sql`GREATEST(0, ${usersTable.creditsUsed} - ${amount})`,
  }).where(eq(usersTable.id, userId));
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

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
    .where(and(eq(apiKeysTable.isActive, true), eq(apiKeysTable.provider, "elevenlabs")))
    .orderBy(asc(apiKeysTable.usageCount));
  return keys[0] ?? null;
}

async function bumpKeyUsage(id: number, current: number) {
  await db.update(apiKeysTable).set({ usageCount: current + 1, lastUsedAt: new Date() }).where(eq(apiKeysTable.id, id));
}

function noKey(res: any) {
  res.status(503).json({ error: "No active API keys configured. Please ask the admin to add an API key." });
}

/* ── Text to Speech ────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const parsed = GenerateSpeechBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const { text, voiceId, stability, similarityBoost, modelId } = parsed.data;

  const user = req.appUser!;
  const admin = isUserAdmin(user);

  if (!admin && modelId && !modelAllowedForPlan(user.plan, "elevenlabs", modelId)) {
    res.status(403).json({ error: "This model requires a paid plan. Please upgrade your plan." });
    return;
  }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  if (!admin && !(await reserveCredits(user.id, text.length))) {
    res.status(402).json({ error: `Not enough credits. This needs ${text.length} credits but you have ${user.credits}.` });
    return;
  }

  const model = modelId ?? "eleven_multilingual_v2";
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: stability ?? 0.5, similarity_boost: similarityBoost ?? 0.75 } }),
    });
    if (!response.ok) {
      if (!admin) await refundCredits(user.id, text.length);
      logger.warn({ status: response.status }, "ElevenLabs TTS failed");
      res.status(502).json({ error: "ElevenLabs API error. Please check your API key." });
      return;
    }
    const audioBuffer = await response.arrayBuffer();
    await ensureAudioDir();
    const filename = `gen_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`;
    await fs.writeFile(path.join(audioDir, filename), Buffer.from(audioBuffer));
    const audioUrl = `/api/audio/${filename}`;
    const voiceName = req.body.voiceName ?? voiceId;
    const [gen] = await db.insert(generationsTable).values({ text, voiceId, voiceName, characterCount: text.length, audioUrl, modelId: model, apiKeyId: apiKey.id, userId: user.id }).returning();
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
    res.json({ generationId: gen.id, audioUrl, characterCount: text.length });
  } catch (err) {
    if (!admin) await refundCredits(user.id, text.length);
    logger.error({ err }, "TTS generation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Speech to Speech ─────────────────────────────────────────────────── */
router.post("/speech-to-speech", requireFeature("speech-to-speech"), upload.single("audio"), async (req, res) => {
  const { voiceId, stability = "0.5", similarityBoost = "0.75" } = req.body;
  if (!req.file || !voiceId) { res.status(400).json({ error: "audio file and voiceId are required" }); return; }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  try {
    const form = new FormData();
    form.append("audio", new Blob([req.file.buffer as any], { type: req.file.mimetype }), req.file.originalname);
    form.append("model_id", "eleven_english_sts_v2");
    form.append("voice_settings", JSON.stringify({ stability: parseFloat(stability), similarity_boost: parseFloat(similarityBoost) }));

    const response = await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey.key, Accept: "audio/mpeg" },
      body: form,
    });
    if (!response.ok) {
      const txt = await response.text();
      logger.warn({ status: response.status, txt }, "ElevenLabs STS failed");
      res.status(502).json({ error: "ElevenLabs API error" });
      return;
    }
    const buf = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buf));
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
  } catch (err) {
    logger.error({ err }, "STS error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Speech to Text ───────────────────────────────────────────────────── */
router.post("/speech-to-text", requireFeature("speech-to-text"), upload.single("audio"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "audio file required" }); return; }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer as any], { type: req.file.mimetype }), req.file.originalname);
    form.append("model_id", "scribe_v1");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey.key },
      body: form,
    });
    if (!response.ok) {
      const txt = await response.text();
      logger.warn({ status: response.status, txt }, "ElevenLabs STT failed");
      res.status(502).json({ error: "ElevenLabs API error" });
      return;
    }
    const data = await response.json() as { text?: string };
    res.json({ text: data.text ?? "" });
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
  } catch (err) {
    logger.error({ err }, "STT error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Sound Effects ────────────────────────────────────────────────────── */
router.post("/sound-effects", requireFeature("sound-effects"), async (req, res) => {
  const { prompt, durationSeconds = 5 } = req.body;
  if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": apiKey.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds }),
    });
    if (!response.ok) {
      const txt = await response.text();
      logger.warn({ status: response.status, txt }, "ElevenLabs sound effects failed");
      res.status(502).json({ error: "ElevenLabs API error" });
      return;
    }
    const buf = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buf));
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
  } catch (err) {
    logger.error({ err }, "Sound effects error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Audio Isolation ──────────────────────────────────────────────────── */
router.post("/audio-isolation", requireFeature("audio-isolation"), upload.single("audio"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "audio file required" }); return; }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  try {
    const form = new FormData();
    form.append("audio", new Blob([req.file.buffer as any], { type: req.file.mimetype }), req.file.originalname);

    const response = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
      method: "POST",
      headers: { "xi-api-key": apiKey.key, Accept: "audio/mpeg" },
      body: form,
    });
    if (!response.ok) {
      const txt = await response.text();
      logger.warn({ status: response.status, txt }, "ElevenLabs audio isolation failed");
      res.status(502).json({ error: "ElevenLabs API error" });
      return;
    }
    const buf = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buf));
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
  } catch (err) {
    logger.error({ err }, "Audio isolation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Music Generation ─────────────────────────────────────────────────── */
router.post("/music", requireFeature("music"), async (req, res) => {
  const { prompt, durationSeconds = 30 } = req.body;
  if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": apiKey.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: prompt, duration_seconds: Math.min(durationSeconds, 22) }),
    });
    if (!response.ok) {
      const txt = await response.text();
      logger.warn({ status: response.status, txt }, "ElevenLabs music failed");
      res.status(502).json({ error: "ElevenLabs API error" });
      return;
    }
    const buf = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buf));
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
  } catch (err) {
    logger.error({ err }, "Music generation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Dubbing ──────────────────────────────────────────────────────────── */
router.post("/dubbing", requireFeature("dubbing"), upload.single("file"), async (req, res) => {
  const { sourceLanguage = "en", targetLanguage } = req.body;
  if (!req.file || !targetLanguage) { res.status(400).json({ error: "file and targetLanguage are required" }); return; }

  const apiKey = await getNextActiveKey();
  if (!apiKey) { noKey(res); return; }

  try {
    const createForm = new FormData();
    createForm.append("file", new Blob([req.file.buffer as any], { type: req.file.mimetype }), req.file.originalname);
    createForm.append("source_lang", sourceLanguage);
    createForm.append("target_lang", targetLanguage);
    createForm.append("mode", "automatic");

    const createRes = await fetch("https://api.elevenlabs.io/v1/dubbing", {
      method: "POST",
      headers: { "xi-api-key": apiKey.key },
      body: createForm,
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      logger.warn({ status: createRes.status, txt }, "ElevenLabs dubbing create failed");
      res.status(502).json({ error: "ElevenLabs API error" });
      return;
    }
    const { dubbing_id } = await createRes.json() as { dubbing_id: string };

    // Poll for completion
    let status = "dubbing";
    let attempts = 0;
    while (status !== "dubbed" && attempts < 60) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}`, {
        headers: { "xi-api-key": apiKey.key },
      });
      if (statusRes.ok) {
        const s = await statusRes.json() as { status: string };
        status = s.status;
      }
      attempts++;
    }

    if (status !== "dubbed") {
      res.status(504).json({ error: "Dubbing timed out. Please try again." });
      return;
    }

    const audioRes = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}/audio/${targetLanguage}`, {
      headers: { "xi-api-key": apiKey.key },
    });
    if (!audioRes.ok) {
      res.status(502).json({ error: "Failed to fetch dubbed audio" });
      return;
    }
    const buf = await audioRes.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buf));
    await bumpKeyUsage(apiKey.id, apiKey.usageCount);
  } catch (err) {
    logger.error({ err }, "Dubbing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
