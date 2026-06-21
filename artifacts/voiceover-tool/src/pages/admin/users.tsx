import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, RefreshCw, Trash2, Edit2, Check, X, CalendarPlus,
  Ban, ShieldCheck, Coins, Plus, Minus, Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLANS = [
  { value: "free", label: "Free", color: "text-white/40", bg: "bg-white/5", credits: 10000 },
  { value: "starter", label: "Starter", color: "text-blue-400", bg: "bg-blue-500/10", credits: 100000 },
  { value: "pro", label: "Pro", color: "text-violet-400", bg: "bg-violet-500/10", credits: 500000 },
  { value: "enterprise", label: "Enterprise", color: "text-amber-400", bg: "bg-amber-500/10", credits: 2000000 },
];

function PlanBadge({ plan }: { plan: string }) {
  const p = PLANS.find(p => p.value === plan) ?? PLANS[0];
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", p.color, p.bg)}>
      {p.label}
    </span>
  );
}

function fmtCredits(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "k";
  return String(n);
}

function expiryInfo(iso: string | null) {
  if (!iso) return { label: "No expiry", sub: "Unlimited", danger: false, none: true };
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return {
    label: d.toLocaleDateString(),
    sub: days < 0 ? "Expired" : `${days}d left`,
    danger: days < 0,
    none: false,
  };
}

const avatarColors = ["text-primary", "text-blue-400", "text-violet-400", "text-green-400", "text-amber-400", "text-pink-400"];

