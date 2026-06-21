import { useState } from "react";
import {
  useListVoices,
  getListVoicesQueryKey,
  useGenerateSpeech,
  useListGenerations,
  getListGenerationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, PlayCircle, StopCircle, CheckCircle2, Mic2, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2", desc: "Best quality, 29 languages" },
  { id: "eleven_monolingual_v1", label: "English v1", desc: "Fast, English only" },
  { id: "eleven_turbo_v2", label: "Turbo v2", desc: "Ultra-fast, low latency" },
];

function VoicePreviewBtn({ url }: { url?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (url ? new Audio(url) : null));
  if (!url || !audio) return null;
  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.currentTime = 0; audio.play(); setPlaying(true); audio.onended = () => setPlaying(false); }
  };
  return (
    <button onClick={togglePlay} className="text-primary hover:text-primary/70 transition-colors" data-testid="btn-preview-voice">
      {playing ? <StopCircle size={15} /> : <PlayCircle size={15} />}
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
  const [latestAudio, setLatestAudio] = useState<string | null>(null);

  const { data: voices, isLoading: loadingVoices } = useListVoices({
    query: { queryKey: getListVoicesQueryKey() }
  });

  const { data: history, isLoading: loadingHistory } = useListGenerations(
    { limit: 8 },
    { query: { queryKey: getListGenerationsQueryKey({ limit: 8 }) } }
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
          toast({ title: "Audio Generated!", description: `${data.characterCount} characters processed.` });
          queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey({ limit: 8 }) });
        },
        onError: (err: any) => {
          toast({ title: "Generation failed", description: err?.error || "Unknown error.", variant: "destructive" });
        }
      }
    );
  };

  const voicesByCategory = voices?.reduce((acc, voice) => {
    const cat = voice.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  const selectedVoice = voices?.find(v => v.voiceId === voiceId);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Text to Speech</h1>
        <p className="text-sm text-muted-foreground">Powered by ElevenLabs — generate lifelike AI voices instantly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Script + Controls */}
        <div className="lg:col-span-3 space-y-4">
          {/* Script */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Script</label>
            </div>
            <Textarea
              placeholder="Start typing here to create lifelike audio..."
              className="min-h-[220px] resize-none font-mono text-sm leading-relaxed px-4 pb-4 border-0 shadow-none focus-visible:ring-0 bg-transparent"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              data-testid="input-script"
            />
            <div className="flex justify-between items-center px-4 py-2 border-t border-border bg-secondary/20 text-xs text-muted-foreground">
              <span>{text.length} / 5000 characters</span>
              {text.length > 4500 && <span className="text-orange-500 font-medium">Approaching limit</span>}
            </div>
          </div>

          {/* Generated audio */}
          {latestAudio && (
            <div className="bg-orange-50 border border-orange-200/60 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Mic2 size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary mb-1">Generated Audio</p>
                <audio controls className="w-full h-8" src={latestAudio} data-testid="audio-player" />
              </div>
              <a href={latestAudio} download="bunnytts-output.mp3" className="shrink-0 p-2 rounded-lg hover:bg-orange-100 text-primary transition-colors">
                <Download size={16} />
              </a>
            </div>
          )}

          {/* Generate button */}
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 font-bold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-px active:translate-y-0"
            onClick={handleGenerate}
            disabled={generateSpeech.isPending || !text.trim() || !voiceId}
            data-testid="btn-generate"
          >
            {generateSpeech.isPending ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
            ) : (
              <><Play className="mr-2 h-5 w-5 fill-white" /> Generate Audio</>
            )}
          </Button>
        </div>

        {/* Right: Voice Settings */}
        <div className="lg:col-span-2 space-y-4">
          {/* Model */}
          <div className="bg-white border border-border rounded-xl shadow-sm p-4 space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="border-border focus:ring-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voice */}
          <div className="bg-white border border-border rounded-xl shadow-sm p-4 space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voice</label>
            <Select value={voiceId} onValueChange={setVoiceId} disabled={loadingVoices}>
              <SelectTrigger className="border-border focus:ring-primary/40" data-testid="select-voice">
                <SelectValue placeholder={loadingVoices ? "Loading voices..." : "Select a voice"} />
              </SelectTrigger>
              <SelectContent>
                {voicesByCategory && Object.entries(voicesByCategory).map(([cat, items]) => (
                  <SelectGroup key={cat}>
                    <SelectLabel className="text-primary/70">{cat}</SelectLabel>
                    {items.map(v => (
                      <SelectItem key={v.voiceId} value={v.voiceId}>{v.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {selectedVoice && (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg">
                <VoicePreviewBtn url={selectedVoice.previewUrl} />
                <span className="text-xs text-muted-foreground flex-1">
                  {selectedVoice.description || "Preview available"}
                </span>
              </div>
            )}
          </div>

          {/* Voice Settings */}
          <div className="bg-white border border-border rounded-xl shadow-sm p-4 space-y-5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voice Settings</label>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Stability</span>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md font-mono">{stability[0].toFixed(2)}</span>
              </div>
              <Slider value={stability} onValueChange={setStability} max={1} step={0.01} data-testid="slider-stability" />
              <p className="text-xs text-muted-foreground">Higher = consistent, lower = expressive.</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Clarity</span>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md font-mono">{similarityBoost[0].toFixed(2)}</span>
              </div>
              <Slider value={similarityBoost} onValueChange={setSimilarityBoost} max={1} step={0.01} data-testid="slider-similarity" />
              <p className="text-xs text-muted-foreground">High = match original, may cause artifacts.</p>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="mt-8">
        <h3 className="text-base font-bold text-foreground mb-3">Recent Generations</h3>
        {loadingHistory ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : history?.items?.length ? (
          <div className="space-y-2">
            {history.items.map((gen) => (
              <div key={gen.id} className="bg-white border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center hover:border-primary/30 transition-colors" data-testid={`card-history-${gen.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-primary">{gen.voiceName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(gen.createdAt).toLocaleDateString()} · {gen.characterCount} chars</span>
                  </div>
                  <p className="text-sm text-foreground/70 truncate font-mono">{gen.text}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <audio controls src={gen.audioUrl} className="h-8 w-[180px]" data-testid={`audio-history-${gen.id}`} />
                  <a href={gen.audioUrl} download={`bunnytts-${gen.id}.mp3`} className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                    <Download size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground text-sm bg-secondary/20">
            <Mic2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No generations yet. Generate your first voiceover above!
          </div>
        )}
      </div>
    </div>
  );
}
