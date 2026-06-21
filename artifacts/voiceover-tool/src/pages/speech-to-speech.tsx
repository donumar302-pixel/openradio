import { AudioWaveform, Upload, Mic, Play, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useListVoices } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SpeechToSpeechPage() {
  const { toast } = useToast();
  const { data: voices } = useListVoices();
  const [voiceId, setVoiceId] = useState("");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !voiceId) {
      toast({ title: "Missing fields", description: "Please select a voice and upload an audio file.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("voiceId", voiceId);
      form.append("stability", String(stability));
      form.append("similarityBoost", String(similarity));
      const res = await fetch("/api/tts/speech-to-speech", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to convert");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast({ title: "Done!", description: "Speech converted successfully." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <AudioWaveform size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Speech to Speech</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Upload audio and clone it with any voice</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        {/* File Upload */}
        <div className="space-y-2">
          <Label className="font-semibold">Audio File</Label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "w-full border-2 border-dashed rounded-xl p-8 text-center transition-all",
              file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
            )}
          >
            <Upload size={22} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{file ? file.name : "Click to upload audio"}</p>
            <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A supported</p>
          </button>
          <input ref={fileRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
        </div>

        {/* Voice */}
        <div className="space-y-2">
          <Label className="font-semibold">Target Voice</Label>
          <Select value={voiceId} onValueChange={setVoiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a voice" />
            </SelectTrigger>
            <SelectContent>
              {voices?.map((v: any) => (
                <SelectItem key={v.voice_id} value={v.voice_id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stability */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="font-semibold">Stability</Label>
            <span className="text-sm text-muted-foreground">{Math.round(stability * 100)}%</span>
          </div>
          <Slider min={0} max={1} step={0.01} value={[stability]} onValueChange={([v]) => setStability(v)} />
        </div>

        {/* Similarity */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="font-semibold">Similarity Boost</Label>
            <span className="text-sm text-muted-foreground">{Math.round(similarity * 100)}%</span>
          </div>
          <Slider min={0} max={1} step={0.01} value={[similarity]} onValueChange={([v]) => setSimilarity(v)} />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !file || !voiceId}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting...</> : <><Mic className="mr-2 h-4 w-4" />Convert Voice</>}
        </Button>
      </div>

      {audioUrl && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-primary" />
            <p className="font-semibold text-sm">Result</p>
          </div>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
