import { Router } from "express";
import multer from "multer";
import { CLONE_CONSENT_TEXT } from "../lib/consent";
import crypto from "crypto";
import { db, usersTable, osTasksTable, osDictionariesTable, voiceClonesTable, type OsTask } from "@workspace/db";
import { eq, and, desc, count, sql, gte, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";
import { requireFeature as requireGlobalFeature } from "../middleware/require-feature";
import { planAllowsFeature, type FeatureKey } from "../lib/plans";
import {
  osGetJson, osPostJson, osPostForm, osPutJson, osDelete,
  getTask, deleteTasks, OpenSpeakerError,
  isOsVoiceProvider, isValidOsVoiceId, type OsTaskState,
} from "../lib/openspeaker";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

/** Server-side upload validation: MIME family + per-tool size cap. Returns an error string or null. */
function badUpload(file: Express.Multer.File, kind: "audio" | "media" | "image", maxMb: number): string | null {
  const mime = String(file.mimetype || "");
  const ok =
    kind === "audio" ? (mime.startsWith("audio/") || mime === "video/webm") :
    kind === "media" ? (mime.startsWith("audio/") || mime.startsWith("video/")) :
    mime.startsWith("image/");
  if (!ok) return `Unsupported file type (${mime || "unknown"}). Please upload ${kind === "image" ? "an image" : "an audio" + (kind === "media" ? " or video" : "")} file.`;
  if (file.size > maxMb * 1024 * 1024) return `File is too large — the maximum is ${maxMb} MB.`;
  return null;
}

/* ═══════════════ Webhook (no session — matched by per-task secret token) ═══════════════ */

router.post("/webhook", async (req, res) => {
  const token = String(req.query.token ?? "");
  res.json({ ok: true }); // always ack quickly
  if (!token) return;
  try {
    const [row] = await db.select().from(osTasksTable).where(eq(osTasksTable.webhookToken, token));
    if (!row || row.status === "done" || row.status === "error") return;
    if (!row.externalTaskId) return;
    // Never trust the webhook body — re-fetch the task state from the provider.
    const state = await getTask(row.externalTaskId);
    await applyTaskState(row, state);
  } catch (err) {
    logger.warn({ err }, "OpenSpeaker webhook processing failed");
  }
});

/* ═══════════════ Everything below requires an active logged-in user ═══════════════ */

router.use(requireActiveUser);

/* ── Credits: atomic reserve / refund / adjust ───────────────────────── */

async function reserveCredits(userId: number, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const rows = await db.update(usersTable).set({
    credits: sql`${usersTable.credits} - ${amount}`,
    creditsUsed: sql`${usersTable.creditsUsed} + ${amount}`,
  }).where(and(eq(usersTable.id, userId), gte(usersTable.credits, amount)))
    .returning({ id: usersTable.id });
  return rows.length > 0;
}

async function refundCredits(userId: number, amount: number) {
  if (amount <= 0) return;
  await db.update(usersTable).set({
    credits: sql`${usersTable.credits} + ${amount}`,
    creditsUsed: sql`GREATEST(0, ${usersTable.creditsUsed} - ${amount})`,
  }).where(eq(usersTable.id, userId));
}

/**
 * Charge extra credits during post-hoc reconciliation to the provider's real cost.
 * Policy: never push the balance below zero — charge at most what the user has.
 * The provider cost was already incurred; the shortfall is absorbed rather than
 * creating a negative balance the user never agreed to.
 */
async function chargeExtraCredits(userId: number, amount: number) {
  if (amount <= 0) return;
  await db.transaction(async (tx) => {
    const [u] = await tx.select({ credits: usersTable.credits }).from(usersTable)
      .where(eq(usersTable.id, userId)).for("update");
    const take = Math.min(amount, Math.max(0, u?.credits ?? 0));
    if (take <= 0) return;
    await tx.update(usersTable).set({
      credits: sql`${usersTable.credits} - ${take}`,
      creditsUsed: sql`${usersTable.creditsUsed} + ${take}`,
    }).where(eq(usersTable.id, userId));
  });
}

/* ── Plan gate (free vs paid). Admins always pass. ───────────────────── */

function requirePlanFeature(feature: FeatureKey) {
  return (req: any, res: any, next: any) => {
    const user = req.appUser!;
    if (!isUserAdmin(user) && !planAllowsFeature(user.plan, feature)) {
      res.status(403).json({ error: "This is a paid feature. Please upgrade your plan to use it." });
      return;
    }
    next();
  };
}

/* ── Task state sync ─────────────────────────────────────────────────── */

function isFinal(status: string): boolean {
  return status === "done" || status === "error";
}

/**
 * Apply a provider task state to our row: status, output, and credit
 * reconciliation. Reconciliation only runs for billed rows (creditsCharged > 0
 * at creation time — admin tasks are created with 0 and are never adjusted).
 * The creditsCharged compare-and-set makes concurrent polls safe.
 */
async function applyTaskState(row: OsTask, state: OsTaskState): Promise<OsTask> {
  const status = state.status === "done" ? "done" : state.status === "error" ? "error" : "processing";
  const providerCost = typeof state.credit_cost === "number" && state.credit_cost >= 0 ? state.credit_cost : null;

  // Credit reconciliation to the provider's actual cost.
  if (row.creditsCharged > 0 && providerCost !== null && providerCost !== row.creditsCharged && status !== "error") {
    const updated = await db.update(osTasksTable)
      .set({ creditsCharged: providerCost, updatedAt: new Date() })
      .where(and(eq(osTasksTable.id, row.id), eq(osTasksTable.creditsCharged, row.creditsCharged)))
      .returning({ id: osTasksTable.id });
    if (updated.length > 0) {
      const diff = providerCost - row.creditsCharged;
      if (diff > 0) await chargeExtraCredits(row.userId, diff);
      else await refundCredits(row.userId, -diff);
      row = { ...row, creditsCharged: providerCost };
    }
  }

  // Refund on provider failure (once).
  if (status === "error" && row.creditsCharged > 0 && !row.refunded) {
    const updated = await db.update(osTasksTable)
      .set({ refunded: true, updatedAt: new Date() })
      .where(and(eq(osTasksTable.id, row.id), eq(osTasksTable.refunded, false)))
      .returning({ id: osTasksTable.id });
    if (updated.length > 0) await refundCredits(row.userId, row.creditsCharged);
    row = { ...row, refunded: true };
  }

  const [saved] = await db.update(osTasksTable).set({
    status,
    output: state.metadata ?? row.output,
    error: status === "error" ? (state.error_message ?? "Generation failed") : null,
    updatedAt: new Date(),
  }).where(eq(osTasksTable.id, row.id)).returning();
  return saved ?? row;
}

/** Refresh a non-final task from the provider; swallow transient provider errors. */
async function refreshTask(row: OsTask): Promise<OsTask> {
  if (isFinal(row.status) || !row.externalTaskId) return row;
  try {
    const state = await getTask(row.externalTaskId);
    return await applyTaskState(row, state);
  } catch (err) {
    logger.warn({ err, taskId: row.externalTaskId }, "OpenSpeaker task refresh failed");
    return row;
  }
}

function taskJson(t: OsTask) {
  return {
    id: t.id,
    tool: t.tool,
    status: t.status,
    title: t.title,
    input: t.input ?? null,
    output: t.output ?? null,
    error: t.error,
    creditsCharged: t.creditsCharged,
    refunded: t.refunded,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/* ── Shared create-task flow with reserve → create → reconcile ───────── */

interface CreateTaskArgs {
  req: any;
  res: any;
  tool: string;
  title: string;
  input: Record<string, unknown>;
  estimate: number;
  create: (webhookUrl: string | null) => Promise<{ task_id?: string } & Record<string, any>>;
}

function webhookUrlFor(token: string): string | null {
  const origin = process.env.APP_ORIGIN || "https://openradio.io";
  try {
    return new URL(`/api/os/webhook?token=${token}`, origin).toString();
  } catch {
    return null;
  }
}

async function runCreateTask({ req, res, tool, title, input, estimate, create }: CreateTaskArgs) {
  const user = req.appUser!;
  const admin = isUserAdmin(user);
  const reserve = admin ? 0 : Math.max(1, Math.ceil(estimate));

  if (!admin && !(await reserveCredits(user.id, reserve))) {
    res.status(402).json({ error: `Not enough credits. This needs about ${reserve} credits but you have ${user.credits}.` });
    return;
  }

  const token = crypto.randomBytes(24).toString("hex");

  // Phase 1 — provider call. Refund on ANY failure here: no upstream work was accepted.
  let created: { task_id?: string } & Record<string, any>;
  try {
    created = await create(webhookUrlFor(token));
  } catch (err: any) {
    if (!admin) await refundCredits(user.id, reserve);
    if (err instanceof OpenSpeakerError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err, tool }, "OpenSpeaker task create error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // Phase 2 — local tracking. The provider has accepted (and may bill) the task,
  // so failures here must NOT refund; they only report a tracking problem.
  try {
    const externalId = created.task_id ?? null;
    let [row] = await db.insert(osTasksTable).values({
      userId: user.id,
      tool,
      externalTaskId: externalId,
      status: "processing",
      title: title.slice(0, 120),
      input,
      creditsCharged: reserve,
      webhookToken: token,
    }).returning();

    // Immediately sync once — the provider reports credit_cost right away,
    // which reconciles our reservation to the real cost.
    if (externalId) row = await refreshTask(row);

    res.json({ task: taskJson(row) });
  } catch (err: any) {
    logger.error({ err, tool, externalTaskId: created?.task_id }, "OpenSpeaker task accepted but local tracking failed");
    res.status(500).json({ error: "The task was submitted but could not be tracked. Please check your history shortly or contact support." });
  }
}

/** Verify a dictionary id belongs to the requesting user (IDOR guard). */
async function assertDictionaryOwnership(req: any, dictionaryId: string): Promise<boolean> {
  const [own] = await db.select({ id: osDictionariesTable.id }).from(osDictionariesTable)
    .where(and(eq(osDictionariesTable.externalId, dictionaryId), eq(osDictionariesTable.userId, req.appUser!.id)));
  return !!own;
}

/** Ensure a clone_ voice belongs to the requesting user (IDOR guard). */
async function assertCloneOwnership(req: any, voiceId: string): Promise<boolean> {
  if (!voiceId.startsWith("clone_")) return true;
  if (isUserAdmin(req.appUser!)) return true;
  const [own] = await db.select({ id: voiceClonesTable.id }).from(voiceClonesTable)
    .where(and(eq(voiceClonesTable.voiceId, voiceId), eq(voiceClonesTable.userId, req.appUser!.id)));
  return !!own;
}

/* ═══════════════ Voice library ═══════════════ */

router.get("/voices", async (req, res) => {
  const provider = String(req.query.provider ?? "");
  if (!isOsVoiceProvider(provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }
  try {
    if (provider === "clone") {
      // Clones are account-wide upstream — only expose the user's own.
      // Search is applied locally; gender/language metadata doesn't exist for clones.
      const cloneSearch = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
      const clones = (await db.select().from(voiceClonesTable)
        .where(and(eq(voiceClonesTable.userId, req.appUser!.id), eq(voiceClonesTable.provider, "openspeaker")))
        .orderBy(desc(voiceClonesTable.createdAt)))
        .filter((c) => !cloneSearch || c.name.toLowerCase().includes(cloneSearch) || (c.description ?? "").toLowerCase().includes(cloneSearch));
      res.json({
        success: true,
        data: clones.map((c) => ({ voice_id: c.voiceId, name: c.name, description: c.description ?? "", provider: "clone" })),
        pagination: { page: 1, page_size: clones.length, total: clones.length },
      });
      return;
    }
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    // Upstream quirk: the ElevenLabs catalog ignores `page` unless a search
    // term is present. Without one, serve the (cached) featured list and
    // paginate it locally so pages actually advance.
    if (provider === "elevenlabs" && !search) {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size ?? "24")) || 24));
      const f: AggFilters = {
        search: "",
        language: typeof req.query.language === "string" ? req.query.language.trim() : "",
        gender: typeof req.query.gender === "string" ? req.query.gender.trim() : "",
      };
      const featured = await elevenFeatured(f);
      res.json({
        success: true,
        data: featured.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, page_size: pageSize, total: featured.length },
        featured_only: true, // hint for the UI: search to explore the full catalog
      });
      return;
    }
    const params = new URLSearchParams({ provider });
    for (const k of ["search", "page", "page_size", "language", "gender"]) {
      const v = req.query[k];
      if (typeof v === "string" && v) params.set(k, v);
    }
    const data = await osGetJson(`/v3/voices?${params.toString()}`, "Voice library");
    res.json(data);
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Voice library unavailable" });
  }
});

