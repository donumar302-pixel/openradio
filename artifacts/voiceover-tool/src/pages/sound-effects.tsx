import { Volume2, Sparkles, Play, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

export default function SoundEffectsPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", description: "Describe the sound effect you want.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/tts/sound-effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, durationSeconds: duration }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast({ title: "Generated!", description: "Sound effect ready." });
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
            <Volume2 size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Sound Effects</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">Generate any sound effect from a text description</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Describe the sound</Label>
          <Textarea
            placeholder='e.g. "Rain hitting a tin roof", "Busy city street", "Forest birds in the morning"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground">{prompt.length}/500 characters</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="font-semibold">Duration</Label>
            <span className="text-sm text-muted-foreground">{duration}s</span>
          </div>
          <Slider min={1} max={22} step={1} value={[duration]} onValueChange={([v]) => setDuration(v)} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1s</span><span>22s</span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Sound Effect</>}
        </Button>
      </div>

      {audioUrl && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-primary" />
              <p className="font-semibold text-sm">Result</p>
            </div>
            <a href={audioUrl} download="sound-effect.mp3">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download size={13} />Download</Button>
            </a>
          </div>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
