import { Router } from "express";
import multer from "multer";
import { CLONE_CONSENT_TEXT } from "../lib/consent";
import crypto from "crypto";
import fsp from "node:fs/promises";
import nodePath from "node:path";
import nodeOs from "node:os";
import { spawn } from "node:child_process";
import { db, usersTable, osTasksTable, osDictionariesTable, voiceClonesTable, elVoiceIndexTable, osDubVideosTable, type OsTask } from "@workspace/db";
import { eq, and, or, desc, count, sql, gte, lt, isNotNull, notInArray, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";
import { getSetting, setSetting } from "../lib/settings";
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

/** Run ffmpeg with a hard timeout; rejects with the tail of stderr on failure. */
function runFfmpeg(args: string[], timeoutMs = 120_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-2000); });
    const timer = setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/**
 * Extract the audio track from an uploaded video as MP3 (the dubbing provider
 * only accepts audio). Uses the system ffmpeg binary via temp files.
 */
async function extractAudioTrack(file: Express.Multer.File): Promise<Express.Multer.File> {
  const dir = await fsp.mkdtemp(nodePath.join(nodeOs.tmpdir(), "dub-"));
  const inPath = nodePath.join(dir, "input");
  const outPath = nodePath.join(dir, "audio.mp3");
  try {
    await fsp.writeFile(inPath, file.buffer);
    await runFfmpeg(["-y", "-i", inPath, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", outPath]);
    const buffer = await fsp.readFile(outPath);
    if (buffer.length < 200) throw new Error("Extracted audio is empty — the video may have no audio track");
    const base = (file.originalname || "video").replace(/\.[^.]+$/, "");
    return {
      ...file,
      buffer,
      size: buffer.length,
      mimetype: "audio/mpeg",
      originalname: `${base}.mp3`,
    };
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ── Dubbed-video retention & muxing ─────────────────────────────────────
   The dubbing provider only returns AUDIO. When the original upload was a
   video we retain it until the task settles (which can take minutes and may
   settle via webhook), then mux the dubbed audio back into it so the user
   gets a dubbed VIDEO download. Both the retained source and the muxed
   result live in Postgres (os_dub_videos, bytea) — NOT on local disk — so
   they survive server restarts/redeploys (production disk is ephemeral) and
   would work across multiple instances. Retained sources are removed as soon
   as the task settles; anything left behind (crashes, phase-1 insert
   failures) is removed by age in the periodic sweep. */

const DUB_VIDEO_DIR = nodePath.join(nodeOs.tmpdir(), "os-dub-videos"); // legacy on-disk store (cleanup only)
const DUB_SRC_MAX_AGE_MS = 24 * 60 * 60 * 1000;      // sources: tasks settle within minutes
const DUB_OUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // muxed results stay downloadable for a week

/** Persist the uploaded source video (durably, in the DB) until the dubbing task settles. */
async function retainSourceVideo(file: Express.Multer.File): Promise<number> {
  const [row] = await db.insert(osDubVideosTable).values({
    kind: "src",
    fileName: (file.originalname || "video").slice(0, 200),
    data: file.buffer,
    size: file.buffer.length,
  }).returning({ id: osDubVideosTable.id });
  if (!row) throw new Error("failed to store the source video");
  return row.id;
}

/** Load a retained source video; throws if it was aged out or never stored. */
async function loadRetainedSource(id: number): Promise<{ data: Buffer; fileName: string | null }> {
  const [row] = await db.select({ data: osDubVideosTable.data, fileName: osDubVideosTable.fileName })
    .from(osDubVideosTable)
    .where(and(eq(osDubVideosTable.id, id), eq(osDubVideosTable.kind, "src")));
  // A missing source can never be recovered by retrying → settle audio-only.
  if (!row) throw dubTerminal(new Error("retained source video not found (aged out or removed)"));
  return row;
}

/** Store the muxed dubbed video for a task (atomic upsert — safe under concurrent finalizers). */
async function saveDubbedVideo(taskId: number, data: Buffer): Promise<void> {
  await db.insert(osDubVideosTable)
    .values({ taskId, kind: "out", data, size: data.length })
    .onConflictDoUpdate({
      target: [osDubVideosTable.taskId, osDubVideosTable.kind],
      set: { data, size: data.length, createdAt: new Date() },
    });
}

/** Tag an error as terminal for dub finalization: fall back to audio-only instead of retrying. */
function dubTerminal(err: unknown): Error {
  const e = err instanceof Error ? err : new Error(String(err));
  (e as any).dubTerminal = true;
  return e;
}

/** Download the dubbed audio and mux it into the retained source video (video stream copied). */
async function muxDubbedVideo(srcVideo: Buffer, srcFileName: string | null, audioUrl: string): Promise<Buffer> {
  const dir = await fsp.mkdtemp(nodePath.join(nodeOs.tmpdir(), "dubmux-"));
  // Keep the original extension as an ffmpeg container-detection hint.
  const ext = nodePath.extname(srcFileName || "").slice(0, 8) || ".mp4";
  const srcPath = nodePath.join(dir, `source${ext}`);
  const audioPath = nodePath.join(dir, "dubbed-audio");
  const tmpOut = nodePath.join(dir, "out.mp4");
  try {
    // Audio-download failures are treated as transient (retried by the sweep).
    const resp = await fetch(audioUrl);
    if (!resp.ok) throw new Error(`dubbed audio download failed with HTTP ${resp.status}`);
    await fsp.writeFile(srcPath, srcVideo);
    await fsp.writeFile(audioPath, Buffer.from(await resp.arrayBuffer()));
    try {
      await runFfmpeg([
        "-y", "-i", srcPath, "-i", audioPath,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        tmpOut,
      ]);
    } catch (err) {
      // ffmpeg failures are usually deterministic (bad container/codec) — don't retry.
      throw dubTerminal(err);
    }
    return await fsp.readFile(tmpOut);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Remove aged-out retained sources and muxed results (crash/orphan safety net). */
async function cleanupDubVideos(): Promise<void> {
  const now = Date.now();
  await db.delete(osDubVideosTable).where(and(
    eq(osDubVideosTable.kind, "src"),
    lt(osDubVideosTable.createdAt, new Date(now - DUB_SRC_MAX_AGE_MS)),
  ));
  await db.delete(osDubVideosTable).where(and(
    eq(osDubVideosTable.kind, "out"),
    lt(osDubVideosTable.createdAt, new Date(now - DUB_OUT_MAX_AGE_MS)),
  ));
  // Legacy: age out files from the old on-disk store (pre-durable-storage deploys).
  let entries: string[];
  try {
    entries = await fsp.readdir(DUB_VIDEO_DIR);
  } catch {
    return; // directory doesn't exist
  }
  for (const name of entries) {
    const p = nodePath.join(DUB_VIDEO_DIR, name);
    const st = await fsp.stat(p).catch(() => null);
    if (!st) continue;
    const maxAge = name.startsWith("out-") ? DUB_OUT_MAX_AGE_MS : DUB_SRC_MAX_AGE_MS;
    if (now - st.mtimeMs > maxAge) await fsp.rm(p, { force: true }).catch(() => {});
  }
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

export async function reserveCredits(userId: number, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  // Expiry is enforced atomically here too (not just at request entry in
  // requireActiveUser) so a request that crosses the expiry moment — e.g. a
  // slow upload — cannot still reserve credits. Admins bypass expiry.
  const rows = await db.update(usersTable).set({
    credits: sql`${usersTable.credits} - ${amount}`,
    creditsUsed: sql`${usersTable.creditsUsed} + ${amount}`,
  }).where(and(
    eq(usersTable.id, userId),
    gte(usersTable.credits, amount),
    sql`(${usersTable.isAdmin} = true OR ${usersTable.planExpiresAt} IS NULL OR ${usersTable.planExpiresAt} > now())`,
  ))
    .returning({ id: usersTable.id });
  return rows.length > 0;
}

export async function refundCredits(userId: number, amount: number) {
  if (amount <= 0) return;
  await db.update(usersTable).set({
    credits: sql`${usersTable.credits} + ${amount}`,
    creditsUsed: sql`GREATEST(0, ${usersTable.creditsUsed} - ${amount})`,
  }).where(eq(usersTable.id, userId));
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

/** Convert the provider's cost into the credits charged to an OpenRadio user. */
function customerCreditsForTool(tool: string, providerCredits: number): number {
  return tool === "image"
    ? Math.max(1, Math.ceil(providerCredits * 1.1))
    : providerCredits;
}

/**
 * Apply a provider task state and its credit adjustment atomically. The task row
 * lock prevents a webhook and a history poll from reconciling/refunding the same
 * task from different stale snapshots.
 */
async function applyTaskState(row: OsTask, state: OsTaskState): Promise<OsTask> {
  const saved = await db.transaction(async (tx) => {
    let [current] = await tx.select().from(osTasksTable)
      .where(eq(osTasksTable.id, row.id)).for("update");
    if (!current || isFinal(current.status)) return current ?? row;

    const status = state.status === "done" ? "done" : state.status === "error" ? "error" : "processing";
    const customerCost = typeof state.credit_cost === "number" && state.credit_cost >= 0
      ? customerCreditsForTool(current.tool, state.credit_cost)
      : null;
    let creditsCharged = current.creditsCharged;
    let refunded = current.refunded;

    // A failed provider task returns the full amount currently charged.
    if (status === "error" && creditsCharged > 0 && !refunded) {
      await tx.update(usersTable).set({
        credits: sql`${usersTable.credits} + ${creditsCharged}`,
        creditsUsed: sql`GREATEST(0, ${usersTable.creditsUsed} - ${creditsCharged})`,
      }).where(eq(usersTable.id, current.userId));
      refunded = true;
    }

    // Reconcile successful/in-progress work to the provider's final reported
    // cost. Image customer pricing is applied by customerCreditsForTool above.
    if (status !== "error" && creditsCharged > 0 && customerCost !== null && customerCost !== creditsCharged) {
      const diff = customerCost - creditsCharged;
      if (diff > 0) {
        const [user] = await tx.select({ credits: usersTable.credits }).from(usersTable)
          .where(eq(usersTable.id, current.userId)).for("update");
        const take = Math.min(diff, Math.max(0, user?.credits ?? 0));
        if (take > 0) {
          await tx.update(usersTable).set({
            credits: sql`${usersTable.credits} - ${take}`,
            creditsUsed: sql`${usersTable.creditsUsed} + ${take}`,
          }).where(eq(usersTable.id, current.userId));
        }
        // Record only what was actually collected, so a later provider failure
        // can never refund more credits than this task deducted.
        creditsCharged += take;
      } else {
        await tx.update(usersTable).set({
          credits: sql`${usersTable.credits} + ${-diff}`,
          creditsUsed: sql`GREATEST(0, ${usersTable.creditsUsed} - ${-diff})`,
        }).where(eq(usersTable.id, current.userId));
        creditsCharged = customerCost;
      }
    }

    const [saved] = await tx.update(osTasksTable).set({
      status,
      output: state.metadata ?? current.output,
      error: status === "error" ? (state.error_message ?? "Generation failed") : null,
      creditsCharged,
      refunded,
      updatedAt: new Date(),
    }).where(eq(osTasksTable.id, current.id)).returning();
    return saved ?? current;
  });
  // Dubbing tasks whose original upload was a video: mux the dubbed audio back
  // into the retained source video once the task is final (outside the tx —
  // ffmpeg + the audio download can take seconds).
  if (saved && saved.tool === "dubbing" && isFinal(saved.status)) {
    return finalizeDubbedVideo(saved);
  }
  return saved;
}

// Tasks currently being finalized (in-process guard: the settle tx guarantees
// only one caller transitions a task to final, but a concurrent caller that
// observes the already-final row could otherwise start a second mux).
const dubFinalizing = new Set<number>();

/**
 * When a dubbing task settles and the original upload was a video (a retained
 * source path is recorded in the task input), mux the dubbed audio back into
 * that video and expose it as a download. Falls back to the audio-only result
 * if muxing fails. Always removes the retained source afterwards.
 */
async function finalizeDubbedVideo(row: OsTask): Promise<OsTask> {
  const input = (row.input ?? {}) as Record<string, unknown>;
  const srcId = typeof input._sourceVideoId === "number" ? input._sourceVideoId : null;
  // Legacy: tasks created before durable storage recorded an on-disk path.
  const legacySrcPath = typeof input._sourceVideoPath === "string" ? input._sourceVideoPath : null;
  if ((srcId === null && !legacySrcPath) || dubFinalizing.has(row.id)) return row;
  dubFinalizing.add(row.id);
  // Only drop the retained source + input marker once finalization reached a
  // terminal outcome (video stored, task errored, or unrecoverable failure).
  // Transient failures keep both so the sweep retries; the 24h source age-out
  // bounds retries — once the source is gone the not-found path settles.
  let settled = true;
  try {
    const cleanInput = { ...input };
    delete cleanInput._sourceVideoId;
    delete cleanInput._sourceVideoPath;
    let output = (row.output ?? null) as Record<string, unknown> | null;
    if (row.status === "done") {
      const m = (output ?? {}) as Record<string, any>;
      const audioUrl = [m.audio_url, m.dubbed_audio_url, m.output_audio_url]
        .find((u) => typeof u === "string" && u.startsWith("http")) ?? null;
      try {
        // Crash recovery: a previous attempt may have stored the muxed video
        // but died before updating the task JSON — just expose it then.
        const existing = await db.select({ id: osDubVideosTable.id }).from(osDubVideosTable)
          .where(and(eq(osDubVideosTable.taskId, row.id), eq(osDubVideosTable.kind, "out")));
        if (existing.length === 0) {
          if (!audioUrl) throw dubTerminal(new Error("provider output has no dubbed audio url"));
          const src = srcId !== null
            ? await loadRetainedSource(srcId)
            : { data: await fsp.readFile(legacySrcPath!).catch((e) => { throw dubTerminal(e); }), fileName: legacySrcPath };
          const muxed = await muxDubbedVideo(src.data, src.fileName, audioUrl);
          await saveDubbedVideo(row.id, muxed);
        }
        output = { ...m, dubbed_video_url: `/api/os/tasks/${row.id}/video` };
      } catch (err) {
        if (!(err as any)?.dubTerminal) {
          // Transient (audio download, DB hiccup): leave the task untouched so
          // the periodic sweep picks it up again via the retained-source marker.
          settled = false;
          logger.warn({ err, taskId: row.id }, "Dubbing: video finalization failed transiently — will retry via sweep");
          return row;
        }
        logger.error({ err, taskId: row.id }, "Dubbing: muxing dubbed audio into the original video failed — keeping audio-only result");
      }
    }
    const [saved] = await db.update(osTasksTable)
      .set({ input: cleanInput, output, updatedAt: new Date() })
      .where(eq(osTasksTable.id, row.id)).returning();
    return saved ?? row;
  } catch (err) {
    // Unexpected failure outside the mux block (e.g. the task update): retry via sweep.
    settled = false;
    logger.warn({ err, taskId: row.id }, "Dubbing: video finalization failed — will retry via sweep");
    return row;
  } finally {
    dubFinalizing.delete(row.id);
    if (settled) {
      if (srcId !== null) {
        await db.delete(osDubVideosTable)
          .where(and(eq(osDubVideosTable.id, srcId), eq(osDubVideosTable.kind, "src")))
          .catch(() => {});
      }
      if (legacySrcPath) await fsp.rm(legacySrcPath, { force: true }).catch(() => {});
    }
  }
}

/** Refresh a non-final task from the provider; swallow transient provider errors. */
export async function refreshTask(row: OsTask): Promise<OsTask> {
  if (isFinal(row.status) || !row.externalTaskId) return row;
  try {
    const state = await getTask(row.externalTaskId);
    return await applyTaskState(row, state);
  } catch (err) {
    logger.warn({ err, taskId: row.externalTaskId }, "OpenSpeaker task refresh failed");
    return row;
  }
}

/** Strip internal (underscore-prefixed) keys, e.g. the retained video path, before sending to the client. */
function publicJsonRecord(v: unknown): unknown {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v ?? null;
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !k.startsWith("_")));
}

export function taskJson(t: OsTask) {
  return {
    id: t.id,
    tool: t.tool,
    status: t.status,
    title: t.title,
    input: publicJsonRecord(t.input),
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

  // Phase 1 — record the task BEFORE calling the provider, so it shows up in
  // History immediately (uploads to the provider can take minutes, and the user
  // may navigate away meanwhile). If we can't even record it, refund and stop.
  let row: OsTask;
  try {
    [row] = await db.insert(osTasksTable).values({
      userId: user.id,
      tool,
      externalTaskId: null,
      status: "processing",
      title: title.slice(0, 120),
      input,
      creditsCharged: reserve,
      webhookToken: token,
    }).returning();
  } catch (err: any) {
    if (!admin) await refundCredits(user.id, reserve);
    logger.error({ err, tool }, "OpenSpeaker task row insert failed");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // Phase 2 — provider call. On failure the task stays in History as an error
  // row; applyTaskState refunds the reservation atomically (refund-once lock).
  let created: { task_id?: string } & Record<string, any>;
  try {
    created = await create(webhookUrlFor(token));
  } catch (err: any) {
    const message = err instanceof OpenSpeakerError ? err.message : "Internal server error";
    try {
      await applyTaskState(row, { id: row.externalTaskId ?? "", status: "error", error_message: message });
    } catch (applyErr: any) {
      logger.error({ err: applyErr, tool, taskId: row.id }, "Failed to settle errored task; sweep must reconcile");
    }
    if (err instanceof OpenSpeakerError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err, tool }, "OpenSpeaker task create error");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  // A "successful" create without a task id can never be polled or settled by
  // the webhook — treat it as a failure and refund, instead of leaving a row
  // stuck in "processing" forever.
  const externalId = created.task_id ?? null;
  if (!externalId) {
    logger.error({ tool, created }, "OpenSpeaker accepted a task but returned no task_id");
    try {
      await applyTaskState(row, { id: "", status: "error", error_message: "The provider did not return a task id. Credits refunded." });
    } catch (applyErr: any) {
      logger.error({ err: applyErr, tool, taskId: row.id }, "Failed to settle no-task-id task");
    }
    res.status(502).json({ error: "The provider did not accept the task. Please try again." });
    return;
  }

  // Phase 3 — attach the provider task id. The provider has accepted (and may
  // bill) the task, so failures here must NOT refund; they only report a
  // tracking problem.
  try {
    const [updated] = await db.update(osTasksTable)
      .set({ externalTaskId: externalId, updatedAt: new Date() })
      .where(eq(osTasksTable.id, row.id)).returning();
    if (updated) row = updated;
    // Immediately sync once — the provider reports credit_cost right away,
    // which reconciles our reservation to the real cost.
    row = await refreshTask(row);
    res.json({ task: taskJson(row) });
  } catch (err: any) {
    logger.error({ err, tool, externalTaskId: externalId }, "OpenSpeaker task accepted but local tracking failed");
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
export async function assertCloneOwnership(req: any, voiceId: string): Promise<boolean> {
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
    // ElevenLabs is always served from the local index (upstream pagination
    // is unreliable both with and without a search term).
    if (provider === "elevenlabs") {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size ?? "24")) || 24));
      const f: AggFilters = {
        search,
        language: typeof req.query.language === "string" ? req.query.language.trim() : "",
        gender: typeof req.query.gender === "string" ? req.query.gender.trim() : "",
      };
      const list = await elLocalQuery(f);
      res.json({
        success: true,
        data: list.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, page_size: pageSize, total: list.length },
        indexing: elIndexing(), // true while the background sweep is still growing the index
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

const AGG_PROVIDERS = ["elevenlabs", "minimax", "fishaudio", "edge"] as const;

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

/* ── ElevenLabs local index ─────────────────────────────────────────────
   Upstream quirks make the 16k+ ElevenLabs catalog unbrowsable directly:
   `page` is ignored without a search term (and even for many search terms),
   and page_size is capped at ~100-120 results per query. So we build our own
   index: a background crawler sweeps a broad set of search terms, merges the
   unique voices into memory, and every ElevenLabs listing/search is served
   from this locally-paginated index (correct, stable pages). */

const EL_INDEX = new Map<string, any>();          // voice_id → voice
const EL_INDEX_MAX = 20_000;                      // hard cap on indexed voices
// Per-term crawl state: bounded, with failure backoff and shared in-flight
// promises so concurrent requests never duplicate upstream calls.
type ElTermState = { status: "done" | "failed"; failures: number; retryAt: number };
const elTermState = new Map<string, ElTermState>();
const EL_TERM_STATE_MAX = 500;
const EL_TERM_MAX_FAILURES = 3;
const elInflightTerms = new Map<string, Promise<void>>();
let elActiveCrawls = 0;
const EL_MAX_CONCURRENT_CRAWLS = 2;               // global upstream rate cap
let elCrawlRunning = false;
let elCrawlDone = false;
const EL_MAX_PAGES_PER_TERM = 4;
const EL_CRAWL_TERMS = [
  // voice qualities / delivery styles
  "narrator", "narration", "calm", "warm", "deep", "soft", "energetic", "confident",
  "professional", "conversational", "friendly", "smooth", "expressive", "clear",
  "authoritative", "soothing", "natural", "dynamic", "cheerful", "serious", "gentle",
  "raspy", "bright", "mature", "young", "elderly", "old", "crisp", "rich", "powerful",
  // use cases
  "audiobook", "podcast", "commercial", "documentary", "storytelling", "meditation",
  "asmr", "news", "radio", "cartoon", "character", "gaming", "anime", "advertising",
  "explainer", "tutorial", "corporate", "social media", "announcer", "presenter",
  "singer", "whisper", "villain", "hero", "robot", "kids", "children",
  // languages / accents
  "english", "american", "british", "australian", "indian", "spanish", "mexican",
  "french", "german", "italian", "portuguese", "brazilian", "russian", "arabic",
  "hindi", "urdu", "chinese", "mandarin", "japanese", "korean", "turkish",
  "vietnamese", "indonesian", "polish", "dutch", "swedish", "greek", "hebrew",
  "thai", "filipino", "african", "nigerian", "irish", "scottish", "welsh", "canadian",
  // common voice-name fragments
  "a", "e", "i", "o", "voice", "man", "woman", "male", "female", "aria", "adam",
  "alex", "anna", "david", "emma", "james", "john", "lisa", "maria", "mike", "sam",
  "sara", "tom", "kai", "leo", "mia", "noor", "omar", "ali", "ahmed", "fatima",
];

function elAddVoices(data: any): { added: number; first?: string } {
  const voices: any[] = Array.isArray(data?.data) ? data.data : [];
  let added = 0;
  for (const v of voices) {
    if (!v?.voice_id) continue;
    const known = EL_INDEX.has(v.voice_id);
    if (known) {
      EL_INDEX.set(v.voice_id, v); // refresh data for voices we already track
      elUnsavedIds.add(v.voice_id);
    } else if (EL_INDEX.size < EL_INDEX_MAX) {
      EL_INDEX.set(v.voice_id, v);
      elUnsavedIds.add(v.voice_id);
      added++;
    }
  }
  if (elUnsavedIds.size > 0) elScheduleSnapshotFlush();
  return { added, first: voices[0]?.voice_id };
}

/* ── Snapshot persistence: the crawled index survives restarts ──────────
   Rows live in el_voice_index (voice_id → raw voice JSON); the sweep's
   completion time is stored in app_settings under EL_SNAPSHOT_META_KEY.
   At startup the snapshot is loaded into EL_INDEX; the crawler only
   re-runs when the snapshot is older than EL_SNAPSHOT_TTL_MS. */

const EL_SNAPSHOT_META_KEY = "el_index_meta";
const EL_SNAPSHOT_TTL_MS = 24 * 60 * 60_000; // re-crawl when older than ~24h
const EL_SNAPSHOT_MIN = 1_000;               // fewer rows = partial crawl, don't trust it
const EL_SNAPSHOT_CHUNK = 400;               // rows per upsert statement

const elUnsavedIds = new Set<string>();      // voices added/refreshed since last DB write
let elFlushTimer: NodeJS.Timeout | null = null;

async function elUpsertRows(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += EL_SNAPSHOT_CHUNK) {
    const rows = ids.slice(i, i + EL_SNAPSHOT_CHUNK)
      .map((id) => EL_INDEX.get(id))
      .filter(Boolean)
      .map((v) => ({ voiceId: v.voice_id as string, data: v, updatedAt: new Date() }));
    if (rows.length === 0) continue;
    await db.insert(elVoiceIndexTable).values(rows).onConflictDoUpdate({
      target: elVoiceIndexTable.voiceId,
      set: { data: sql`excluded.data`, updatedAt: sql`excluded.updated_at` },
    });
  }
}

/* Debounced incremental flush so on-demand search crawls (and sweep progress)
   are durable without a DB write per upstream page. */
function elScheduleSnapshotFlush(): void {
  if (elFlushTimer) return;
  elFlushTimer = setTimeout(async () => {
    elFlushTimer = null;
    const ids = [...elUnsavedIds];
    elUnsavedIds.clear();
    try {
      await elUpsertRows(ids);
    } catch (err) {
      for (const id of ids) elUnsavedIds.add(id); // retry on the next flush
      logger.warn({ err, pending: ids.length }, "ElevenLabs snapshot incremental flush failed");
    }
  }, 15_000);
  elFlushTimer.unref?.();
}

/* Load persisted rows into EL_INDEX. Returns true when the snapshot is
   complete and fresh enough that the sweep can be skipped entirely. */
async function elLoadSnapshot(): Promise<boolean> {
  const rows = await db.select().from(elVoiceIndexTable);
  for (const row of rows) {
    const v: any = row.data;
    if (v?.voice_id && !EL_INDEX.has(v.voice_id) && EL_INDEX.size < EL_INDEX_MAX) {
      EL_INDEX.set(v.voice_id, v);
    }
  }
  const meta = await getSetting<{ refreshedAt?: string } | undefined>(EL_SNAPSHOT_META_KEY);
  const refreshedAt = meta?.refreshedAt ? Date.parse(meta.refreshedAt) : NaN;
  const fresh =
    rows.length >= EL_SNAPSHOT_MIN &&
    Number.isFinite(refreshedAt) &&
    Date.now() - refreshedAt < EL_SNAPSHOT_TTL_MS;
  if (rows.length > 0) {
    logger.info({ loaded: rows.length, fresh }, "ElevenLabs voice snapshot loaded");
  }
  return fresh;
}

/* Full save after a completed sweep: upsert everything and stamp refreshed-at. */
async function elSaveSnapshot(): Promise<void> {
  await elUpsertRows([...EL_INDEX.keys()]);
  elUnsavedIds.clear();
  await setSetting(EL_SNAPSHOT_META_KEY, { refreshedAt: new Date().toISOString() });
  logger.info({ saved: EL_INDEX.size }, "ElevenLabs voice snapshot saved");
}

function elSetTermState(key: string, state: ElTermState): void {
  if (!elTermState.has(key) && elTermState.size >= EL_TERM_STATE_MAX) {
    const oldest = elTermState.keys().next().value;
    if (oldest !== undefined) elTermState.delete(oldest);
  }
  elTermState.set(key, state);
}

async function elFetchPage(search: string, page: number): Promise<any> {
  const p = new URLSearchParams({ provider: "elevenlabs", page: String(page), page_size: "100" });
  if (search) p.set("search", search);
  return osGetJson(`/v3/voices?${p.toString()}`, "Voice library");
}

/* Crawl one search term; follows pagination only while it actually advances.
   Concurrent callers share the same in-flight promise; failures back off and
   are retried at most EL_TERM_MAX_FAILURES times; global concurrency capped. */
function elCrawlTerm(term: string): Promise<void> {
  const key = term.toLowerCase().trim().slice(0, 64);
  const st = elTermState.get(key);
  if (st?.status === "done") return Promise.resolve();
  if (st?.status === "failed" && (st.failures >= EL_TERM_MAX_FAILURES || Date.now() < st.retryAt)) {
    return Promise.resolve();
  }
  const inflight = elInflightTerms.get(key);
  if (inflight) return inflight;
  const run = (async () => {
    while (elActiveCrawls >= EL_MAX_CONCURRENT_CRAWLS) {
      await new Promise((r) => setTimeout(r, 200));
    }
    elActiveCrawls++;
    try {
      const p1: any = await elFetchPage(key, 1);
      const r1 = elAddVoices(p1);
      const count1 = Array.isArray(p1?.data) ? p1.data.length : 0;
      const total = Number(p1?.pagination?.total ?? 0);
      if (count1 >= 100 && total > count1 && EL_INDEX.size < EL_INDEX_MAX) {
        for (let page = 2; page <= EL_MAX_PAGES_PER_TERM; page++) {
          const pn: any = await elFetchPage(key, page);
          const firstId = Array.isArray(pn?.data) ? pn.data[0]?.voice_id : undefined;
          if (!firstId || firstId === r1.first) break; // upstream pagination broken for this term
          elAddVoices(pn);
          if ((pn.data?.length ?? 0) < 100 || EL_INDEX.size >= EL_INDEX_MAX) break;
        }
      }
      elSetTermState(key, { status: "done", failures: 0, retryAt: 0 });
    } catch (err) {
      const failures = (st?.failures ?? 0) + 1;
      elSetTermState(key, { status: "failed", failures, retryAt: Date.now() + failures * 30_000 });
      logger.warn({ err, term: key, failures }, "ElevenLabs index crawl term failed");
    } finally {
      elActiveCrawls--;
      elInflightTerms.delete(key);
    }
  })();
  elInflightTerms.set(key, run);
  return run;
}

/* Kick off index initialization once per process (fire-and-forget):
   load the persisted snapshot; if it is complete and fresh (<24h) skip the
   sweep entirely, otherwise run the background sweep (failed terms retried
   in bounded extra passes; a degraded finish is logged) and persist the
   result for the next restart. */
function elEnsureIndex(): void {
  if (elCrawlRunning || elCrawlDone) return;
  elCrawlRunning = true;
  (async () => {
    try {
      let snapshotFresh = false;
      try {
        snapshotFresh = await elLoadSnapshot();
      } catch (err) {
        logger.warn({ err }, "ElevenLabs voice snapshot load failed — falling back to full crawl");
      }
      if (snapshotFresh) {
        elCrawlDone = true;
        logger.info({ indexed: EL_INDEX.size }, "ElevenLabs voice index restored from snapshot; crawl skipped");
        return;
      }
      const sweep = ["", ...EL_CRAWL_TERMS];
      for (let pass = 1; pass <= 3; pass++) {
        let pending = 0;
        for (const term of sweep) {
          const key = term.toLowerCase().trim().slice(0, 64);
          const st = elTermState.get(key);
          if (st?.status === "done" || (st?.status === "failed" && st.failures >= EL_TERM_MAX_FAILURES)) continue;
          if (st?.status === "failed" && Date.now() < st.retryAt) {
            await new Promise((r) => setTimeout(r, Math.min(st.retryAt - Date.now(), 30_000)));
          }
          await elCrawlTerm(term);
          pending++;
          await new Promise((r) => setTimeout(r, 150));
        }
        const failed = [...elTermState.values()].filter((s) => s.status === "failed").length;
        if (failed === 0 || pass === 3) {
          if (failed > 0) logger.warn({ failed, indexed: EL_INDEX.size }, "ElevenLabs voice index built degraded");
          else logger.info({ indexed: EL_INDEX.size }, "ElevenLabs voice index built");
          break;
        }
        if (pending === 0) break;
      }
      elCrawlDone = true;
      try {
        await elSaveSnapshot();
      } catch (err) {
        logger.warn({ err }, "ElevenLabs voice snapshot save failed — index stays in-memory only");
      }
    } finally {
      elCrawlRunning = false;
    }
  })().catch((err) => {
    logger.error({ err }, "ElevenLabs index crawl crashed");
    elCrawlDone = true; // stop client polling; index stays partial until restart
  });
}

function elVoiceMatches(v: any, f: AggFilters): boolean {
  if (f.gender && v.gender !== f.gender) return false;
  if (f.language && v.language !== f.language) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${v.name ?? ""} ${v.description ?? ""} ${v.accent ?? ""} ${v.category ?? ""} ${(v.tags ?? []).join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/* Local, stably-ordered query over the index (insertion order is stable). */
export async function elLocalQuery(f: AggFilters): Promise<any[]> {
  elEnsureIndex();
  // On-demand: pull the user's search term into the index so results go
  // beyond what the sweep found (up to 4 upstream pages, cached by term).
  if (f.search && f.search.length >= 2) await elCrawlTerm(f.search);
  const out: any[] = [];
  for (const v of EL_INDEX.values()) if (elVoiceMatches(v, f)) out.push(v);
  return out;
}

function elIndexing(): boolean {
  return !elCrawlDone;
}

async function aggProviderTotal(provider: string, f: AggFilters): Promise<number> {
  if (provider === "elevenlabs") return (await elLocalQuery(f)).length;
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
  if (provider === "elevenlabs") {
    return (await elLocalQuery(f)).slice((page - 1) * pageSize, page * pageSize);
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
      indexing: elIndexing(),
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

/**
 * The /v1/task/* endpoints (dubbing, voice-changer) forward voice ids straight
 * to ElevenLabs, so they need the RAW ElevenLabs id. The prefixed
 * "elevenlabs_<id>" form used by the /v3 endpoints is accepted at creation but
 * fails during processing with "elevenlabs_voice_not_found" (verified live).
 * Other prefixes (clone_, ...) are passed through unchanged.
 */
function rawElevenVoiceId(voiceId: string): string {
  return voiceId.startsWith("elevenlabs_") ? voiceId.slice("elevenlabs_".length) : voiceId;
}

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
  let file = req.file;
  let sourceVideoId: number | null = null;

  // The provider's dubbing endpoint only accepts AUDIO files — video uploads
  // are rejected with "Invalid file" (verified live). Extract the audio track
  // from video uploads before submitting, and retain the original video so the
  // dubbed audio can be muxed back into it when the task settles.
  if (String(file.mimetype || "").startsWith("video/")) {
    try {
      file = await extractAudioTrack(file);
    } catch (err: any) {
      logger.error({ err, fileName: req.file.originalname }, "Dubbing: audio extraction from video failed");
      res.status(400).json({ error: "Could not read the audio track from this video. Please check the file has sound, or upload an MP3/WAV instead." });
      return;
    }
    try {
      sourceVideoId = await retainSourceVideo(req.file);
    } catch (err) {
      logger.warn({ err, fileName: req.file.originalname }, "Dubbing: could not retain the source video — the result will be audio-only");
    }
  }

  await runCreateTask({
    req, res, tool: "dubbing",
    title: `${req.file.originalname || "audio"} → ${targetLang}`,
    input: {
      targetLang, sourceLang, numSpeakers, fileName: req.file.originalname, fileSize: req.file.size,
      ...(sourceVideoId !== null ? { _sourceVideoId: sourceVideoId } : {}),
    },
    estimate: Math.max(500, Math.ceil(file.size / 20_000)), // reconciled to real cost right after creation
    create: async (webhookUrl) => {
      const form = new FormData();
      form.append("file", new Blob([file.buffer as any], { type: file.mimetype }), file.originalname || "audio.mp3");
      form.append("num_speakers", String(numSpeakers));
      form.append("source_lang", sourceLang);
      form.append("target_lang", targetLang);
      if (voiceId) form.append("voice_id", rawElevenVoiceId(voiceId));
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
      form.append("voice_id", rawElevenVoiceId(voiceId));
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
  return customerCreditsForTool("image", data.credits);
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

/** Download the muxed dubbed video (dubbing tasks whose original upload was a video). */
router.get("/tasks/:id/video", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(osTasksTable)
    .where(and(eq(osTasksTable.id, id), eq(osTasksTable.userId, req.appUser!.id)));
  if (!row || row.tool !== "dubbing" || row.status !== "done") {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const [vid] = await db.select({ data: osDubVideosTable.data, size: osDubVideosTable.size })
    .from(osDubVideosTable)
    .where(and(eq(osDubVideosTable.taskId, row.id), eq(osDubVideosTable.kind, "out")));
  if (!vid) {
    res.status(410).json({ error: "The dubbed video is no longer available. Please download the audio, or run the dubbing again." });
    return;
  }
  const base = String((row.input as any)?.fileName || "video").replace(/\.[^.]+$/, "").slice(0, 80) || "video";
  res.type("video/mp4");
  res.attachment(`${base} (dubbed).mp4`);
  res.send(vid.data);
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
  // Remove any retained source / muxed dubbed video for this task.
  if (row.tool === "dubbing") {
    const srcId = (row.input as any)?._sourceVideoId;
    await db.delete(osDubVideosTable).where(
      typeof srcId === "number"
        ? or(eq(osDubVideosTable.taskId, row.id), and(eq(osDubVideosTable.id, srcId), eq(osDubVideosTable.kind, "src")))
        : eq(osDubVideosTable.taskId, row.id),
    ).catch(() => {});
    // Legacy on-disk leftovers from before durable storage.
    const src = (row.input as any)?._sourceVideoPath;
    if (typeof src === "string") await fsp.rm(src, { force: true }).catch(() => {});
    await fsp.rm(nodePath.join(DUB_VIDEO_DIR, `out-${row.id}.mp4`), { force: true }).catch(() => {});
  }
  res.status(204).send();
});

/* ═══════════════ Background sweep for abandoned tasks ═══════════════ */

/**
 * Tasks are normally settled when the user polls them or the provider webhook
 * fires. If the user closes the tab right after submitting and the webhook
 * never arrives, a task can sit "processing" with credits reserved forever.
 * This sweep refreshes stale non-final tasks from the provider so charge /
 * refund reconciliation (applyTaskState) eventually runs for every task.
 *
 * Tasks without an externalTaskId are skipped at the query level — there is
 * nothing to ask the provider about (refreshTask would skip them anyway).
 */
const SWEEP_STALE_AFTER_MS = 15 * 60 * 1000; // only touch tasks older than this
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const SWEEP_BATCH_LIMIT = 25; // cap provider calls per sweep

let sweepRunning = false;

export async function sweepStaleOsTasks(): Promise<void> {
  if (sweepRunning) return; // don't overlap if a sweep outlives the interval
  sweepRunning = true;
  try {
    // Recover dubbing finalizations interrupted by a crash/redeploy: a task can
    // settle to done/error with the retained-source marker still in its input
    // (the process died before muxing or before the input/output update).
    // finalizeDubbedVideo is idempotent: it reuses an already-stored result,
    // retries transient failures, and settles audio-only on terminal ones.
    try {
      const pendingDubs = await db.select().from(osTasksTable)
        .where(and(
          eq(osTasksTable.tool, "dubbing"),
          inArray(osTasksTable.status, ["done", "error"]),
          sql`(${osTasksTable.input}::jsonb) ? '_sourceVideoId'`,
        ))
        .limit(10);
      for (const row of pendingDubs) {
        await finalizeDubbedVideo(row).catch((err) =>
          logger.warn({ err, taskId: row.id }, "Dubbing finalize recovery failed"));
      }
    } catch (err) {
      logger.warn({ err }, "Dubbing finalize recovery sweep failed");
    }
    // Age out orphaned dubbing video blobs (crashes, deploys, phase-1 failures).
    await cleanupDubVideos();
    const cutoff = new Date(Date.now() - SWEEP_STALE_AFTER_MS);
    const stale = await db.select().from(osTasksTable)
      .where(and(
        notInArray(osTasksTable.status, ["done", "error"]),
        isNotNull(osTasksTable.externalTaskId),
        lt(osTasksTable.updatedAt, cutoff),
      ))
      .orderBy(osTasksTable.updatedAt)
      .limit(SWEEP_BATCH_LIMIT);
    if (stale.length === 0) return;
    logger.info({ count: stale.length }, "Sweeping stale OpenSpeaker tasks");
    for (const row of stale) {
      // refreshTask swallows transient provider errors; applyTaskState
      // settles credits (refund-once via the refunded flag, extra-charge via
      // the creditsCharged compare-and-set) and bumps updatedAt so a task
      // that is still genuinely processing isn't re-polled until next cutoff.
      await refreshTask(row);
      // If the provider lookup failed, refreshTask leaves the row untouched.
      // Bump updatedAt anyway (no-op when applyTaskState already saved) so
      // permanently-failing rows rotate to the back of the queue instead of
      // monopolizing every batch and starving newer abandoned tasks.
      await db.update(osTasksTable)
        .set({ updatedAt: new Date() })
        .where(and(eq(osTasksTable.id, row.id), lt(osTasksTable.updatedAt, cutoff)));
    }
  } catch (err) {
    logger.warn({ err }, "Stale OpenSpeaker task sweep failed");
  } finally {
    sweepRunning = false;
  }
}

/** Kick off ElevenLabs voice-index initialization at boot (snapshot load,
 *  then a crawl only if the snapshot is stale) instead of waiting for the
 *  first Voice Library request. Fire-and-forget. */
export function startElVoiceIndex(): void {
  elEnsureIndex();
}

/** Start the periodic sweep. Returns the timer (unref'd so it never blocks shutdown). */
export function startOsTaskSweeper(): NodeJS.Timeout {
  const timer = setInterval(() => { void sweepStaleOsTasks(); }, SWEEP_INTERVAL_MS);
  timer.unref();
  // Run one pass shortly after boot to settle anything abandoned while down.
  setTimeout(() => { void sweepStaleOsTasks(); }, 15_000).unref();
  return timer;
}

export default router;