/* ── Aggregated catalog: one stable global page across all providers ──── */

const AGG_PROVIDERS = ["elevenlabs", "minimax", "fishaudio", "edge", "vbee"] as const;

type AggFilters = { search: string; language: string; gender: string };

const aggTotalCache = new Map<string, { total: number; at: number }>();
const aggPageCache = new Map<string, { data: any[]; at: number }>();
const AGG_TOTAL_TTL = 5 * 60_000;
const AGG_PAGE_TTL = 60_000;
const AGG_PAGE_CACHE_MAX = 300;

function aggParams(provider: string, f: AggFilters, page: number, pageSize: number) {
  const p = new URLSearchParams({ provider, page: String(page), page_size: String(pageSize) });
  if (f.search) p.set("search", f.search);
  if (f.language) p.set("language", f.language);
  if (f.gender) p.set("gender", f.gender);
  return p.toString();
}

/* Upstream quirk: ElevenLabs ignores `page` when there is no search term —
   every page returns the same "featured" list. Cache that list once and
   paginate it locally instead of trusting the bogus 16k+ pagination. */
const elFeaturedCache = new Map<string, { data: any[]; at: number }>();

async function elevenFeatured(f: AggFilters): Promise<any[]> {
  const key = `${f.language}|${f.gender}`;
  const hit = elFeaturedCache.get(key);
  if (hit && Date.now() - hit.at < AGG_TOTAL_TTL) return hit.data;
  const data: any = await osGetJson(`/v3/voices?${aggParams("elevenlabs", f, 1, 100)}`, "Voice library");
  const seen = new Set<string>();
  const voices: any[] = (Array.isArray(data?.data) ? data.data : []).filter((v: any) => {
    if (seen.has(v.voice_id)) return false;
    seen.add(v.voice_id);
    return true;
  });
  elFeaturedCache.set(key, { data: voices, at: Date.now() });
  return voices;
}

