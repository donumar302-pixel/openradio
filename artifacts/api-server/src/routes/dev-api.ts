import { Router, type IRouter } from "express";
import { db, usersTable, userApiKeysTable, osTasksTable, voiceClonesTable } from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { isUserAdmin } from "../middleware/require-active-user";
import { osPostForm, osGetJson, OpenSpeakerError, isValidOsVoiceId, isOsVoiceProvider } from "../lib/openspeaker";
import {
  reserveCredits, refundCredits, refreshTask, taskJson,
  elLocalQuery, assertCloneOwnership,
} from "./openspeaker";
import { hashApiKey } from "./api-keys";

/**
 * Public Developer API (v1). Authenticated with per-user API keys
 * (`Authorization: Bearer orv_...`) — no session/cookies. Paid plans only.
 * Generation goes through the same OpenSpeaker task pipeline as the web app,
 * so credits, history, webhooks and the abandoned-task sweep all apply.
 */

const router: IRouter = Router();

/* ── Key authentication ──────────────────────────────────────────────── */

router.use(async (req: any, res, next) => {
  const header = String(req.headers.authorization ?? "");
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key || !key.startsWith("orv_")) {
    res.status(401).json({ error: "Missing API key. Send it as: Authorization: Bearer orv_..." });
    return;
  }
  try {
    const [keyRow] = await db.select().from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.keyHash, hashApiKey(key)), isNull(userApiKeysTable.revokedAt)));
    if (!keyRow) { res.status(401).json({ error: "Invalid or revoked API key." }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, keyRow.userId));
    if (!user || user.status !== "active") {
      res.status(403).json({ error: "This account is not active." });
      return;
    }
    const admin = isUserAdmin(user);
    if (!admin && user.plan === "free") {
      res.status(403).json({ error: "The Developer API requires a paid plan." });
      return;
    }
    if (!admin && user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) {
      res.status(403).json({ error: "Your plan has expired. Please renew to keep using the API." });
      return;
    }

    req.appUser = user;
    req.apiKeyRow = keyRow;

    // Touch lastUsedAt at most once a minute per key (fire-and-forget).
    if (!keyRow.lastUsedAt || Date.now() - keyRow.lastUsedAt.getTime() > 60_000) {
      db.update(userApiKeysTable).set({ lastUsedAt: new Date() })
        .where(eq(userApiKeysTable.id, keyRow.id)).catch(() => {});
    }
    next();
  } catch (err) {
    logger.error({ err }, "Dev API auth failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Simple per-key rate limit (in-memory) ───────────────────────────── */

const RATE_LIMIT = 60; // requests per minute per key
const rateBuckets = new Map<number, { count: number; resetAt: number }>();

router.use((req: any, res, next) => {
  const id = req.apiKeyRow.id as number;
  const now = Date.now();
  let bucket = rateBuckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + 60_000 };
    rateBuckets.set(id, bucket);
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }
  if (++bucket.count > RATE_LIMIT) {
    res.status(429).json({ error: `Rate limit exceeded (${RATE_LIMIT} requests/minute). Try again shortly.` });
    return;
  }
  next();
});

/* ── Serialization ───────────────────────────────────────────────────── */

