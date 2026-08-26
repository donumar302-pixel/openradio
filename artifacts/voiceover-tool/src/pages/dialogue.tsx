import { MessagesSquare, Loader2, Plus, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { OsVoicePicker } from "@/components/os/voice-picker";
import { OsTaskResult, OsTaskHistory } from "@/components/os/task-panel";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskJson } from "@/lib/os-api";
import { estimateDialogueCost } from "@/lib/os-cost";

interface Speaker { voiceId: string; name: string }

const LABELS = "ABCDEFGHIJ".split("");

export default function DialoguePage() {
  const { toast } = useToast();
  const [text, setText] = useState("A> Hey, have you tried the new AI voices?\nB> I have! They sound incredibly natural now.");
  const [speakers, setSpeakers] = useState<Speaker[]>([
    { voiceId: "", name: "" },
    { voiceId: "", name: "" },
  ]);
  const { task, submitting, run, working, cancel, cancelling } = useOsTask("dialogue");
  const estimate = text.trim() ? estimateDialogueCost(text) : null;
  const insufficient = useOsInsufficientCredits(estimate);

  const setSpeaker = (i: number, voiceId: string, name: string) =>
    setSpeakers((s) => s.map((sp, idx) => (idx === i ? { voiceId, name } : sp)));

  const handleSubmit = () => {
    if (!text.trim()) { toast({ title: "Missing script", description: "Write the dialogue first.", variant: "destructive" }); return; }
    if (speakers.some((s) => !s.voiceId)) { toast({ title: "Missing voices", description: "Assign a voice to every speaker.", variant: "destructive" }); return; }
    run(() => osCreateTaskJson("/dialogue", {
      text,
      speakers: speakers.map((s) => ({ voiceId: s.voiceId })),
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessagesSquare size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Text to Dialogue</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Create multi-speaker conversations with different AI voices</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Script</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"A> First speaker's line\nB> Second speaker's line"}
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Start each line with <code className="font-mono bg-secondary px-1 rounded">A&gt;</code>, <code className="font-mono bg-secondary px-1 rounded">B&gt;</code>… to assign it to a speaker.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Speakers</Label>
            {speakers.length < 10 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                onClick={() => setSpeakers((s) => [...s, { voiceId: "", name: "" }])}>
                <Plus size={13} />Add speaker
              </Button>
            )}
          </div>
          {speakers.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                {LABELS[i]}
              </span>
              <div className="flex-1 min-w-0">
                <OsVoicePicker value={s.voiceId} valueName={s.name} onChange={(v, n) => setSpeaker(i, v, n)} placeholder={`Voice for speaker ${LABELS[i]}`} />
              </div>
              {speakers.length > 2 && (
                <button onClick={() => setSpeakers((sp) => sp.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground/50 hover:text-red-500 shrink-0">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>

        <OsCostEstimate estimate={estimate} />

        <Button onClick={handleSubmit} disabled={working || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</> : insufficient ? <>Not enough credits</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Dialogue</>}
        </Button>
      </div>

      <OsTaskResult task={task} onCancel={cancel} cancelling={cancelling} />
      <OsTaskHistory tool="dialogue" />
    </div>
  );
}