async function aggProviderTotal(provider: string, f: AggFilters): Promise<number> {
  if (provider === "elevenlabs" && !f.search) return (await elevenFeatured(f)).length;
  const key = `${provider}|${f.search}|${f.language}|${f.gender}`;
  const hit = aggTotalCache.get(key);
  if (hit && Date.now() - hit.at < AGG_TOTAL_TTL) return hit.total;
  try {
    const data: any = await osGetJson(`/v3/voices?${aggParams(provider, f, 1, 1)}`, "Voice library");
    const total = Number(data?.pagination?.total ?? (Array.isArray(data?.data) ? data.data.length : 0)) || 0;
    aggTotalCache.set(key, { total, at: Date.now() });
    return total;
  } catch (err) {
    logger.warn({ err, provider }, "Aggregated voice count failed");
    return hit?.total ?? 0; // stale-if-error, else treat as empty
  }
}

async function aggProviderPage(provider: string, f: AggFilters, page: number, pageSize: number): Promise<any[]> {
  if (provider === "elevenlabs" && !f.search) {
    return (await elevenFeatured(f)).slice((page - 1) * pageSize, page * pageSize);
  }
  const key = `${provider}|${f.search}|${f.language}|${f.gender}|${page}|${pageSize}`;
  const hit = aggPageCache.get(key);
  if (hit && Date.now() - hit.at < AGG_PAGE_TTL) return hit.data;
  const data: any = await osGetJson(`/v3/voices?${aggParams(provider, f, page, pageSize)}`, "Voice library");
  const voices: any[] = Array.isArray(data?.data) ? data.data : [];
  if (aggPageCache.size >= AGG_PAGE_CACHE_MAX) {
    const oldest = aggPageCache.keys().next().value;
    if (oldest !== undefined) aggPageCache.delete(oldest);
  }
  aggPageCache.set(key, { data: voices, at: Date.now() });
  return voices;
}