function apiTaskJson(t: ReturnType<typeof taskJson>) {
  const out: any = t.output ?? null;
  return {
    id: t.id,
    status: t.status,
    audio_url: out?.audio_url ?? out?.dubbed_audio_url ?? out?.output_audio_url ?? null,
    credits_charged: t.creditsCharged,
    error: t.error,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

/* ── Account info ────────────────────────────────────────────────────── */

router.get("/me", (req: any, res) => {
  const u = req.appUser;
  res.json({
    name: u.name,
    plan: u.plan,
    credits: u.credits,
    plan_expires_at: u.planExpiresAt?.toISOString() ?? null,
  });
});

/* ── Voice catalog ───────────────────────────────────────────────────── */

router.get("/voices", async (req: any, res) => {
  const provider = String(req.query.provider ?? "elevenlabs");
  if (!isOsVoiceProvider(provider)) {
    res.status(400).json({ error: "Invalid provider. Use one of: elevenlabs, minimax, fishaudio, edge, clone" });
    return;
  }
  try {
    if (provider === "clone") {
      const clones = await db.select().from(voiceClonesTable)
        .where(and(eq(voiceClonesTable.userId, req.appUser.id), eq(voiceClonesTable.provider, "openspeaker")))
        .orderBy(desc(voiceClonesTable.createdAt));
      res.json({ data: clones.map((c) => ({ voice_id: c.voiceId, name: c.name, description: c.description ?? "" })), total: clones.length });
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size ?? "24")) || 24));
    if (provider === "elevenlabs") {
      const list = await elLocalQuery({
        search,
        language: typeof req.query.language === "string" ? req.query.language.trim() : "",
        gender: typeof req.query.gender === "string" ? req.query.gender.trim() : "",
      });
      res.json({ data: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, page_size: pageSize });
      return;
    }
    const params = new URLSearchParams({ provider, page: String(page), page_size: String(pageSize) });
    if (search) params.set("search", search);
    const data: any = await osGetJson(`/v3/voices?${params.toString()}`, "Voice library");
    res.json({ data: data?.data ?? [], total: data?.pagination?.total ?? (data?.data?.length ?? 0), page, page_size: pageSize });
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Voice library unavailable" });
  }
});

/* ── Text to Speech ──────────────────────────────────────────────────── */

const SYNC_WAIT_MS = 90_000;
const POLL_MS = 2_000;

router.post("/tts", async (req: any, res) => {
  const { text, voice_id: voiceIdSnake, voiceId: voiceIdCamel, speed } = req.body ?? {};
  const voiceId = voiceIdSnake ?? voiceIdCamel;
  if (typeof text !== "string" || !text.trim() || text.length > 20_000) {
    res.status(400).json({ error: "Provide 'text' (1 to 20,000 characters)." });
    return;
  }
  if (!isValidOsVoiceId(voiceId)) {
    res.status(400).json({ error: "Provide a valid 'voice_id' (see GET /api/v1/voices)." });
    return;
  }
  if (!(await assertCloneOwnership(req, voiceId))) {
    res.status(403).json({ error: "You can only use your own cloned voices." });
    return;
  }

  const user = req.appUser;
  const admin = isUserAdmin(user);
  const reserve = admin ? 0 : Math.max(1, Math.ceil(text.length));
  if (!admin && !(await reserveCredits(user.id, reserve))) {
    res.status(402).json({ error: `Not enough credits. This needs about ${reserve} credits but you have ${user.credits}.` });
    return;
  }

  let created: { task_id?: string } & Record<string, any>;
  try {
    const form = new FormData();
    form.append("text", text);
    form.append("voice_id", voiceId);
    if (speed) form.append("speed", String(Math.min(1.5, Math.max(0.5, Number(speed) || 1))));
    created = await osPostForm(`/v3/text-to-speech`, form, "Text to Speech");
  } catch (err: any) {
    if (!admin) await refundCredits(user.id, reserve);
    if (err instanceof OpenSpeakerError) { res.status(err.status).json({ error: err.message }); return; }
    logger.error({ err }, "Dev API TTS create error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  let [row] = await db.insert(osTasksTable).values({
    userId: user.id,
    tool: "tts",
    externalTaskId: created.task_id ?? null,
    status: "processing",
    title: `[API] ${text.slice(0, 72)}`,
    input: { voiceId, speed: speed ?? 1, characters: text.length, via: "api" },
    creditsCharged: reserve,
  }).returning();

  // Synchronous mode (default): poll until done or the wait budget runs out.
  const deadline = Date.now() + SYNC_WAIT_MS;
  row = await refreshTask(row);
  while (row.status === "processing" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    row = await refreshTask(row);
  }

  const body = apiTaskJson(taskJson(row));
  if (row.status === "processing") {
    res.status(202).json({ ...body, message: "Still processing — poll GET /api/v1/tasks/{id} for the result." });
    return;
  }
  if (row.status === "error") {
    res.status(422).json(body);
    return;
  }
  res.json(body);
});

/* ── Task status ─────────────────────────────────────────────────────── */

router.get("/tasks/:id", async (req: any, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  let [row] = await db.select().from(osTasksTable)
    .where(and(eq(osTasksTable.id, id), eq(osTasksTable.userId, req.appUser.id)));
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  row = await refreshTask(row);
  res.json(apiTaskJson(taskJson(row)));
});

export default router;
