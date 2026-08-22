import { Radio, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { OsTaskResult, OsTaskHistory, OsFileDrop } from "@/components/os/task-panel";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskForm } from "@/lib/os-api";
import { estimateIsolationCost } from "@/lib/os-cost";

export default function AudioIsolationPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const { task, submitting, run, working } = useOsTask("voice-isolation");
  const estimate = file ? estimateIsolationCost(file.size) : null;
  const insufficient = useOsInsufficientCredits(estimate);

  const handleSubmit = () => {
    if (!file) {
      toast({ title: "No file", description: "Please upload an audio file first.", variant: "destructive" });
      return;
    }
    run(() => {
      const form = new FormData();
      form.append("file", file);
      return osCreateTaskForm("/voice-isolate", form);
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Radio size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Audio Isolation</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Remove background noise and isolate crystal-clear vocals</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Audio File</Label>
          <OsFileDrop file={file} onFile={setFile} />
        </div>

        <OsCostEstimate estimate={estimate} />

        <Button onClick={handleSubmit} disabled={working || !file || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</> : insufficient ? <>Not enough credits</> : <><Radio className="mr-2 h-4 w-4" />Isolate Voice</>}
        </Button>
      </div>

      <OsTaskResult task={task} />
      <OsTaskHistory tool="voice-isolation" />
    </div>
  );
}