router.get("/voices/all", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.page_size ?? "24")) || 24));
  const f: AggFilters = {
    search: typeof req.query.search === "string" ? req.query.search.trim() : "",
    language: typeof req.query.language === "string" ? req.query.language.trim() : "",
    gender: typeof req.query.gender === "string" ? req.query.gender.trim() : "",
  };
  try {
    // User's own clones lead the catalog (local, cheap, search-filtered).
    const cloneRows = await db.select().from(voiceClonesTable)
      .where(and(eq(voiceClonesTable.userId, req.appUser!.id), eq(voiceClonesTable.provider, "openspeaker")))
      .orderBy(desc(voiceClonesTable.createdAt));
    const q = f.search.toLowerCase();
    const clones = cloneRows
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q))
      .map((c) => ({ voice_id: c.voiceId, name: c.name, description: c.description ?? "", provider: "clone" }));

    const totals = await Promise.all(AGG_PROVIDERS.map((p) => aggProviderTotal(p, f)));

    // Global ordering: clones, then providers in AGG_PROVIDERS order.
    const segments: { provider: string; total: number }[] = [
      { provider: "clone", total: clones.length },
      ...AGG_PROVIDERS.map((p, i) => ({ provider: p, total: totals[i] })),
    ];
    const grandTotal = segments.reduce((a, s) => a + s.total, 0);

    const start = (page - 1) * pageSize;
    const out: any[] = [];
    let cursor = 0;
    for (const seg of segments) {
      const segStart = cursor;
      const segEnd = cursor + seg.total;
      cursor = segEnd;
      if (out.length >= pageSize || segEnd <= start) continue;
      const from = Math.max(start, segStart) - segStart;         // offset inside this provider
      const need = Math.min(pageSize - out.length, seg.total - from);
      if (need <= 0) continue;
      if (seg.provider === "clone") {
        out.push(...clones.slice(from, from + need));
        continue;
      }
      // Fetch the upstream page(s) covering [from, from + need)
      const firstPage = Math.floor(from / pageSize) + 1;
      const lastPage = Math.floor((from + need - 1) / pageSize) + 1;
      let buf: any[] = [];
      for (let p = firstPage; p <= lastPage; p++) {
        buf = buf.concat(await aggProviderPage(seg.provider, f, p, pageSize));
      }
      const innerFrom = from - (firstPage - 1) * pageSize;
      out.push(...buf.slice(innerFrom, innerFrom + need).map((v) => ({ ...v, provider: seg.provider })));
    }

    res.json({
      success: true,
      data: out,
      pagination: { page, page_size: pageSize, total: grandTotal },
      totals: Object.fromEntries(segments.map((s) => [s.provider, s.total])),
    });
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Voice library unavailable" });
  }
});

/* ═══════════════ Text to Speech ═══════════════ */

router.post("/tts", requireGlobalFeature("os-tts"), requirePlanFeature("tts"), async (req, res) => {
  const { text, voiceId, speed, dictionaryId } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || text.length > 1_000_000) {
    res.status(400).json({ error: "Please enter text (up to 1,000,000 characters)." });
    return;
  }
  if (!isValidOsVoiceId(voiceId)) {
    res.status(400).json({ error: "Please choose a valid voice." });
    return;
  }
  if (!(await assertCloneOwnership(req, voiceId))) {
    res.status(403).json({ error: "You can only use your own cloned voices." });
    return;
  }
  if (typeof dictionaryId === "string" && dictionaryId && !(await assertDictionaryOwnership(req, dictionaryId))) {
    res.status(403).json({ error: "You can only use your own pronunciation dictionaries." });
    return;
  }
  await runCreateTask({
    req, res, tool: "tts",
    title: text.slice(0, 80),
    input: { voiceId, speed: speed ?? 1, characters: text.length },
    estimate: text.length,
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("text", text);
      form.append("voice_id", voiceId);
      if (speed) form.append("speed", String(Math.min(1.5, Math.max(0.5, Number(speed) || 1))));
      if (typeof dictionaryId === "string" && dictionaryId) form.append("pronunciation_dictionary_id", dictionaryId);
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v3/text-to-speech`, form, "Text to Speech");
    },
  });
});

/* ═══════════════ Text to Dialogue ═══════════════ */

router.post("/dialogue", requireGlobalFeature("os-dialogue"), requirePlanFeature("dialogue"), async (req, res) => {
  const { text, speakers, delay, dictionaryId } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || text.length > 1_000_000) {
    res.status(400).json({ error: "Please enter the dialogue script." });
    return;
  }
  if (!Array.isArray(speakers) || speakers.length < 2 || speakers.length > 26) {
    res.status(400).json({ error: "Please assign at least 2 speakers." });
    return;
  }
  const cleanSpeakers: { voice_id: string; speed?: number }[] = [];
  for (const s of speakers) {
    const vid = s?.voiceId ?? s?.voice_id;
    if (!isValidOsVoiceId(vid)) {
      res.status(400).json({ error: "Every speaker needs a valid voice." });
      return;
    }
    if (!(await assertCloneOwnership(req, vid))) {
      res.status(403).json({ error: "You can only use your own cloned voices." });
      return;
    }
    const sp: { voice_id: string; speed?: number } = { voice_id: vid };
    const spd = Number(s?.speed);
    if (spd && spd >= 0.5 && spd <= 1.5) sp.speed = spd;
    cleanSpeakers.push(sp);
  }
  if (typeof dictionaryId === "string" && dictionaryId && !(await assertDictionaryOwnership(req, dictionaryId))) {
    res.status(403).json({ error: "You can only use your own pronunciation dictionaries." });
    return;
  }
  await runCreateTask({
    req, res, tool: "dialogue",
    title: text.slice(0, 80),
    input: { speakers: cleanSpeakers.length, characters: text.length },
    estimate: text.length,
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("text", text);
      form.append("speakers", JSON.stringify(cleanSpeakers));
      const d = Number(delay);
      if (Number.isFinite(d) && d >= 0 && d <= 5) form.append("delay", String(d));
      if (typeof dictionaryId === "string" && dictionaryId) form.append("pronunciation_dictionary_id", dictionaryId);
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v3/text-to-speech/dialogue`, form, "Text to Dialogue");
    },
  });
});

/* ═══════════════ Pronunciation Dictionary ═══════════════ */

const dictGate = [requireGlobalFeature("os-dictionary"), requirePlanFeature("dictionary")] as const;

