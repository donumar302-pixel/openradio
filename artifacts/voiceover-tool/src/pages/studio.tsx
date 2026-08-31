import { useState, useMemo, useRef, useEffect } from "react";
import {
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, PlayCircle, StopCircle, Mic2, History, Settings2, ChevronRight, RotateCcw, Smile, PauseCircle, Tag, Upload, Zap, ChevronsUpDown, Check, SlidersHorizontal, ChevronUp, BookAudio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { OsVoicePicker } from "@/components/os/voice-picker";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { SlowGenerationNote } from "@/components/os/task-panel";
import { osCreateTaskJson, osJson, taskAudioUrl, type OsVoice, type OsTask } from "@/lib/os-api";
import { EngineSlowNotice, engineMedianMs, isEngineSlow, useEngineHealth, engineOfVoiceId as healthEngineOfVoiceId } from "@/components/os/engine-health";
import { estimateTtsCost } from "@/lib/os-cost";

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`.replace(/([^:]\/)\/+/g, "$1");

const PROVIDER_LOGOS: Record<string, string> = {
  el: asset("providers/elevenlabs.png"),
  minimax: asset("providers/minimax.png"),
  edge: asset("providers/edge.png"),
  fishaudio: asset("providers/fishaudio.png"),
};

// Every Studio platform is served by the OpenSpeaker library — voices, generation
// and history all go through /api/os (never direct provider APIs).
const OS_PROVIDER_OF = {
  el: "elevenlabs",
  minimax: "minimax",
  fishaudio: "fishaudio",
  edge: "edge",
} as const;
type StudioPlatform = keyof typeof OS_PROVIDER_OF;

const PLATFORM_LABEL: Record<StudioPlatform, string> = {
  el: "ElevenLabs", minimax: "Fire TTS", fishaudio: "Fish Audio", edge: "Edge TTS",
};

/** Engine label from an OpenSpeaker prefixed voice id (elevenlabs_xxx, minimax_xxx, …). */
function engineOfVoiceId(voiceId: string): string {
  if (voiceId.startsWith("elevenlabs_")) return "ElevenLabs";
  if (voiceId.startsWith("minimax_")) return "Fire TTS";
  if (voiceId.startsWith("fishaudio_")) return "Fish Audio";
  if (voiceId.startsWith("edge_")) return "Edge TTS";
  if (voiceId.startsWith("clone_") || voiceId.startsWith("voiceclone_")) return "My Clone";
  return "Voice Library";
}


const EMOTIONS = [
  { id: "happy",     emoji: "😄", label: "Happy" },
  { id: "sad",       emoji: "😢", label: "Sad" },
  { id: "angry",     emoji: "😠", label: "Angry" },
  { id: "fearful",   emoji: "😨", label: "Fearful" },
  { id: "surprised", emoji: "😲", label: "Surprised" },
  { id: "disgusted", emoji: "🤢", label: "Disgusted" },
  { id: "neutral",   emoji: "😐", label: "Neutral" },
  { id: "excited",   emoji: "🤩", label: "Excited" },
];

// Scripts up to this length generate as a single provider task; longer ones
// go through the server's chunked longform pipeline (split → generate each
// part → stitch into one MP3). Keep in sync with the api-server limits.
const TTS_SINGLE_MAX = 5_000;
const TTS_LONG_MAX = 60_000;

const PAUSES = [
  { label: "Short",   value: "500ms" },
  { label: "Medium",  value: "1000ms" },
  { label: "Long",    value: "2000ms" },
  { label: "X-Long",  value: "3000ms" },
];

const SOUND_TAGS = [
  { id: "laughter",  emoji: "😂", label: "Laughter" },
  { id: "applause",  emoji: "👏", label: "Applause" },
  { id: "gasp",      emoji: "😮", label: "Gasp" },
  { id: "sigh",      emoji: "😮‍💨", label: "Sigh" },
  { id: "music",     emoji: "🎵", label: "Music" },
  { id: "breathing", emoji: "💨", label: "Breathing" },
];

function SliderRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <span className="w-9 h-7 flex items-center justify-center border border-[#e5e7eb] rounded text-sm font-semibold text-foreground bg-white">
          {value % 1 === 0 ? value : value.toFixed(2)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer accent-primary bg-[#e5e7eb]" />
    </div>
  );
}

function useDebouncedValue<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function osPreviewUrl(v: OsVoice): string | null {
  return v.preview_url || v.languages?.find((l) => l.preview_url)?.preview_url || null;
}

function VoicePreviewBtn({ url }: { url?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (url ? new Audio(url) : null));
  if (!url || !audio) return null;
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.currentTime = 0; audio.play(); setPlaying(true); audio.onended = () => setPlaying(false); }
  };
  return (
    <button onClick={toggle} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#f3f4f6] text-[#6b7280] hover:text-foreground transition-colors">
      {playing ? <StopCircle size={14} /> : <PlayCircle size={14} />}
    </button>
  );
}

export default function StudioPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceProvider, setVoiceProvider] = useState<StudioPlatform | "os">("el");
  const [osVoiceName, setOsVoiceName] = useState("");
  const [elVoiceName, setElVoiceName] = useState("");
  const [elSearch, setElSearch] = useState("");
  const [dictionaryId, setDictionaryId] = useState("");
  const [elModel, setElModel] = useState<"eleven_turbo_v2_5" | "eleven_v3">("eleven_turbo_v2_5");
  const [speed, setSpeed] = useState(1);
  const [latestAudio, setLatestAudio] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"settings" | "history">("settings");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [openPopup, setOpenPopup] = useState<"emotion" | "pause" | "soundtag" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pick up a script handed over from the AI Script Writer page.
  useEffect(() => {
    const handoff = sessionStorage.getItem("script-handoff");
    if (handoff) {
      sessionStorage.removeItem("script-handoff");
      setText(handoff);
    }
  }, []);

  useEffect(() => {
    if (!openPopup) return;
    const close = () => setOpenPopup(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openPopup]);

  // Read ?voice=provider:id from URL on mount (from Voice Library "Use" button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voice = params.get("voice");
    if (!voice) return;
    const colonIdx = voice.indexOf(":");
    if (colonIdx === -1) return;
    const raw = voice.slice(0, colonIdx);
    const id = voice.slice(colonIdx + 1);
    if (raw === "os") {
      // Full OpenSpeaker voice library (prefixed voice id, e.g. elevenlabs_xxx)
      setVoiceProvider("os");
      setVoiceId(id);
      setOsVoiceName(id.replace(/^[a-z]+_/, "").replace(/[-_]/g, " "));
      return;
    }
    // All platforms are served via the OpenSpeaker library → prefixed ids
    const provider: StudioPlatform =
      raw === "mm" || raw === "minimax" ? "minimax"
      : raw === "fa" || raw === "fishaudio" ? "fishaudio"
      : raw === "edge" ? "edge" : "el";
    const prefix = `${OS_PROVIDER_OF[provider]}_`;
    setVoiceProvider(provider);
    setVoiceId(id.startsWith(prefix) ? id : `${prefix}${id}`);
  }, []);

  function insertAtCursor(before: string, after = "") {
    const el = textareaRef.current;
    if (!el) { setText(t => t + before + after); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + before + selected + after + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + selected.length + after.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Platform voices come from the OpenSpeaker library (full index, server-side search)
  const osProvider = voiceProvider === "os" ? null : OS_PROVIDER_OF[voiceProvider];
  const debouncedElSearch = useDebouncedValue(elSearch);
  const { data: elVoiceData, isLoading: loadingVoices } = useQuery({
    queryKey: ["studio-voices", osProvider, debouncedElSearch],
    queryFn: () => {
      const params = new URLSearchParams({ provider: osProvider!, page: "1", page_size: "60" });
      if (debouncedElSearch) params.set("search", debouncedElSearch);
      return osJson<{ data: OsVoice[]; pagination?: { total?: number } }>(`/voices?${params}`);
    },
    enabled: !!osProvider,
    staleTime: 60_000,
  });
  const elVoices: OsVoice[] = elVoiceData?.data ?? [];
  const elTotal = elVoiceData?.pagination?.total ?? elVoices.length;

  // Keep the selected voice's metadata even when the list/search moves on,
  // and resolve deep-linked ids (?voice=el:xxx) that aren't on the first page.
  const [selectedElMeta, setSelectedElMeta] = useState<OsVoice | null>(null);
  const needElResolve = !!osProvider && !!voiceId
    && selectedElMeta?.voice_id !== voiceId
    && !elVoices.some((v) => v.voice_id === voiceId);
  const { data: elResolveData } = useQuery({
    queryKey: ["studio-voice-resolve", osProvider, voiceId],
    queryFn: () => {
      const params = new URLSearchParams({
        provider: osProvider!, page: "1", page_size: "5",
        search: voiceId.replace(/^[a-z]+_/, ""),
      });
      return osJson<{ data: OsVoice[] }>(`/voices?${params}`);
    },
    enabled: needElResolve,
    staleTime: Infinity,
  });
  useEffect(() => {
    const found = elResolveData?.data?.find((v) => v.voice_id === voiceId);
    if (found) { setSelectedElMeta(found); setElVoiceName(found.name); }
  }, [elResolveData, voiceId]);

  const { data: history, isLoading: loadingHistory } = useListGenerations(
    { limit: 20 },
    { query: { queryKey: getListGenerationsQueryKey({ limit: 20 }) } }
  );

  const { task: osTask, submitting: osSubmitting, run: osRun, working: osWorking, slow: osSlow, cancel: osCancel, cancelling: osCancelling } = useOsTask("tts");
  const { data: dictData } = useQuery<{ dictionaries: { id: string; name: string }[] }>({
    queryKey: ["os-dictionaries"],
    queryFn: () => osJson("/dictionaries"),
    staleTime: 60_000,
  });
  useEffect(() => {
    if (osTask?.status === "done") {
      const url = taskAudioUrl(osTask);
      if (url) { setLatestAudio(url); toast({ title: "Generated!", description: "Your audio is ready." }); }
    }
    if (osTask?.status === "done" || osTask?.status === "error" || osTask?.status === "cancelled") {
      queryClient.invalidateQueries({ queryKey: ["studio-tts-history"] });
    }
  }, [osTask?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // OpenSpeaker TTS task history — persistent for every platform
  const { data: osTaskHistory, isLoading: loadingOsHistory } = useQuery<{ items: OsTask[] }>({
    queryKey: ["studio-tts-history"],
    queryFn: () => osJson("/tasks?tool=tts&limit=20"),
    enabled: rightTab === "history",
    refetchInterval: (q) => (q.state.data?.items?.some((t) => t.status === "processing") ? 4000 : false),
  });

  const handleGenerate = async () => {
    if (!text.trim()) { toast({ title: "Text required", description: "Please enter some text.", variant: "destructive" }); return; }
    if (!voiceId) { toast({ title: "Voice required", description: "Please select a voice.", variant: "destructive" }); return; }
    // Every platform generates through the OpenSpeaker library (prefixed voice id).
    // Long scripts (>5,000 chars) use the chunked longform pipeline: the server
    // splits them, generates each part, and stitches one MP3.
    setLatestAudio(null);
    const endpoint = text.length > TTS_SINGLE_MAX ? "/tts-long" : "/tts";
    const isElVoice = voiceId.startsWith("elevenlabs_");
    osRun(() => osCreateTaskJson(endpoint, { text, voiceId, speed, dictionaryId: dictionaryId || undefined, model: isElVoice ? elModel : undefined }));
  };

  // Per-part progress for longform runs (reported by the server while it works).
  const longProgress = osTask?.status === "processing" && osTask.output?.progress
    ? (osTask.output.progress as { done?: number; total?: number })
    : null;

  const isGenerating = osWorking;
  // Advisory engine-health signal: warn before Generate when the selected
  // engine's recent tasks are stalling. Never blocks generation.
  const engineHealth = useEngineHealth();
  const selectedEngine = voiceProvider === "os" ? healthEngineOfVoiceId(voiceId) : OS_PROVIDER_OF[voiceProvider];
  const selectedEngineSlow = isEngineSlow(engineHealth, selectedEngine);
  const selectedEngineMedianMs = engineMedianMs(engineHealth, selectedEngine);
  // Mirrors the server's charge: 1 credit/char via OpenSpeaker.
  const costEstimate = text.trim() ? estimateTtsCost(text) : null;
  const insufficientCredits = useOsInsufficientCredits(costEstimate);
  const expressionEnabled = voiceProvider === "minimax";

  // Merged history: OpenSpeaker TTS tasks (persistent, all platforms) + legacy generations
  const mergedHistory = useMemo(() => {
    type Row = { id: string; at: number; text: string; sub: string; url: string | null; processing?: boolean; error?: string; cancelled?: boolean };
    const rows: Row[] = [];
    for (const t of osTaskHistory?.items ?? []) {
      const engine = engineOfVoiceId(String(t.input?.voiceId ?? ""));
      const chars = t.input?.characters;
      rows.push({
        id: `os-${t.id}`, at: Date.parse(t.createdAt), text: t.title,
        sub: `${engine}${typeof chars === "number" ? ` · ${chars} chars` : ""}`,
        url: t.status === "done" ? taskAudioUrl(t) : null,
        processing: t.status === "processing",
        error: t.status === "error" ? (t.error || "Generation failed — credits refunded.") : undefined,
        cancelled: t.status === "cancelled",
      });
    }
    for (const g of (history?.items ?? []) as any[]) {
      rows.push({ id: `gen-${g.id}`, at: Date.parse(g.createdAt), text: g.text, sub: `${g.voiceName} · ${g.characterCount} chars`, url: g.audioUrl });
    }
    return rows.sort((a, b) => b.at - a.at).slice(0, 30);
  }, [osTaskHistory, history]);

  const selectedElVoice = voiceProvider !== "os"
    ? (elVoices.find((v) => v.voice_id === voiceId) ?? (selectedElMeta?.voice_id === voiceId ? selectedElMeta : undefined))
    : undefined;
  const [voiceOpen, setVoiceOpen] = useState(false);
  useEffect(() => { setElSearch(""); }, [voiceProvider]);

  const selectedVoiceLabel = useMemo(() => {
    if (!voiceId) return null;
    return selectedElVoice?.name ?? elVoiceName ?? null;
  }, [voiceId, selectedElVoice, elVoiceName]);

  const resetSettings = () => { setSpeed(1); };

  const RightPanelContent = (
    <>
      {/* Tabs */}
      <div className="flex border-b border-[#f3f4f6] shrink-0">
        {(["settings", "history"] as const).map(tab => (
          <button key={tab} onClick={() => setRightTab(tab)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors",
              rightTab === tab ? "text-foreground border-b-2 border-primary" : "text-[#9ca3af] hover:text-foreground"
            )}>
            {tab === "settings" ? <Settings2 size={13} /> : <History size={13} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Settings */}
      {rightTab === "settings" && (
        <div className="flex-1 overflow-y-auto">
          {/* Platform */}
          <div className="p-4 border-b border-[#f3f4f6]">
            <span className="text-sm font-semibold text-foreground block mb-3">Platform</span>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: "el" as const,        label: "ElevenLabs",  active: "text-orange-600 bg-orange-50 border-orange-300" },
                { id: "minimax" as const,   label: "Fire TTS",    active: "text-violet-600 bg-violet-50 border-violet-300" },
                { id: "edge" as const,      label: "Edge TTS",    active: "text-sky-600 bg-sky-50 border-sky-300" },
                { id: "fishaudio" as const, label: "Fish Audio",  active: "text-emerald-600 bg-emerald-50 border-emerald-300" },
              ] as const).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setVoiceProvider(p.id); setVoiceId(""); }}
                  className={cn(
                    "px-2 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                    voiceProvider === p.id ? p.active : "border-[#e5e7eb] text-[#6b7280] hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <img src={PROVIDER_LOGOS[p.id]} alt="" className="w-4 h-4 rounded-sm object-contain shrink-0" />
                  {p.label}
                  {isEngineSlow(engineHealth, OS_PROVIDER_OF[p.id]) && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                      title="Experiencing high demand — generations may be slow"
                      data-testid={`engine-slow-dot-${p.id}`}
                    />
                  )}
                </button>
              ))}
              <button
                onClick={() => { setVoiceProvider("os"); setVoiceId(""); setOsVoiceName(""); }}
                className={cn(
                  "col-span-2 px-2 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                  voiceProvider === "os" ? "text-blue-600 bg-blue-50 border-blue-300" : "border-[#e5e7eb] text-[#6b7280] hover:border-primary/40 hover:text-foreground"
                )}
              >
                <BookAudio size={14} className="shrink-0" />
                Voice Library
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">6000+</span>
              </button>
            </div>
            <EngineSlowNotice show={selectedEngineSlow} medianMs={selectedEngineMedianMs} className="mt-3" />
          </div>
          {/* ElevenLabs model — shown when the ElevenLabs platform or an ElevenLabs library voice is selected */}
          {(voiceProvider === "el" || (voiceProvider === "os" && voiceId.startsWith("elevenlabs_"))) && (
            <div className="p-4 border-b border-[#f3f4f6]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Model</span>
                <button onClick={() => setElModel("eleven_turbo_v2_5")} className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground transition-colors">
                  <RotateCcw size={10} /> Reset Value
                </button>
              </div>
              <select
                value={elModel}
                onChange={(e) => setElModel(e.target.value as "eleven_turbo_v2_5" | "eleven_v3")}
                data-testid="select-el-model"
                className="w-full h-10 px-3 border border-[#e5e7eb] rounded-lg text-sm bg-white text-foreground font-medium hover:border-primary/40 focus:outline-none focus:border-orange-400 cursor-pointer"
              >
                <option value="eleven_turbo_v2_5">ElevenLabs V2.5 — fast, great quality</option>
                <option value="eleven_v3">ElevenLabs V3 — most expressive</option>
              </select>
            </div>
          )}
          {/* Voice */}
          <div className="p-4 border-b border-[#f3f4f6]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Voice</span>
              <button onClick={() => setVoiceId("")} className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground transition-colors">
                <RotateCcw size={10} /> Reset Value
              </button>
            </div>
            {voiceProvider !== "os" && selectedElVoice && (
              <div className={cn("flex items-center gap-3 p-2.5 border rounded-xl mb-3",
                voiceProvider === "minimax" ? "border-violet-200 bg-violet-50"
                : voiceProvider === "fishaudio" ? "border-emerald-200 bg-emerald-50"
                : voiceProvider === "edge" ? "border-sky-200 bg-sky-50"
                : "border-[#e5e7eb]"
              )}>
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-lg",
                  voiceProvider === "minimax" ? "bg-violet-100 text-violet-600"
                  : voiceProvider === "fishaudio" ? "bg-emerald-100 text-emerald-600"
                  : voiceProvider === "edge" ? "bg-sky-100 text-sky-600"
                  : "bg-gradient-to-br from-primary/30 to-orange-200 text-primary"
                )}>
                  {(selectedElVoice.name ?? "V")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{selectedElVoice.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      voiceProvider === "minimax" ? "bg-violet-100 text-violet-600"
                      : voiceProvider === "fishaudio" ? "bg-emerald-100 text-emerald-600"
                      : voiceProvider === "edge" ? "bg-sky-100 text-sky-600"
                      : "bg-[#f3f4f6] text-[#6b7280]"
                    )}>
                      {[selectedElVoice.language, selectedElVoice.gender].filter(Boolean).join(" · ") || selectedElVoice.category || "voice"}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-[#6b7280] font-semibold">
                      <img src={PROVIDER_LOGOS[voiceProvider]} alt="" className="w-3 h-3 rounded-sm object-contain" /> {PLATFORM_LABEL[voiceProvider]}
                    </span>
                  </div>
                </div>
                <VoicePreviewBtn key={selectedElVoice.voice_id} url={osPreviewUrl(selectedElVoice)} />
              </div>
            )}
            {voiceProvider === "os" && (
              <div className="space-y-3">
                <OsVoicePicker
                  value={voiceId}
                  valueName={osVoiceName}
                  onChange={(v, n) => { setVoiceId(v); setOsVoiceName(n); }}
                  placeholder="Browse the voice library"
                />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] mb-1 block">Pronunciation Dictionary</label>
                  <select
                    value={dictionaryId}
                    onChange={e => setDictionaryId(e.target.value)}
                    className="w-full h-9 px-3 border border-[#e5e7eb] rounded-lg text-sm bg-white text-foreground focus:outline-none focus:border-blue-400 cursor-pointer"
                  >
                    <option value="">None</option>
                    {(dictData?.dictionaries ?? []).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {voiceProvider !== "os" && (
            <Popover open={voiceOpen} onOpenChange={setVoiceOpen}>
              <PopoverTrigger asChild>
                <button data-testid="select-voice" className={cn(
                  "w-full flex items-center justify-between h-10 px-3 border rounded-lg text-sm transition-colors",
                  "border-[#e5e7eb] bg-white hover:border-primary/40 focus:outline-none",
                  !selectedVoiceLabel && "text-[#9ca3af]"
                )}>
                  <span className="truncate font-medium">{loadingVoices ? "Loading voices..." : (selectedVoiceLabel ?? "Choose a voice")}</span>
                  <ChevronsUpDown size={14} className="shrink-0 text-[#9ca3af] ml-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start" side="bottom">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search voices..."
                    className="h-9 text-sm"
                    value={elSearch}
                    onValueChange={setElSearch}
                  />
                  <CommandList className="max-h-72">
                    <CommandEmpty className="py-6 text-center text-sm text-[#9ca3af]">
                      {loadingVoices ? "Loading voices…" : "No voice found."}
                    </CommandEmpty>

                    {/* Platform voices (full OpenSpeaker index, server-side search) */}
                    {!loadingVoices && (
                      <CommandGroup heading={`${PLATFORM_LABEL[voiceProvider]} · ${elTotal.toLocaleString()} voices${elSearch ? "" : " — type to search all"}`}>
                        {elVoices.map((v) => (
                          <CommandItem key={v.voice_id} value={v.voice_id}
                            onSelect={() => { setVoiceId(v.voice_id); setElVoiceName(v.name); setSelectedElMeta(v); setVoiceOpen(false); setMobilePanel(false); }}
                            className="flex items-center gap-2 py-2 cursor-pointer">
                            <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center shrink-0 text-primary font-bold text-xs">{v.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                              <p className="text-[10px] text-[#9ca3af]">{[v.language, v.gender].filter(Boolean).join(" · ") || v.category || ""}</p>
                            </div>
                            <VoicePreviewBtn key={`pv-${v.voice_id}`} url={osPreviewUrl(v)} />
                            {voiceId === v.voice_id && <Check size={13} className="text-primary shrink-0" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            )}
          </div>

          {/* Voice Modifier */}
          <div className="p-4 border-b border-[#f3f4f6]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Voice Modifier</span>
            </div>
          </div>

          {/* Voice Settings */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Voice Settings</span>
              <button onClick={resetSettings} className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground transition-colors">
                <RotateCcw size={10} /> Reset
              </button>
            </div>
            <SliderRow label="Speed" value={speed} onChange={setSpeed} min={0.5} max={1.5} step={0.1} />
          </div>
        </div>
      )}

      {/* History */}
      {rightTab === "history" && (
        <div className="flex-1 overflow-y-auto">
          {(loadingHistory || loadingOsHistory) && mergedHistory.length === 0 ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#9ca3af]" /></div>
          ) : mergedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <History size={28} className="text-[#d1d5db] mb-3" />
              <p className="text-sm font-semibold text-[#6b7280]">No history yet</p>
              <p className="text-xs text-[#9ca3af] mt-1">Generated audio will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f3f4f6]">
              {mergedHistory.map((row) => (
                <div key={row.id} className="p-4 hover:bg-[#fafafa] transition-colors" data-testid={`history-item-${row.id}`}>
                  <p className="text-xs font-semibold text-foreground mb-1 line-clamp-2">{row.text}</p>
                  <p className="text-[10px] text-[#9ca3af] mb-2">{row.sub}</p>
                  {row.processing ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-primary font-semibold flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Generating…</p>
                      <SlowGenerationNote since={row.at} compact />
                    </div>
                  ) : row.error ? (
                    <p className="text-[10px] text-red-500 font-semibold" data-testid={`error-history-${row.id}`}>{row.error}</p>
                  ) : row.cancelled ? (
                    <p className="text-[10px] text-[#9ca3af] font-semibold" data-testid={`cancelled-history-${row.id}`}>Cancelled — credits refunded.</p>
                  ) : row.url ? (
                    <audio controls src={row.url} className="w-full h-7" data-testid={`audio-history-${row.id}`} />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#f3f4f6] shrink-0">
        <h1 className="text-[15px] sm:text-[17px] font-bold text-foreground">Speech Synthesis</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: settings toggle */}
          <button
            className="lg:hidden flex items-center gap-1.5 text-[12px] font-semibold text-[#6b7280] border border-[#e5e7eb] px-3 py-1.5 rounded-lg"
            onClick={() => setMobilePanel(v => !v)}
          >
            <SlidersHorizontal size={13} /> {mobilePanel ? "Hide" : "Settings"}
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
              voiceProvider === "el" ? "text-orange-600 bg-orange-50 border-orange-200"
              : voiceProvider === "minimax" ? "text-violet-600 bg-violet-50 border-violet-200"
              : voiceProvider === "fishaudio" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
              : voiceProvider === "os" ? "text-blue-600 bg-blue-50 border-blue-200"
              : "text-sky-600 bg-sky-50 border-sky-200"
            )}>
              {voiceProvider === "os"
                ? <BookAudio size={13} className="shrink-0" />
                : <img src={PROVIDER_LOGOS[voiceProvider]} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />}
              {voiceProvider === "el" ? "ElevenLabs" : voiceProvider === "minimax" ? "Fire HD" : voiceProvider === "fishaudio" ? "Fish Pro" : voiceProvider === "os" ? "Voice Library" : "Edge TTS"}
            </span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Left: text area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex-1 relative min-h-[120px]">
            <textarea
              ref={textareaRef}
              placeholder="Start typing here to unleash the power of speech synthesis to generate speech..."
              className="w-full h-full resize-none text-[15px] leading-relaxed px-4 sm:px-7 py-4 sm:py-6 outline-none bg-white placeholder:text-[#9ca3af]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={TTS_LONG_MAX}
              data-testid="input-script"
            />
          </div>

          {/* Longform progress — per-part instead of one endless spinner */}
          {isGenerating && longProgress && typeof longProgress.total === "number" && longProgress.total > 1 && (
            <div className="px-4 sm:px-7 pb-3" data-testid="longform-progress">
              <div className="bg-blue-50 border border-blue-200/60 rounded-xl px-3 sm:px-4 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[12px] font-semibold text-blue-700">
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Generating part {Math.min((longProgress.done ?? 0) + 1, longProgress.total)} of {longProgress.total}
                  </span>
                  <span>{Math.round(((longProgress.done ?? 0) / longProgress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${((longProgress.done ?? 0) / longProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-blue-600/80">Long scripts are generated in parts and stitched into a single MP3 — keep this tab open.</p>
              </div>
            </div>
          )}

          {/* Slow-generation note — high demand upstream, credits protected */}
          {isGenerating && osSlow && (
            <div className="px-4 sm:px-7 pb-3">
              <SlowGenerationNote since={osTask?.createdAt ?? null} onCancel={osCancel} cancelling={osCancelling} />
            </div>
          )}

          {/* Generated audio */}
          {latestAudio && (
            <div className="px-4 sm:px-7 pb-3">
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-200/60 rounded-xl px-3 sm:px-4 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Mic2 size={13} className="text-white" />
                </div>
                <audio controls className="flex-1 h-7" src={latestAudio} data-testid="audio-player" />
                <a href={latestAudio} download="openradio.mp3">
                  <button className="p-1 rounded hover:bg-orange-100 text-primary transition-colors"><Download size={14} /></button>
                </a>
              </div>
            </div>
          )}

          {/* Expression toolbar — Emotion / Pause / Sound Tag (Fire TTS) */}
          <div className="flex items-center gap-2 px-4 sm:px-7 py-2 border-t border-[#f3f4f6] flex-wrap">
            {/* Emotion */}
            <div className="relative shrink-0">
              <button
                disabled={!expressionEnabled}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (!expressionEnabled) return; setOpenPopup(p => p === "emotion" ? null : "emotion"); }}
                className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors",
                  !expressionEnabled ? "border-[#e5e7eb] text-[#cbd0d6] cursor-not-allowed" :
                  openPopup === "emotion" ? "border-primary text-primary bg-orange-50" : "border-[#e5e7eb] text-[#6b7280] hover:border-primary hover:text-primary"
                )}>
                <Smile size={13} /> Emotion <ChevronUp size={11} className={cn("transition-transform", openPopup === "emotion" ? "rotate-180" : "")} />
              </button>
              {expressionEnabled && openPopup === "emotion" && (
                <div onMouseDown={e => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-[#e5e7eb] p-1.5 z-30 min-w-[170px]">
                  <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide px-3 pt-1.5 pb-1">Choose emotion</p>
                  {EMOTIONS.map(e => (
                    <button key={e.id} onClick={() => { insertAtCursor(`[${e.id}]`); setOpenPopup(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-orange-50 hover:text-primary rounded-xl transition-colors text-left text-foreground">
                      <span>{e.emoji}</span> {e.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pause */}
            <div className="relative shrink-0">
              <button
                disabled={!expressionEnabled}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (!expressionEnabled) return; setOpenPopup(p => p === "pause" ? null : "pause"); }}
                className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors",
                  !expressionEnabled ? "border-[#e5e7eb] text-[#cbd0d6] cursor-not-allowed" :
                  openPopup === "pause" ? "border-primary text-primary bg-orange-50" : "border-[#e5e7eb] text-[#6b7280] hover:border-primary hover:text-primary"
                )}>
                <PauseCircle size={13} /> Pause <ChevronUp size={11} className={cn("transition-transform", openPopup === "pause" ? "rotate-180" : "")} />
              </button>
              {expressionEnabled && openPopup === "pause" && (
                <div onMouseDown={e => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-[#e5e7eb] p-1.5 z-30 min-w-[160px]">
                  <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide px-3 pt-1.5 pb-1">Insert pause</p>
                  {PAUSES.map(p => (
                    <button key={p.value} onClick={() => { insertAtCursor(`<break time="${p.value}"/>`); setOpenPopup(null); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium hover:bg-orange-50 hover:text-primary rounded-xl transition-colors text-left">
                      <span className="text-foreground">{p.label}</span>
                      <span className="text-[11px] text-[#9ca3af] font-mono">{p.value}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sound Tag */}
            <div className="relative shrink-0">
              <button
                disabled={!expressionEnabled}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (!expressionEnabled) return; setOpenPopup(p => p === "soundtag" ? null : "soundtag"); }}
                className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium whitespace-nowrap transition-colors",
                  !expressionEnabled ? "border-[#e5e7eb] text-[#cbd0d6] cursor-not-allowed" :
                  openPopup === "soundtag" ? "border-primary text-primary bg-orange-50" : "border-[#e5e7eb] text-[#6b7280] hover:border-primary hover:text-primary"
                )}>
                <Tag size={13} /> Sound Tag <ChevronUp size={11} className={cn("transition-transform", openPopup === "soundtag" ? "rotate-180" : "")} />
              </button>
              {expressionEnabled && openPopup === "soundtag" && (
                <div onMouseDown={e => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-[#e5e7eb] p-1.5 z-30 min-w-[170px]">
                  <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide px-3 pt-1.5 pb-1">Insert sound</p>
                  {SOUND_TAGS.map(s => (
                    <button key={s.id} onClick={() => { insertAtCursor(`[${s.id}]`); setOpenPopup(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium hover:bg-orange-50 hover:text-primary rounded-xl transition-colors text-left text-foreground">
                      <span>{s.emoji}</span> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!expressionEnabled && (
              <span className="flex items-center gap-1 text-[11px] text-[#9ca3af] shrink-0">
                <Zap size={11} className="text-violet-400" /> Select a Fire TTS voice to use these
              </span>
            )}
            <div className="flex-1 min-w-2" />
            {text.length > TTS_SINGLE_MAX && (
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full shrink-0" data-testid="badge-long-script">
                Long script · stitched into one MP3
              </span>
            )}
            <span className="text-xs text-[#9ca3af] shrink-0">{text.length.toLocaleString()} / {TTS_LONG_MAX.toLocaleString()}</span>
          </div>

          {/* Advisory engine-health warning — visible even when the settings panel is hidden */}
          {selectedEngineSlow && (
            <div className="px-4 sm:px-7 pb-2 shrink-0">
              <EngineSlowNotice show compact medianMs={selectedEngineMedianMs} />
            </div>
          )}

          {/* Cost estimate — every engine charges credits (per character; Edge per 500 chars) */}
          <div className="px-4 sm:px-7 pb-3 shrink-0">
            <OsCostEstimate
              estimate={costEstimate}
              footnote={voiceProvider === "os" ? undefined : "Charged when generation starts — refunded automatically if it fails."}
            />
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 px-4 sm:px-7 py-3 border-t border-[#f3f4f6] bg-white shrink-0">
            <select className="text-xs border border-[#e5e7eb] rounded px-2 py-1 bg-white text-[#6b7280] outline-none max-w-[130px] sm:max-w-none">
              <option>Detect Language</option>
              <option>English</option><option>Urdu</option><option>Arabic</option>
              <option>Hindi</option><option>Spanish</option><option>French</option><option>German</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim() || !voiceId || insufficientCredits}
              className={cn(
                "flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all",
                isGenerating || !text.trim() || !voiceId || insufficientCredits
                  ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed"
                  : voiceProvider === "minimax"
                    ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                    : voiceProvider === "fishaudio"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                      : "bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30"
              )}
              data-testid="btn-generate"
            >
              {isGenerating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                : insufficientCredits
                  ? <>Not enough credits</>
                  : voiceProvider === "minimax"
                  ? <><Zap className="h-4 w-4 fill-white" /> Generate</>
                  : voiceProvider === "fishaudio"
                    ? <>🐟 Generate</>
                    : <><Play className="h-4 w-4 fill-white" /> Generate</>
              }
            </button>
          </div>
        </div>

        {/* Right panel — desktop always visible, mobile toggled */}
        <div className={cn(
          "w-full lg:w-[280px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#f3f4f6] bg-white flex flex-col",
          "lg:flex",
          mobilePanel ? "flex" : "hidden lg:flex",
          "max-h-[50vh] lg:max-h-none"
        )}>
          {RightPanelContent}
        </div>
      </div>
    </div>
  );
}
