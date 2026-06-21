import { MessageSquareText, Upload, Loader2, Copy, Check } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SpeechToTextPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: "No file", description: "Please upload an audio file first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setTranscript("");
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch("/api/tts/speech-to-text", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Transcription failed");
      }
      const data = await res.json();
      setTranscript(data.text || "");
      toast({ title: "Transcribed!", description: "Audio converted to text." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquareText size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Speech to Text</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Transcribe audio into text with high accuracy</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Audio File</Label>
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
            <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, FLAC supported</p>
          </button>
          <input ref={fileRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !file}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Transcribing...</> : <><MessageSquareText className="mr-2 h-4 w-4" />Transcribe</>}
        </Button>
      </div>

      {transcript && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Transcript</p>
            <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5 text-xs">
              {copied ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}
            </Button>
          </div>
          <Textarea value={transcript} readOnly rows={8} className="resize-none text-sm bg-secondary/30 border-border" />
        </div>
      )}
    </div>
  );
}