function cleanRules(rules: unknown): { from: string; to: string; matchType: string; caseSensitive: boolean }[] | null {
  if (!Array.isArray(rules) || rules.length === 0 || rules.length > 500) return null;
  const out = [];
  for (const r of rules) {
    if (typeof r?.from !== "string" || !r.from || typeof r?.to !== "string") return null;
    out.push({
      from: r.from.slice(0, 200),
      to: r.to.slice(0, 200),
      matchType: r.matchType === "contains" ? "contains" : "word",
      caseSensitive: !!r.caseSensitive,
    });
  }
  return out;
}

router.get("/dictionaries", ...dictGate, async (req, res) => {
  try {
    const owned = await db.select().from(osDictionariesTable)
      .where(eq(osDictionariesTable.userId, req.appUser!.id))
      .orderBy(desc(osDictionariesTable.createdAt));
    if (owned.length === 0) { res.json({ dictionaries: [] }); return; }
    const remote = await osGetJson<any>(`/v3/dictionaries`, "Dictionaries");
    const list = Array.isArray(remote?.data) ? remote.data : Array.isArray(remote?.dictionaries) ? remote.dictionaries : Array.isArray(remote) ? remote : [];
    const byId = new Map<string, any>(list.map((d: any) => [String(d.id), d]));
    res.json({
      dictionaries: owned.map((o) => {
        const r = byId.get(o.externalId);
        return {
          id: o.externalId,
          name: r?.name ?? o.name,
          rules: r?.rules ?? [],
          rulesCount: Array.isArray(r?.rules) ? r.rules.length : o.rulesCount,
          createdAt: o.createdAt.toISOString(),
        };
      }),
    });
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Failed to load dictionaries" });
  }
});

router.post("/dictionaries", ...dictGate, async (req, res) => {
  const { name, rules } = req.body ?? {};
  const clean = cleanRules(rules);
  if (typeof name !== "string" || !name.trim() || !clean) {
    res.status(400).json({ error: "A name and 1–500 valid rules are required." });
    return;
  }
  try {
    const created = await osPostJson<any>(`/v3/dictionaries`, { name: name.trim().slice(0, 100), rules: clean }, "Create dictionary");
    const externalId = String(created?.dictionary?.id ?? created?.data?.id ?? created?.id ?? "");
    if (!externalId) { res.status(502).json({ error: "Dictionary was not created. Please try again." }); return; }
    await db.insert(osDictionariesTable).values({
      userId: req.appUser!.id,
      externalId,
      name: name.trim().slice(0, 100),
      rulesCount: clean.length,
    });
    res.json({ id: externalId, name: name.trim(), rulesCount: clean.length });
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Failed to create dictionary" });
  }
});

async function ownedDictionary(req: any, res: any): Promise<string | null> {
  const externalId = String(req.params.id ?? "");
  const [own] = await db.select().from(osDictionariesTable)
    .where(and(eq(osDictionariesTable.externalId, externalId), eq(osDictionariesTable.userId, req.appUser!.id)));
  if (!own) {
    res.status(404).json({ error: "Dictionary not found" });
    return null;
  }
  return externalId;
}

router.put("/dictionaries/:id", ...dictGate, async (req, res) => {
  const externalId = await ownedDictionary(req, res);
  if (!externalId) return;
  const { name, rules } = req.body ?? {};
  const clean = cleanRules(rules);
  if (typeof name !== "string" || !name.trim() || !clean) {
    res.status(400).json({ error: "A name and 1–500 valid rules are required." });
    return;
  }
  try {
    await osPutJson(`/v3/dictionaries/${encodeURIComponent(externalId)}`, { name: name.trim().slice(0, 100), rules: clean }, "Update dictionary");
    await db.update(osDictionariesTable)
      .set({ name: name.trim().slice(0, 100), rulesCount: clean.length })
      .where(eq(osDictionariesTable.externalId, externalId));
    res.json({ ok: true });
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Failed to update dictionary" });
  }
});

router.delete("/dictionaries/:id", ...dictGate, async (req, res) => {
  const externalId = await ownedDictionary(req, res);
  if (!externalId) return;
  try {
    await osDelete(`/v3/dictionaries/${encodeURIComponent(externalId)}`, "Delete dictionary");
  } catch (err) {
    logger.warn({ err }, "Remote dictionary delete failed (removing local mapping anyway)");
  }
  await db.delete(osDictionariesTable).where(eq(osDictionariesTable.externalId, externalId));
  res.status(204).send();
});

router.post("/dictionaries/preview", ...dictGate, async (req, res) => {
  const { text, rules } = req.body ?? {};
  const clean = cleanRules(rules);
  if (typeof text !== "string" || !clean) {
    res.status(400).json({ error: "text and rules are required" });
    return;
  }
  try {
    const data = await osPostJson(`/v3/dictionaries/preview`, { text: text.slice(0, 5000), rules: clean }, "Preview dictionary");
    res.json(data);
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Preview failed" });
  }
});

/* ═══════════════ Voice Clone ═══════════════ */

