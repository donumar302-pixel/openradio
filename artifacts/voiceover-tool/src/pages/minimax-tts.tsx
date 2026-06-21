import { useState } from "react";
import {
  Loader2, Play, Download, Mic2, Settings2, History,
  RotateCcw, Smile, PauseCircle, Tag, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── Models ─────────────────────────────────────────────────────── */
const MODELS = [
  {
    id: "speech-02-hd",
    label: "Speech-02-HD",
    desc: "Highest quality, natural prosody",
    badge: "Best",
    badgeColor: "bg-violet-100 text-violet-600",
  },
  {
    id: "speech-02-turbo",
    label: "Speech-02-Turbo",
    desc: "Fast generation, great quality",
    badge: "Fast",
    badgeColor: "bg-blue-100 text-blue-600",
  },
  {
    id: "speech-01-hd",
    label: "Speech-01-HD",
    desc: "Previous HD generation model",
    badge: null,
    badgeColor: "",
  },
  {
    id: "speech-01-turbo",
    label: "Speech-01-Turbo",
    desc: "Previous turbo generation model",
    badge: null,
    badgeColor: "",
  },
];

/* ── Language tabs ───────────────────────────────────────────────── */
const LANG_TABS = [
  "All", "English", "Arabic", "Chinese",
  "Hindi", "Japanese", "Korean", "Spanish",
  "French", "German", "Portuguese", "Italian", "Russian",
];

interface Voice {
  id: string; name: string; lang?: string;
  style?: string; isClone?: boolean; description?: string;
}

/* ── Slider ─────────────────────────────────────────────────────── */
function SliderRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">{label}</span>
        <span className="w-10 h-8 flex items-center justify-center border border-[#e5e7eb] rounded-lg text-[14px] font-bold bg-white shadow-sm">
          {value % 1 === 0 ? value : value.toFixed(1)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-600 bg-[#e5e7eb]"
      />
      <div className="flex justify-between text-[11px] text-[#9ca3af]">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function MinimaxTtsPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState("speech-02-hd");
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"settings" | "history">("settings");
  const [langFilter, setLangFilter] = useState("All");

  const { data: voiceData } = useQuery<{ builtin: Voice[]; clones: Voice[] }>({
    queryKey: ["minimax-voices"],
    queryFn: () => fetch("/api/minimax/voices").then(r => r.json()),
  });

  const allVoices: Voice[] = [
    ...(voiceData?.clones ?? []).map(c => ({ ...c, lang: "Clone" })),
    ...(voiceData?.builtin ?? []),
  ];
  const filteredVoices = langFilter === "All"
    ? allVoices
    : allVoices.filter(v => v.lang === langFilter);
  const byGroup = filteredVoices.reduce((acc, v) => {
    const g = v.isClone ? "My Clones" : (v.lang ?? "Other");
    if (!acc[g]) acc[g] = [];
    acc[g].push(v);
    return acc;
  }, {} as Record<string, Voice[]>);

  const selectedVoice = allVoices.find(v => v.id === voiceId);
  const selectedModel = MODELS.find(m => m.id === model)!;
  const reset = () => { setSpeed(1); setVolume(1); setPitch(0); };

  const generate = async () => {
    if (!text.trim()) { toast({ title: "Text required", variant: "destructive" }); return; }
    if (!voiceId) { toast({ title: "Select a voice", variant: "destructive" }); return; }
    setLoading(true); setAudioUrl(null);
    try {
      const res = await fetch("/api/minimax/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, model, speed, volume, pitch }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Generation failed");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast({ title: "Generated!", description: "Your audio is ready." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#fafafa] overflow-hidden">

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-7 py-4 border-b border-[#f0f0f0] bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-sm">
            <Zap size={17} className="text-white fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-black text-foreground tracking-tight">Fire TTS</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-500">Hot</span>
            </div>
            <p className="text-[12px] text-[#9ca3af]">AI Speech Synthesis — 35+ voices, 13 languages</p>
          </div>
        </div>
      </div>

      {/* ── Model Selector Cards ── */}
      <div className="px-7 py-4 border-b border-[#f0f0f0] bg-white shrink-0">
        <p className="text-[12px] font-bold text-[#9ca3af] uppercase tracking-wider mb-3">Select Model</p>
        <div className="grid grid-cols-4 gap-3">
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              className={cn(
                "flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all",
                model === m.id
                  ? "border-violet-500 bg-violet-50 shadow-sm"
                  : "border-[#f0f0f0] bg-white hover:border-violet-200 hover:bg-violet-50/30"
              )}
            >
              <div className="flex items-center gap-2 mb-1 w-full">
                <span className={cn(
                  "text-[13px] font-bold truncate",
                  model === m.id ? "text-violet-700" : "text-foreground"
                )}>{m.label}</span>
                {m.badge && (
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-auto", m.badgeColor)}>
                    {m.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#9ca3af] leading-snug">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left — text area */}
        <div className="flex flex-col flex-1 min-w-0 bg-white border-r border-[#f0f0f0]">
          <textarea
            placeholder="Start typing here to generate speech with Fire TTS…"
            className="flex-1 resize-none text-[15px] leading-relaxed px-7 py-6 outline-none bg-white placeholder:text-[#c4c4c4]"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={5000}
          />

          {/* Audio player */}
          {audioUrl && (
            <div className="px-7 pb-4">
              <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                  <Mic2 size={14} className="text-white" />
                </div>
                <audio controls className="flex-1 h-8" src={audioUrl} />
                <a href={audioUrl} download="fire-tts.mp3">
                  <button className="p-2 rounded-xl hover:bg-violet-100 text-violet-600 transition-colors">
                    <Download size={15} />
                  </button>
                </a>
              </div>
            </div>
          )}

          {/* Emotion / tag pills */}
          <div className="flex items-center gap-2 px-7 py-3 border-t border-[#f0f0f0]">
            {[
              { icon: <Smile size={13} />, label: "Emotion" },
              { icon: <PauseCircle size={13} />, label: "Pause" },
              { icon: <Tag size={13} />, label: "Sound Tag" },
            ].map(p => (
              <button key={p.label}
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-violet-400 hover:text-violet-600 transition-colors font-medium">
                {p.icon} {p.label}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[12px] text-[#9ca3af] font-medium">{text.length} / 5,000</span>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-4 px-7 py-4 border-t border-[#f0f0f0] bg-[#fafafa] shrink-0">
            <select className="text-[13px] border border-[#e5e7eb] rounded-lg px-3 py-2 bg-white text-[#6b7280] outline-none cursor-pointer hover:border-violet-300 transition-colors font-medium">
              <option>Detect Language</option>
              <option>English</option><option>Arabic</option><option>Chinese</option>
              <option>Hindi</option><option>Japanese</option><option>Korean</option>
              <option>Spanish</option><option>French</option><option>German</option>
              <option>Portuguese</option><option>Italian</option><option>Russian</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={generate}
              disabled={loading || !text.trim() || !voiceId}
              className={cn(
                "flex items-center gap-2 px-7 py-2.5 rounded-xl text-[14px] font-bold transition-all",
                loading || !text.trim() || !voiceId
                  ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed"
                  : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
              )}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                : <><Play className="h-4 w-4 fill-white" />Generate Speech</>
              }
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[300px] shrink-0 bg-white flex flex-col">

          {/* Tabs */}
          <div className="flex border-b border-[#f0f0f0] shrink-0">
            {(["settings", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold transition-colors capitalize",
                  tab === t
                    ? "text-foreground border-b-2 border-violet-600"
                    : "text-[#9ca3af] hover:text-foreground"
                )}>
                {t === "settings" ? <Settings2 size={14} /> : <History size={14} />}
                {t}
              </button>
            ))}
          </div>

          {tab === "settings" && (
            <div className="flex-1 overflow-y-auto">

              {/* Voice selector */}
              <div className="p-5 border-b border-[#f0f0f0] space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-foreground">Voice</p>
                  <button onClick={() => setVoiceId("")}
                    className="flex items-center gap-1 text-[12px] text-[#9ca3af] hover:text-foreground transition-colors">
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>

                {/* Language filter */}
                <div className="flex flex-wrap gap-1.5">
                  {LANG_TABS.slice(0, 8).map(l => (
                    <button key={l} onClick={() => setLangFilter(l)}
                      className={cn(
                        "text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors",
                        langFilter === l
                          ? "bg-violet-600 text-white border-violet-600"
                          : "border-[#e5e7eb] text-[#6b7280] hover:border-violet-300 hover:text-violet-600"
                      )}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Selected voice card */}
                {selectedVoice && (
                  <div className="flex items-center gap-3 p-3 border border-violet-200 bg-violet-50 rounded-xl">
                    <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 text-white font-black text-[14px]">
                      {selectedVoice.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold truncate text-foreground">{selectedVoice.name}</p>
                      <p className="text-[11px] text-[#9ca3af]">
                        {selectedVoice.lang}
                        {selectedVoice.style ? ` · ${selectedVoice.style}` : ""}
                      </p>
                    </div>
                  </div>
                )}

                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger className="border-[#e5e7eb] text-[13px] h-10 w-full rounded-xl">
                    <SelectValue placeholder="Choose a voice…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Object.entries(byGroup).map(([group, voices]) => (
                      <SelectGroup key={group}>
                        <SelectLabel className="text-violet-600 text-[11px] font-bold">{group}</SelectLabel>
                        {voices.map(v => (
                          <SelectItem key={v.id} value={v.id} className="text-[13px] py-2">
                            <div className="flex items-center gap-2">
                              <span>{v.name}</span>
                              {v.style && <span className="text-[10px] text-[#9ca3af]">{v.style}</span>}
                              {v.isClone && <span className="text-[10px] text-violet-500 font-bold">Clone</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice settings sliders */}
              <div className="p-5 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-foreground">Voice Settings</p>
                  <button onClick={reset}
                    className="flex items-center gap-1 text-[12px] text-[#9ca3af] hover:text-foreground transition-colors">
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>
                <SliderRow label="Speed"  value={speed}  onChange={setSpeed}  min={0.5} max={2}  step={0.1} />
                <SliderRow label="Pitch"  value={pitch}  onChange={setPitch}  min={-12} max={12} step={1} />
                <SliderRow label="Volume" value={volume} onChange={setVolume} min={0}   max={10} step={0.1} />
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <Mic2 className="h-10 w-10 text-[#d1d5db] mb-3" />
              <p className="text-[14px] font-semibold text-[#6b7280]">No history yet</p>
              <p className="text-[12px] text-[#9ca3af] mt-1">Generated audio will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
