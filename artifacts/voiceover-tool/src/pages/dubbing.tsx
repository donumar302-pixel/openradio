import { Languages, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { OsTaskResult, OsTaskHistory, OsFileDrop } from "@/components/os/task-panel";
import { OsCostEstimate } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskForm } from "@/lib/os-api";
import { estimateDubbingCost } from "@/lib/os-cost";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "nl", label: "Dutch" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
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
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("es");
  const [numSpeakers, setNumSpeakers] = useState("0");
  const { task, submitting, run, working } = useOsTask("dubbing");

  const handleSubmit = () => {
    if (!file) {
      toast({ title: "No file", description: "Please upload a video or audio file.", variant: "destructive" });
      return;
    }
    run(() => {
      const form = new FormData();
      form.append("file", file);
      form.append("sourceLang", sourceLang);
      form.append("targetLang", targetLang);
      form.append("numSpeakers", numSpeakers);
      return osCreateTaskForm("/dubbing", form);
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Languages size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Dubbing</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Automatically dub audio and video into other languages</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Video / Audio File</Label>
          <OsFileDrop file={file} onFile={setFile} accept="video/*,audio/*" hint="MP4, MOV, MP3, WAV supported" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Source Language</Label>
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
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
          <div className="space-y-2">
            <Label className="font-semibold">Speakers</Label>
            <Select value={numSpeakers} onValueChange={setNumSpeakers}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Auto-detect</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <OsCostEstimate estimate={file ? estimateDubbingCost(file.size) : null} />

        <Button
          onClick={handleSubmit}
          disabled={working || !file || sourceLang === targetLang}
          className="w-full bg-primary hover:bg-primary/90 font-bold"
        >
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</> : <><Languages className="mr-2 h-4 w-4" />Start Dubbing</>}
        </Button>
        <p className="text-xs text-muted-foreground text-center">Dubbing can take several minutes — track progress in History below.</p>
      </div>

      <OsTaskResult task={task} />
      <OsTaskHistory tool="dubbing" />
    </div>
  );
}
