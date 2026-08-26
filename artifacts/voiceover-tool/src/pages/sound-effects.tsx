import { Drum, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { OsTaskResult, OsTaskHistory } from "@/components/os/task-panel";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskJson } from "@/lib/os-api";
import { estimateSoundEffectCost } from "@/lib/os-cost";

export default function SoundEffectsPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [autoDuration, setAutoDuration] = useState(true);
  const [duration, setDuration] = useState(5);
  const [influence, setInfluence] = useState(0.3);
  const [loop, setLoop] = useState(false);
  const { task, submitting, run, working, cancel, cancelling } = useOsTask("sound-effects");

  const cost = estimateSoundEffectCost(autoDuration, duration);
  const insufficient = useOsInsufficientCredits(cost);

  const handleSubmit = () => {
    if (text.trim().length < 3) {
      toast({ title: "Describe the sound", description: "At least 3 characters.", variant: "destructive" });
      return;
    }
    run(() => osCreateTaskJson("/sound-effect", {
      text,
      durationSeconds: autoDuration ? undefined : duration,
      promptInfluence: influence,
      loop,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Drum size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Sound Effects</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Generate any sound effect from a text description</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Describe the sound</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 450))}
            rows={3}
            placeholder="Thunder rolling with heavy rain, distant and cinematic"
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{text.length}/450</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold">Automatic duration</Label>
            <p className="text-xs text-muted-foreground">Let the AI pick the best length</p>
          </div>
          <Switch checked={autoDuration} onCheckedChange={setAutoDuration} />
        </div>

        {!autoDuration && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="font-semibold">Duration</Label>
              <span className="text-sm text-muted-foreground">{duration}s</span>
            </div>
            <Slider min={0.5} max={30} step={0.5} value={[duration]} onValueChange={([v]) => setDuration(v)} />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="font-semibold">Prompt Influence</Label>
            <span className="text-sm text-muted-foreground">{Math.round(influence * 100)}%</span>
          </div>
          <Slider min={0} max={1} step={0.01} value={[influence]} onValueChange={([v]) => setInfluence(v)} />
          <p className="text-xs text-muted-foreground">Higher = follows your description more literally</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold">Seamless loop</Label>
            <p className="text-xs text-muted-foreground">Make the sound loop cleanly</p>
          </div>
          <Switch checked={loop} onCheckedChange={setLoop} />
        </div>

        <OsCostEstimate estimate={cost} />

        <Button onClick={handleSubmit} disabled={working || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</> : insufficient ? <>Not enough credits</> : <><Sparkles className="mr-2 h-4 w-4" />Generate</>}
        </Button>
      </div>

      <OsTaskResult task={task} onCancel={cancel} cancelling={cancelling} />
      <OsTaskHistory tool="sound-effects" />
    </div>
  );
}
