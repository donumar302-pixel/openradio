import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";
import { reserveCredits, refundCredits } from "./openspeaker";

/**
 * AI Script Writer — generates voiceover scripts with OpenAI (works on any
 * host, including Railway, via OPENAI_API_KEY). Flat credit cost per script,
 * charged with the same atomic reserve → provider → refund-on-failure flow
 * used by the voice tools.
 */

const router: IRouter = Router();
router.use(requireActiveUser);

export const SCRIPT_CREDITS = 10;

const LENGTHS: Record<string, { label: string; maxTokens: number }> = {
  short: { label: "about 30 seconds (roughly 70-90 words)", maxTokens: 400 },
  medium: { label: "about 1 minute (roughly 140-170 words)", maxTokens: 700 },
  long: { label: "about 2-3 minutes (roughly 350-450 words)", maxTokens: 1400 },
};

router.post("/generate", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: "Script Writer is not configured yet. Please contact support." });
    return;
  }
  const topic = String(req.body?.topic ?? "").trim();
  if (!topic || topic.length > 600) {
    res.status(400).json({ error: "Please describe your topic (up to 600 characters)." });
    return;
  }
  const language = String(req.body?.language ?? "English").trim().slice(0, 40) || "English";
  const tone = String(req.body?.tone ?? "conversational").trim().slice(0, 40) || "conversational";
  const length = LENGTHS[String(req.body?.length ?? "medium")] ?? LENGTHS.medium;

  const user = req.appUser!;
  const admin = isUserAdmin(user);
  if (!admin && !(await reserveCredits(user.id, SCRIPT_CREDITS))) {
    res.status(402).json({ error: `Not enough credits. Script generation costs ${SCRIPT_CREDITS} credits.` });
    return;
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: length.maxTokens,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: "You are a professional voiceover script writer. Write scripts that sound natural when read aloud by a text-to-speech engine: short sentences, natural rhythm, no stage directions, no markdown, no headings, no emojis, no [brackets]. Return ONLY the script text.",
          },
          {
            role: "user",
            content: `Write a voiceover script in ${language} with a ${tone} tone, ${length.label} long, about:\n\n${topic}`,
          },
        ],
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      logger.warn({ status: resp.status, body: body.slice(0, 300) }, "OpenAI script generation failed");
      throw new Error("The AI writer is temporarily unavailable. Please try again.");
    }
    const data: any = await resp.json();
    const script = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!script) throw new Error("The AI writer returned an empty script. Please try again.");
    res.json({ script, creditsCharged: admin ? 0 : SCRIPT_CREDITS });
  } catch (err: any) {
    if (!admin) await refundCredits(user.id, SCRIPT_CREDITS);
    res.status(502).json({ error: err.message || "Script generation failed. You were not charged." });
  }
});

export default router;
