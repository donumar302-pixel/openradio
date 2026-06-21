import { Radio, Upload, Play, Download, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AudioIsolationPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: "No file", description: "Please upload an audio file.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch("/api/tts/audio-isolation", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Isolation failed");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast({ title: "Done!", description: "Voice isolated successfully." });
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
            <Radio size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Audio Isolation</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">Remove background noise and isolate voice from audio</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">
        {[
          { title: "Remove Noise", desc: "Eliminate background sounds" },
          { title: "Isolate Voice", desc: "Keep only the vocal track" },
          { title: "HD Quality", desc: "Studio-grade output" },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl border border-border p-4">
            <p className="font-semibold text-sm text-foreground">{f.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Upload Audio</Label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "w-full border-2 border-dashed rounded-xl p-10 text-center transition-all",
              file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
            )}
          >
            <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{file ? file.name : "Click to upload audio"}</p>
            <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A supported • Max 50MB</p>
          </button>
          <input ref={fileRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !file}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Isolating...</> : <><Radio className="mr-2 h-4 w-4" />Isolate Voice</>}
        </Button>
      </div>

      {audioUrl && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-primary" />
              <p className="font-semibold text-sm">Isolated Voice</p>
            </div>
            <a href={audioUrl} download="isolated-voice.mp3">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download size={13} />Download</Button>
            </a>
          </div>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
