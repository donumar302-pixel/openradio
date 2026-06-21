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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Download, Clock, PlayCircle, StopCircle, CheckCircle2, Mic2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function AudioPlayer({ url }: { url: string }) {
  if (!url) return null;
  return (
    <div className="w-full bg-orange-50 border border-orange-200/60 p-3 rounded-xl flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Mic2 className="h-4 w-4 text-primary" />
      </div>
      <audio controls className="w-full h-9 outline-none" src={url} data-testid="audio-player">
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

function VoicePreviewBtn({ url }: { url?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => (url ? new Audio(url) : null));

  if (!url || !audio) return null;

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.play();
      setPlaying(true);
      audio.onended = () => setPlaying(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 rounded-full text-primary hover:bg-primary/10"
      onClick={togglePlay}
      data-testid="btn-preview-voice"
    >
      {playing ? <StopCircle size={14} /> : <PlayCircle size={14} />}
    </Button>
  );
}

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);

  const { data: voices, isLoading: loadingVoices } = useListVoices({
    query: { queryKey: getListVoicesQueryKey() }
  });

  const { data: history, isLoading: loadingHistory } = useListGenerations(
    { limit: 10 },
    { query: { queryKey: getListGenerationsQueryKey({ limit: 10 }) } }
  );

  const generateSpeech = useGenerateSpeech();

  const handleGenerate = () => {
    if (!text.trim()) {
      toast({ title: "Text required", description: "Please enter some text to generate speech.", variant: "destructive" });
      return;
    }
    if (!voiceId) {
      toast({ title: "Voice required", description: "Please select a voice.", variant: "destructive" });
      return;
    }

    generateSpeech.mutate(
      {
        data: {
          text,
          voiceId,
          stability: stability[0],
          similarityBoost: similarityBoost[0],
          modelId: "eleven_multilingual_v2"
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Audio Generated!", description: "Your voiceover is ready.", icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> });
          queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey({ limit: 10 }) });
        },
        onError: (err: any) => {
          toast({ title: "Generation failed", description: err?.error || "Unknown error occurred.", variant: "destructive" });
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

  const activeGeneration = history?.items?.[0];

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Sparkles size={12} />
          Powered by ElevenLabs AI
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-foreground">
          Text to <span className="text-primary">Voice Studio</span>
        </h1>
        <p className="text-muted-foreground text-lg">Convert your text into lifelike speech in seconds.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Script + Output */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Your Script</CardTitle>
              <CardDescription>Enter the text you want to convert to speech.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Type or paste your script here..."
                className="min-h-[200px] resize-y font-mono text-sm leading-relaxed p-4 bg-secondary/30 focus-visible:ring-primary/50 border-border/60"
                value={text}
                onChange={(e) => setText(e.target.value)}
                data-testid="input-script"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>{text.length} / 5000 characters</span>
                {text.length > 4500 && <span className="text-orange-500 font-medium">Approaching limit</span>}
              </div>
            </CardContent>
            <CardFooter className="border-t border-border bg-secondary/20 py-4 flex flex-col gap-4">
              {generateSpeech.isSuccess && activeGeneration && (
                <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-400">
                  <AudioPlayer url={activeGeneration.audioUrl} />
                </div>
              )}
              <div className="w-full flex justify-end">
                <Button
                  size="lg"
                  className="min-w-[160px] font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-px active:translate-y-0 bg-primary hover:bg-primary/90"
                  onClick={handleGenerate}
                  disabled={generateSpeech.isPending || !text.trim() || !voiceId}
                  data-testid="btn-generate"
                >
                  {generateSpeech.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4 fill-white" /> Generate Audio</>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* History */}
          <div className="space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Recent Generations
            </h3>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : history?.items?.length ? (
              <div className="space-y-2">
                {history.items.map((gen) => (
                  <Card key={gen.id} className="border-border/60 hover:border-primary/30 hover:shadow-sm transition-all" data-testid={`card-history-${gen.id}`}>
                    <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-primary">{gen.voiceName}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(gen.createdAt).toLocaleDateString()} &middot; {gen.characterCount} chars
                          </span>
                        </div>
                        <p className="text-sm text-foreground/70 truncate font-mono">{gen.text}</p>
                      </div>
                      <div className="w-full sm:w-auto flex items-center gap-2 shrink-0">
                        <audio controls src={gen.audioUrl} className="h-8 w-full sm:w-[190px]" data-testid={`audio-history-${gen.id}`} />
                        <Button variant="outline" size="icon" className="h-8 w-8 border-primary/30 text-primary hover:bg-primary/10 shrink-0" asChild>
                          <a href={gen.audioUrl} download={`bunnytts-${gen.id}.mp3`} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl bg-secondary/20">
                <Mic2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                No generations yet. Generate your first voiceover above!
              </div>
            )}
          </div>
        </div>

        {/* Right: Voice Settings */}
        <div>
          <Card className="border-border shadow-sm sticky top-24">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Mic2 className="h-3.5 w-3.5 text-primary" />
                </div>
                Voice Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              <div className="space-y-3">
                <Label htmlFor="voice-select" className="font-semibold">Voice</Label>
                <Select value={voiceId} onValueChange={setVoiceId} disabled={loadingVoices}>
                  <SelectTrigger id="voice-select" className="border-border focus:ring-primary/40" data-testid="select-voice">
                    <SelectValue placeholder={loadingVoices ? "Loading voices..." : "Select a voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voicesByCategory && Object.entries(voicesByCategory).map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="text-primary/70">{category}</SelectLabel>
                        {items.map((voice) => (
                          <SelectItem key={voice.voiceId} value={voice.voiceId}>
                            <span>{voice.name}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>

                {voiceId && voices && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200/50 rounded-lg text-sm">
                    <span className="flex-1 text-muted-foreground text-xs">
                      {voices.find((v) => v.voiceId === voiceId)?.description || "No description"}
                    </span>
                    <VoicePreviewBtn url={voices.find((v) => v.voiceId === voiceId)?.previewUrl} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Stability</Label>
                  <span className="text-xs text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded-md">
                    {stability[0].toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={stability}
                  onValueChange={setStability}
                  max={1}
                  step={0.01}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                  data-testid="slider-stability"
                />
                <p className="text-xs text-muted-foreground">Higher = more consistent, lower = more expressive.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Clarity Enhancement</Label>
                  <span className="text-xs text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded-md">
                    {similarityBoost[0].toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={similarityBoost}
                  onValueChange={setSimilarityBoost}
                  max={1}
                  step={0.01}
                  className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                  data-testid="slider-similarity"
                />
                <p className="text-xs text-muted-foreground">High values match the original voice more closely.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