router.post("/voice-clone", requireGlobalFeature("os-voice-clone"), requirePlanFeature("voice-cloning"), upload.single("audio"), async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!req.file || !name) {
    res.status(400).json({ error: "A voice name and a 3–30 second audio sample are required." });
    return;
  }
  if (String(req.body?.consent ?? "") !== "true") {
    res.status(400).json({ error: "You must confirm you have the right to clone this voice." });
    return;
  }
  {
    const bad = badUpload(req.file, "audio", 10);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  try {
    const form = new FormData();
    form.append("voice_name", name.slice(0, 80));
    form.append("audio_file", new Blob([req.file.buffer as any], { type: req.file.mimetype }), req.file.originalname || "sample.mp3");
    const created = await osPostForm<any>(`/v3/text-to-speech/voice-clone`, form, "Voice clone");
    const rawId = String(created?.data?.voice_id ?? created?.voice_id ?? "");
    if (!rawId) { res.status(502).json({ error: "Voice cloning failed. Please try a different sample." }); return; }
    const voiceId = rawId.startsWith("clone_") ? rawId : `clone_${rawId}`;
    const [row] = await db.insert(voiceClonesTable).values({
      userId: req.appUser!.id,
      name: name.slice(0, 80),
      voiceId,
      provider: "openspeaker",
      consentAt: new Date(),
      consentText: CLONE_CONSENT_TEXT,
    }).returning();
    res.json({ id: row.id, voiceId, name: row.name });
  } catch (err: any) {
    if (err instanceof OpenSpeakerError) { res.status(err.status).json({ error: err.message }); return; }
    logger.error({ err }, "OpenSpeaker voice clone error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/voice-clones", requireGlobalFeature("os-voice-clone"), async (req, res) => {
  const clones = await db.select().from(voiceClonesTable)
    .where(and(eq(voiceClonesTable.userId, req.appUser!.id), eq(voiceClonesTable.provider, "openspeaker")))
    .orderBy(desc(voiceClonesTable.createdAt));
  res.json({ clones: clones.map((c) => ({ id: c.id, voiceId: c.voiceId, name: c.name, createdAt: c.createdAt.toISOString() })) });
});

router.delete("/voice-clones/:id", requireGlobalFeature("os-voice-clone"), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const admin = isUserAdmin(req.appUser!);
  const [clone] = await db.select().from(voiceClonesTable).where(
    admin
      ? and(eq(voiceClonesTable.id, id), eq(voiceClonesTable.provider, "openspeaker"))
      : and(eq(voiceClonesTable.id, id), eq(voiceClonesTable.provider, "openspeaker"), eq(voiceClonesTable.userId, req.appUser!.id)),
  );
  if (!clone) { res.status(404).json({ error: "Voice clone not found" }); return; }
  try {
    const rawId = clone.voiceId.replace(/^clone_/, "");
    await osDelete(`/v3/text-to-speech/voice-clone/${encodeURIComponent(rawId)}`, "Delete clone");
  } catch (err) {
    logger.warn({ err }, "Remote clone delete failed (removing local record anyway)");
  }
  await db.delete(voiceClonesTable).where(eq(voiceClonesTable.id, clone.id));
  res.status(204).send();
});

/* ═══════════════ Audio Dubbing ═══════════════ */

router.post("/dubbing", requireGlobalFeature("os-dubbing"), requirePlanFeature("dubbing"), upload.single("file"), async (req, res) => {
  const targetLang = String(req.body?.targetLang ?? "").trim();
  const sourceLang = String(req.body?.sourceLang ?? "auto").trim() || "auto";
  const numSpeakers = Math.min(9, Math.max(0, parseInt(String(req.body?.numSpeakers ?? "0")) || 0));
  const voiceId = String(req.body?.voiceId ?? "").trim();
  if (!req.file || !targetLang) {
    res.status(400).json({ error: "An audio file and target language are required." });
    return;
  }
  {
    const bad = badUpload(req.file, "media", 200);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  if (voiceId && (!isValidOsVoiceId(voiceId) || !(await assertCloneOwnership(req, voiceId)))) {
    res.status(400).json({ error: "Invalid replacement voice." });
    return;
  }
  const file = req.file;
  await runCreateTask({
    req, res, tool: "dubbing",
    title: `${file.originalname || "audio"} → ${targetLang}`,
    input: { targetLang, sourceLang, numSpeakers, fileName: file.originalname, fileSize: file.size },
    estimate: Math.max(500, Math.ceil(file.size / 20_000)), // reconciled to real cost right after creation
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("file", new Blob([file.buffer as any], { type: file.mimetype }), file.originalname || "audio.mp3");
      form.append("num_speakers", String(numSpeakers));
      form.append("source_lang", sourceLang);
      form.append("target_lang", targetLang);
      if (voiceId) form.append("voice_id", voiceId);
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v1/task/dubbing`, form, "Dubbing");
    },
  });
});

/* ═══════════════ Voice Changer ═══════════════ */

router.post("/voice-changer", requireGlobalFeature("os-voice-changer"), requirePlanFeature("speech-to-speech"), upload.single("file"), async (req, res) => {
  const voiceId = String(req.body?.voiceId ?? "").trim();
  if (!req.file || !isValidOsVoiceId(voiceId)) {
    res.status(400).json({ error: "An audio file and a valid voice are required." });
    return;
  }
  {
    const bad = badUpload(req.file, "audio", 50);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  if (!(await assertCloneOwnership(req, voiceId))) {
    res.status(403).json({ error: "You can only use your own cloned voices." });
    return;
  }
  const stability = Math.min(1, Math.max(0, Number(req.body?.stability) || 0.5));
  const similarity = Math.min(1, Math.max(0, Number(req.body?.similarityBoost) || 0.75));
  const removeNoise = String(req.body?.removeNoise ?? "false") === "true";
  const file = req.file;
  await runCreateTask({
    req, res, tool: "voice-changer",
    title: file.originalname || "Voice change",
    input: { voiceId, fileName: file.originalname, fileSize: file.size },
    estimate: Math.max(100, Math.ceil(file.size / 10_000)),
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("file", new Blob([file.buffer as any], { type: file.mimetype }), file.originalname || "audio.mp3");
      form.append("voice_id", voiceId);
      form.append("model_id", "eleven_multilingual_sts_v2");
      form.append("voice_settings", JSON.stringify({ stability, similarity_boost: similarity }));
      form.append("remove_background_noise", String(removeNoise));
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v1/task/voice-changer`, form, "Voice changer");
    },
  });
});

/* ═══════════════ Voice Isolation ═══════════════ */

