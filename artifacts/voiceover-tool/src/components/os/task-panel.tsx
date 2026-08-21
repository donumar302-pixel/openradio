import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Download, Trash2, CheckCircle2, XCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { osJson, taskAudioUrl, taskDownloads, taskImageUrls, type OsTask } from "@/lib/os-api";

/* ── Active task banner ─────────────────────────────────────────────── */

export function OsTaskResult({ task }: { task: OsTask | null }) {
  if (!task) return null;
  if (task.status === "processing") {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center gap-3">
        <Loader2 className="animate-spin text-primary shrink-0" size={18} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Generating…</p>
          <p className="text-xs text-muted-foreground truncate">This runs in the background — you can keep working, the result also appears in History below.</p>
        </div>
      </div>
    );
  }
  if (task.status === "error") {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm flex items-center gap-3">
        <XCircle className="text-red-500 shrink-0" size={18} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-red-600">Generation failed</p>
          <p className="text-xs text-muted-foreground">{task.error || "Your credits were refunded."}</p>
        </div>
      </div>
    );
  }
  return <TaskOutput task={task} highlight />;
}

/* ── Output rendering (done tasks) ──────────────────────────────────── */

function TaskOutput({ task, highlight }: { task: OsTask; highlight?: boolean }) {
  const audio = taskAudioUrl(task);
  const images = taskImageUrls(task);
  const downloads = taskDownloads(task);
  const text = typeof task.output?.text === "string" ? task.output.text : null;
  return (
    <div className={cn("bg-white rounded-2xl border p-5 shadow-sm space-y-3", highlight ? "border-primary/40" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <p className="font-semibold text-sm truncate">{task.title || "Result"}</p>
        </div>
        {downloads.length > 0 && (
          <div className="flex gap-1.5 flex-wrap justify-end">
            {downloads.map((d) => (
              <a key={d.url} href={d.url} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"><Download size={12} />{d.label}</Button>
              </a>
            ))}
          </div>
        )}
      </div>
      {audio && <audio controls src={audio} className="w-full" />}
      {images.length > 0 && (
        <div className={cn("grid gap-2", images.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {images.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="Generated" className="rounded-xl border border-border w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {text && <p className="text-sm bg-secondary/40 rounded-xl p-3 whitespace-pre-wrap">{text}</p>}
    </div>
  );
}

/* ── History list ───────────────────────────────────────────────────── */

export function OsTaskHistory({ tool, emptyLabel = "Nothing generated yet." }: { tool: string; emptyLabel?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["os-tasks", tool],
    queryFn: () => osJson<{ items: OsTask[]; total: number }>(`/tasks?tool=${tool}&limit=10`),
    refetchInterval: (q) => (q.state.data?.items.some((t) => t.status === "processing") ? 5000 : false),
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/os/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-tasks", tool] }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History size={15} className="text-muted-foreground" />
        <p className="font-bold text-sm text-foreground">History</p>
      </div>
      {isLoading ? (
        <div className="py-6 text-center"><Loader2 className="animate-spin inline text-muted-foreground" size={18} /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center bg-secondary/30 rounded-xl">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-border px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                {t.status === "processing" && <Loader2 size={14} className="animate-spin text-primary shrink-0" />}
                {t.status === "done" && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                {t.status === "error" && <XCircle size={14} className="text-red-500 shrink-0" />}
                <p className="text-[13px] font-semibold truncate flex-1">{t.title || `Task ${t.id}`}</p>
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(t.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                <button
                  onClick={() => del.mutate(t.id)}
                  className="text-muted-foreground/50 hover:text-red-500 transition-colors shrink-0"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {t.status === "done" && <HistoryOutputs task={t} />}
              {t.status === "error" && <p className="text-[11px] text-red-500">{t.error || "Failed — credits refunded."}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryOutputs({ task }: { task: OsTask }) {
  const audio = taskAudioUrl(task);
  const images = taskImageUrls(task);
  const downloads = taskDownloads(task);
  return (
    <div className="space-y-2">
      {audio && <audio controls src={audio} className="w-full h-9" />}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="" className="h-20 w-20 object-cover rounded-lg border border-border" />
            </a>
          ))}
        </div>
      )}
      {downloads.filter((d) => d.label !== "Audio").length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {downloads.filter((d) => d.label !== "Audio").map((d) => (
            <a key={d.url} href={d.url} target="_blank" rel="noreferrer"
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1">
              <Download size={11} />{d.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Reusable audio file drop ───────────────────────────────────────── */

export function OsFileDrop({ file, onFile, accept = "audio/*", hint = "MP3, WAV, M4A, FLAC supported" }: {
  file: File | null;
  onFile: (f: File) => void;
  accept?: string;
  hint?: string;
}) {
  return (
    <label className={cn(
      "block w-full border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
      file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50",
    )}>
      <input type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <Download size={22} className="mx-auto mb-2 text-muted-foreground rotate-180" />
      <p className="text-sm font-medium text-foreground">{file ? file.name : "Click to upload"}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </label>
  );
}
