import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import {
  Upload, FileText, Trash2, Play, Download, Loader2,
  CheckCircle2, XCircle, Clock, Layers, StopCircle, PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OsVoicePicker } from "@/components/os/voice-picker";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { osCreateTaskJson, osGetTask, osJson, taskAudioUrl } from "@/lib/os-api";
import { estimateTtsCost } from "@/lib/os-cost";

const MAX_LINES = 100;
const MAX_CHARS = 5000;

type LineState = "idle" | "generating" | "done" | "error";
interface LineItem {
  id: number;
  text: string;
  state: LineState;
  audioUrl?: string;
  error?: string;
  taskId?: number;
}

function parseFile(content: string, fileName: string): string[] {
  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const rawLines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!isCsv) return rawLines;
  return rawLines.map(line => {
    const parts = line.split(",");
    return parts[0].replace(/^"|"$/g, "").trim();
  }).filter(Boolean);
}

function StatusBadge({ state }: { state: LineState }) {
  if (state === "idle") return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9ca3af]"><Clock size={11} />Pending</span>;
  if (state === "generating") return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"><Loader2 size={11} className="animate-spin" />Generating</span>;
  if (state === "done") return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600"><CheckCircle2 size={11} />Done</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500"><XCircle size={11} />Error</span>;
}

function MiniPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.currentTime = 0; a.play(); setPlaying(true); a.onended = () => setPlaying(false); }
  };
  return (
    <>
      <audio ref={audioRef} src={url} preload="none" />
      <button
        onClick={toggle}
        className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
      >
        {playing ? <StopCircle size={13} /> : <Play size={13} />}
      </button>
    </>
  );
}

