import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LifeBuoy, RefreshCw, Send, Trash2, ArrowLeft, Check, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Ticket = {
  id: number; subject: string; status: "open" | "answered" | "closed";
  userId: number; userName: string; userEmail: string;
  createdAt: string; updatedAt: string;
};

type Message = { id: number; sender: "user" | "admin"; body: string; createdAt: string };
type TicketDetail = Ticket & { messages: Message[] };

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "text-amber-400", bg: "bg-amber-500/10" },
  answered: { label: "Answered", color: "text-blue-400", bg: "bg-blue-500/10" },
  closed: { label: "Closed", color: "text-white/40", bg: "bg-white/5" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.open;
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", s.color, s.bg)}>
      {s.label}
    </span>
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TicketThread({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["admin-ticket", id],
    queryFn: () => fetch(`/api/admin/support/${id}`).then(r => r.json()),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-ticket", id] });
    qc.invalidateQueries({ queryKey: ["admin-support"] });
  };

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      fetch(`/api/admin/support/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { invalidate(); setReply(""); },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/admin/support/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-support"] }); onBack(); },
  });

  if (isLoading || !ticket) {
    return <div className="py-12 text-center text-white/20 text-[13px]">Loading ticket...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] font-bold text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to tickets
        </button>
        {deleting ? (
          <div className="flex items-center gap-2">
            <button onClick={() => deleteMutation.mutate()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/30">
              <Check size={10} /> Confirm delete
            </button>
            <button onClick={() => setDeleting(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X size={12} /></button>
          </div>
        ) : (
          <button onClick={() => setDeleting(true)} className="flex items-center gap-1.5 text-[12px] font-bold text-white/40 hover:text-red-400 transition-colors">
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>

      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        {/* Ticket header */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-white truncate">{ticket.subject}</p>
              <p className="text-[12px] text-white/40 mt-0.5">{ticket.userName} · {ticket.userEmail}</p>
            </div>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {(["open", "answered", "closed"] as const).map(s => (
              <button key={s} onClick={() => statusMutation.mutate(s)} disabled={statusMutation.isPending || ticket.status === s}
                className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors",
                  ticket.status === s ? "bg-white/10 text-white" : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="px-5 py-5 space-y-4 max-h-[420px] overflow-y-auto">
          {ticket.messages.map(m => (
            <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5",
                m.sender === "admin" ? "bg-primary/20 text-white rounded-br-sm" : "bg-white/5 text-white/90 rounded-bl-sm")}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-50">
                  {m.sender === "admin" ? "Admin" : ticket.userName}
                </p>
                <p className="text-[13px] whitespace-pre-wrap break-words">{m.body}</p>
                <p className="text-[10px] opacity-40 mt-1.5">{fmtDateTime(m.createdAt)}</p>
              </div>
            </div>
          ))}
          {ticket.messages.length === 0 && (
            <p className="text-center text-[12px] text-white/20 py-6">No messages</p>
          )}
        </div>

        {/* Reply box */}
        <div className="px-5 py-4 border-t border-white/5">
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="Write a reply..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none" />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => reply.trim() && replyMutation.mutate(reply.trim())} disabled={replyMutation.isPending || !reply.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
              <Send size={13} /> {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </button>
            {replyMutation.isError && <p className="text-[11px] text-red-400">{(replyMutation.error as Error)?.message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSupport() {
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: tickets = [], isLoading, refetch, isFetching } = useQuery<Ticket[]>({
    queryKey: ["admin-support", filter],
    queryFn: () => fetch(`/api/admin/support${filter ? `?status=${filter}` : ""}`).then(r => r.json()),
  });

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Support</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{tickets.length} tickets</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {openId != null ? (
        <TicketThread id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex items-center gap-1.5 bg-[#161b22] border border-white/5 rounded-xl p-1 w-fit">
            {[
              { value: "", label: "All" },
              { value: "open", label: "Open" },
              { value: "answered", label: "Answered" },
              { value: "closed", label: "Closed" },
            ].map(s => (
              <button key={s.value} onClick={() => setFilter(s.value)}
                className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors",
                  filter === s.value ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60")}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Ticket list */}
          <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
              <LifeBuoy size={14} className="text-primary" />
              <p className="text-[13px] font-bold text-white">Tickets</p>
            </div>
            {isLoading ? (
              <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center text-white/20 text-[13px]">No tickets found</div>
            ) : (
              <div className="divide-y divide-white/5">
                {tickets.map(t => (
                  <button key={t.id} onClick={() => setOpenId(t.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-[11px] shrink-0">
                      {t.userName?.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">{t.subject}</p>
                      <p className="text-[11px] text-white/30 truncate">{t.userName} · {t.userEmail}</p>
                    </div>
                    <span className="text-[11px] text-white/20 shrink-0 hidden sm:block">{fmtDateTime(t.updatedAt)}</span>
                    <StatusBadge status={t.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
