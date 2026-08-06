import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable, usersTable } from "@workspace/db";
import { eq, asc, and, sql, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";
import { modelAllowedForPlan } from "../lib/plans";

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

const FISH_BASE = "https://api.fish.audio/v1";
const FISH_PUBLIC_BASE = "https://api.fish.audio";

interface FishCreds { id: number; apiKey: string; usageCount: number; isFree?: boolean; }

/** Returns [freeKey | null, paidKey | null] */
async function getFishKeys(): Promise<{ free: FishCreds | null; paid: FishCreds | null }> {
  const freeEnv = process.env.FISH_AUDIO_API_KEY_FREE;
  const paidEnv = process.env.FISH_AUDIO_API_KEY;
  const free: FishCreds | null = freeEnv ? { id: 0, apiKey: freeEnv, usageCount: 0, isFree: true } : null;
  const paid: FishCreds | null = paidEnv ? { id: 0, apiKey: paidEnv, usageCount: 0 } : null;

  if (free || paid) return { free, paid };

  // Fall back to DB keys
  const keys = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.provider, "fishaudio"), eq(apiKeysTable.isActive, true)))
    .orderBy(asc(apiKeysTable.usageCount));
  const dbKey = keys[0] ? { id: keys[0].id, apiKey: keys[0].key, usageCount: keys[0].usageCount } : null;
  return { free: null, paid: dbKey };
}

/** Primary: try free key, fallback to paid if 402 */
async function getFishApiKey(): Promise<FishCreds | null> {
  const { free, paid } = await getFishKeys();
  return free ?? paid;
}

async function bumpKey(id: number, current: number) {
  if (id === 0) return;
  await db.update(apiKeysTable)
    .set({ usageCount: current + 1, lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, id));
}

const FALLBACK_VOICES = [
  { id: "default", name: "Default Voice", lang: "All Languages", style: "Neutral" },
];

/* ── GET /voices ─────────────────────────────────────────────────────── */
router.get("/voices", requireActiveUser, async (req, res) => {
  const language = typeof req.query.language === "string" ? req.query.language : "";
  const page = parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10) || 1;
  const pageSize = 50;
  const creds = await getFishApiKey();

  const params = new URLSearchParams({
    page_size: String(pageSize),
    page_number: String(page),
    sort_by: "task_count",
    type: "tts",
  });
  if (language) params.set("language", language);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (creds) headers.Authorization = `Bearer ${creds.apiKey}`;

  try {
    const response = await fetch(`${FISH_PUBLIC_BASE}/model?${params.toString()}`, { headers });

    if (!response.ok) {
      res.json({ voices: FALLBACK_VOICES, total: 0, page, pageSize });
      return;
    }

    const data = await response.json() as any;
    const items: any[] = data?.items ?? [];
    const total: number = data?.total ?? 0;

    const voices = items.map((v: any) => ({
      id: v._id as string,
      name: v.title as string,
      lang: (v.languages as string[])?.[0] ?? "Multi",
      languages: v.languages as string[] ?? [],
      style: (v.tags as string[])?.[0] ?? "Voice",
      tags: v.tags as string[] ?? [],
      description: v.description as string ?? null,
      preview: (v.samples as any[])?.[0]?.audio ?? null,
      likeCount: v.like_count as number ?? 0,
      taskCount: v.task_count as number ?? 0,
    }));

    res.json({ voices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (e) {
    logger.warn({ err: e }, "Fish Audio voices fetch failed, using fallback");
    res.json({ voices: FALLBACK_VOICES, total: 0, page: 1, pageSize });
  }
});

/* ── POST /tts ───────────────────────────────────────────────────────── */
router.post("/tts", requireActiveUser, async (req, res) => {
  const { text, voiceId, speed = 1 } = req.body;

  // Always use the free model for all users — zero cost on Fish Audio side
  const model = "s2.1-pro-free";

  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const user = req.appUser!;
  const admin = isUserAdmin(user);

  const { free, paid } = await getFishKeys();
  if (!free && !paid) {
    res.status(503).json({ error: "No Fish Audio API key configured. Add FISH_AUDIO_API_KEY in Secrets." });
    return;
  }

  if (!admin && !(await reserveCredits(user.id, text.length))) {
    res.status(402).json({ error: `Not enough credits. Needed: ${text.length}, available: ${user.credits}.` });
    return;
  }

  try {
    const body: Record<string, unknown> = {
      text,
      format: "mp3",
      latency: "normal",
      ...(speed !== 1 && { prosody: { speed } }),
    };

    if (voiceId && voiceId !== "default") {
      body.reference_id = voiceId;
    }

    async function callFishTTS(apiKey: string) {
      return fetch(`${FISH_BASE}/tts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          model,
        },
        body: JSON.stringify(body),
      });
    }

    // Try free key first, fall back to paid if free returns 402 (not activated yet)
    let response = free ? await callFishTTS(free.apiKey) : null;
    let usedCreds: FishCreds | null = free ?? null;

    if (response?.status === 402 && paid) {
      logger.info("Free Fish Audio key returned 402 — falling back to paid key");
      response = await callFishTTS(paid.apiKey);
      usedCreds = paid;
    }

    if (!response || !response.ok) {
      const errText = await response?.text() ?? "No response";
      logger.warn({ status: response?.status, errText }, "Fish Audio TTS failed");
      if (!admin) await refundCredits(user.id, text.length);
      res.status(502).json({ error: "Fish Audio error: " + errText });
      return;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (usedCreds) await bumpKey(usedCreds.id, usedCreds.usageCount);

    res.set({ "Content-Type": "audio/mpeg", "Content-Disposition": "attachment; filename=fishaudio-tts.mp3" });
    res.send(audioBuffer);
  } catch (e: any) {
    if (!admin) await refundCredits(user.id, text.length);
    logger.error({ err: e }, "Fish Audio TTS error");
    res.status(500).json({ error: e.message });
  }
});

export default router;