router.post("/voice-isolate", requireGlobalFeature("os-voice-isolation"), requirePlanFeature("audio-isolation"), upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "An audio file is required." }); return; }
  {
    const bad = badUpload(req.file, "media", 100);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  const file = req.file;
  await runCreateTask({
    req, res, tool: "voice-isolation",
    title: file.originalname || "Voice isolation",
    input: { fileName: file.originalname, fileSize: file.size },
    estimate: Math.max(100, Math.ceil(file.size / 20_000)),
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("file", new Blob([file.buffer as any], { type: file.mimetype }), file.originalname || "audio.mp3");
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v1/task/voice-isolate`, form, "Voice isolation");
    },
  });
});

/* ═══════════════ Speech to Text ═══════════════ */

router.post("/speech-to-text", requireGlobalFeature("os-speech-to-text"), requirePlanFeature("speech-to-text"), upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "An audio file is required." }); return; }
  {
    const bad = badUpload(req.file, "media", 100);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  const file = req.file;
  await runCreateTask({
    req, res, tool: "speech-to-text",
    title: file.originalname || "Transcription",
    input: { fileName: file.originalname, fileSize: file.size },
    estimate: Math.max(20, Math.ceil(file.size / 50_000)),
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("file", new Blob([file.buffer as any], { type: file.mimetype }), file.originalname || "audio.mp3");
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v1/task/speech-to-text`, form, "Speech to text");
    },
  });
});

/* ═══════════════ Sound Effects ═══════════════ */

router.post("/sound-effect", requireGlobalFeature("os-sound-effects"), requirePlanFeature("sound-effects"), async (req, res) => {
  const { text, durationSeconds, promptInfluence, loop } = req.body ?? {};
  if (typeof text !== "string" || text.trim().length < 3 || text.length > 450) {
    res.status(400).json({ error: "Describe the sound in 3–450 characters." });
    return;
  }
  let duration: number | null = null;
  if (durationSeconds !== undefined && durationSeconds !== null && durationSeconds !== "") {
    const d = Number(durationSeconds);
    if (!Number.isFinite(d) || d < 0.5 || d > 30) {
      res.status(400).json({ error: "Duration must be between 0.5 and 30 seconds." });
      return;
    }
    duration = d;
  }
  // Documented pricing: auto = 200 credits, else 50 credits/second (min 50).
  const estimate = duration === null ? 200 : Math.max(50, Math.ceil(duration * 50));
  await runCreateTask({
    req, res, tool: "sound-effects",
    title: text.slice(0, 80),
    input: { durationSeconds: duration, loop: !!loop },
    estimate,
    create: async (webhookUrl) => {
      const body: Record<string, unknown> = { text: text.trim() };
      if (duration !== null) body.duration_seconds = duration;
      const pi = Number(promptInfluence);
      if (Number.isFinite(pi) && pi >= 0 && pi <= 1) body.prompt_influence = pi;
      if (loop !== undefined) body.loop = !!loop;
      if (webhookUrl) body.receive_url = webhookUrl;
      return osPostJson(`/v1/task/sound-effect`, body, "Sound effect");
    },
  });
});

/* ═══════════════ Suno Music ═══════════════ */

router.post("/music", requireGlobalFeature("os-music"), requirePlanFeature("music"), async (req, res) => {
  const { mode, description, makeInstrumental, title, lyrics, tags, vocalGender } = req.body ?? {};
  const createMode = mode === "custom" ? "custom" : "simple";
  const body: Record<string, unknown> = { create_mode: createMode };
  let taskTitle = "";
  if (createMode === "simple") {
    if (typeof description !== "string" || !description.trim() || description.length > 500) {
      res.status(400).json({ error: "Describe your song in 1–500 characters." });
      return;
    }
    body.gpt_description_prompt = description.trim();
    if (makeInstrumental !== undefined) body.make_instrumental = !!makeInstrumental;
    taskTitle = description.trim().slice(0, 80);
  } else {
    const cleanLyrics = typeof lyrics === "string" ? lyrics.slice(0, 5000) : "";
    const cleanTags = typeof tags === "string" ? tags.slice(0, 1000) : "";
    if (!cleanLyrics.trim() && !cleanTags.trim()) {
      res.status(400).json({ error: "Custom mode needs lyrics or styles." });
      return;
    }
    if (cleanLyrics) body.lyrics = cleanLyrics;
    if (cleanTags) body.tags = cleanTags;
    if (typeof title === "string" && title.trim()) body.title = title.trim().slice(0, 80);
    if (vocalGender === "f" || vocalGender === "m") body.vocal_gender = vocalGender;
    taskTitle = (typeof title === "string" && title.trim()) ? title.trim().slice(0, 80) : (cleanTags || cleanLyrics).slice(0, 80);
  }
  await runCreateTask({
    req, res, tool: "music",
    title: taskTitle || "Music generation",
    input: { mode: createMode },
    estimate: 4000, // reconciled to the provider's real cost right after creation
    create: async (webhookUrl) => {
      if (webhookUrl) body.receive_url = webhookUrl;
      return osPostJson(`/v1s/task/music-generation`, body, "Music generation");
    },
  });
});

/* ═══════════════ AI Images ═══════════════ */

let imageModelsCache: { at: number; data: any } | null = null;

router.get("/image/models", requireGlobalFeature("os-image"), async (_req, res) => {
  try {
    if (imageModelsCache && Date.now() - imageModelsCache.at < 10 * 60 * 1000) {
      res.json(imageModelsCache.data);
      return;
    }
    const data = await osGetJson(`/v1i/models`, "Image models");
    imageModelsCache = { at: Date.now(), data };
    res.json(data);
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Image models unavailable" });
  }
});

