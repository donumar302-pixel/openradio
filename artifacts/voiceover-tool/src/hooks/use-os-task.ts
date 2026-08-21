import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { osGetTask, type OsTask } from "@/lib/os-api";
import { useToast } from "@/hooks/use-toast";

/**
 * Tracks one active OpenSpeaker task: polls /api/os/tasks/:id every few
 * seconds until it reaches "done" or "error", then stops and refreshes the
 * tool's history list.
 */
export function useOsTask(tool: string) {
  const [task, setTask] = useState<OsTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const stop = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!task || task.status !== "processing") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await osGetTask(task.id);
        if (cancelled) return;
        setTask(fresh);
        if (fresh.status === "processing") {
          timer.current = setTimeout(tick, 3000);
        } else {
          qc.invalidateQueries({ queryKey: ["os-tasks", tool] });
          qc.invalidateQueries({ queryKey: ["auth-me"] });
          if (fresh.status === "error") {
            toast({ title: "Generation failed", description: fresh.error || "Credits were refunded.", variant: "destructive" });
          }
        }
      } catch {
        if (!cancelled) timer.current = setTimeout(tick, 5000);
      }
    };
    timer.current = setTimeout(tick, 2500);
    return () => { cancelled = true; stop(); };
  }, [task?.id, task?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Run a create call; manages submitting/toast/history invalidation. */
  const run = useCallback(async (create: () => Promise<OsTask>) => {
    setSubmitting(true);
    try {
      const created = await create();
      setTask(created);
      qc.invalidateQueries({ queryKey: ["os-tasks", tool] });
      qc.invalidateQueries({ queryKey: ["auth-me"] });
      return created;
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [qc, tool, toast]);

  return { task, setTask, submitting, run, working: submitting || task?.status === "processing" };
}
