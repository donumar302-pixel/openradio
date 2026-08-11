import { Router } from "express";
import { tts, getVoices } from "edge-tts";
import { db, usersTable } from "@workspace/db";
import { eq, sql, gte, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";

const router = Router();

// Cache voices list for 1 hour
let voicesCache: Awaited<ReturnType<typeof getVoices>> | null = null;
let voicesCachedAt = 0;

async function getCachedVoices() {
  if (voicesCache && Date.now() - voicesCachedAt < 3_600_000) return voicesCache;
  voicesCache = await getVoices();
  voicesCachedAt = Date.now();
  return voicesCache;
}

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

/* ── GET /edge/voices ─────────────────────────────────────────────────── */
router.get("/voices", requireActiveUser, async (req, res) => {
  const { language, gender, search } = req.query as Record<string, string>;
  try {
    let voices = await getCachedVoices();

    if (language) voices = voices.filter(v => v.Locale.toLowerCase().startsWith(language.toLowerCase()));
    if (gender)   voices = voices.filter(v => v.Gender.toLowerCase() === gender.toLowerCase());
    if (search)   voices = voices.filter(v =>
      v.FriendlyName.toLowerCase().includes(search.toLowerCase()) ||
      v.Locale.toLowerCase().includes(search.toLowerCase())
    );

    const formatted = voices.map(v => ({
      id: `edge:${v.ShortName}`,
      name: v.FriendlyName,
      shortName: v.ShortName,
      locale: v.Locale,
      gender: v.Gender,
      provider: "edge",
    }));

    res.json({ voices: formatted, total: formatted.length });
  } catch (e: any) {
    logger.error({ err: e }, "Edge TTS getVoices failed");
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /edge/tts ───────────────────────────────────────────────────── */
router.post("/tts", requireActiveUser, async (req, res) => {
  const { text, voiceId, rate, pitch } = req.body as {
    text: string; voiceId?: string; rate?: string; pitch?: string;
  };

  if (!text) { res.status(400).json({ error: "text is required" }); return; }

  const user = req.appUser!;
  const admin = isUserAdmin(user);

  // Edge TTS is FREE — charge minimal 1 credit per request to track usage
  const creditCost = Math.max(1, Math.ceil(text.length / 500));

  if (!admin && !(await reserveCredits(user.id, creditCost))) {
    res.status(402).json({ error: `Not enough credits. Needed: ${creditCost}` });
    return;
  }

  // Strip "edge:" prefix if present
  const voice = (voiceId ?? "en-US-AriaNeural").replace(/^edge:/, "");

  try {
    const audioBuffer = await tts(text, {
      voice,
      ...(rate  && { rate }),
      ...(pitch && { pitch }),
    });

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename=openradio-edge.mp3`,
    });
    res.send(audioBuffer);
  } catch (e: any) {
    if (!admin) await refundCredits(user.id, creditCost);
    logger.error({ err: e }, "Edge TTS failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
