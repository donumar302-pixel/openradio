import { Music2, Sparkles, Play, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const GENRES = ["Ambient", "Cinematic", "Electronic", "Jazz", "Lo-fi", "Orchestra", "Pop", "Rock"];

export default function MusicPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", description: "Describe the music you want.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/tts/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: genre ? `${genre} music: ${prompt}` : prompt, durationSeconds: duration }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Music generation failed");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast({ title: "Music ready!", description: "Your track has been generated." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Music2 size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Music Generation</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">Generate original music tracks from text descriptions</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Describe your music</Label>
          <Textarea
            placeholder='e.g. "Calm piano music for a relaxing study session", "Upbeat electronic track for a workout video"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Genre (optional)</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger>
                <SelectValue placeholder="Any genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any genre</SelectItem>
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="font-semibold">Duration</Label>
              <span className="text-sm text-muted-foreground">{duration}s</span>
            </div>
            <Slider min={5} max={180} step={5} value={[duration]} onValueChange={([v]) => setDuration(v)} />
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Music</>}
        </Button>
      </div>

      {audioUrl && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-primary" />
              <p className="font-semibold text-sm">Generated Track</p>
            </div>
            <a href={audioUrl} download="generated-music.mp3">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download size={13} />Download</Button>
            </a>
          </div>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
