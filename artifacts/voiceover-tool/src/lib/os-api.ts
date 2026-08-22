/** Client helpers for the OpenSpeaker tool-suite API (/api/os). */

export class OsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OsApiError";
  }
}

export interface OsTask {
  id: number;
  tool: string;
  status: "processing" | "done" | "error";
  title: string;
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  error: string | null;
  creditsCharged: number;
  refunded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OsVoice {
  voice_id: string;
  name: string;
  description?: string | null;
  language?: string | null;
  gender?: string | null;
  category?: string | null;
  preview_url?: string | null;
  languages?: { language?: string; preview_url?: string | null }[];
}

const providerLogo = (name: string) => `${import.meta.env.BASE_URL}logos/${name}.png`;

export const OS_PROVIDERS = [
  { id: "elevenlabs", label: "ElevenLabs", logo: providerLogo("elevenlabs") },
  { id: "minimax", label: "MiniMax", logo: providerLogo("minimax") },
  { id: "fishaudio", label: "Fish Audio", logo: providerLogo("fishaudio") },
  { id: "edge", label: "Edge", logo: providerLogo("edge") },
  { id: "clone", label: "My Clones", logo: null },
] as const;

/** Logo for a provider id (voice pickers, library cards). */
export function osProviderLogo(providerId: string): string | null {
  const p = OS_PROVIDERS.find((x) => x.id === providerId);
  return p?.logo ?? null;
}

export async function osJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/os${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new OsApiError(data.error || "Request failed", res.status);
  return data as T;
}

export async function osCreateTaskJson(path: string, body: unknown): Promise<OsTask> {
  const data = await osJson<{ task: OsTask }>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.task;
}

export async function osCreateTaskForm(path: string, form: FormData): Promise<OsTask> {
  const data = await osJson<{ task: OsTask }>(path, { method: "POST", body: form });
  return data.task;
}

export async function osGetTask(id: number): Promise<OsTask> {
  const data = await osJson<{ task: OsTask }>(`/tasks/${id}`);
  return data.task;
}

export function taskAudioUrl(t: OsTask): string | null {
  // Image tasks: the provider mirrors the generated image URL into audio_url,
  // which would render a broken audio player. Images render separately.
  if (t.tool === "image") return null;
  const m = t.output;
  if (!m) return null;
  return m.audio_url || m.dubbed_audio_url || m.output_audio_url || null;
}

/** Music (Suno) generations return multiple songs: all_audio_urls + suno_result.clips (with titles). */
export function taskSongs(t: OsTask): { title: string; url: string }[] {
  const m = t.output ?? {};
  const songs: any[] = Array.isArray(m.all_audio_urls) ? m.all_audio_urls : Array.isArray(m.songs) ? m.songs : [];
  if (songs.length === 0) return [];
  const clips: any[] = Array.isArray(m.suno_result?.clips) ? m.suno_result.clips : [];
  const usedTitles = new Set<string>();
  const out: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  songs.forEach((s: any, i: number) => {
    const url = s?.audio_url ?? s;
    if (typeof url !== "string" || !url.startsWith("http") || seen.has(url)) return;
    seen.add(url);
    let title = typeof clips[i]?.title === "string" && clips[i].title.trim() ? clips[i].title.trim() : `Song ${i + 1}`;
    if (usedTitles.has(title)) title = `${title} (${i + 1})`; // Suno often reuses one title for both clips
    usedTitles.add(title);
    out.push({ title, url });
  });
  return out;
}

/** result_images entries are objects ({ imageUrl, previewUrl, ... }); older/other shapes may be plain strings. */
function imageEntryUrl(u: any): string | null {
  if (typeof u === "string") return u;
  if (u && typeof u === "object") {
    const url = u.imageUrl ?? u.image_url ?? u.url ?? u.previewUrl ?? u.preview_url;
    if (typeof url === "string") return url;
  }
  return null;
}

export function taskImageUrls(t: OsTask): string[] {
  const m = t.output;
  if (!m) return [];
  const arr = Array.isArray(m.result_images) ? m.result_images : Array.isArray(m.images) ? m.images : [];
  return arr.map(imageEntryUrl).filter((u: string | null): u is string => typeof u === "string");
}

/** All downloadable artifacts of a completed task (audio, srt, json, ...). */
export function taskDownloads(t: OsTask): { label: string; url: string }[] {
  const m = t.output ?? {};
  const out: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  const push = (label: string, url: unknown) => {
    if (typeof url === "string" && url.startsWith("http") && !seen.has(url)) {
      seen.add(url);
      out.push({ label, url });
    }
  };
  // Music (Suno) returns all_audio_urls + suno_result.clips (with titles) — no generic audio label.
  const songs = taskSongs(t);
  if (songs.length > 0) {
    songs.forEach((s) => push(s.title, s.url));
  } else {
    push("Audio", taskAudioUrl(t));
  }
  push("Voice Audio", m.replacement_audio_url);
  push("Subtitles (SRT)", m.srt_url);
  push("Transcript (JSON)", m.json_url);
  push("Transcript", m.transcript_url);
  taskImageUrls(t).forEach((u, i) => push(`Image ${i + 1}`, u));
  return out;
}
