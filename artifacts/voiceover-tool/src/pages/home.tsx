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
import { Loader2, Play, Download, Clock, PlayCircle, StopCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function AudioPlayer({ url }: { url: string }) {
  if (!url) return null;
  return (
    <div className="w-full bg-secondary/30 p-4 rounded-lg border border-border/50 flex items-center gap-4">
      <audio controls className="w-full h-10 outline-none" src={url} data-testid="audio-player">
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

function VoicePreviewBtn({ url }: { url?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => url ? new Audio(url) : null);

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
      className="h-6 w-6 rounded-full" 
      onClick={togglePlay}
      data-testid="btn-preview-voice"
    >
      {playing ? <StopCircle size={14} className="text-primary" /> : <PlayCircle size={14} />}
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
          modelId: "eleven_monolingual_v1" 
        } 
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Audio generated successfully.", icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> });
          queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey({ limit: 10 }) });
        },
        onError: (err: any) => {
          toast({ title: "Generation failed", description: err?.error || "Unknown error occurred.", variant: "destructive" });
        }
      }
    );
  };
  
  // Group voices by category
  const voicesByCategory = voices?.reduce((acc, voice) => {
    const cat = voice.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  const activeGeneration = history?.items?.[0]; // Show the most recent one at the top if it matches the current session

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Studio</h1>
        <p className="text-muted-foreground">Transform text into lifelike speech using professional AI voices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Script</CardTitle>
              <CardDescription>Enter the text you want to synthesize.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Type your script here..." 
                className="min-h-[200px] resize-y font-mono text-sm leading-relaxed p-4 bg-background/50 focus-visible:ring-primary/50"
                value={text}
                onChange={(e) => setText(e.target.value)}
                data-testid="input-script"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>{text.length} characters</span>
                <span>Max 5000</span>
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/20 border-t border-border/50 py-4 flex flex-col gap-4">
              <div className="w-full flex items-center justify-between">
                <div className="flex-1">
                  {generateSpeech.isSuccess && activeGeneration && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <AudioPlayer url={activeGeneration.audioUrl} />
                    </div>
                  )}
                </div>
                <Button 
                  size="lg" 
                  className="ml-4 min-w-[140px] shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40"
                  onClick={handleGenerate}
                  disabled={generateSpeech.isPending || !text.trim() || !voiceId}
                  data-testid="btn-generate"
                >
                  {generateSpeech.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synthesizing...</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" /> Generate</>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" /> 
              Recent Generations
            </h3>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : history?.items?.length ? (
              <div className="space-y-3">
                {history.items.map((gen) => (
                  <Card key={gen.id} className="bg-card/30 border-border/40 hover:bg-card/50 transition-colors" data-testid={`card-history-${gen.id}`}>
                    <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-primary">{gen.voiceName}</span>
                          <span className="text-xs text-muted-foreground">• {new Date(gen.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-foreground/80 truncate font-mono">{gen.text}</p>
                      </div>
                      <div className="w-full sm:w-auto flex items-center gap-2">
                        <audio controls src={gen.audioUrl} className="h-8 w-full sm:w-[200px]" data-testid={`audio-history-${gen.id}`} />
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
                          <a href={gen.audioUrl} download={`voiceover-${gen.id}.mp3`} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border/50 rounded-lg">
                No recent generations found.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="voice-select">Voice</Label>
                <Select value={voiceId} onValueChange={setVoiceId} disabled={loadingVoices}>
                  <SelectTrigger id="voice-select" data-testid="select-voice">
                    <SelectValue placeholder={loadingVoices ? "Loading voices..." : "Select a voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voicesByCategory && Object.entries(voicesByCategory).map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{category}</SelectLabel>
                        {items.map(voice => (
                          <SelectItem key={voice.voiceId} value={voice.voiceId} className="flex justify-between items-center w-full">
                            <div className="flex items-center gap-2 flex-1">
                              <span>{voice.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                
                {voiceId && voices && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-secondary/40 rounded-md text-sm">
                    <span className="flex-1 text-muted-foreground">{voices.find(v => v.voiceId === voiceId)?.description || "No description"}</span>
                    <VoicePreviewBtn url={voices.find(v => v.voiceId === voiceId)?.previewUrl} />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Stability</Label>
                  <span className="text-xs text-muted-foreground font-mono">{stability[0].toFixed(2)}</span>
                </div>
                <Slider 
                  value={stability} 
                  onValueChange={setStability} 
                  max={1} 
                  step={0.01}
                  data-testid="slider-stability"
                />
                <p className="text-xs text-muted-foreground">Higher stability makes the voice more consistent, lower makes it more expressive.</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Clarity + Similarity Enhancement</Label>
                  <span className="text-xs text-muted-foreground font-mono">{similarityBoost[0].toFixed(2)}</span>
                </div>
                <Slider 
                  value={similarityBoost} 
                  onValueChange={setSimilarityBoost} 
                  max={1} 
                  step={0.01}
                  data-testid="slider-similarity"
                />
                <p className="text-xs text-muted-foreground">High values strongly match the original voice but may cause artifacts.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