export default function BatchTtsPage() {
  const { toast } = useToast();
  const [lines, setLines] = useState<LineItem[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const stopRef = useRef(false);
  const runIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Total cost of the lines that still need generating (1 credit/char via OpenSpeaker).
  const remainingCost = lines
    .filter(l => l.state !== "done")
    .reduce((sum, l) => sum + estimateTtsCost(l.text), 0);
  const insufficientCredits = useOsInsufficientCredits(lines.length > 0 ? remainingCost : null);

  const loadFile = useCallback((file: File) => {
    if (!file.name.match(/\.(txt|csv)$/i)) {
      toast({ title: "Unsupported file", description: "Please upload a .txt or .csv file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseFile(content, file.name).slice(0, MAX_LINES);
      const items: LineItem[] = parsed.map((text, i) => ({
        id: i, text: text.slice(0, MAX_CHARS), state: "idle",
      }));
      setLines(items);
    };
    reader.readAsText(file);
  }, [toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const removeLine = (id: number) => setLines(prev => prev.filter(l => l.id !== id));
  const clearAll = () => { setLines([]); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const doneCnt = lines.filter(l => l.state === "done").length;
  const totalCnt = lines.length;

  /** Cancel a still-processing task server-side (provider delete + refund). */
  const cancelTask = async (taskId: number): Promise<boolean> => {
    try {
      await osJson(`/tasks/${taskId}`, { method: "DELETE" });
      return true;
    } catch {
      return false;
    }
  };

  const runBatch = async () => {
    if (!voiceId) { toast({ title: "Voice required", description: "Please select a voice first.", variant: "destructive" }); return; }
    if (lines.length === 0) { toast({ title: "No lines", description: "Upload a file first.", variant: "destructive" }); return; }
    if (isRunning) return; // never allow two loops at once

    const runId = ++runIdRef.current;
    stopRef.current = false;
    setIsRunning(true);

    for (let i = 0; i < lines.length; i++) {
      if (stopRef.current || runIdRef.current !== runId) break;
      if (lines[i].state === "done") continue;

      setLines(prev => prev.map(l => l.id === i ? { ...l, state: "generating" } : l));

      try {
        // All engines generate through the OpenSpeaker library (prefixed voice id).
        let task = await osCreateTaskJson("/tts", { text: lines[i].text, voiceId, speed: 1 });
        setLines(prev => prev.map(l => l.id === i ? { ...l, taskId: task.id } : l));
        const deadline = Date.now() + 300_000;
        let timedOut = false;
        while (task.status === "processing") {
          if (stopRef.current) break;
          if (Date.now() > deadline) { timedOut = true; break; }
          await new Promise(r => setTimeout(r, 1500));
          task = await osGetTask(task.id);
        }
        if (task.status === "processing") {
          // Stopped or timed out while the provider is still working: cancel
          // server-side so reserved credits are refunded. Only give the line
          // up once cancellation is confirmed; otherwise settle it by polling.
          const cancelled = await cancelTask(task.id);
          if (!cancelled) {
            while (task.status === "processing" && runIdRef.current === runId) {
              await new Promise(r => setTimeout(r, 2500));
              task = await osGetTask(task.id);
            }
          }
          if (cancelled || task.status === "processing") {
            setLines(prev => prev.map(l => l.id === i ? { ...l, state: "idle", taskId: undefined } : l));
            if (timedOut && !stopRef.current) continue; // move on; credits were refunded
            break;
          }
        }
        if (task.status === "error") throw new Error(task.error || "Generation failed");
        const audioUrl = taskAudioUrl(task);
        if (!audioUrl) throw new Error("No audio returned");
        setLines(prev => prev.map(l => l.id === i ? { ...l, state: "done", audioUrl } : l));
        if (stopRef.current) break;
      } catch (e: any) {
        setLines(prev => prev.map(l => l.id === i ? { ...l, state: "error", error: e.message } : l));
      }
    }

    if (runIdRef.current === runId) {
      setIsRunning(false);
      if (!stopRef.current) {
        toast({ title: "Batch complete!", description: "All lines processed." });
      }
    }
  };

  // Stop only signals the loop; isRunning stays true until the active line is
  // settled (cancelled with refund, or finished) so a second run can't overlap.
  const stopBatch = () => { stopRef.current = true; };

  const downloadZip = async () => {
    const done = lines.filter(l => l.state === "done" && l.audioUrl);
    if (done.length === 0) return;
    toast({ title: "Preparing ZIP…", description: "Fetching audio files." });
    const zip = new JSZip();
    await Promise.all(done.map(async (l, i) => {
      try {
        const blob = await fetch(l.audioUrl!).then(r => {
          if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
          return r.blob();
        });
        zip.file(`line_${String(l.id + 1).padStart(3, "0")}.mp3`, blob);
      } catch { /* skip failed */ }
    }));
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "batch-tts.zip";
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Bulk TTS</h1>
            <p className="text-sm text-muted-foreground">Upload a file, generate audio for every line in one go</p>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      {lines.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
            isDragging ? "border-primary bg-primary/5" : "border-[#e5e7eb] hover:border-primary/50 hover:bg-[#fafafa]"
          )}
        >
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Upload size={24} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="font-bold text-foreground">Drop your file here or click to browse</p>
            <p className="text-sm text-muted-foreground mt-1">Supports <strong>.txt</strong> and <strong>.csv</strong> — up to {MAX_LINES} lines</p>
            <p className="text-xs text-muted-foreground mt-1">TXT: one line = one audio &nbsp;·&nbsp; CSV: first column used as text</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
          />
        </div>
      )}

      {/* Settings + actions bar */}
      {lines.length > 0 && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Voice select — full OpenSpeaker library (all engines + clones) */}
          <div className="flex-1 min-w-0 w-full">
            <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wide mb-1">Voice</p>
            <OsVoicePicker
              value={voiceId}
              valueName={voiceName}
              onChange={(id, name) => { if (!isRunning) { setVoiceId(id); setVoiceName(name); } }}
              placeholder="Select a voice"
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 self-end sm:self-auto">
            {!isRunning ? (
              <Button
                onClick={runBatch}
                className="h-9 px-5 text-sm font-bold"
                disabled={!voiceId || lines.length === 0 || insufficientCredits}
              >
                <Layers size={14} className="mr-2" />
                {insufficientCredits ? "Not enough credits" : "Generate All"}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopBatch} className="h-9 px-5 text-sm font-bold">
                <StopCircle size={14} className="mr-2" />
                Stop
              </Button>
            )}
            {doneCnt > 0 && (
              <Button variant="outline" onClick={downloadZip} className="h-9 px-4 text-sm">
                <PackageOpen size={14} className="mr-2" />
                ZIP ({doneCnt})
              </Button>
            )}
            <Button variant="ghost" onClick={clearAll} disabled={isRunning} className="h-9 px-3 text-sm text-[#9ca3af] hover:text-red-500">
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Cost estimate — mirrors the server's 1 credit/char OpenSpeaker charge */}
      {lines.length > 0 && doneCnt < totalCnt && (
        <OsCostEstimate estimate={remainingCost} />
      )}

      {/* Progress bar */}
      {lines.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-[#6b7280]">
            <span>{doneCnt} of {totalCnt} lines done</span>
            <span>{Math.round((doneCnt / totalCnt) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(doneCnt / totalCnt) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Lines table */}
      {lines.length > 0 && (
        <div className="bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_100px_80px] text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] px-4 py-2.5 bg-[#fafafa] border-b border-[#f3f4f6]">
            <span>#</span>
            <span>Text</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-[#f3f4f6]">
            {lines.map(line => (
              <div key={line.id} className={cn(
                "grid grid-cols-[40px_1fr_100px_80px] items-center px-4 py-3 gap-2 transition-colors",
                line.state === "generating" && "bg-orange-50/50"
              )}>
                <span className="text-[12px] font-bold text-[#9ca3af]">{line.id + 1}</span>
                <div className="min-w-0">
                  <p className="text-[13px] text-foreground truncate">{line.text}</p>
                  {line.error && <p className="text-[11px] text-red-400 truncate mt-0.5">{line.error}</p>}
                </div>
                <StatusBadge state={line.state} />
                <div className="flex items-center justify-end gap-1.5">
                  {line.state === "done" && line.audioUrl && (
                    <>
                      <MiniPlayer url={line.audioUrl} />
                      <a
                        href={line.audioUrl}
                        download={`line_${line.id + 1}.mp3`}
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-[#f3f4f6] hover:bg-[#e5e7eb] text-[#6b7280] transition-colors"
                      >
                        <Download size={13} />
                      </a>
                    </>
                  )}
                  {line.state === "idle" && !isRunning && (
                    <button
                      onClick={() => removeLine(line.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-50 text-[#d1d5db] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state after clear */}
      {lines.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2 text-[#9ca3af]">
          <FileText size={32} className="text-[#e5e7eb]" />
          <p className="text-sm">Upload a .txt or .csv file to get started</p>
        </div>
      )}
    </div>
  );
}
