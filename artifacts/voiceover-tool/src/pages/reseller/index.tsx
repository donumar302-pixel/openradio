import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Coins, Users, CalendarClock, Gift,
  Ban, ShieldCheck, Trash2, X, Check, LogOut, Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ResellerMe = {
  name: string;
  email: string;
  credits: number;
  expiresAt: string | null;
  userCount: number;
  creditsGiven: number;
};

type ResellerUser = {
  id: number;
  name: string;
  email: string;
  credits: number;
  creditsUsed: number;
  status: string;
  createdAt: string;
  expiresAt: string | null;
};

const CREDIT_QUICK = [
  { label: "10K", value: 10000 },
  { label: "50K", value: 50000 },
  { label: "100K", value: 100000 },
  { label: "500K", value: 500000 },
];

const EXPIRY_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "15 days", days: 15 },
  { label: "1 month", days: null as number | null }, // null days => 1 month
  { label: "No expiry", days: undefined as number | undefined },
];

function fmtDate(iso: string | null) {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isPast(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function oneMonthISO() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

// Max selectable custom date = 1 month from today (yyyy-mm-dd for <input type="date" max>)
function maxCustomDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Reusable expiry picker: presets + custom date (max 1 month). Value is ISO string or null.
function ExpiryPicker({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  const [customDate, setCustomDate] = useState(value ? new Date(value).toISOString().slice(0, 10) : "");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {EXPIRY_PRESETS.map(p => (
          <button key={p.label}
            onClick={() => {
              setCustomDate("");
              if (p.days === undefined) onChange(null);
              else if (p.days === null) onChange(oneMonthISO());
              else onChange(addDaysISO(p.days));
            }}
            className="px-2.5 py-1 rounded-md bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10">
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" value={customDate} max={maxCustomDate()}
        onChange={e => { setCustomDate(e.target.value); onChange(e.target.value ? new Date(e.target.value).toISOString() : null); }}
        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white focus:outline-none focus:border-primary/50" />
    </div>
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

function StatCard({ icon, label, value, sub, danger }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; danger?: boolean;
}) {
  return (
    <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-white/30 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className={cn("text-[26px] font-black leading-tight", danger ? "text-red-400" : "text-white")}>{value}</p>
      {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function AddUserCreditsModal({ user, onClose, onSubmit, error, pending }: {
  user: ResellerUser;
  onClose: () => void;
  onSubmit: (credits: number) => void;
  error?: string;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("");
  return (
    <ModalShell title={`Add credits · ${user.name}`} onClose={onClose}>
      <p className="text-[12px] text-white/40 mb-3">
        Current: <span className="text-amber-400 font-bold">{user.credits.toLocaleString()}</span>
      </p>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credits to add</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10000" autoFocus
          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {CREDIT_QUICK.map(p => (
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

function CreateUserModal({ onClose, onSubmit, error, pending }: {
  onClose: () => void;
  onSubmit: (body: Record<string, any>) => void;
  error?: string;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credits, setCredits] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const handleSubmit = () => {
    const c = parseInt(credits);
    if (!name.trim() || !email.trim() || !password || !Number.isFinite(c)) return;
    const body: Record<string, any> = { name: name.trim(), email: email.trim(), password, credits: c };
    if (expiresAt) body.expiresAt = expiresAt;
    onSubmit(body);
  };

  return (
    <ModalShell title="Create User" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Password</label>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 6 chars"
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credits</label>
          <input type="number" value={credits} onChange={e => setCredits(e.target.value)} placeholder="amount"
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          <div className="flex flex-wrap gap-2 mt-1">
            {CREDIT_QUICK.map(p => (
              <button key={p.value} onClick={() => setCredits(String(p.value))}
                className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold", credits === String(p.value) ? "bg-primary/20 text-primary" : "bg-white/5 text-white/60 hover:bg-white/10")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            Expiry · {fmtDate(expiresAt)}
          </label>
          <ExpiryPicker value={expiresAt} onChange={setExpiresAt} />
          <p className="text-[10px] text-white/25">Max 1 month from today.</p>
        </div>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSubmit}
            disabled={pending || !name.trim() || !email.trim() || !password || !credits}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
            <Plus size={13} /> {pending ? "Creating..." : "Create User"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-[12px] font-bold">Cancel</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ChangeExpiryModal({ user, onClose, onSubmit, error, pending }: {
  user: ResellerUser;
  onClose: () => void;
  onSubmit: (expiresAt: string | null) => void;
  error?: string;
  pending: boolean;
}) {
  const [expiresAt, setExpiresAt] = useState<string | null>(user.expiresAt);
  return (
    <ModalShell title={`Change expiry · ${user.name}`} onClose={onClose}>
      <p className="text-[12px] text-white/40 mb-3">
        Current: <span className={cn("font-bold", isPast(user.expiresAt) ? "text-red-400" : "text-white")}>{fmtDate(user.expiresAt)}</span>
      </p>
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          New expiry · {fmtDate(expiresAt)}
        </label>
        <ExpiryPicker value={expiresAt} onChange={setExpiresAt} />
        <p className="text-[10px] text-white/25">Max 1 month from today.</p>
      </div>
      {error && <p className="text-[11px] text-red-400 mt-3">{error}</p>}
      <div className="flex items-center gap-2 mt-4">
        <button onClick={() => onSubmit(expiresAt)} disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
          <Check size={13} /> {pending ? "Saving..." : "Save expiry"}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/40 hover:text-white text-[12px] font-bold">Cancel</button>
      </div>
    </ModalShell>
  );
}

export default function ResellerPanel() {
  const qc = useQueryClient();
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creditsFor, setCreditsFor] = useState<ResellerUser | null>(null);
  const [expiryFor, setExpiryFor] = useState<ResellerUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: me, error: meError } = useQuery<ResellerMe>({
    queryKey: ["reseller-me"],
    queryFn: async () => {
      const r = await fetch("/api/reseller/me", { credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw Object.assign(new Error(body?.error ?? "Access denied"), { status: r.status, expired: !!body?.expired });
      }
      return r.json();
    },
  });

  const { data: users = [], isLoading, refetch, isFetching } = useQuery<ResellerUser[]>({
    queryKey: ["reseller-users"],
    queryFn: async () => {
      const r = await fetch("/api/reseller/users", { credentials: "include" });
      if (!r.ok) throw new Error("Access denied");
      return r.json();
    },
    enabled: !meError,
  });

  // Client-side search: the reseller's full user list is already loaded.
  const q = search.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : users;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["reseller-me"] });
    qc.invalidateQueries({ queryKey: ["reseller-users"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      fetch("/api/reseller/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { refreshAll(); setCreatingOpen(false); },
  });

  const creditsMutation = useMutation({
    mutationFn: ({ id, credits }: { id: number; credits: number }) =>
      fetch(`/api/reseller/users/${id}/credits`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { refreshAll(); setCreditsFor(null); },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, any>) =>
      fetch(`/api/reseller/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => refreshAll(),
  });

  const expiryMutation = useMutation({
    mutationFn: ({ id, expiresAt }: { id: number; expiresAt: string | null }) =>
      fetch(`/api/reseller/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => { refreshAll(); setExpiryFor(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/reseller/users/${id}`, { method: "DELETE", credentials: "include" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r; }),
    onSuccess: () => { refreshAll(); setDeletingId(null); },
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // Stay in the reseller area — logging out of the panel should land on the
    // reseller login page, not the main app's login.
    window.location.href = "/reseller";
  };

  const expired = isPast(me?.expiresAt ?? null);

  if (meError) {
    const err = meError as Error & { expired?: boolean };
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#161b22] border border-white/5 rounded-2xl p-8 text-center space-y-4">
          <p className="text-[26px] font-black">{err.expired ? "Account Expired" : "Access Denied"}</p>
          <p className="text-white/40 text-sm">
            {err.expired
              ? "Your reseller account has expired. Please contact the administrator to renew it."
              : err.message || "Your reseller access is not available. Please contact the administrator."}
          </p>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5 bg-[#0f1117]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-black text-[17px] text-white">OpenRadio</span>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 shrink-0">Reseller Panel</span>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 text-[12px] font-bold transition-all">
          <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5 max-w-7xl mx-auto">
        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Coins size={14} className="text-amber-400" />} label="Credits Left"
            value={(me?.credits ?? 0).toLocaleString()} sub="Available pool" />
          <StatCard icon={<CalendarClock size={14} />} label="Expiry"
            value={fmtDate(me?.expiresAt ?? null)} sub={expired ? "Expired" : undefined} danger={expired} />
          <StatCard icon={<Users size={14} />} label="My Users"
            value={(me?.userCount ?? 0).toLocaleString()} />
          <StatCard icon={<Gift size={14} className="text-emerald-400" />} label="Credits Given"
            value={(me?.creditsGiven ?? 0).toLocaleString()} sub="Total distributed" />
        </div>

        {/* Header + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-black text-white">My Users</h1>
            <p className="text-[13px] text-white/40 mt-0.5">{users.length} users</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none min-w-[140px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                data-testid="input-user-search"
                className="w-full sm:w-[220px] pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/5 text-[12px] font-semibold text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-all"
              />
            </div>
            <button onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5">
              <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => { createMutation.reset(); setCreatingOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 transition-all">
              <Plus size={13} /> Create User
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-[1.3fr_1.5fr_120px_120px_100px_130px_120px_280px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
                <span>Name</span>
                <span>Email</span>
                <span>Credits</span>
                <span>Used</span>
                <span>Status</span>
                <span>Expiry</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center text-white/20 text-[13px]">No users yet</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-white/20 text-[13px]">No users match "{search}"</div>
              ) : (
                filteredUsers.map(u => {
                  const blocked = u.status === "blocked";
                  const isDeleting = deletingId === u.id;
                  const userExpired = isPast(u.expiresAt);
                  return (
                    <div key={u.id} className="grid grid-cols-[1.3fr_1.5fr_120px_120px_100px_130px_120px_280px] px-5 py-3.5 items-center border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 pr-3">
                        <span className="text-[13px] font-semibold text-white truncate block">{u.name}</span>
                      </div>
                      <div className="min-w-0 pr-3">
                        <span className="text-[12px] text-white/50 truncate block">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[13px] font-bold text-amber-400">
                        <Coins size={12} /> {u.credits.toLocaleString()}
                      </div>
                      <div className="text-[12px] text-white/50 tabular-nums">{u.creditsUsed.toLocaleString()}</div>
                      <div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                          blocked ? "bg-red-500/15 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                          {blocked ? "Blocked" : "Active"}
                        </span>
                      </div>
                      <div className={cn("text-[12px] font-bold", !u.expiresAt ? "text-white/30" : userExpired ? "text-red-400" : "text-white/70")}>
                        {fmtDate(u.expiresAt)}
                      </div>
                      <div className="text-[11px] text-white/40">
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        {isDeleting ? (
                          <>
                            <button onClick={() => deleteMutation.mutate(u.id)} disabled={deleteMutation.isPending}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/30">
                              <Check size={10} /> Confirm
                            </button>
                            <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X size={12} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { creditsMutation.reset(); setCreditsFor(u); }} title="Add credits"
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors">
                              <Coins size={12} /> Credits
                            </button>
                            <button onClick={() => { expiryMutation.reset(); setExpiryFor(u); }} title="Change expiry"
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 text-white/60 text-[11px] font-bold hover:bg-white/10 transition-colors">
                              <CalendarClock size={12} /> Expiry
                            </button>
                            <button onClick={() => patchMutation.mutate({ id: u.id, status: blocked ? "active" : "blocked" })}
                              disabled={patchMutation.isPending} title={blocked ? "Unsuspend" : "Suspend"}
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {creatingOpen && (
        <CreateUserModal
          onClose={() => setCreatingOpen(false)}
          onSubmit={body => createMutation.mutate(body)}
          error={createMutation.isError ? (createMutation.error as Error)?.message : undefined}
          pending={createMutation.isPending}
        />
      )}
      {creditsFor && (
        <AddUserCreditsModal
          user={creditsFor}
          onClose={() => setCreditsFor(null)}
          onSubmit={credits => creditsMutation.mutate({ id: creditsFor.id, credits })}
          error={creditsMutation.isError ? (creditsMutation.error as Error)?.message : undefined}
          pending={creditsMutation.isPending}
        />
      )}
      {expiryFor && (
        <ChangeExpiryModal
          user={expiryFor}
          onClose={() => setExpiryFor(null)}
          onSubmit={expiresAt => expiryMutation.mutate({ id: expiryFor.id, expiresAt })}
          error={expiryMutation.isError ? (expiryMutation.error as Error)?.message : undefined}
          pending={expiryMutation.isPending}
        />
      )}
    </div>
  );
}
