import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { apiKeysTable, voiceClonesTable, usersTable } from "@workspace/db";
import { eq, asc, and, sql, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";
import { planAllowsFeature, modelAllowedForPlan } from "../lib/plans";
import { requireFeature } from "../middleware/require-feature";
import { CLONE_CONSENT_TEXT } from "../lib/consent";

const router = Router();

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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const MINIMAX_BASE = "https://api.minimaxi.chat/v1";

interface MinimaxCreds { id: number; groupId: string; apiKey: string; usageCount: number; }

async function getMinimaxCreds(): Promise<MinimaxCreds | null> {
  // Option 1: two separate env vars (recommended)
  if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID) {
    return { id: 0, groupId: process.env.MINIMAX_GROUP_ID, apiKey: process.env.MINIMAX_API_KEY, usageCount: 0 };
  }
  // Option 2: combined env var "groupId:apiKey"
  if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY.includes(":")) {
    const [groupId, ...rest] = process.env.MINIMAX_API_KEY.split(":");
    return { id: 0, groupId: groupId ?? "", apiKey: rest.join(":"), usageCount: 0 };
  }
  // Option 3: DB key added via Admin panel (format: groupId:apiKey)
  const keys = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.provider, "minimax"), eq(apiKeysTable.isActive, true)))
    .orderBy(asc(apiKeysTable.usageCount));
  if (keys[0]) {
    const [groupId, ...rest] = keys[0].key.split(":");
    return { id: keys[0].id, groupId: groupId ?? "", apiKey: rest.join(":"), usageCount: keys[0].usageCount };
  }
  return null;
}

async function bumpKey(id: number, current: number) {
  if (id === 0) return; // env-var key — no DB row to update
  await db.update(apiKeysTable)
    .set({ usageCount: current + 1, lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, id));
}

/* ── Built-in voices list ─────────────────────────────────────────────── */
const BUILTIN_VOICES = [
  { id: "Calm_Woman",         name: "Calm Woman",          lang: "English", style: "Calm" },
  { id: "Calm_Man",           name: "Calm Man",            lang: "English", style: "Calm" },
  { id: "Energetic_Man",      name: "Energetic Man",       lang: "English", style: "Energetic" },
  { id: "Energetic_Woman",    name: "Energetic Woman",     lang: "English", style: "Energetic" },
  { id: "Gentle_Man",         name: "Gentle Man",          lang: "English", style: "Gentle" },
  { id: "Gentle_Woman",       name: "Gentle Woman",        lang: "English", style: "Gentle" },
  { id: "Young_Man",          name: "Young Man",           lang: "English", style: "Young" },
  { id: "Young_Woman",        name: "Young Woman",         lang: "English", style: "Young" },
  { id: "Old_Man",            name: "Old Man",             lang: "English", style: "Mature" },
  { id: "Old_Woman",          name: "Old Woman",           lang: "English", style: "Mature" },
  { id: "News_Man",           name: "News Anchor (Male)",  lang: "English", style: "Professional" },
  { id: "News_Woman",         name: "News Anchor (Female)",lang: "English", style: "Professional" },
  { id: "Documentary_Man",    name: "Documentary (Male)",  lang: "English", style: "Professional" },
  { id: "Documentary_Woman",  name: "Documentary (Female)",lang: "English", style: "Professional" },
  { id: "Narration_Man",      name: "Narration (Male)",    lang: "English", style: "Narration" },
  { id: "Narration_Woman",    name: "Narration (Female)",  lang: "English", style: "Narration" },
  { id: "AR_Male_Warm",       name: "Arabic Male Warm",    lang: "Arabic",  style: "Warm" },
  { id: "AR_Female_Soft",     name: "Arabic Female Soft",  lang: "Arabic",  style: "Soft" },
  { id: "ZH_Male_Calm",       name: "Chinese Male Calm",   lang: "Chinese", style: "Calm" },
  { id: "ZH_Female_Sweet",    name: "Chinese Female Sweet",lang: "Chinese", style: "Sweet" },
  { id: "ES_Male_Bold",       name: "Spanish Male Bold",   lang: "Spanish", style: "Bold" },
  { id: "ES_Female_Bright",   name: "Spanish Female Bright",lang:"Spanish", style: "Bright" },
  { id: "FR_Male_Elegant",    name: "French Male Elegant", lang: "French",  style: "Elegant" },
  { id: "FR_Female_Soft",     name: "French Female Soft",  lang: "French",  style: "Soft" },
  { id: "DE_Male_Strong",     name: "German Male Strong",  lang: "German",  style: "Strong" },
  { id: "JP_Male_Calm",       name: "Japanese Male Calm",  lang: "Japanese",style: "Calm" },
  { id: "JP_Female_Sweet",    name: "Japanese Female Sweet",lang:"Japanese",style: "Sweet" },
  { id: "KR_Male_Bold",       name: "Korean Male Bold",    lang: "Korean",  style: "Bold" },
  { id: "KR_Female_Bright",   name: "Korean Female Bright",lang: "Korean",  style: "Bright" },
  { id: "HI_Male_Warm",       name: "Hindi Male Warm",     lang: "Hindi",   style: "Warm" },
  { id: "HI_Female_Soft",     name: "Hindi Female Soft",   lang: "Hindi",   style: "Soft" },
  { id: "PT_Male_Bold",       name: "Portuguese Male",     lang: "Portuguese",style:"Bold" },
  { id: "IT_Male_Elegant",    name: "Italian Male Elegant",lang: "Italian", style: "Elegant" },
  { id: "RU_Male_Deep",       name: "Russian Male Deep",   lang: "Russian", style: "Deep" },
];

