import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, RefreshCw, Send, Users, Hash } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type SentNotification = {
  title: string; body: string; recipients: number; read: number; createdAt: string;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminNotifications() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "ids">("all");
  const [idsInput, setIdsInput] = useState("");

  const { data: history = [], isLoading, refetch, isFetching } = useQuery<SentNotification[]>({
    queryKey: ["admin-notifications"],
    queryFn: () => fetch("/api/admin/notifications").then(r => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      setTitle(""); setBody(""); setIdsInput("");
    },
  });

  const handleSend = () => {
    if (!title.trim() || !body.trim()) return;
    let target: "all" | number[] = "all";
    if (targetMode === "ids") {
      const ids = idsInput.split(",").map(s => parseInt(s.trim())).filter(n => Number.isFinite(n));
      if (ids.length === 0) return;
      target = ids;
    }
    sendMutation.mutate({ title: title.trim(), body: body.trim(), target });
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Notifications</h1>
          <p className="text-[13px] text-white/40 mt-0.5">Broadcast messages to users</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Send form */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Send size={14} className="text-primary" />
          <p className="text-[13px] font-bold text-white">Send Notification</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="New feature available!"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Write your message..."
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Target</label>
            <div className="flex items-center gap-1.5 bg-[#0f1117] border border-white/10 rounded-lg p-1 w-fit">
              <button onClick={() => setTargetMode("all")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors", targetMode === "all" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
                <Users size={12} /> All users
              </button>
              <button onClick={() => setTargetMode("ids")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors", targetMode === "ids" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
                <Hash size={12} /> Specific IDs
              </button>
            </div>
            {targetMode === "ids" && (
              <input value={idsInput} onChange={e => setIdsInput(e.target.value)} placeholder="e.g. 12, 45, 78"
                className="w-full mt-2 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSend} disabled={sendMutation.isPending || !title.trim() || !body.trim() || (targetMode === "ids" && !idsInput.trim())}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
              <Send size={13} /> {sendMutation.isPending ? "Sending..." : "Send"}
            </button>
            {sendMutation.isSuccess && <p className="text-[11px] text-emerald-400">Sent to {(sendMutation.data as any)?.sent ?? 0} user(s).</p>}
            {sendMutation.isError && <p className="text-[11px] text-red-400">{(sendMutation.error as Error)?.message}</p>}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
          <Bell size={14} className="text-primary" />
          <p className="text-[13px] font-bold text-white">Sent History</p>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">No notifications sent yet</div>
        ) : (
          <div className="divide-y divide-white/5">
            {history.map((n, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-white">{n.title}</p>
                    <p className="text-[12px] text-white/50 mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-white/20 mt-1.5">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/5 text-white/50">
                      {n.recipients} sent
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                      {n.read} read
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
