import { useState } from "react";
import { Loader2, Play, Download, Mic2, Settings2, History, RotateCcw, ChevronRight, Smile, PauseCircle, Tag, Upload } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const MODELS = [
  { id: "speech-02-hd",    label: "Speech-02-HD",    badge: "Best" },
  { id: "speech-02-turbo", label: "Speech-02-Turbo", badge: "Fast" },
  { id: "speech-01-hd",    label: "Speech-01-HD",    badge: null },
  { id: "speech-01-turbo", label: "Speech-01-Turbo", badge: null },
];

const LANGUAGES = [
  "All", "English", "Chinese", "Arabic", "Hindi", "Japanese",
  "Korean", "Spanish", "French", "German", "Portuguese", "Italian", "Russian",
];

interface Voice { id: string; name: string; lang?: string; style?: string; isClone?: boolean; description?: string; }

function SliderRow({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <span className="w-9 h-7 flex items-center justify-center border border-[#e5e7eb] rounded text-sm font-semibold bg-white">
          {value % 1 === 0 ? value : value.toFixed(1)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer accent-orange-500 bg-[#e5e7eb]"
      />
    </div>
  );
}

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

  const filteredVoices = langFilter === "All" ? allVoices : allVoices.filter(v => v.lang === langFilter);

  const byGroup = filteredVoices.reduce((acc, v) => {
    const g = v.isClone ? "My Clones" : (v.lang ?? "Other");
    if (!acc[g]) acc[g] = [];
    acc[g].push(v);
    return acc;
  }, {} as Record<string, Voice[]>);

  const selectedVoice = allVoices.find(v => v.id === voiceId);
  const selectedModel = MODELS.find(m => m.id === model);

  const reset = () => { setSpeed(1); setVolume(1); setPitch(0); };

  const generate = async () => {
    if (!text.trim()) { toast({ title: "Text required", variant: "destructive" }); return; }
    if (!voiceId) { toast({ title: "Select a voice", variant: "destructive" }); return; }
    setLoading(true);
    setAudioUrl(null);
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
      toast({ title: "Generated!", description: "MiniMax audio ready." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#f3f4f6] shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[17px] font-bold text-foreground">MiniMax — Speech Synthesis</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">MiniMax</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#6b7280]">Model</span>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-8 text-sm border-[#e5e7eb] w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    {m.label}
                    {m.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-100 text-violet-600">{m.badge}</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        {/* Left */}
        <div className="flex flex-col flex-1 min-w-0">
          <textarea
            placeholder="Start typing here to generate speech with MiniMax AI..."
            className="flex-1 resize-none text-[15px] leading-relaxed px-7 py-6 outline-none bg-white placeholder:text-[#9ca3af]"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={5000}
          />

          {audioUrl && (
            <div className="px-7 pb-3">
              <div className="flex items-center gap-3 bg-violet-50 border border-violet-200/60 rounded-xl px-4 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
                  <Mic2 size={13} className="text-white" />
                </div>
                <audio controls className="flex-1 h-7" src={audioUrl} />
                <a href={audioUrl} download="minimax-tts.mp3">
                  <button className="p-1 rounded hover:bg-violet-100 text-violet-600 transition-colors">
                    <Download size={14} />
                  </button>
                </a>
              </div>
            </div>
          )}

          {/* Pills */}
          <div className="flex items-center gap-2 px-7 py-2 border-t border-[#f3f4f6]">
            <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-violet-400 hover:text-violet-600 transition-colors">
              <Smile size={12} /> Emotion
            </button>
            <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-violet-400 hover:text-violet-600 transition-colors">
              <PauseCircle size={12} /> Pause
            </button>
            <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-violet-400 hover:text-violet-600 transition-colors">
              <Tag size={12} /> Sound Tag
            </button>
            <div className="flex-1" />
            <span className="text-xs text-[#9ca3af]">{text.length} / 5,000 characters</span>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-3 px-7 py-3 border-t border-[#f3f4f6] bg-white shrink-0">
            <div className="flex items-center gap-2 text-[#6b7280]">
              <Upload size={14} />
              <select className="text-xs border border-[#e5e7eb] rounded px-2 py-1 bg-white text-[#6b7280] outline-none">
                <option>Detect Language</option>
                <option>English</option><option>Arabic</option><option>Chinese</option>
                <option>Hindi</option><option>Japanese</option><option>Korean</option>
                <option>Spanish</option><option>French</option><option>German</option>
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={generate}
              disabled={loading || !text.trim() || !voiceId}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
                loading || !text.trim() || !voiceId
                  ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed"
                  : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
              )}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><Play className="h-4 w-4 fill-white" />Generate</>}
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[280px] shrink-0 border-l border-[#f3f4f6] bg-white flex flex-col">
          <div className="flex border-b border-[#f3f4f6] shrink-0">
            {(["settings", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors capitalize",
                  tab === t ? "text-foreground border-b-2 border-violet-500" : "text-[#9ca3af] hover:text-foreground"
                )}>
                {t === "settings" ? <Settings2 size={13} /> : <History size={13} />} {t}
              </button>
            ))}
          </div>

          {tab === "settings" && (
            <div className="flex-1 overflow-y-auto">
              {/* Voice */}
              <div className="p-4 border-b border-[#f3f4f6] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Voice</span>
                  <button onClick={() => setVoiceId("")} className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground">
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>

                {/* Language filter */}
                <div className="flex gap-1.5 flex-wrap">
                  {["All", "English", "Arabic", "Chinese", "Hindi", "Japanese", "Korean", "Spanish"].map(l => (
                    <button key={l} onClick={() => setLangFilter(l)}
                      className={cn("text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors",
                        langFilter === l ? "bg-violet-600 text-white border-violet-600" : "border-[#e5e7eb] text-[#6b7280] hover:border-violet-400"
                      )}>
                      {l}
                    </button>
                  ))}
                </div>

                {selectedVoice && (
                  <div className="flex items-center gap-2.5 p-2.5 border border-[#e5e7eb] rounded-xl">
                    <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 text-violet-600 font-bold text-sm">
                      {selectedVoice.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedVoice.name}</p>
                      <p className="text-[10px] text-[#9ca3af]">{selectedVoice.lang} {selectedVoice.style ? `· ${selectedVoice.style}` : ""}</p>
                    </div>
                  </div>
                )}

                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger className="border-[#e5e7eb] text-sm h-10 w-full">
                    <SelectValue placeholder="Choose a voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Object.entries(byGroup).map(([group, voices]) => (
                      <SelectGroup key={group}>
                        <SelectLabel className="text-violet-600/70 text-xs">{group}</SelectLabel>
                        {voices.map(v => (
                          <SelectItem key={v.id} value={v.id} className="text-sm py-2">
                            <div>
                              <span>{v.name}</span>
                              {v.isClone && <span className="ml-1.5 text-[10px] text-violet-500 font-semibold">Clone</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Modifier */}
              <div className="px-4 py-3 border-b border-[#f3f4f6]">
                <button className="w-full flex items-center justify-between py-1">
                  <span className="text-sm font-semibold">Voice Modifier</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-semibold">Free</span>
                    <ChevronRight size={14} className="text-[#9ca3af]" />
                  </div>
                </button>
              </div>

              {/* Sliders */}
              <div className="p-4 space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">Voice Settings</span>
                  <button onClick={reset} className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground">
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>
                <SliderRow label="Speed"  value={speed}  onChange={setSpeed}  min={0.5} max={2}   step={0.1} />
                <SliderRow label="Pitch"  value={pitch}  onChange={setPitch}  min={-12} max={12}  step={1} />
                <SliderRow label="Volume" value={volume} onChange={setVolume} min={0}   max={10}  step={0.1} />
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <Mic2 className="h-9 w-9 text-[#d1d5db] mb-3" />
              <p className="text-sm font-medium text-[#6b7280]">History coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
