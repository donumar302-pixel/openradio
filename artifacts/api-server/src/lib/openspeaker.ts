import { logger } from "./logger";

/**
 * Server-side OpenSpeaker API client.
 * The API key stays on the server — it must NEVER be sent to browser code.
 *
 * Contract summary (verified against the official OpenSpeaker docs):
 *  - Base URL https://api.openspeaker.ai, auth header `xi-api-key`.
 *  - Generation endpoints create asynchronous tasks: { success, task_id }.
 *  - Poll GET /v1/task/{id} → { id, status: doing|done|error, credit_cost,
 *    metadata: { audio_url, srt_url, json_url, result_images, ... }, progress, type }.
 *  - POST /v1/task/delete { task_ids: [...] } → { success, refunded_credits }.
 */

const BASE = "https://api.openspeaker.ai";
const TIMEOUT_MS = 60_000;

export class OpenSpeakerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.OPENSPEAKER_API_KEY;
  if (!key) throw new OpenSpeakerError("OpenSpeaker is not configured on this server.", 503);
  return key;
}

async function osFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "xi-api-key": apiKey(), ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Parse an OpenSpeaker JSON response; throws OpenSpeakerError with a safe message on failure. */
async function parseJson<T = any>(res: Response, what: string): Promise<T> {
  let body: any = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || (body && body.success === false)) {
    const msg = body?.message
      ?? body?.error?.message
      ?? (Array.isArray(body?.errors)
        ? body.errors.map((e: any) => typeof e === "string" ? e : `${e.field}: ${e.message}`).join("; ")
        : typeof body?.error === "string" ? body.error : null)
      ?? `${what} failed`;
    logger.warn({ status: res.status, what, msg }, "OpenSpeaker API error");
    throw new OpenSpeakerError(String(msg), res.status >= 500 ? 502 : res.status === 401 ? 503 : 400);
  }
  return body as T;
}

export async function osGetJson<T = any>(path: string, what = "OpenSpeaker request"): Promise<T> {
  return parseJson<T>(await osFetch(path), what);
}

export async function osPostJson<T = any>(path: string, body: unknown, what = "OpenSpeaker request"): Promise<T> {
  const res = await osFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res, what);
}

export async function osPostForm<T = any>(path: string, form: FormData, what = "OpenSpeaker request"): Promise<T> {
  const res = await osFetch(path, { method: "POST", body: form });
  return parseJson<T>(res, what);
}

export async function osPutJson<T = any>(path: string, body: unknown, what = "OpenSpeaker request"): Promise<T> {
  const res = await osFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res, what);
}

export async function osDelete<T = any>(path: string, what = "OpenSpeaker request"): Promise<T> {
  const res = await osFetch(path, { method: "DELETE" });
  return parseJson<T>(res, what);
}

/* ── Typed helpers ───────────────────────────────────────────────────── */

export interface OsTaskState {
  id: string;
  created_at?: string;
  status: "doing" | "done" | "error" | string;
  error_message?: string | null;
  credit_cost?: number;
  metadata?: Record<string, any> | null;
  progress?: number;
  type?: string;
}

export async function getTask(taskId: string): Promise<OsTaskState> {
  return osGetJson<OsTaskState>(`/v1/task/${encodeURIComponent(taskId)}`, "Task lookup");
}

export async function deleteTasks(taskIds: string[]): Promise<{ success: boolean; refunded_credits?: number }> {
  return osPostJson(`/v1/task/delete`, { task_ids: taskIds }, "Task delete");
}

export async function getProviderCredits(): Promise<number | null> {
  try {
    const data = await osGetJson<{ credits?: number }>(`/v1/credits`, "Credits");
    return typeof data.credits === "number" ? data.credits : null;
  } catch {
    return null;
  }
}

export const OS_VOICE_PROVIDERS = ["elevenlabs", "minimax", "clone", "edge", "vbee", "fishaudio"] as const;
export type OsVoiceProvider = (typeof OS_VOICE_PROVIDERS)[number];

export function isOsVoiceProvider(p: string): p is OsVoiceProvider {
  return (OS_VOICE_PROVIDERS as readonly string[]).includes(p);
}

/** Valid voice_id prefixes for generation (kokoro intentionally excluded — not an active source). */
const VOICE_ID_RE = /^(elevenlabs|minimax|clone|edge|vbee|fishaudio)_.+/;

export function isValidOsVoiceId(voiceId: unknown): voiceId is string {
  return typeof voiceId === "string" && VOICE_ID_RE.test(voiceId);
}