async function quoteImagePrice(modelId: string, generationsCount: number, modelParameters: Record<string, unknown> | null, assets: number): Promise<number> {
  const body: Record<string, unknown> = { model_id: modelId, generations_count: generationsCount };
  if (modelParameters) body.model_parameters = modelParameters;
  if (assets > 0) body.assets = assets;
  const data = await osPostJson<{ credits?: number }>(`/v1i/task/price`, body, "Image price");
  if (typeof data.credits !== "number") throw new OpenSpeakerError("Could not calculate the image price.", 502);
  return data.credits;
}

function parseModelParameters(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  } catch { /* ignore */ }
  return null;
}

router.post("/image/price", requireGlobalFeature("os-image"), requirePlanFeature("image"), async (req, res) => {
  const modelId = String(req.body?.modelId ?? "");
  const generationsCount = Math.min(4, Math.max(1, parseInt(String(req.body?.generationsCount ?? "1")) || 1));
  if (!modelId) { res.status(400).json({ error: "modelId is required" }); return; }
  try {
    const credits = await quoteImagePrice(modelId, generationsCount, parseModelParameters(req.body?.modelParameters), Math.max(0, parseInt(String(req.body?.assets ?? "0")) || 0));
    res.json({ credits });
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Price quote failed" });
  }
});

router.post("/image/generate", requireGlobalFeature("os-image"), requirePlanFeature("image"), upload.array("assets", 14), async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  const modelId = String(req.body?.modelId ?? "").trim();
  const generationsCount = Math.min(4, Math.max(1, parseInt(String(req.body?.generationsCount ?? "1")) || 1));
  const modelParameters = parseModelParameters(req.body?.modelParameters);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!prompt || prompt.length > 4000 || !modelId) {
    res.status(400).json({ error: "A prompt (up to 4,000 characters) and model are required." });
    return;
  }
  for (const f of files) {
    const bad = badUpload(f, "image", 5);
    if (bad) { res.status(400).json({ error: bad }); return; }
  }
  let estimate: number;
  try {
    estimate = await quoteImagePrice(modelId, generationsCount, modelParameters, files.length);
  } catch (err: any) {
    const status = err instanceof OpenSpeakerError ? err.status : 502;
    res.status(status).json({ error: err.message ?? "Price quote failed" });
    return;
  }
  await runCreateTask({
    req, res, tool: "image",
    title: prompt.slice(0, 80),
    input: { modelId, generationsCount, modelParameters, assets: files.length },
    estimate,
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("model_id", modelId);
      form.append("generations_count", String(generationsCount));
      if (modelParameters) form.append("model_parameters", JSON.stringify(modelParameters));
      for (const f of files) {
        form.append("assets", new Blob([f.buffer as any], { type: f.mimetype }), f.originalname || "image.png");
      }
      if (webhookUrl) form.append("receive_url", webhookUrl);
      return osPostForm(`/v1i/task/generate-image`, form, "Image generation");
    },
  });
});

/* ═══════════════ Task history (user-owned, IDOR-safe) ═══════════════ */

router.get("/tasks", async (req, res) => {
  const userId = req.appUser!.id;
  const tool = typeof req.query.tool === "string" && req.query.tool ? req.query.tool : null;
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20")) || 20));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0")) || 0);
  const where = tool
    ? and(eq(osTasksTable.userId, userId), eq(osTasksTable.tool, tool))
    : eq(osTasksTable.userId, userId);

  let [items, [{ total }]] = await Promise.all([
    db.select().from(osTasksTable).where(where).orderBy(desc(osTasksTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(osTasksTable).where(where),
  ]);

  // Refresh up to 5 visible non-final tasks so history stays live after reloads.
  const pending = items.filter((t) => !isFinal(t.status) && t.externalTaskId).slice(0, 5);
  if (pending.length > 0) {
    const refreshed = await Promise.all(pending.map((t) => refreshTask(t)));
    const byId = new Map(refreshed.map((t) => [t.id, t]));
    items = items.map((t) => byId.get(t.id) ?? t);
  }

  res.json({ items: items.map(taskJson), total });
});

router.get("/tasks/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  let [row] = await db.select().from(osTasksTable)
    .where(and(eq(osTasksTable.id, id), eq(osTasksTable.userId, req.appUser!.id)));
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }
  row = await refreshTask(row);
  res.json({ task: taskJson(row) });
});

router.delete("/tasks/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  let [row] = await db.select().from(osTasksTable)
    .where(and(eq(osTasksTable.id, id), eq(osTasksTable.userId, req.appUser!.id)));
  if (!row) { res.status(404).json({ error: "Task not found" }); return; }

  // Sync provider state first so a task that actually finished is settled
  // (charged/refunded) correctly before we decide anything.
  row = await refreshTask(row);

  if (!isFinal(row.status) && row.externalTaskId) {
    // Still running upstream: only refund if the provider-side delete succeeds.
    // If it fails, keep the record so credits stay reserved for billed work.
    try {
      await deleteTasks([row.externalTaskId]);
    } catch (err) {
      logger.warn({ err, taskId: row.externalTaskId }, "Remote task delete failed — keeping task");
      res.status(502).json({ error: "Couldn't cancel this task with the provider. Please try again in a moment." });
      return;
    }
  } else if (row.externalTaskId) {
    try { await deleteTasks([row.externalTaskId]); } catch (err) {
      logger.warn({ err }, "Remote task delete failed (removing local record anyway)");
    }
  }

  // Refund if the work never finished and was never refunded (cancellation confirmed above).
  if (!isFinal(row.status) && row.creditsCharged > 0 && !row.refunded) {
    const updated = await db.update(osTasksTable)
      .set({ refunded: true })
      .where(and(eq(osTasksTable.id, row.id), eq(osTasksTable.refunded, false)))
      .returning({ id: osTasksTable.id });
    if (updated.length > 0) await refundCredits(row.userId, row.creditsCharged);
  }
  await db.delete(osTasksTable).where(eq(osTasksTable.id, row.id));
  res.status(204).send();
});

export default router;
