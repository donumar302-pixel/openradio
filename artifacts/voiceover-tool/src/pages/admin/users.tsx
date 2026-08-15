import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, RefreshCw, Trash2, Edit2, Check, X, CalendarPlus,
  Ban, ShieldCheck, Coins, Plus, Minus, Sparkles, KeyRound,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
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
  status: string; isAdmin: boolean; createdAt: string; signupIp: string | null;
  generationCount: number; charactersUsed: number;
};

type UsersEnvelope = {
  total: number; page: number; pageSize: number; users: AdminUser[];
};

const PAGE_SIZE = 25;

export default function AdminUsers() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [managingId, setManagingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<"suspend" | "unsuspend" | "delete" | null>(null);

  // manage-panel form state
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState("free");
  const [creditAmount, setCreditAmount] = useState("");

  const qc = useQueryClient();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (planFilter) params.set("plan", planFilter);
  if (statusFilter) params.set("status", statusFilter);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, refetch, isFetching } = useQuery<UsersEnvelope>({
    queryKey: ["admin-users", search, planFilter, statusFilter, page],
    queryFn: () => fetch(`/api/admin/users?${params.toString()}`).then(r => r.json()),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, any>) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeletingId(null); },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: "suspend" | "unsuspend" | "delete" }) =>
      fetch(`/api/admin/users/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setSelected(new Set()); setBulkConfirm(null); },
  });

  const startManage = (u: AdminUser) => {
    setManagingId(u.id);
    setEditName(u.name);
    setEditPlan(u.plan ?? "free");
    setCreditAmount("");
    setDeletingId(null);
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = users.length > 0 && users.every(u => selected.has(u.id));
  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) users.forEach(u => next.delete(u.id));
      else users.forEach(u => next.add(u.id));
      return next;
    });
  };

  const handleResetPassword = (u: AdminUser) => {
    const pw = window.prompt(`New password for ${u.name} (min 6 chars):`);
    if (pw == null) return;
    if (pw.length < 6) { window.alert("Password must be at least 6 characters."); return; }
    resetPwMutation.mutate({ id: u.id, password: pw });
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Users</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{total} registered accounts</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-[#161b22] border border-white/5 rounded-xl text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
          />
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-[#161b22] border border-white/5 rounded-xl text-[13px] text-white focus:outline-none focus:border-primary/50">
          <option value="">All plans</option>
          {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-[#161b22] border border-white/5 rounded-xl text-[13px] text-white focus:outline-none focus:border-primary/50">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-[#161b22] border border-primary/20 rounded-xl px-4 py-3">
          <span className="text-[12px] font-bold text-white">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            {bulkConfirm ? (
              <>
                <span className="text-[12px] font-bold text-amber-400">
                  Confirm {bulkConfirm} for {selected.size} user(s)?
                </span>
                <button
                  onClick={() => bulkMutation.mutate({ ids: Array.from(selected), action: bulkConfirm })}
                  disabled={bulkMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/30">
                  <Check size={11} /> {bulkMutation.isPending ? "..." : "Confirm"}
                </button>
                <button onClick={() => setBulkConfirm(null)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X size={13} /></button>
              </>
            ) : (
              <>
                <button onClick={() => setBulkConfirm("suspend")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-[11px] font-bold hover:bg-amber-500/20">
                  <Ban size={11} /> Suspend
                </button>
                <button onClick={() => setBulkConfirm("unsuspend")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20">
                  <ShieldCheck size={11} /> Unsuspend
                </button>
                <button onClick={() => setBulkConfirm("delete")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-bold hover:bg-red-500/20">
                  <Trash2 size={11} /> Delete
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X size={13} /></button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[920px]">
        <div className="grid grid-cols-[36px_1.4fr_90px_110px_120px_90px_240px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span className="flex items-center">
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
          </span>
          <span>User</span>
          <span>Plan</span>
          <span>Credits</span>
          <span>Expiry</span>
          <span>Gens</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">
            {search || planFilter || statusFilter ? "No users match filter" : "No users yet"}
          </div>
        ) : (
          users.map((u) => {
            const color = avatarColors[u.id % avatarColors.length];
            const isManaging = managingId === u.id;
            const isDeleting = deletingId === u.id;
            const exp = expiryInfo(u.planExpiresAt);
            const blocked = u.status === "blocked";
            const isSelected = selected.has(u.id);

            return (
              <div key={u.id} className={cn("border-b border-white/5 transition-colors", isManaging ? "bg-white/[0.04]" : isSelected ? "bg-primary/[0.04]" : "hover:bg-white/[0.02]")}>
                {/* Row */}
                <div className="grid grid-cols-[36px_1.4fr_90px_110px_120px_90px_240px] px-5 py-3.5 items-center">
                  {/* Checkbox */}
                  <div className="flex items-center">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(u.id)}
                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" />
                  </div>

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
                      {u.signupIp && <span className="text-[9px] text-white/20 truncate block font-mono">IP {u.signupIp}</span>}
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
                        <button onClick={() => handleResetPassword(u)} disabled={resetPwMutation.isPending} title="Reset password"
                          className="p-2 rounded-lg text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                          <KeyRound size={14} />
                        </button>
                        <button onClick={() => patchMutation.mutate({ id: u.id, status: blocked ? "active" : "blocked" })} disabled={patchMutation.isPending}
                          title={blocked ? "Unsuspend" : "Suspend"}
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
                          {blocked ? <><ShieldCheck size={12} /> Unsuspend account</> : <><Ban size={12} /> Suspend account</>}
                        </button>
                        <button onClick={() => handleResetPassword(u)} disabled={resetPwMutation.isPending}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:underline mt-1">
                          <KeyRound size={12} /> Reset password
                        </button>
                      </div>
                    </div>
                    {patchMutation.isError && (
                      <p className="text-[11px] text-red-400 mt-2">{(patchMutation.error as Error)?.message}</p>
                    )}
                    {resetPwMutation.isSuccess && (
                      <p className="text-[11px] text-emerald-400 mt-2">Password reset successfully.</p>
                    )}
                    {resetPwMutation.isError && (
                      <p className="text-[11px] text-red-400 mt-2">{(resetPwMutation.error as Error)?.message}</p>
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-white/40">
          Page {page} of {totalPages} · {total} users
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-[12px] font-bold hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={13} /> Prev
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-[12px] font-bold hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
