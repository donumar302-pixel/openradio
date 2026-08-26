import { AudioWaveform, Mic, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { OsVoicePicker } from "@/components/os/voice-picker";
import { OsTaskResult, OsTaskHistory, OsFileDrop } from "@/components/os/task-panel";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskForm } from "@/lib/os-api";
import { estimateVoiceChangerCost } from "@/lib/os-cost";

export default function VoiceChangerPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [removeNoise, setRemoveNoise] = useState(false);
  const { task, submitting, run, working, cancel, cancelling } = useOsTask("voice-changer");
  const estimate = file ? estimateVoiceChangerCost(file.size) : null;
  const insufficient = useOsInsufficientCredits(estimate);

  const handleSubmit = () => {
    if (!file || !voiceId) {
      toast({ title: "Missing fields", description: "Upload audio and choose a target voice.", variant: "destructive" });
      return;
    }
    run(() => {
      const form = new FormData();
      form.append("file", file);
      form.append("voiceId", voiceId);
      form.append("stability", String(stability));
      form.append("similarityBoost", String(similarity));
      form.append("removeNoise", String(removeNoise));
      return osCreateTaskForm("/voice-changer", form);
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <AudioWaveform size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Voice Changer</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Re-voice any recording with a voice from the full library — including your clones</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Audio File</Label>
          <OsFileDrop file={file} onFile={setFile} />
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Target Voice</Label>
          <OsVoicePicker value={voiceId} valueName={voiceName} onChange={(v, n) => { setVoiceId(v); setVoiceName(n); }} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="font-semibold">Stability</Label>
            <span className="text-sm text-muted-foreground">{Math.round(stability * 100)}%</span>
          </div>
          <Slider min={0} max={1} step={0.01} value={[stability]} onValueChange={([v]) => setStability(v)} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="font-semibold">Similarity Boost</Label>
            <span className="text-sm text-muted-foreground">{Math.round(similarity * 100)}%</span>
          </div>
          <Slider min={0} max={1} step={0.01} value={[similarity]} onValueChange={([v]) => setSimilarity(v)} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold">Remove background noise</Label>
            <p className="text-xs text-muted-foreground">Clean the input before converting</p>
          </div>
          <Switch checked={removeNoise} onCheckedChange={setRemoveNoise} />
        </div>

        <OsCostEstimate estimate={estimate} />

        <Button onClick={handleSubmit} disabled={working || !file || !voiceId || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</> : insufficient ? <>Not enough credits</> : <><Mic className="mr-2 h-4 w-4" />Convert Voice</>}
        </Button>
      </div>

      <OsTaskResult task={task} onCancel={cancel} cancelling={cancelling} />
      <OsTaskHistory tool="voice-changer" />
    </div>
  );
}
