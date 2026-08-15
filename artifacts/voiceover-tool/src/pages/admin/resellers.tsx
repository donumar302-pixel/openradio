import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Coins, CalendarClock, Ban, ShieldCheck, X, Check,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Reseller = {
  id: number;
  name: string;
  email: string;
  resellerCredits: number;
  resellerExpiresAt: string | null;
  status: string;
  createdAt: string;
  userCount: number;
};

const CREDIT_PRESETS = [
  { label: "100K", value: 100000 },
  { label: "500K", value: 500000 },
  { label: "1M", value: 1000000 },
  { label: "5M", value: 5000000 },
];

const EXPIRY_PRESETS = [
  { label: "1 month", months: 1 },
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "No expiry", months: null as number | null },
  { label: "Custom date", months: undefined as number | undefined },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPast(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function addMonthsISO(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function AddCreditsModal({ reseller, onClose, onSubmit, error, pending }: {
  reseller: Reseller;
  onClose: () => void;
  onSubmit: (credits: number) => void;
  error?: string;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("");
  return (
    <ModalShell title={`Add credits · ${reseller.name}`} onClose={onClose}>
      <p className="text-[12px] text-white/40 mb-3">
        Current pool: <span className="text-amber-400 font-bold">{reseller.resellerCredits.toLocaleString()}</span>
      </p>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credits to add</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="100000" autoFocus
          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {CREDIT_PRESETS.map(p => (
          <button key={p.value} onClick={() => setAmount(String(p.value))}
            className="px-2.5 py-1 rounded-md bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10">{p.label}</button>
        ))}
      </div>
      {error && <p className="text-[11px] text-red-400 mt-3">{error}</p>}
      <div className="flex items-center gap-2 mt-4">
        <button onClick={() => { const n = parseInt(amount); if (Number.isFinite(n) && n > 0) onSubmit(n); }}
          disabled={pending || !amount}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-[12px] font-bold hover:bg-emerald-500/30 disabled:opacity-40 transition-colors">
          <Plus size={13} /> {pending ? "Adding..." : "Add credits"}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-[12px] font-bold">Cancel</button>
      </div>
    </ModalShell>
  );
}

function ExpiryModal({ reseller, onClose, onSubmit, error, pending }: {
  reseller: Reseller;
  onClose: () => void;
  onSubmit: (expiresAt: string | null) => void;
  error?: string;
  pending: boolean;
}) {
  const [date, setDate] = useState(
    reseller.resellerExpiresAt ? new Date(reseller.resellerExpiresAt).toISOString().slice(0, 10) : ""
  );
  return (
    <ModalShell title={`Change expiry · ${reseller.name}`} onClose={onClose}>
      <p className="text-[12px] text-white/40 mb-3">
        Current: <span className="text-white font-bold">{fmtDate(reseller.resellerExpiresAt) || "No expiry"}</span>
      </p>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">New expiry date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white focus:outline-none focus:border-primary/50" />
      </div>
      {error && <p className="text-[11px] text-red-400 mt-3">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => { if (date) onSubmit(new Date(date).toISOString()); }}
          disabled={pending || !date}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
          <Check size={13} /> {pending ? "Saving..." : "Set expiry"}
        </button>
        <button onClick={() => onSubmit(null)} disabled={pending}
          className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-[12px] font-bold hover:bg-white/10 disabled:opacity-40">
          Clear (no expiry)
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-[12px] font-bold">Cancel</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-md bg-[#161b22] border border-white/10 rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-black text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateResellerModal({ onClose, onSubmit, error, pending, success }: {
  onClose: () => void;
  onSubmit: (body: Record<string, any>) => void;
  error?: string;
  pending: boolean;
  success: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credits, setCredits] = useState("");
  const [expiryMode, setExpiryMode] = useState<"none" | "months" | "custom">("none");
  const [expiryMonths, setExpiryMonths] = useState<number | null>(null);
  const [customDate, setCustomDate] = useState("");

  const computeExpiry = (): string | null => {
    if (expiryMode === "none") return null;
    if (expiryMode === "months" && expiryMonths != null) return addMonthsISO(expiryMonths);
    if (expiryMode === "custom" && customDate) return new Date(customDate).toISOString();
    return null;
  };

  const handleSubmit = () => {
    const c = parseInt(credits);
    if (!name.trim() || !email.trim() || !password || !Number.isFinite(c)) return;
    onSubmit({ name: name.trim(), email: email.trim(), password, credits: c, expiresAt: computeExpiry() });
  };

  return (
    <ModalShell title="Create Reseller" onClose={onClose}>
      {success ? (
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Check size={22} className="text-emerald-400" />
          </div>
          <p className="text-[14px] font-bold text-white mb-1">Reseller created</p>
          <p className="text-[12px] text-white/50">Reseller can log in at <span className="text-primary font-bold">openradio.io/reseller</span></p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-white/5 text-white/70 text-[12px] font-bold hover:bg-white/10">Close</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Acme Radio Ltd"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="reseller@acme.com"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Password</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 6 chars"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credits pool</label>
            <input type="number" value={credits} onChange={e => setCredits(e.target.value)} placeholder="amount"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
            <div className="flex flex-wrap gap-2 mt-1">
              {CREDIT_PRESETS.map(p => (
                <button key={p.value} onClick={() => setCredits(String(p.value))}
                  className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold", credits === String(p.value) ? "bg-primary/20 text-primary" : "bg-white/5 text-white/60 hover:bg-white/10")}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Expiry</label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_PRESETS.map(p => {
                const active = (p.months === null && expiryMode === "none")
                  || (p.months === undefined && expiryMode === "custom")
                  || (typeof p.months === "number" && expiryMode === "months" && expiryMonths === p.months);
                return (
                  <button key={p.label}
                    onClick={() => {
                      if (p.months === null) { setExpiryMode("none"); }
                      else if (p.months === undefined) { setExpiryMode("custom"); }
                      else { setExpiryMode("months"); setExpiryMonths(p.months); }
                    }}
                    className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold", active ? "bg-primary/20 text-primary" : "bg-white/5 text-white/60 hover:bg-white/10")}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            {expiryMode === "custom" && (
              <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                className="w-full mt-2 bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white focus:outline-none focus:border-primary/50" />
            )}
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit}
              disabled={pending || !name.trim() || !email.trim() || !password || !credits}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
              <Plus size={13} /> {pending ? "Creating..." : "Create Reseller"}
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-[12px] font-bold">Cancel</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export default function AdminResellers() {
  const qc = useQueryClient();
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [creditsFor, setCreditsFor] = useState<Reseller | null>(null);
  const [expiryFor, setExpiryFor] = useState<Reseller | null>(null);

  const { data: resellers = [], isLoading, refetch, isFetching } = useQuery<Reseller[]>({
    queryKey: ["admin-resellers"],
    queryFn: () => fetch("/api/admin/resellers", { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      fetch("/api/admin/resellers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-resellers"] }); },
  });

  const creditsMutation = useMutation({
    mutationFn: ({ id, credits }: { id: number; credits: number }) =>
      fetch(`/api/admin/resellers/${id}/credits`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-resellers"] }); setCreditsFor(null); },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, any>) =>
      fetch(`/api/admin/resellers/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-resellers"] }); setExpiryFor(null); },
  });

  return (
    <>
      <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black text-white">Resellers</h1>
            <p className="text-[13px] text-white/40 mt-0.5">{resellers.length} resellers</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
            >
              <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => { createMutation.reset(); setCreatingOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 transition-all"
            >
              <Plus size={13} /> Create Reseller
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1.3fr_1.4fr_130px_80px_140px_100px_120px_260px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
                <span>Name</span>
                <span>Email</span>
                <span>Credits pool</span>
                <span>Users</span>
                <span>Expiry</span>
                <span>Status</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
              ) : resellers.length === 0 ? (
                <div className="py-12 text-center text-white/20 text-[13px]">No resellers yet</div>
              ) : (
                resellers.map(r => {
                  const blocked = r.status === "blocked";
                  const expired = isPast(r.resellerExpiresAt);
                  return (
                    <div key={r.id} className="grid grid-cols-[1.3fr_1.4fr_130px_80px_140px_100px_120px_260px] px-5 py-3.5 items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 pr-3">
                        <span className="text-[13px] font-semibold text-white truncate block">{r.name}</span>
                      </div>
                      <div className="min-w-0 pr-3">
                        <span className="text-[12px] text-white/50 truncate block">{r.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[13px] font-bold text-amber-400">
                        <Coins size={12} /> {r.resellerCredits.toLocaleString()}
                      </div>
                      <div className="text-[13px] font-bold text-white tabular-nums">{r.userCount}</div>
                      <div className={cn("text-[12px] font-bold", !r.resellerExpiresAt ? "text-white/30" : expired ? "text-red-400" : "text-white/70")}>
                        {r.resellerExpiresAt ? fmtDate(r.resellerExpiresAt) : "No expiry"}
                      </div>
                      <div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                          blocked ? "bg-red-500/15 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                          {blocked ? "Blocked" : "Active"}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/40">{fmtDate(r.createdAt)}</div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => { creditsMutation.reset(); setCreditsFor(r); }} title="Add credits"
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors">
                          <Coins size={12} /> Credits
                        </button>
                        <button onClick={() => { patchMutation.reset(); setExpiryFor(r); }} title="Change expiry"
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10 transition-colors">
                          <CalendarClock size={12} /> Expiry
                        </button>
                        <button onClick={() => patchMutation.mutate({ id: r.id, status: blocked ? "active" : "blocked" })}
                          disabled={patchMutation.isPending} title={blocked ? "Unsuspend" : "Suspend"}
                          className={cn("p-2 rounded-lg transition-colors", blocked ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-amber-400 hover:bg-amber-500/10")}>
                          {blocked ? <ShieldCheck size={14} /> : <Ban size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {creatingOpen && (
        <CreateResellerModal
          onClose={() => setCreatingOpen(false)}
          onSubmit={body => createMutation.mutate(body)}
          error={createMutation.isError ? (createMutation.error as Error)?.message : undefined}
          pending={createMutation.isPending}
          success={createMutation.isSuccess}
        />
      )}
      {creditsFor && (
        <AddCreditsModal
          reseller={creditsFor}
          onClose={() => setCreditsFor(null)}
          onSubmit={credits => creditsMutation.mutate({ id: creditsFor.id, credits })}
          error={creditsMutation.isError ? (creditsMutation.error as Error)?.message : undefined}
          pending={creditsMutation.isPending}
        />
      )}
      {expiryFor && (
        <ExpiryModal
          reseller={expiryFor}
          onClose={() => setExpiryFor(null)}
          onSubmit={expiresAt => patchMutation.mutate({ id: expiryFor.id, expiresAt })}
          error={patchMutation.isError ? (patchMutation.error as Error)?.message : undefined}
          pending={patchMutation.isPending}
        />
      )}
    </>
  );
}