/* ── GET /voices ──────────────────────────────────────────────────────── */
router.get("/voices", requireActiveUser, async (req, res) => {
  const clones = await db.select().from(voiceClonesTable)
    .where(and(eq(voiceClonesTable.userId, req.appUser!.id), eq(voiceClonesTable.provider, "minimax")))
    .orderBy(asc(voiceClonesTable.createdAt));
  res.json({
    builtin: BUILTIN_VOICES,
    clones: clones.map((c) => ({
      id: c.voiceId,      // kept as the TTS voice id for the voice selectors
      dbId: c.id,         // database primary key (used for deletion)
      voiceId: c.voiceId,
      name: c.name,
      description: c.description,
      isClone: true,
    })),
  });
});

/* ── POST /tts ────────────────────────────────────────────────────────── */
router.post("/tts", requireActiveUser, async (req, res) => {
  const { text, voiceId, model = "speech-02-hd", speed = 1, volume = 1, pitch = 0 } = req.body;

  if (!text || !voiceId) {
    res.status(400).json({ error: "text and voiceId are required" });
    return;
  }

  const user = req.appUser!;
  const admin = isUserAdmin(user);

  if (!admin && !modelAllowedForPlan(user.plan, "minimax", model)) {
    res.status(403).json({ error: "This model requires a paid plan. Please upgrade your plan." });
    return;
  }

  const creds = await getMinimaxCreds();
  if (!creds) {
    res.status(503).json({ error: "No active MiniMax API key configured. Add MINIMAX_API_KEY + MINIMAX_GROUP_ID in Secrets." });
    return;
  }

  if (!admin && !(await reserveCredits(user.id, text.length))) {
    res.status(402).json({ error: `Not enough credits. This needs ${text.length} credits but you have ${user.credits}.` });
    return;
  }

  const { groupId, apiKey } = creds;

  try {
    const response = await fetch(`${MINIMAX_BASE}/t2a_v2?GroupId=${groupId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        text,
        stream: false,
        voice_setting: { voice_id: voiceId, speed, vol: volume, pitch },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn({ status: response.status, errText }, "MiniMax TTS failed");
      res.status(502).json({ error: "MiniMax API error: " + errText });
      return;
    }

    const data = await response.json() as any;
    if (data?.base_resp?.status_code !== 0) {
      if (!admin) await refundCredits(user.id, text.length);
      res.status(502).json({ error: data?.base_resp?.status_msg || "MiniMax error" });
      return;
    }

    // Decode hex audio
    const hexAudio: string = data?.data?.audio ?? "";
    if (!hexAudio) {
      if (!admin) await refundCredits(user.id, text.length);
      res.status(502).json({ error: "No audio data returned from MiniMax" });
      return;
    }

    const audioBuffer = Buffer.from(hexAudio, "hex");
    await bumpKey(creds.id, creds.usageCount);

    res.set({ "Content-Type": "audio/mpeg", "Content-Disposition": "attachment; filename=minimax-tts.mp3" });
    res.send(audioBuffer);
  } catch (e: any) {
    if (!admin) await refundCredits(user.id, text.length);
    logger.error({ err: e }, "MiniMax TTS error");
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /voice-clone ────────────────────────────────────────────────── */
router.post("/voice-clone", requireFeature("voice-cloning"), requireActiveUser, async (req, res, next) => {
  const user = req.appUser!;
  if (!isUserAdmin(user) && !planAllowsFeature(user.plan, "voice-cloning")) {
    res.status(403).json({ error: "Voice Cloning is a paid feature. Please upgrade your plan." });
    return;
  }
  next();
}, upload.single("audio"), async (req, res) => {
  const { name, description } = req.body;
  const file = req.file;

  if (!file || !name) {
    res.status(400).json({ error: "Audio file and name are required" });
    return;
  }
  if (String(req.body?.consent ?? "") !== "true") {
    res.status(400).json({ error: "You must confirm you have the right to clone this voice." });
    return;
  }

  const creds = await getMinimaxCreds();
  if (!creds) {
    res.status(503).json({ error: "No active MiniMax API key configured." });
    return;
  }

  const { groupId, apiKey } = creds;

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    form.append("file", blob, file.originalname || "voice.mp3");
    form.append("voice_name", name);

    const response = await fetch(`${MINIMAX_BASE}/voice_clone?GroupId=${groupId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "MiniMax clone error: " + errText });
      return;
    }

    const data = await response.json() as any;
    if (data?.base_resp?.status_code !== 0) {
      res.status(502).json({ error: data?.base_resp?.status_msg || "Clone failed" });
      return;
    }

    const voiceId: string = data?.voice_id ?? "";
    if (!voiceId) {
      res.status(502).json({ error: "No voice ID returned" });
      return;
    }

    // Save clone to DB (scoped to the creating user) with the consent attestation
    const [saved] = await db.insert(voiceClonesTable)
      .values({
        name,
        voiceId,
        description: description || null,
        userId: req.appUser!.id,
        consentAt: new Date(),
        consentText: CLONE_CONSENT_TEXT,
      })
      .returning();

    await bumpKey(creds.id, creds.usageCount);

    res.status(201).json({ id: saved.id, name: saved.name, voiceId: saved.voiceId, description: saved.description });
  } catch (e: any) {
    logger.error({ err: e }, "MiniMax voice clone error");
    res.status(500).json({ error: e.message });
  }
});

/* ── DELETE /voice-clone/:id ──────────────────────────────────────────── */
router.delete("/voice-clone/:id", requireFeature("voice-cloning"), requireActiveUser, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const user = req.appUser!;
  // Admins may delete any MiniMax clone; everyone else only their own.
  // Provider filter keeps this endpoint from touching OpenSpeaker clones,
  // which need provider-side cleanup via /api/os/voice-clones.
  const where = isUserAdmin(user)
    ? and(eq(voiceClonesTable.id, id), eq(voiceClonesTable.provider, "minimax"))
    : and(eq(voiceClonesTable.id, id), eq(voiceClonesTable.userId, user.id), eq(voiceClonesTable.provider, "minimax"));
  const deleted = await db.delete(voiceClonesTable).where(where).returning({ id: voiceClonesTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Voice clone not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
