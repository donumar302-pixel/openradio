import { MsEdgeTTS, OUTPUT_FORMAT, type Voice } from "msedge-tts";

export const isDirectEdgeVoice = (id: unknown): boolean =>
  typeof id === "string" && /^edge_[\w-]{2,100}$/.test(id);

let voiceCache: { until: number; voices: Voice[] } | null = null;
let voiceRequest: Promise<Voice[]> | null = null;

export async function edgeVoices(): Promise<Voice[]> {
  if (voiceCache && Date.now() < voiceCache.until) return voiceCache.voices;
  voiceRequest ??= new MsEdgeTTS().getVoices().then((voices) => {
    voiceCache = { voices, until: Date.now() + 60 * 60_000 };
    return voices;
  }).finally(() => { voiceRequest = null; });
  return voiceRequest;
}

export async function getDirectEdgeVoice(id: string): Promise<Voice | undefined> {
  if (!isDirectEdgeVoice(id)) return undefined;
  return (await edgeVoices()).find((voice) => voice.ShortName === id.slice(5));
}

export async function listDirectEdgeVoices(filters: {
  search?: string; language?: string; gender?: string;
}): Promise<Array<{
  voice_id: string; name: string; language: string;
  gender: string; description: string; provider: string;
}>> {
  const voices = await edgeVoices();
  const search = (filters.search ?? "").toLowerCase();
  const lang = (filters.language ?? "").toLowerCase();
  const gender = (filters.gender ?? "").toLowerCase();
  return voices.filter((v) =>
    (!search || `${v.ShortName} ${v.FriendlyName} ${v.Locale}`.toLowerCase().includes(search)) &&
    (!lang || v.Locale.toLowerCase() === lang || v.Locale.toLowerCase().startsWith(`${lang}-`)) &&
    (!gender || v.Gender.toLowerCase() === gender)
  ).map((v) => ({
    voice_id: `edge_${v.ShortName}`,
    name: `${v.ShortName.replace(`${v.Locale}-`, "").replace(/Neural$/, "")} (${v.Locale})`,
    language: v.Locale,
    gender: v.Gender.toLowerCase(),
    description: v.Locale,
    provider: "edge",
  }));
}

/** Edge Read Aloud is a direct, keyless Microsoft service; never call OpenSpeaker. */
export async function synthesizeDirectEdge(
  text: string, voiceId: string, speed?: number, signal?: AbortSignal,
): Promise<Buffer> {
  const voice = await getDirectEdgeVoice(voiceId);
  if (!voice) throw new Error("This Edge voice is no longer available. Please choose another voice.");
  const tts = new MsEdgeTTS();
  const deadline = AbortSignal.timeout(90_000);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let audioStream: ReturnType<MsEdgeTTS["toStream"]>["audioStream"] | undefined;
  let rejectAbort: (reason: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const stop = () => {
    tts.close();
    audioStream?.destroy();
    rejectAbort(new Error(signal?.aborted ? "Edge generation cancelled." : "Edge generation timed out."));
  };
  combined.addEventListener("abort", stop, { once: true });
  try {
    if (combined.aborted) throw new Error("Edge generation cancelled.");
    await Promise.race([
      tts.setMetadata(voice.ShortName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
      aborted,
    ]);
    const rate = Number.isFinite(speed) ? Math.min(1.5, Math.max(0.5, speed!)) : 1;
    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    audioStream = tts.toStream(safeText, { rate: rate - 1 }).audioStream;
    const stream = audioStream;
    const audio = await Promise.race([
      (async () => {
        const chunks: Buffer[] = [];
        for await (const piece of stream) chunks.push(Buffer.from(piece));
        return Buffer.concat(chunks);
      })(),
      aborted,
    ]);
    if (audio.length < 200) throw new Error("Edge returned no audio. Please try again.");
    return audio;
  } finally {
    combined.removeEventListener("abort", stop);
    audioStream?.destroy();
    tts.close();
  }
}