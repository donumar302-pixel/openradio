import { useState, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, PlayCircle, StopCircle, Mic2, History, Settings2, ChevronRight, RotateCcw, Smile, PauseCircle, Tag, Upload, Zap, ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MiniMaxVoice { id: string; name: string; lang?: string; style?: string; isClone?: boolean; }

const MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2", badge: "Best" },
  { id: "eleven_turbo_v2_5",      label: "Turbo v2.5",      badge: "Fast" },
  { id: "eleven_turbo_v2",        label: "Turbo v2",        badge: null },
  { id: "eleven_monolingual_v1",  label: "English v1",      badge: null },
];

function SliderRow({
  label, value, onChange, min, max, step,
}: {
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
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer accent-primary bg-[#e5e7eb]"
      />
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
  const [voiceProvider, setVoiceProvider] = useState<"el" | "minimax">("el");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [speed, setSpeed] = useState(1);
  const [latestAudio, setLatestAudio] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"settings" | "history">("settings");

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

  const { data: history, isLoading: loadingHistory } = useListGenerations(
    { limit: 20 },
    { query: { queryKey: getListGenerationsQueryKey({ limit: 20 }) } }
  );

  const generateSpeech = useGenerateSpeech();
  const [mmGenerating, setMmGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ title: "Text required", description: "Please enter some text.", variant: "destructive" });
      return;
    }
    if (!voiceId) {
      toast({ title: "Voice required", description: "Please select a voice.", variant: "destructive" });
      return;
    }

    // MiniMax path
    if (voiceProvider === "minimax") {
      setMmGenerating(true);
      setLatestAudio(null);
      try {
        const res = await fetch("/api/minimax/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId, model: "speech-02-hd", speed, volume: 1, pitch: 0 }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any).error || "Generation failed");
        }
        const blob = await res.blob();
        setLatestAudio(URL.createObjectURL(blob));
        toast({ title: "Generated!", description: "Your audio is ready." });
      } catch (e: any) {
        toast({ title: "Generation failed", description: e.message, variant: "destructive" });
      } finally {
        setMmGenerating(false);
      }
      return;
    }

    // ElevenLabs path
    generateSpeech.mutate(
      { data: { text, voiceId, stability, similarityBoost, modelId } },
      {
        onSuccess: (data) => {
          setLatestAudio(data.audioUrl);
          queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey({ limit: 20 }) });
        },
        onError: (err: any) => {
          toast({ title: "Generation failed", description: err?.error || "Unknown error.", variant: "destructive" });
        },
      }
    );
  };

  const isGenerating = generateSpeech.isPending || mmGenerating;

  const voicesByCategory = voices?.reduce((acc, voice) => {
    const cat = voice.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  // MiniMax voices grouped by language
  const mmByLang = mmVoices.reduce((acc, v) => {
    const g = v.isClone ? "My Clones" : (v.lang ?? "Other");
    if (!acc[g]) acc[g] = [];
    acc[g].push(v);
    return acc;
  }, {} as Record<string, MiniMaxVoice[]>);

  const selectedElVoice = voiceProvider === "el" ? voices?.find((v) => v.voiceId === voiceId) : undefined;
  const selectedMmVoice = voiceProvider === "minimax" ? mmVoices.find((v) => v.id === voiceId) : undefined;
  const selectedModel = MODELS.find((m) => m.id === modelId);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const handleVoiceSelect = (composite: string) => {
    const colonIdx = composite.indexOf(":");
    const provider = composite.slice(0, colonIdx) as "el" | "minimax";
    const id = composite.slice(colonIdx + 1);
    setVoiceProvider(provider);
    setVoiceId(id);
    setVoiceOpen(false);
  };

  const selectedVoiceLabel = useMemo(() => {
    if (!voiceId) return null;
    if (voiceProvider === "el" && selectedElVoice) return selectedElVoice.name;
    if (voiceProvider === "minimax" && selectedMmVoice)
      return selectedMmVoice.name + (selectedMmVoice.style ? ` · ${selectedMmVoice.style}` : "");
    return null;
  }, [voiceId, voiceProvider, selectedElVoice, selectedMmVoice]);

  const resetSettings = () => {
    setStability(0.5);
    setSimilarityBoost(0.75);
    setSpeed(1);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#f3f4f6] shrink-0">
        <h1 className="text-[17px] font-bold text-foreground">Speech Synthesis</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#6b7280]">Model</span>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="h-8 text-sm border-[#e5e7eb] w-48 gap-2">
              <SelectValue />
              {selectedModel?.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-primary text-white ml-1">
                  {selectedModel.badge}
                </span>
              )}
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    {m.label}
                    {m.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">
                        {m.badge}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: text area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Text */}
          <div className="flex-1 relative">
            <textarea
              placeholder="Start typing here to unleash the power of speech synthesis to generate speech..."
              className="w-full h-full resize-none text-[15px] leading-relaxed px-7 py-6 outline-none bg-white placeholder:text-[#9ca3af]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              data-testid="input-script"
            />
          </div>

          {/* Generated audio */}
          {latestAudio && (
            <div className="px-7 pb-3">
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-200/60 rounded-xl px-4 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Mic2 size={13} className="text-white" />
                </div>
                <audio controls className="flex-1 h-7" src={latestAudio} data-testid="audio-player" />
                <a href={latestAudio} download="bunnytts.mp3">
                  <button className="p-1 rounded hover:bg-orange-100 text-primary transition-colors">
                    <Download size={14} />
                  </button>
                </a>
              </div>
            </div>
          )}

          {/* Tag pills bar */}
          <div className="flex items-center gap-2 px-7 py-2 border-t border-[#f3f4f6]">
            <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-primary hover:text-primary transition-colors">
              <Smile size={12} /> Emotion
            </button>
            <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-primary hover:text-primary transition-colors">
              <PauseCircle size={12} /> Pause
            </button>
            <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-[#e5e7eb] text-[#6b7280] hover:border-primary hover:text-primary transition-colors">
              <Tag size={12} /> Sound Tag
            </button>

            <div className="flex-1" />

            <span className="text-xs text-[#9ca3af]">
              {text.length} / 5,000 characters
              {text.length > 4500 && <span className="text-primary ml-1">Approaching limit</span>}
            </span>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 px-7 py-3 border-t border-[#f3f4f6] bg-white shrink-0">
            <div className="flex items-center gap-2 text-[#6b7280]">
              <Upload size={14} />
              <select className="text-xs border border-[#e5e7eb] rounded px-2 py-1 bg-white text-[#6b7280] outline-none">
                <option>Detect Language</option>
                <option>English</option>
                <option>Urdu</option>
                <option>Arabic</option>
                <option>Hindi</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
              </select>
            </div>

            <div className="flex-1" />

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim() || !voiceId}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
                isGenerating || !text.trim() || !voiceId
                  ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed"
                  : voiceProvider === "minimax"
                    ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                    : "bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30"
              )}
              data-testid="btn-generate"
            >
              {isGenerating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                : voiceProvider === "minimax"
                  ? <><Zap className="h-4 w-4 fill-white" /> Generate</>
                  : <><Play className="h-4 w-4 fill-white" /> Generate</>
              }
            </button>
          </div>
        </div>

        {/* Right: Settings panel */}
        <div className="w-[280px] shrink-0 border-l border-[#f3f4f6] bg-white flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-[#f3f4f6] shrink-0">
            <button
              onClick={() => setRightTab("settings")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors",
                rightTab === "settings"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-[#9ca3af] hover:text-foreground"
              )}
            >
              <Settings2 size={13} /> Settings
            </button>
            <button
              onClick={() => setRightTab("history")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors",
                rightTab === "history"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-[#9ca3af] hover:text-foreground"
              )}
            >
              <History size={13} /> History
            </button>
          </div>

          {/* Settings */}
          {rightTab === "settings" && (
            <div className="flex-1 overflow-y-auto">
              {/* Voice */}
              <div className="p-4 border-b border-[#f3f4f6]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">Voice</span>
                  <button
                    onClick={() => setVoiceId("")}
                    className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground transition-colors"
                  >
                    <RotateCcw size={10} /> Reset Value
                  </button>
                </div>

                {/* Selected voice card */}
                {(selectedElVoice || selectedMmVoice) && (
                  <div className={cn(
                    "flex items-center gap-3 p-2.5 border rounded-xl mb-3",
                    voiceProvider === "minimax" ? "border-violet-200 bg-violet-50" : "border-[#e5e7eb]"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-lg",
                      voiceProvider === "minimax"
                        ? "bg-violet-100 text-violet-600"
                        : "bg-gradient-to-br from-primary/30 to-orange-200 text-primary"
                    )}>
                      {(selectedElVoice?.name ?? selectedMmVoice?.name ?? "V")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {selectedElVoice?.name ?? selectedMmVoice?.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                          "inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold",
                          voiceProvider === "minimax" ? "bg-violet-100 text-violet-600" : "bg-[#f3f4f6] text-[#6b7280]"
                        )}>
                          {voiceProvider === "minimax"
                            ? (selectedMmVoice?.isClone ? "Clone" : selectedMmVoice?.lang ?? "AI")
                            : (selectedElVoice?.category ?? "voice")}
                        </span>
                        {voiceProvider === "minimax" && (
                          <span className="flex items-center gap-0.5 text-[10px] text-violet-500 font-semibold">
                            <Zap size={9} className="fill-violet-500" /> Fire TTS
                          </span>
                        )}
                        {voiceProvider === "minimax" && selectedMmVoice?.style && (
                          <span className="text-[10px] text-[#9ca3af]">{selectedMmVoice.style}</span>
                        )}
                      </div>
                    </div>
                    {voiceProvider === "el" && <VoicePreviewBtn url={selectedElVoice?.previewUrl} />}
                  </div>
                )}

                {/* ── Searchable voice picker ── */}
                <Popover open={voiceOpen} onOpenChange={setVoiceOpen}>
                  <PopoverTrigger asChild>
                    <button
                      data-testid="select-voice"
                      className={cn(
                        "w-full flex items-center justify-between h-10 px-3 border rounded-lg text-sm transition-colors",
                        "border-[#e5e7eb] bg-white hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
                        !selectedVoiceLabel && "text-[#9ca3af]"
                      )}
                    >
                      <span className="truncate font-medium">
                        {loadingVoices ? "Loading voices..." : (selectedVoiceLabel ?? "Choose a voice")}
                      </span>
                      <ChevronsUpDown size={14} className="shrink-0 text-[#9ca3af] ml-2" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start" side="bottom">
                    <Command>
                      <CommandInput placeholder="Search voices..." className="h-9 text-sm" />
                      <CommandList className="max-h-72">
                        <CommandEmpty className="py-6 text-center text-sm text-[#9ca3af]">No voice found.</CommandEmpty>

                        {/* ── ElevenLabs voices ── */}
                        {voicesByCategory && Object.keys(voicesByCategory).length > 0 && (
                          <>
                            <div className="px-3 pt-2.5 pb-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">Text to Speech</p>
                            </div>
                            {Object.entries(voicesByCategory).map(([cat, items]) => (
                              <CommandGroup key={`el-${cat}`} heading={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                                {items.map((v) => (
                                  <CommandItem
                                    key={`el:${v.voiceId}`}
                                    value={`el:${v.voiceId}:${v.name} ${cat}`}
                                    onSelect={() => handleVoiceSelect(`el:${v.voiceId}`)}
                                    className="flex items-center gap-2 py-2 cursor-pointer"
                                  >
                                    <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
                                      {v.name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                                      <p className="text-[10px] text-[#9ca3af] capitalize">{cat}</p>
                                    </div>
                                    {voiceProvider === "el" && voiceId === v.voiceId && (
                                      <Check size={13} className="text-primary shrink-0" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </>
                        )}

                        {/* ── MiniMax (Fire TTS) voices ── */}
                        {mmVoices.length > 0 && (
                          <>
                            {voicesByCategory && Object.keys(voicesByCategory).length > 0 && <CommandSeparator />}
                            <div className="px-3 pt-2.5 pb-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-violet-500 flex items-center gap-1">
                                <Zap size={9} className="fill-violet-500" /> Fire TTS (35+ langs)
                              </p>
                            </div>
                            {Object.entries(mmByLang).map(([lang, langVoices]) => (
                              <CommandGroup key={`mm-${lang}`} heading={lang}>
                                {langVoices.map(v => (
                                  <CommandItem
                                    key={`mm:${v.id}`}
                                    value={`mm:${v.id}:${v.name} ${v.style ?? ""} ${lang}`}
                                    onSelect={() => handleVoiceSelect(`mm:${v.id}`)}
                                    className="flex items-center gap-2 py-2 cursor-pointer"
                                  >
                                    <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center shrink-0 text-violet-600 font-bold text-xs">
                                      {v.name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
                                      <p className="text-[10px] text-[#9ca3af]">
                                        {v.isClone ? "Clone" : (v.style ?? lang)}
                                      </p>
                                    </div>
                                    {voiceProvider === "minimax" && voiceId === v.id && (
                                      <Check size={13} className="text-violet-600 shrink-0" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Model (also in right panel for quick access) */}
              <div className="px-4 py-3 border-b border-[#f3f4f6]">
                <button className="w-full flex items-center justify-between py-1 group">
                  <span className="text-sm font-semibold text-foreground">Voice Modifier</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-primary font-semibold">Free</span>
                    <ChevronRight size={14} className="text-[#9ca3af]" />
                  </div>
                </button>
              </div>

              {/* Sliders */}
              <div className="p-4 space-y-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-foreground">Voice Settings</span>
                  <button
                    onClick={resetSettings}
                    className="flex items-center gap-1 text-xs text-[#9ca3af] hover:text-foreground transition-colors"
                  >
                    <RotateCcw size={10} /> Reset
                  </button>
                </div>

                <SliderRow label="Speed"    value={speed}           onChange={setSpeed}           min={0.5} max={2}   step={0.1} />
                <SliderRow label="Stability" value={stability}       onChange={setStability}       min={0}   max={1}   step={0.01} />
                <SliderRow label="Clarity"  value={similarityBoost} onChange={setSimilarityBoost} min={0}   max={1}   step={0.01} />
              </div>
            </div>
          )}

          {/* History */}
          {rightTab === "history" && (
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : history?.items?.length ? (
                <div className="divide-y divide-[#f3f4f6]">
                  {history.items.map((gen) => (
                    <div key={gen.id} className="p-4 hover:bg-[#fafafa] transition-colors" data-testid={`card-history-${gen.id}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-primary truncate">{gen.voiceName}</span>
                        <span className="text-xs text-[#9ca3af] shrink-0 ml-2">{gen.characterCount}ch</span>
                      </div>
                      <p className="text-xs text-[#6b7280] truncate mb-2">{gen.text}</p>
                      <div className="flex items-center gap-2">
                        <audio controls src={gen.audioUrl} className="flex-1 h-7" data-testid={`audio-history-${gen.id}`} />
                        <a href={gen.audioUrl} download={`bunnytts-${gen.id}.mp3`}>
                          <button className="p-1 rounded hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-primary transition-colors">
                            <Download size={13} />
                          </button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <Mic2 className="h-9 w-9 text-[#d1d5db] mb-3" />
                  <p className="text-sm font-medium text-[#6b7280]">No generations yet</p>
                  <p className="text-xs text-[#9ca3af] mt-1">Your history will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
