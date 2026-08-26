import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { osGetTask, osCancelTask, type OsTask } from "@/lib/os-api";
import { useToast } from "@/hooks/use-toast";

/** How long a task can sit in "processing" before we call it slow (~2 min). */
const SLOW_AFTER_MS = 2 * 60 * 1000;

/**
 * True once something that started at `since` (ISO string or epoch ms) has
 * been running for longer than SLOW_AFTER_MS while `active` is true.
 * Used to surface a "high demand" note instead of an endless spinner.
 */
export function useIsSlowSince(since: string | number | null | undefined, active: boolean): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) { setSlow(false); return; }
    const parsed = typeof since === "number" ? since : since ? Date.parse(since) : NaN;
    const started = Number.isFinite(parsed) ? Math.min(parsed, Date.now()) : Date.now();
    const remaining = SLOW_AFTER_MS - (Date.now() - started);
    if (remaining <= 0) { setSlow(true); return; }
    setSlow(false);
    const t = setTimeout(() => setSlow(true), remaining);
    return () => clearTimeout(t);
  }, [since, active]);

  return slow;
}

/** True once a task has been processing for longer than SLOW_AFTER_MS. */
export function useTaskIsSlow(task: OsTask | null): boolean {
  return useIsSlowSince(task?.createdAt ?? null, task?.status === "processing");
}

/**
 * Tracks one active OpenSpeaker task: polls /api/os/tasks/:id every few
 * seconds until it reaches "done" or "error", then stops and refreshes the
 * tool's history list.
 */
export function useOsTask(tool: string) {
  const [task, setTask] = useState<OsTask | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const slow = useTaskIsSlow(task);

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
          qc.invalidateQueries({ queryKey: ["auth", "me"] });
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
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      return created;
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [qc, tool, toast]);

  /**
   * User-initiated cancel of the active task: server cancels provider-side and
   * refunds; polling stops on its own once the status leaves "processing".
   */
  const cancel = useCallback(async () => {
    if (!task || task.status !== "processing" || cancelling) return;
    setCancelling(true);
    try {
      const fresh = await osCancelTask(task.id);
      setTask(fresh);
      qc.invalidateQueries({ queryKey: ["os-tasks", tool] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      if (fresh.status === "cancelled") {
        toast({ title: "Cancelled", description: "Your credits have been refunded." });
      } else if (fresh.status === "done") {
        toast({ title: "Already finished", description: "Your result was ready before the cancel went through." });
      }
    } catch (e: any) {
      toast({ title: "Couldn't cancel", description: e.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  }, [task, cancelling, qc, tool, toast]);

  return { task, setTask, submitting, run, slow, cancel, cancelling, working: submitting || task?.status === "processing" };
}
