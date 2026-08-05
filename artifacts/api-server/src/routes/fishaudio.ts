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

interface FishCreds { id: number; apiKey: string; usageCount: number; }

async function getFishApiKey(): Promise<FishCreds | null> {
  if (process.env.FISH_AUDIO_API_KEY) {
    return { id: 0, apiKey: process.env.FISH_AUDIO_API_KEY, usageCount: 0 };
  }
  const keys = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.provider, "fishaudio"), eq(apiKeysTable.isActive, true)))
    .orderBy(asc(apiKeysTable.usageCount));
  if (keys[0]) return { id: keys[0].id, apiKey: keys[0].key, usageCount: keys[0].usageCount };
  return null;
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
  const creds = await getFishApiKey();

  const params = new URLSearchParams({
    page_size: "50",
    sort_by: "task_count",
  });
  if (language) params.set("language", language);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (creds) headers.Authorization = `Bearer ${creds.apiKey}`;

  try {
    const response = await fetch(`${FISH_PUBLIC_BASE}/model?${params.toString()}`, { headers });

    if (!response.ok) {
      res.json({ voices: FALLBACK_VOICES });
      return;
    }

    const data = await response.json() as any;
    const items: any[] = data?.items ?? [];

    const voices = [
      ...FALLBACK_VOICES,
      ...items.map((v: any) => ({
        id: v._id as string,
        name: v.title as string,
        lang: (v.languages as string[])?.[0] ?? "Multi",
        style: (v.tags as string[])?.[0] ?? "Voice",
      })),
    ];

    res.json({ voices });
  } catch (e) {
    logger.warn({ err: e }, "Fish Audio voices fetch failed, using fallback");
    res.json({ voices: FALLBACK_VOICES });
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

  const creds = await getFishApiKey();
  if (!creds) {
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

    const response = await fetch(`${FISH_BASE}/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
        model,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn({ status: response.status, errText }, "Fish Audio TTS failed");
      if (!admin) await refundCredits(user.id, text.length);
      res.status(502).json({ error: "Fish Audio error: " + errText });
      return;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await bumpKey(creds.id, creds.usageCount);

    res.set({ "Content-Type": "audio/mpeg", "Content-Disposition": "attachment; filename=fishaudio-tts.mp3" });
    res.send(audioBuffer);
  } catch (e: any) {
    if (!admin) await refundCredits(user.id, text.length);
    logger.error({ err: e }, "Fish Audio TTS error");
    res.status(500).json({ error: e.message });
  }
});

export default router;