type AdminUser = {
  id: number; name: string; email: string; plan: string;
  credits: number; creditsUsed: number; planExpiresAt: string | null;
  status: string; isAdmin: boolean; createdAt: string;
  generationCount: number; charactersUsed: number;
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [managingId, setManagingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // manage-panel form state
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState("free");
  const [creditAmount, setCreditAmount] = useState("");

  const qc = useQueryClient();

  const { data: users = [], isLoading, refetch, isFetching } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, any>) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeletingId(null); },
  });

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const startManage = (u: AdminUser) => {
    setManagingId(u.id);
    setEditName(u.name);
    setEditPlan(u.plan ?? "free");
    setCreditAmount("");
    setDeletingId(null);
  };

  const planCounts = PLANS.map(p => ({
    ...p,
    count: users.filter((u) => (u.plan ?? "free") === p.value).length,
  }));

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Users</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{users.length} registered accounts</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Plan summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {planCounts.map(p => (
          <div key={p.value} className="bg-[#161b22] border border-white/5 rounded-xl p-4">
            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", p.color)}>{p.label}</p>
            <p className="text-2xl font-black text-white">{p.count}</p>
            <p className="text-[10px] text-white/20 mt-0.5">{fmtCredits(p.credits)} credits</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full max-w-sm pl-9 pr-4 py-2.5 bg-[#161b22] border border-white/5 rounded-xl text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[860px]">
        <div className="grid grid-cols-[1.4fr_90px_110px_120px_90px_220px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>User</span>
          <span>Plan</span>
          <span>Credits</span>
          <span>Expiry</span>
          <span>Gens</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">
            {search ? "No users match search" : "No users yet"}
          </div>
        ) : (
          filtered.map((u) => {
            const color = avatarColors[u.id % avatarColors.length];
            const isManaging = managingId === u.id;
            const isDeleting = deletingId === u.id;
            const exp = expiryInfo(u.planExpiresAt);
            const blocked = u.status === "blocked";

            return (
              <div key={u.id} className={cn("border-b border-white/5 transition-colors", isManaging ? "bg-white/[0.04]" : "hover:bg-white/[0.02]")}>
                {/* Row */}
                <div className="grid grid-cols-[1.4fr_90px_110px_120px_90px_220px] px-5 py-3.5 items-center">
                  {/* User */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <div className={cn("w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-black text-[11px] shrink-0", color)}>
                      {u.name?.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-white truncate">{u.name}</span>
                        {blocked && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Blocked</span>}
                      </div>
                      <span className="text-[11px] text-white/40 truncate block">{u.email}</span>
                    </div>
                  </div>

                  {/* Plan */}
                  <div><PlanBadge plan={u.plan ?? "free"} /></div>

                  {/* Credits */}
                  <div>
                    <p className="text-[13px] font-bold text-white tabular-nums">{u.credits.toLocaleString()}</p>
                    <p className="text-[10px] text-white/30">{fmtCredits(u.creditsUsed)} used</p>
                  </div>

                  {/* Expiry */}
                  <div>
                    <p className={cn("text-[12px] font-bold", exp.none ? "text-white/30" : exp.danger ? "text-red-400" : "text-white")}>{exp.label}</p>
                    <p className={cn("text-[10px]", exp.danger ? "text-red-400/70" : "text-white/30")}>{exp.sub}</p>
                  </div>

                  {/* Generations */}
                  <div>
                    <p className="text-[13px] font-bold text-white tabular-nums">{u.generationCount}</p>
                    <p className="text-[10px] text-white/30">{fmtCredits(u.charactersUsed)} ch</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    {isDeleting ? (
                      <>
                        <button onClick={() => deleteMutation.mutate(u.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/30 transition-colors">
                          <Check size={10} /> Confirm
                        </button>
                        <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"><X size={12} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => isManaging ? setManagingId(null) : startManage(u)} title="Manage"
                          className={cn("p-2 rounded-lg transition-colors", isManaging ? "bg-primary/20 text-primary" : "text-white/40 hover:text-primary hover:bg-primary/10")}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => patchMutation.mutate({ id: u.id, extendDays: 30 })} disabled={patchMutation.isPending} title="Extend +30 days"
                          className="flex items-center gap-1 px-2 py-2 rounded-lg text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-bold transition-colors">
                          <CalendarPlus size={13} /> 30d
                        </button>
                        <button onClick={() => patchMutation.mutate({ id: u.id, status: blocked ? "active" : "blocked" })} disabled={patchMutation.isPending}
                          title={blocked ? "Unblock" : "Block"}
                          className={cn("p-2 rounded-lg transition-colors", blocked ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-amber-400 hover:bg-amber-500/10")}>
                          {blocked ? <ShieldCheck size={14} /> : <Ban size={14} />}
                        </button>
                        <button onClick={() => setDeletingId(u.id)} title="Delete"
                          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Manage panel */}
                {isManaging && (
                  <div className="px-5 pb-5 pt-1">
                    <div className="bg-[#0f1117] border border-white/10 rounded-xl p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Name</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white focus:outline-none focus:border-primary/50" />
                        <button onClick={() => patchMutation.mutate({ id: u.id, name: editName })} disabled={patchMutation.isPending}
                          className="text-[11px] font-bold text-primary hover:underline">Save name</button>
                      </div>

                      {/* Plan */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Plan</label>
                        <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
                          className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white focus:outline-none focus:border-primary/50">
                          {PLANS.map(p => <option key={p.value} value={p.value}>{p.label} · {fmtCredits(p.credits)}</option>)}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => patchMutation.mutate({ id: u.id, plan: editPlan })} disabled={patchMutation.isPending}
                            className="text-[11px] font-bold text-primary hover:underline">Set plan</button>
                          <button onClick={() => patchMutation.mutate({ id: u.id, plan: editPlan, applyPlanCredits: true })} disabled={patchMutation.isPending}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline">
                            <Sparkles size={11} /> Set + grant credits
                          </button>
                        </div>
                      </div>

                      {/* Credits */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credits · {u.credits.toLocaleString()}</label>
                        <div className="flex items-center gap-1.5">
                          <Coins size={13} className="text-amber-400 shrink-0" />
                          <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="amount"
                            className="w-full bg-[#161b22] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white focus:outline-none focus:border-primary/50" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => { const n = parseInt(creditAmount); if (Number.isFinite(n)) patchMutation.mutate({ id: u.id, creditsDelta: Math.abs(n) }); }}
                            disabled={patchMutation.isPending || !creditAmount}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20"><Plus size={11} /> Add</button>
                          <button onClick={() => { const n = parseInt(creditAmount); if (Number.isFinite(n)) patchMutation.mutate({ id: u.id, creditsDelta: -Math.abs(n) }); }}
                            disabled={patchMutation.isPending || !creditAmount}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-[11px] font-bold hover:bg-red-500/20"><Minus size={11} /> Deduct</button>
                          <button onClick={() => { const n = parseInt(creditAmount); if (Number.isFinite(n)) patchMutation.mutate({ id: u.id, credits: Math.abs(n) }); }}
                            disabled={patchMutation.isPending || !creditAmount}
                            className="px-2 py-1 rounded-md bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10">Set</button>
                        </div>
                      </div>

                      {/* Expiry & status */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Expiry · {exp.none ? "none" : exp.sub}</label>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => patchMutation.mutate({ id: u.id, extendDays: 30 })} disabled={patchMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20"><CalendarPlus size={11} /> +30d</button>
                          <button onClick={() => patchMutation.mutate({ id: u.id, extendDays: 7 })} disabled={patchMutation.isPending}
                            className="px-2 py-1 rounded-md bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10">+7d</button>
                          <button onClick={() => patchMutation.mutate({ id: u.id, planExpiresAt: null })} disabled={patchMutation.isPending}
                            className="px-2 py-1 rounded-md bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10">Clear</button>
                        </div>
                        <button onClick={() => patchMutation.mutate({ id: u.id, status: blocked ? "active" : "blocked" })} disabled={patchMutation.isPending}
                          className={cn("flex items-center gap-1 text-[11px] font-bold mt-1", blocked ? "text-emerald-400 hover:underline" : "text-amber-400 hover:underline")}>
                          {blocked ? <><ShieldCheck size={12} /> Unblock account</> : <><Ban size={12} /> Block account</>}
                        </button>
                      </div>
                    </div>
                    {patchMutation.isError && (
                      <p className="text-[11px] text-red-400 mt-2">{(patchMutation.error as Error)?.message}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
