import { useState } from "react";
import {
  useListVoices,
  getListVoicesQueryKey,
  useGenerateSpeech,
  useListGenerations,
  getListGenerationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, PlayCircle, StopCircle, Mic2, History, Settings2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
  { id: "eleven_monolingual_v1", label: "English v1" },
  { id: "eleven_turbo_v2", label: "Turbo v2" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5" },
];

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
    <button onClick={toggle} className="text-primary hover:text-primary/70 transition-colors shrink-0">
      {playing ? <StopCircle size={14} /> : <PlayCircle size={14} />}
    </button>
  );
}

export default function StudioPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_multilingual_v2");
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);
  const [speed, setSpeed] = useState([1]);
  const [latestAudio, setLatestAudio] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"settings" | "history">("settings");

  const { data: voices, isLoading: loadingVoices } = useListVoices({
    query: { queryKey: getListVoicesQueryKey() },
  });

  const { data: history, isLoading: loadingHistory } = useListGenerations(
    { limit: 20 },
    { query: { queryKey: getListGenerationsQueryKey({ limit: 20 }) } }
  );

  const generateSpeech = useGenerateSpeech();

  const handleGenerate = () => {
    if (!text.trim()) {
      toast({ title: "Text required", description: "Please enter some text.", variant: "destructive" });
      return;
    }
    if (!voiceId) {
      toast({ title: "Voice required", description: "Please select a voice.", variant: "destructive" });
      return;
    }
    generateSpeech.mutate(
      { data: { text, voiceId, stability: stability[0], similarityBoost: similarityBoost[0], modelId } },
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

  const voicesByCategory = voices?.reduce((acc, voice) => {
    const cat = voice.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  const selectedVoice = voices?.find((v) => v.voiceId === voiceId);

  const resetSettings = () => {
    setStability([0.5]);
    setSimilarityBoost([0.75]);
    setSpeed([1]);
  };

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col bg-[#fafafa]">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-border shrink-0">
        <h1 className="text-lg font-extrabold text-foreground">Speech Synthesis</h1>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Model</span>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="h-8 text-sm border-border w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-sm">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Text area */}
        <div className="flex flex-col flex-1 min-w-0">
          <Textarea
            placeholder="Start typing here to unleash the power of speech synthesis to generate speech..."
            className="flex-1 resize-none text-base leading-relaxed border-0 shadow-none focus-visible:ring-0 bg-white rounded-none px-8 py-6 min-h-0"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            data-testid="input-script"
          />

          {/* Audio result */}
          {latestAudio && (
            <div className="px-8 pb-4">
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-200/70 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Mic2 size={15} className="text-white" />
                </div>
                <audio controls className="flex-1 h-8" src={latestAudio} data-testid="audio-player" />
                <a href={latestAudio} download="bunnytts.mp3">
                  <button className="p-1.5 rounded-lg hover:bg-orange-100 text-primary transition-colors">
                    <Download size={15} />
                  </button>
                </a>
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-8 py-3 border-t border-border bg-white shrink-0">
            <span className="text-xs text-muted-foreground">
              {text.length} / 5,000 characters
              {text.length > 4500 && <span className="text-orange-500 font-medium ml-2">Approaching limit</span>}
            </span>
            <Button
              onClick={handleGenerate}
              disabled={generateSpeech.isPending || !text.trim() || !voiceId}
              className="bg-primary hover:bg-primary/90 font-bold px-8"
              data-testid="btn-generate"
            >
              {generateSpeech.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Play className="mr-2 h-4 w-4 fill-white" />Generate</>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Settings panel */}
        <div className="w-72 shrink-0 border-l border-border bg-white flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setRightTab("settings")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors",
                rightTab === "settings"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings2 size={14} />
              Settings
            </button>
            <button
              onClick={() => setRightTab("history")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors",
                rightTab === "history"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <History size={14} />
              History
            </button>
          </div>

          {/* Settings tab */}
          {rightTab === "settings" && (
            <div className="flex-1 overflow-y-auto">
              {/* Voice selector */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Voice</span>
                </div>

                <Select value={voiceId} onValueChange={setVoiceId} disabled={loadingVoices}>
                  <SelectTrigger className="border-border text-sm" data-testid="select-voice">
                    <SelectValue placeholder={loadingVoices ? "Loading..." : "Choose a voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voicesByCategory &&
                      Object.entries(voicesByCategory).map(([cat, items]) => (
                        <SelectGroup key={cat}>
                          <SelectLabel className="text-primary/70 text-xs">{cat}</SelectLabel>
                          {items.map((v) => (
                            <SelectItem key={v.voiceId} value={v.voiceId} className="text-sm">
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                  </SelectContent>
                </Select>

                {selectedVoice && (
                  <div className="flex items-center gap-2.5 p-2.5 bg-secondary/40 rounded-lg">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mic2 size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedVoice.name}</p>
                      <p className="text-xs text-muted-foreground truncate capitalize">{selectedVoice.category || "voice"}</p>
                    </div>
                    <VoicePreviewBtn url={selectedVoice.previewUrl} />
                  </div>
                )}
              </div>

              {/* Sliders */}
              <div className="p-4 space-y-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">Voice Settings</span>
                  <button
                    onClick={resetSettings}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw size={11} />
                    Reset
                  </button>
                </div>

                {/* Stability */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Stability</span>
                    <span className="text-sm font-bold text-foreground">{stability[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={stability}
                    onValueChange={setStability}
                    min={0} max={1} step={0.01}
                    className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.relative]:bg-secondary"
                    data-testid="slider-stability"
                  />
                  <p className="text-xs text-muted-foreground">Higher = consistent, lower = expressive</p>
                </div>

                {/* Clarity / Similarity */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Clarity</span>
                    <span className="text-sm font-bold text-foreground">{similarityBoost[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    value={similarityBoost}
                    onValueChange={setSimilarityBoost}
                    min={0} max={1} step={0.01}
                    className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">Higher = closer to original voice</p>
                </div>

                {/* Speed */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Speed</span>
                    <span className="text-sm font-bold text-foreground">{speed[0].toFixed(1)}</span>
                  </div>
                  <Slider
                    value={speed}
                    onValueChange={setSpeed}
                    min={0.5} max={2} step={0.1}
                    className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.5x</span><span>2x</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History tab */}
          {rightTab === "history" && (
            <div className="flex-1 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : history?.items?.length ? (
                <div className="divide-y divide-border">
                  {history.items.map((gen) => (
                    <div
                      key={gen.id}
                      className="p-4 hover:bg-secondary/30 transition-colors"
                      data-testid={`card-history-${gen.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-primary truncate">{gen.voiceName}</span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{gen.characterCount} ch</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-2">{gen.text}</p>
                      <div className="flex items-center gap-2">
                        <audio controls src={gen.audioUrl} className="flex-1 h-7" data-testid={`audio-history-${gen.id}`} />
                        <a href={gen.audioUrl} download={`bunnytts-${gen.id}.mp3`}>
                          <button className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                            <Download size={13} />
                          </button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Mic2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No generations yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Your history will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
