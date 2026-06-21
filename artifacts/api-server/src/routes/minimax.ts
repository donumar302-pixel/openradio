import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { apiKeysTable, voiceClonesTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const MINIMAX_BASE = "https://api.minimaxi.chat/v1";

async function getMinimaxKey() {
  const keys = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.provider, "minimax"), eq(apiKeysTable.isActive, true)))
    .orderBy(asc(apiKeysTable.usageCount));
  return keys[0] ?? null;
}

async function bumpKey(id: number, current: number) {
  await db.update(apiKeysTable)
    .set({ usageCount: current + 1, lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, id));
}

// key format: "groupId:apiKey"
function parseKey(raw: string): { groupId: string; apiKey: string } {
  const [groupId, ...rest] = raw.split(":");
  return { groupId: groupId ?? "", apiKey: rest.join(":") };
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
router.get("/voices", async (req, res) => {
  const clones = await db.select().from(voiceClonesTable).orderBy(asc(voiceClonesTable.createdAt));
  res.json({
    builtin: BUILTIN_VOICES,
    clones: clones.map((c) => ({
      id: c.voiceId,
      name: c.name,
      description: c.description,
      isClone: true,
    })),
  });
});

/* ── POST /tts ────────────────────────────────────────────────────────── */
router.post("/tts", async (req, res) => {
  const { text, voiceId, model = "speech-02-hd", speed = 1, volume = 1, pitch = 0 } = req.body;

  if (!text || !voiceId) {
    res.status(400).json({ error: "text and voiceId are required" });
    return;
  }

  const keyRow = await getMinimaxKey();
  if (!keyRow) {
    res.status(503).json({ error: "No active MiniMax API key configured. Please add one in Admin → MiniMax Keys." });
    return;
  }

  const { groupId, apiKey } = parseKey(keyRow.key);

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
      res.status(502).json({ error: data?.base_resp?.status_msg || "MiniMax error" });
      return;
    }

    // Decode hex audio
    const hexAudio: string = data?.data?.audio ?? "";
    if (!hexAudio) {
      res.status(502).json({ error: "No audio data returned from MiniMax" });
      return;
    }

    const audioBuffer = Buffer.from(hexAudio, "hex");
    await bumpKey(keyRow.id, keyRow.usageCount);

    res.set({ "Content-Type": "audio/mpeg", "Content-Disposition": "attachment; filename=minimax-tts.mp3" });
    res.send(audioBuffer);
  } catch (e: any) {
    logger.error({ err: e }, "MiniMax TTS error");
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /voice-clone ────────────────────────────────────────────────── */
router.post("/voice-clone", upload.single("audio"), async (req, res) => {
  const { name, description } = req.body;
  const file = req.file;

  if (!file || !name) {
    res.status(400).json({ error: "Audio file and name are required" });
    return;
  }

  const keyRow = await getMinimaxKey();
  if (!keyRow) {
    res.status(503).json({ error: "No active MiniMax API key configured." });
    return;
  }

  const { groupId, apiKey } = parseKey(keyRow.key);

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

    // Save clone to DB
    const [saved] = await db.insert(voiceClonesTable)
      .values({ name, voiceId, description: description || null })
      .returning();

    await bumpKey(keyRow.id, keyRow.usageCount);

    res.status(201).json({ id: saved.id, name: saved.name, voiceId: saved.voiceId, description: saved.description });
  } catch (e: any) {
    logger.error({ err: e }, "MiniMax voice clone error");
    res.status(500).json({ error: e.message });
  }
});

/* ── DELETE /voice-clone/:id ──────────────────────────────────────────── */
router.delete("/voice-clone/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(voiceClonesTable).where(eq(voiceClonesTable.id, id));
  res.json({ success: true });
});

export default router;
