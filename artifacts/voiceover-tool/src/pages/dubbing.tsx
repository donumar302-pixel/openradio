import { Languages, Upload, Loader2, Play, Download } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnamese" },
];

export default function DubbingPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("es");
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: "No file", description: "Please upload a video or audio file.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sourceLanguage", sourceLang);
      form.append("targetLanguage", targetLang);
      const res = await fetch("/api/tts/dubbing", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Dubbing failed");
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      toast({ title: "Dubbed!", description: "Your file has been dubbed successfully." });
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
            <Languages size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Dubbing</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Automatically dub videos and audio into 29+ languages</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center text-sm">
        {["92 Languages", "Sync-aware", "Voice Cloning"].map((f) => (
          <div key={f} className="bg-white rounded-xl border border-border px-3 py-3 font-semibold text-foreground">
            {f}
          </div>
        ))}
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Video / Audio File</Label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "w-full border-2 border-dashed rounded-xl p-8 text-center transition-all",
              file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
            )}
          >
            <Upload size={22} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{file ? file.name : "Click to upload"}</p>
            <p className="text-xs text-muted-foreground mt-1">MP4, MOV, MP3, WAV supported</p>
          </button>
          <input ref={fileRef} type="file" accept="video/*,audio/*" onChange={handleFile} className="hidden" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Source Language</Label>
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Target Language</Label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading || !file || sourceLang === targetLang}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Dubbing...</> : <><Languages className="mr-2 h-4 w-4" />Start Dubbing</>}
        </Button>
      </div>

      {audioUrl && (
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-primary" />
              <p className="font-semibold text-sm">Dubbed Output</p>
            </div>
            <a href={audioUrl} download="dubbed-audio.mp3">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download size={13} />Download</Button>
            </a>
          </div>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}
