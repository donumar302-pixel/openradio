/** Client helpers for the OpenSpeaker tool-suite API (/api/os). */

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

export const OS_PROVIDERS = [
  { id: "elevenlabs", label: "ElevenLabs" },
  { id: "minimax", label: "MiniMax" },
  { id: "fishaudio", label: "Fish Audio" },
  { id: "edge", label: "Edge" },
  { id: "vbee", label: "Vbee" },
  { id: "clone", label: "My Clones" },
] as const;

export async function osJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/os${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
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
  const m = t.output;
  if (!m) return null;
  return m.audio_url || m.dubbed_audio_url || m.output_audio_url || null;
}

export function taskImageUrls(t: OsTask): string[] {
  const m = t.output;
  if (!m) return [];
  if (Array.isArray(m.result_images)) return m.result_images.filter((u: any) => typeof u === "string");
  if (Array.isArray(m.images)) return m.images.filter((u: any) => typeof u === "string");
  return [];
}

/** All downloadable artifacts of a completed task (audio, srt, json, ...). */
export function taskDownloads(t: OsTask): { label: string; url: string }[] {
  const m = t.output ?? {};
  const out: { label: string; url: string }[] = [];
  const push = (label: string, url: unknown) => {
    if (typeof url === "string" && url.startsWith("http")) out.push({ label, url });
  };
  push("Audio", m.audio_url);
  push("Voice Audio", m.replacement_audio_url);
  push("Subtitles (SRT)", m.srt_url);
  push("Transcript (JSON)", m.json_url);
  push("Transcript", m.transcript_url);
  for (const u of taskImageUrls(t)) push(`Image ${out.length + 1}`, u);
  if (Array.isArray(m.songs)) {
    m.songs.forEach((s: any, i: number) => push(`Song ${i + 1}`, s?.audio_url ?? s));
  }
  return out;
}
