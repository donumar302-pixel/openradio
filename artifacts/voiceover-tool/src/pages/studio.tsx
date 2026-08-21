import { useState, useMemo, useRef, useEffect } from "react";
import {
  useListVoices,
  getListVoicesQueryKey,
  useGenerateSpeech,
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, PlayCircle, StopCircle, Mic2, History, Settings2, ChevronRight, RotateCcw, Smile, PauseCircle, Tag, Upload, Zap, ChevronsUpDown, Check, SlidersHorizontal, ChevronUp, BookAudio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { OsVoicePicker } from "@/components/os/voice-picker";
import { OsCostEstimate } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskJson, osJson, taskAudioUrl } from "@/lib/os-api";
import { estimateTtsCost } from "@/lib/os-cost";

interface MiniMaxVoice { id: string; name: string; lang?: string; style?: string; isClone?: boolean; }
interface FishVoice { id: string; name: string; lang?: string; style?: string; }

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`.replace(/([^:]\/)\/+/g, "$1");

const PROVIDER_LOGOS: Record<string, string> = {
  el: asset("providers/elevenlabs.png"),
  minimax: asset("providers/minimax.png"),
  edge: asset("providers/edge.png"),
  fishaudio: asset("providers/fishaudio.png"),
};

const MODELS = [
  { id: "eleven_v3",         label: "Eleven v3",         badge: "Best" },
  { id: "eleven_turbo_v2_5", label: "Multilingual v2.5", badge: "Fast" },
];

const MM_MODELS = [
  { id: "speech-02-hd", label: "Fire HD", badge: "Best" },
];

const FA_MODELS = [
  { id: "s2.1-pro-free", label: "Fish Pro", badge: "Best" },
];

const FA_LANGUAGES = [
  { code: "",    label: "All Languages" },
  { code: "en",  label: "🇺🇸 English" },
  { code: "zh",  label: "🇨🇳 Chinese" },
  { code: "ja",  label: "🇯🇵 Japanese" },
  { code: "ko",  label: "🇰🇷 Korean" },
  { code: "hi",  label: "🇮🇳 Hindi" },
  { code: "ur",  label: "🇵🇰 Urdu" },
  { code: "ar",  label: "🇸🇦 Arabic" },
  { code: "es",  label: "🇪🇸 Spanish" },
  { code: "fr",  label: "🇫🇷 French" },
  { code: "de",  label: "🇩🇪 German" },
  { code: "ru",  label: "🇷🇺 Russian" },
  { code: "pt",  label: "🇧🇷 Portuguese" },
  { code: "it",  label: "🇮🇹 Italian" },
  { code: "tr",  label: "🇹🇷 Turkish" },
  { code: "id",  label: "🇮🇩 Indonesian" },
  { code: "vi",  label: "🇻🇳 Vietnamese" },
  { code: "th",  label: "🇹🇭 Thai" },
  { code: "pl",  label: "🇵🇱 Polish" },
  { code: "nl",  label: "🇳🇱 Dutch" },
  { code: "sv",  label: "🇸🇪 Swedish" },
  { code: "cs",  label: "🇨🇿 Czech" },
  { code: "ro",  label: "🇷🇴 Romanian" },
  { code: "hu",  label: "🇭🇺 Hungarian" },
  { code: "el",  label: "🇬🇷 Greek" },
  { code: "da",  label: "🇩🇰 Danish" },
  { code: "fi",  label: "🇫🇮 Finnish" },
  { code: "nb",  label: "🇳🇴 Norwegian" },
  { code: "uk",  label: "🇺🇦 Ukrainian" },
  { code: "ms",  label: "🇲🇾 Malay" },
  { code: "fil", label: "🇵🇭 Filipino" },
];

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
  const [voiceProvider, setVoiceProvider] = useState<"el" | "minimax" | "fishaudio" | "edge" | "os">("el");
  const [osVoiceName, setOsVoiceName] = useState("");
  const [dictionaryId, setDictionaryId] = useState("");
  const [modelId, setModelId] = useState("eleven_v3");
  const [mmModel, setMmModel] = useState("speech-02-hd");
  const [faModel, setFaModel] = useState("s2.1-pro-free");
  const [faLang, setFaLang] = useState("");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [latestAudio, setLatestAudio] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"settings" | "history">("settings");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [openPopup, setOpenPopup] = useState<"emotion" | "pause" | "soundtag" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    const provider: "el" | "minimax" | "fishaudio" | "edge" =
      raw === "mm" ? "minimax" : raw === "fa" ? "fishaudio" : raw === "edge" ? "edge" : "el";
    setVoiceProvider(provider);
    setVoiceId(id);
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

  const { data: voices, isLoading: loadingVoices } = useListVoices({
    query: { queryKey: getListVoicesQueryKey() },
  });

  const { data: mmVoiceData } = useQuery<{ builtin: MiniMaxVoice[]; clones: MiniMaxVoice[] }>({
    queryKey: ["minimax-voices"],
    queryFn: () => fetch("/api/minimax/voices").then(r => r.json()),
    staleTime: 60_000,
  });
  const mmVoices: MiniMaxVoice[] = [
    ...(mmVoiceData?.clones ?? []).map(c => ({ ...c, isClone: true })),
    ...(mmVoiceData?.builtin ?? []),
  ];

  const { data: faVoiceData } = useQuery<{ voices: FishVoice[] }>({
    queryKey: ["fishaudio-voices", faLang],
    queryFn: () => fetch(`/api/fishaudio/voices${faLang ? `?language=${faLang}` : ""}`).then(r => r.json()),
    staleTime: 120_000,
  });
  const faVoices: FishVoice[] = faVoiceData?.voices ?? [];

  const { data: edgeVoiceData } = useQuery<{ voices: { id: string; name: string; shortName: string; locale: string; gender: string }[] }>({
    queryKey: ["edge-voices"],
    queryFn: () => fetch("/api/edge/voices").then(r => r.json()),
    staleTime: 3_600_000,
  });
  const edgeVoices = edgeVoiceData?.voices ?? [];
  const edgeByLocale = edgeVoices.reduce<Record<string, typeof edgeVoices>>((acc, v) => {
    const key = v.locale;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(v);
    return acc;
  }, {});

  const faByLang = faVoices.reduce<Record<string, FishVoice[]>>((acc, v) => {
    const key = v.lang ?? "Multi";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(v);
    return acc;
  }, {});

  const { data: history, isLoading: loadingHistory } = useListGenerations(
    { limit: 20 },
    { query: { queryKey: getListGenerationsQueryKey({ limit: 20 }) } }
  );

  const generateSpeech = useGenerateSpeech();
  const { task: osTask, submitting: osSubmitting, run: osRun, working: osWorking } = useOsTask("tts");
  const { data: dictData } = useQuery<{ dictionaries: { id: string; name: string }[] }>({
    queryKey: ["os-dictionaries"],
    queryFn: () => osJson("/dictionaries"),
    enabled: voiceProvider === "os",
    staleTime: 60_000,
  });
  useEffect(() => {
    if (osTask?.status === "done") {
      const url = taskAudioUrl(osTask);
      if (url) { setLatestAudio(url); toast({ title: "Generated!", description: "Your audio is ready." }); }
    }
  }, [osTask?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mmGenerating, setMmGenerating]     = useState(false);
  const [faGenerating, setFaGenerating]     = useState(false);
  const [edgeGenerating, setEdgeGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!text.trim()) { toast({ title: "Text required", description: "Please enter some text.", variant: "destructive" }); return; }
    if (!voiceId) { toast({ title: "Voice required", description: "Please select a voice.", variant: "destructive" }); return; }

    if (voiceProvider === "os") {
      setLatestAudio(null);
      osRun(() => osCreateTaskJson("/tts", { text, voiceId, speed, dictionaryId: dictionaryId || undefined }));
      return;
    }

    if (voiceProvider === "minimax") {
      setMmGenerating(true); setLatestAudio(null);
      try {
        const res = await fetch("/api/minimax/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId, model: mmModel, speed, volume, pitch }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || "Generation failed"); }
        const blob = await res.blob();
        setLatestAudio(URL.createObjectURL(blob));
        toast({ title: "Generated!", description: "Your audio is ready." });
      } catch (e: any) {
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
      } finally { setMmGenerating(false); }
      return;
    }

    if (voiceProvider === "fishaudio") {
      setFaGenerating(true); setLatestAudio(null);
      try {
        const res = await fetch("/api/fishaudio/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId, model: faModel, speed }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || "Generation failed"); }
        const blob = await res.blob();
        setLatestAudio(URL.createObjectURL(blob));
        toast({ title: "Generated!", description: "Your audio is ready." });
      } catch (e: any) {
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
      } finally { setFaGenerating(false); }
      return;
    }

    if (voiceProvider === "edge") {
      setEdgeGenerating(true); setLatestAudio(null);
      try {
        const res = await fetch("/api/edge/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || "Generation failed"); }
        const blob = await res.blob();
        setLatestAudio(URL.createObjectURL(blob));
        toast({ title: "Generated!", description: "Your audio is ready." });
      } catch (e: any) {
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
      } finally { setEdgeGenerating(false); }
      return;
    }

    generateSpeech.mutate(
      { data: { text, voiceId, stability, similarityBoost, modelId } },
      {
        onSuccess: (data) => { setLatestAudio(data.audioUrl); queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey({ limit: 20 }) }); },
        onError: (err: any) => { toast({ title: "Generation failed", description: err?.error || "Unknown error.", variant: "destructive" }); },
      }
    );
  };

  const isGenerating = generateSpeech.isPending || mmGenerating || faGenerating || edgeGenerating || (voiceProvider === "os" && osWorking);
  const expressionEnabled = voiceProvider === "minimax";

  const voicesByCategory = voices?.reduce((acc, voice) => {
    const cat = voice.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  const mmByLang = mmVoices.reduce((acc, v) => {
    const g = v.isClone ? "My Clones" : (v.lang ?? "Other");
    if (!acc[g]) acc[g] = [];
    acc[g].push(v);
    return acc;
  }, {} as Record<string, MiniMaxVoice[]>);

  const selectedElVoice   = voiceProvider === "el"        ? voices?.find((v) => v.voiceId === voiceId) : undefined;
  const selectedMmVoice   = voiceProvider === "minimax"   ? mmVoices.find((v) => v.id === voiceId)    : undefined;
  const selectedFaVoice   = voiceProvider === "fishaudio" ? faVoices.find((v) => v.id === voiceId)    : undefined;
  const selectedEdgeVoice = voiceProvider === "edge"      ? edgeVoices.find((v) => v.id === voiceId)  : undefined;
  const [voiceOpen, setVoiceOpen] = useState(false);

  const handleVoiceSelect = (composite: string) => {
    const colonIdx = composite.indexOf(":");
    const raw = composite.slice(0, colonIdx);
    const provider: "el" | "minimax" | "fishaudio" | "edge" =
      raw === "mm" ? "minimax" : raw === "fa" ? "fishaudio" : raw === "edge" ? "edge" : "el";
    const id = composite.slice(colonIdx + 1);
    setVoiceProvider(provider); setVoiceId(id); setVoiceOpen(false);
    setMobilePanel(false);
  };

  const selectedVoiceLabel = useMemo(() => {
    if (!voiceId) return null;
    if (voiceProvider === "el"        && selectedElVoice)   return selectedElVoice.name;
    if (voiceProvider === "minimax"   && selectedMmVoice)   return selectedMmVoice.name + (selectedMmVoice.style ? ` · ${selectedMmVoice.style}` : "");
    if (voiceProvider === "fishaudio" && selectedFaVoice)   return selectedFaVoice.name + (selectedFaVoice.style ? ` · ${selectedFaVoice.style}` : "");
    if (voiceProvider === "edge"      && selectedEdgeVoice) return selectedEdgeVoice.name;
    return null;
  }, [voiceId, voiceProvider, selectedElVoice, selectedMmVoice, selectedFaVoice, selectedEdgeVoice]);

  const resetSettings = () => { setStability(0.5); setSimilarityBoost(0.75); setSpeed(1); setVolume(1); setPitch(0); };

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
          </div>
          {/* Voice */}
          <div className="p-4 border-b border-[#f3f4f6]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Voice</span>
              <button onClick={() => setVoiceId("")} className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground transition-colors">
                <RotateCcw size={10} /> Reset Value
              </button>
            </div>
            {(selectedElVoice || selectedMmVoice || selectedFaVoice || selectedEdgeVoice) && (
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
                  {(selectedElVoice?.name ?? selectedMmVoice?.name ?? selectedFaVoice?.name ?? selectedEdgeVoice?.name ?? "V")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{selectedElVoice?.name ?? selectedMmVoice?.name ?? selectedFaVoice?.name ?? selectedEdgeVoice?.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      voiceProvider === "minimax" ? "bg-violet-100 text-violet-600"
                      : voiceProvider === "fishaudio" ? "bg-emerald-100 text-emerald-600"
                      : voiceProvider === "edge" ? "bg-sky-100 text-sky-600"
                      : "bg-[#f3f4f6] text-[#6b7280]"
                    )}>
                      {voiceProvider === "minimax"
                        ? (selectedMmVoice?.isClone ? "Clone" : selectedMmVoice?.lang ?? "AI")
                        : voiceProvider === "fishaudio"
                          ? (selectedFaVoice?.lang ?? "Multi")
                          : voiceProvider === "edge"
                            ? (selectedEdgeVoice?.locale ?? "Multi")
                            : (selectedElVoice?.category ?? "voice")}
                    </span>
                    {voiceProvider === "minimax" && <span className="flex items-center gap-0.5 text-[10px] text-violet-500 font-semibold"><Zap size={9} className="fill-violet-500" /> Fire TTS</span>}
                    {voiceProvider === "minimax" && selectedMmVoice?.style && <span className="text-[10px] text-[#9ca3af]">{selectedMmVoice.style}</span>}
                    {voiceProvider === "fishaudio" && <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold"><img src={PROVIDER_LOGOS.fishaudio} alt="" className="w-3 h-3 rounded-sm object-contain" /> Fish Audio</span>}
                    {voiceProvider === "fishaudio" && selectedFaVoice?.style && <span className="text-[10px] text-[#9ca3af]">{selectedFaVoice.style}</span>}
                    {voiceProvider === "edge" && <span className="flex items-center gap-1 text-[10px] text-sky-600 font-semibold"><img src={PROVIDER_LOGOS.edge} alt="" className="w-3 h-3 rounded-sm object-contain" /> Edge TTS</span>}
                    {voiceProvider === "edge" && selectedEdgeVoice?.gender && <span className="text-[10px] text-[#9ca3af]">{selectedEdgeVoice.gender}</span>}
                  </div>
                </div>
                {voiceProvider === "el" && <VoicePreviewBtn url={selectedElVoice?.previewUrl} />}
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
            {voiceProvider === "fishaudio" && (
              <div className="mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] mb-1 block">Language Filter</label>
                <select
                  value={faLang}
                  onChange={e => { setFaLang(e.target.value); setVoiceId(""); }}
                  className="w-full h-9 px-3 border border-[#e5e7eb] rounded-lg text-sm bg-white text-foreground focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {FA_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
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
                <Command>
                  <CommandInput placeholder="Search voices..." className="h-9 text-sm" />
                  <CommandList className="max-h-72">
                    <CommandEmpty className="py-6 text-center text-sm text-[#9ca3af]">No voice found.</CommandEmpty>

                    {/* ElevenLabs voices */}
                    {voiceProvider === "el" && voicesByCategory && Object.entries(voicesByCategory).map(([cat, items]) => (
                      <CommandGroup key={`el-${cat}`} heading={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                        {items.map((v) => (
                          <CommandItem key={`el:${v.voiceId}`} value={`el:${v.voiceId}:${v.name} ${cat}`}
                            onSelect={() => handleVoiceSelect(`el:${v.voiceId}`)} className="flex items-center gap-2 py-2 cursor-pointer">
                            <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center shrink-0 text-primary font-bold text-xs">{v.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                              <p className="text-[10px] text-[#9ca3af] capitalize">{cat}</p>
                            </div>
                            {voiceId === v.voiceId && <Check size={13} className="text-primary shrink-0" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}

                    {/* Fire TTS / MiniMax voices */}
                    {voiceProvider === "minimax" && Object.entries(mmByLang).map(([lang, langVoices]) => (
                      <CommandGroup key={`mm-${lang}`} heading={lang}>
                        {langVoices.map(v => (
                          <CommandItem key={`mm:${v.id}`} value={`mm:${v.id}:${v.name} ${v.style ?? ""} ${lang}`}
                            onSelect={() => handleVoiceSelect(`mm:${v.id}`)} className="flex items-center gap-2 py-2 cursor-pointer">
                            <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center shrink-0 text-violet-600 font-bold text-xs">{v.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                              <p className="text-[10px] text-[#9ca3af]">{v.isClone ? "Clone" : (v.style ?? lang)}</p>
                            </div>
                            {voiceId === v.id && <Check size={13} className="text-violet-600 shrink-0" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}

                    {/* Fish Audio voices */}
                    {voiceProvider === "fishaudio" && Object.entries(faByLang).map(([lang, langVoices]) => (
                      <CommandGroup key={`fa-${lang}`} heading={lang}>
                        {langVoices.map(v => (
                          <CommandItem key={`fa:${v.id}`} value={`fa:${v.id}:${v.name} ${v.style ?? ""} ${v.lang ?? ""}`}
                            onSelect={() => handleVoiceSelect(`fa:${v.id}`)} className="flex items-center gap-2 py-2 cursor-pointer">
                            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600 font-bold text-xs">{v.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                              <p className="text-[10px] text-[#9ca3af]">{v.style ?? v.lang ?? "Multi"}</p>
                            </div>
                            {voiceId === v.id && <Check size={13} className="text-emerald-600 shrink-0" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}

                    {/* Edge TTS voices */}
                    {voiceProvider === "edge" && Object.entries(edgeByLocale).map(([locale, locVoices]) => (
                      <CommandGroup key={`edge-${locale}`} heading={locale}>
                        {locVoices.map(v => (
                          <CommandItem key={`edge:${v.id}`} value={`edge:${v.id}:${v.name} ${locale}`}
                            onSelect={() => handleVoiceSelect(`edge:${v.id}`)} className="flex items-center gap-2 py-2 cursor-pointer">
                            <div className="w-7 h-7 rounded-md bg-sky-50 flex items-center justify-center shrink-0 text-sky-600 font-bold text-xs">{v.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                              <p className="text-[10px] text-[#9ca3af]">{v.gender} · {locale}</p>
                            </div>
                            {voiceId === v.id && <Check size={13} className="text-sky-600 shrink-0" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
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
            <SliderRow label="Speed" value={speed} onChange={setSpeed} min={0.5} max={2} step={0.1} />
            {voiceProvider === "el" && (
              <>
                <SliderRow label="Stability" value={stability} onChange={setStability} min={0} max={1} step={0.01} />
                <SliderRow label="Clarity" value={similarityBoost} onChange={setSimilarityBoost} min={0} max={1} step={0.01} />
              </>
            )}
            {voiceProvider === "minimax" && (
              <>
                <SliderRow label="Pitch" value={pitch} onChange={setPitch} min={-12} max={12} step={1} />
                <SliderRow label="Volume" value={volume} onChange={setVolume} min={0} max={10} step={0.1} />
              </>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {rightTab === "history" && (
        <div className="flex-1 overflow-y-auto">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#9ca3af]" /></div>
          ) : !history?.items?.length ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <History size={28} className="text-[#d1d5db] mb-3" />
              <p className="text-sm font-semibold text-[#6b7280]">No history yet</p>
              <p className="text-xs text-[#9ca3af] mt-1">Generated audio will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f3f4f6]">
              {history.items.map((gen: any) => (
                <div key={gen.id} className="p-4 hover:bg-[#fafafa] transition-colors" data-testid={`history-item-${gen.id}`}>
                  <p className="text-xs font-semibold text-foreground mb-1 line-clamp-2">{gen.text}</p>
                  <p className="text-[10px] text-[#9ca3af] mb-2">{gen.voiceName} · {gen.characterCount} chars</p>
                  <audio controls src={gen.audioUrl} className="w-full h-7" data-testid={`audio-history-${gen.id}`} />
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
          {/* Model selector — only ElevenLabs has multiple models */}
          {voiceProvider === "el" && (() => {
            const models = MODELS;
            const value = modelId;
            const selected = models.find(m => m.id === value);
            const handleModelChange = (id: string) => setModelId(id);
            return (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-[#6b7280]">Model</span>
                <Select value={value} onValueChange={handleModelChange}>
                  <SelectTrigger className="h-8 text-sm border-[#e5e7eb] w-44 sm:w-52 gap-2">
                    <SelectValue />
                    {selected?.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-primary text-white ml-1">{selected.badge}</span>}
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          {m.label}
                          {m.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">{m.badge}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}
          {voiceProvider !== "el" && (
            <div className="hidden sm:flex items-center gap-2">
              <span className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
                voiceProvider === "minimax" ? "text-violet-600 bg-violet-50 border-violet-200"
                : voiceProvider === "fishaudio" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                : voiceProvider === "os" ? "text-blue-600 bg-blue-50 border-blue-200"
                : "text-sky-600 bg-sky-50 border-sky-200"
              )}>
                {voiceProvider === "os"
                  ? <BookAudio size={13} className="shrink-0" />
                  : <img src={PROVIDER_LOGOS[voiceProvider]} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />}
                {voiceProvider === "minimax" ? "Fire HD" : voiceProvider === "fishaudio" ? "Fish Pro" : voiceProvider === "os" ? "Voice Library" : "Edge TTS"}
              </span>
            </div>
          )}
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
              maxLength={5000}
              data-testid="input-script"
            />
          </div>

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
            <span className="text-xs text-[#9ca3af] shrink-0">{text.length} / 5,000</span>
          </div>

          {/* Cost estimate (OpenSpeaker engine only — other engines don't use credits tasks) */}
          {voiceProvider === "os" && (
            <div className="px-4 sm:px-7 pb-3 shrink-0">
              <OsCostEstimate estimate={text.trim() ? estimateTtsCost(text) : null} />
            </div>
          )}

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
              disabled={isGenerating || !text.trim() || !voiceId}
              className={cn(
                "flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all",
                isGenerating || !text.trim() || !voiceId
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
