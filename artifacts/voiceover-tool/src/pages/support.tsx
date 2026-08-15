import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Plus, ArrowLeft, Send, Loader2, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TicketStatus = "open" | "answered" | "closed";

interface TicketSummary {
  id: number;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}
interface TicketMessage {
  id: number;
  sender: "user" | "admin";
  body: string;
  createdAt: string;
}
interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "Just now";
}

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-amber-50 text-amber-600",
  answered: "bg-green-50 text-green-600",
  closed: "bg-[#f3f4f6] text-[#6b7280]",
};

function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", statusStyles[status])}>
      {status}
    </span>
  );
}

async function fetchTickets(): Promise<TicketSummary[]> {
  const res = await fetch("/api/support", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load tickets");
  return res.json();
}

async function fetchTicket(id: number): Promise<TicketDetail> {
  const res = await fetch(`/api/support/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load ticket");
  return res.json();
}

/* ── Thread view ─────────────────────────────────────────────── */
function TicketThread({ id, onBack }: { id: number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["support", id],
    queryFn: () => fetchTicket(id),
  });

  const sendReply = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/support/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to send reply");
      return d;
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support", id] });
      queryClient.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} /> Back to tickets
      </button>

      {isLoading || !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-extrabold text-foreground">{data.subject}</h1>
            <StatusPill status={data.status} />
          </div>

          <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 shadow-sm space-y-4">
            {data.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    msg.sender === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-[#f3f4f6] text-foreground rounded-bl-md"
                  )}
                >
                  <p className="text-[11px] font-bold mb-0.5 opacity-70">
                    {msg.sender === "user" ? "You" : "Support"}
                  </p>
                  <p className="text-[13px] whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={cn("text-[10px] mt-1", msg.sender === "user" ? "text-white/60" : "text-[#9ca3af]")}>
                    {timeAgo(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {data.status === "closed" ? (
            <p className="text-sm text-[#9ca3af] text-center font-semibold">This ticket is closed.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e5e7eb] p-4 shadow-sm space-y-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                className="resize-none"
              />
              <Button
                onClick={() => sendReply.mutate(reply.trim())}
                disabled={!reply.trim() || sendReply.isPending}
                className="w-full font-bold"
              >
                {sendReply.isPending ? "Sending..." : <><Send size={14} /> Send Reply</>}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── New ticket form ─────────────────────────────────────────── */
function NewTicketForm({ onCreated, onCancel }: { onCreated: (id: number) => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create ticket");
      return d as TicketSummary;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["support"] });
      toast({ title: "Ticket created", description: "We'll get back to you shortly." });
      onCreated(d.id);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={16} className="text-primary" />
        <h2 className="font-bold text-base">New Ticket</h2>
      </div>
      <div className="space-y-1.5">
        <Label className="font-semibold text-sm">Subject</Label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What can we help you with?"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="font-semibold text-sm">Message</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue in detail..."
          rows={5}
          className="resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="font-semibold">Cancel</Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!subject.trim() || !message.trim() || create.isPending}
          className="flex-1 font-bold"
        >
          {create.isPending ? "Submitting..." : "Submit Ticket"}
        </Button>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function SupportPage() {
  const [view, setView] = useState<{ mode: "list" | "new" } | { mode: "thread"; id: number }>({ mode: "list" });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support"],
    queryFn: fetchTickets,
  });

  if (view.mode === "thread") {
    return <TicketThread id={view.id} onBack={() => setView({ mode: "list" })} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <LifeBuoy size={18} className="text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">Contact Support</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:ml-12">Get help from our team</p>
        </div>
        {view.mode === "list" && (
          <Button onClick={() => setView({ mode: "new" })} className="font-bold shrink-0">
            <Plus size={15} /> New Ticket
          </Button>
        )}
      </div>

      {view.mode === "new" ? (
        <NewTicketForm
          onCreated={(id) => setView({ mode: "thread", id })}
          onCancel={() => setView({ mode: "list" })}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-10 shadow-sm flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#f3f4f6] flex items-center justify-center mb-3">
            <MessageSquare size={22} className="text-[#9ca3af]" />
          </div>
          <p className="font-bold text-foreground">No tickets yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create a ticket and our team will help you out.</p>
          <Button onClick={() => setView({ mode: "new" })} className="font-bold">
            <Plus size={15} /> New Ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setView({ mode: "thread", id: t.id })}
              className="w-full text-left bg-white rounded-2xl border border-[#e5e7eb] p-4 shadow-sm hover:border-primary/40 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-[15px] text-foreground truncate">{t.subject}</p>
                <StatusPill status={t.status} />
              </div>
              <p className="text-[12px] text-[#9ca3af] font-semibold mt-1">
                Updated {timeAgo(t.updatedAt)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
