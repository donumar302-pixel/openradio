import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Plus, Trash2, Check, X, ChevronDown, ChevronRight,
  Power, Coins,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Promo = {
  id: number; code: string; credits: number; maxRedemptions: number | null;
  redemptionCount: number; isActive: boolean; expiresAt: string | null; createdAt: string;
};

type Redemption = { id: number; userId: number; name: string; email: string; createdAt: string };

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RedemptionsList({ promoId }: { promoId: number }) {
  const { data: redemptions = [], isLoading } = useQuery<Redemption[]>({
    queryKey: ["admin-promo-redemptions", promoId],
    queryFn: () => fetch(`/api/admin/promos/${promoId}/redemptions`).then(r => r.json()),
  });

  if (isLoading) return <div className="px-5 py-4 text-[12px] text-white/20">Loading redemptions...</div>;
  if (redemptions.length === 0) return <div className="px-5 py-4 text-[12px] text-white/20">No redemptions yet</div>;

  return (
    <div className="divide-y divide-white/5">
      {redemptions.map(r => (
        <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-[10px] shrink-0">
            {r.name?.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white truncate">{r.name}</p>
            <p className="text-[11px] text-white/30 truncate">{r.email}</p>
          </div>
          <span className="text-[11px] text-white/30 shrink-0">{fmtDate(r.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPromos() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: promos = [], isLoading, refetch, isFetching } = useQuery<Promo[]>({
    queryKey: ["admin-promos"],
    queryFn: () => fetch("/api/admin/promos").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
      setCode(""); setCredits(""); setMaxRedemptions(""); setExpiresAt("");
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, any>) =>
      fetch(`/api/admin/promos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promos"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/promos/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-promos"] }); setDeletingId(null); },
  });

  const handleCreate = () => {
    const c = parseInt(credits);
    if (!code.trim() || !Number.isFinite(c)) return;
    const body: Record<string, any> = { code: code.trim(), credits: c };
    const mr = parseInt(maxRedemptions);
    if (Number.isFinite(mr)) body.maxRedemptions = mr;
    if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
    createMutation.mutate(body);
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Promo Codes</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{promos.length} codes</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Create form */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={14} className="text-primary" />
          <p className="text-[13px] font-bold text-white">Create Promo Code</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Code</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="WELCOME25"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credits</label>
            <input type="number" value={credits} onChange={e => setCredits(e.target.value)} placeholder="25000"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Max redemptions (optional)</label>
            <input type="number" value={maxRedemptions} onChange={e => setMaxRedemptions(e.target.value)} placeholder="unlimited"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Expiry (optional)</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2.5 py-2 text-[13px] text-white focus:outline-none focus:border-primary/50" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={handleCreate} disabled={createMutation.isPending || !code.trim() || !credits}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
            <Plus size={13} /> {createMutation.isPending ? "Creating..." : "Create Code"}
          </button>
          {createMutation.isError && <p className="text-[11px] text-red-400">{(createMutation.error as Error)?.message}</p>}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[720px]">
        <div className="grid grid-cols-[40px_1.2fr_110px_140px_100px_130px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span></span>
          <span>Code</span>
          <span>Credits</span>
          <span>Redemptions</span>
          <span>Expiry</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : promos.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">No promo codes yet</div>
        ) : (
          promos.map(p => {
            const isExpanded = expanded === p.id;
            const isDeleting = deletingId === p.id;
            return (
              <div key={p.id} className="border-b border-white/5">
                <div className={cn("grid grid-cols-[40px_1.2fr_110px_140px_100px_130px] px-5 py-3.5 items-center transition-colors", isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]")}>
                  <button onClick={() => setExpanded(isExpanded ? null : p.id)}
                    className="text-white/30 hover:text-white transition-colors">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-mono font-bold text-white truncate">{p.code}</span>
                      {!p.isActive && <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/40">Inactive</span>}
                    </div>
                    <span className="text-[10px] text-white/20">Created {fmtDate(p.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[13px] font-bold text-amber-400">
                    <Coins size={12} /> {p.credits.toLocaleString()}
                  </div>
                  <div className="text-[12px] text-white/70">
                    {p.redemptionCount}{p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : " / ∞"}
                  </div>
                  <div className="text-[12px] text-white/50">{fmtDate(p.expiresAt)}</div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {isDeleting ? (
                      <>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/30">
                          <Check size={10} /> Confirm
                        </button>
                        <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X size={12} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => patchMutation.mutate({ id: p.id, isActive: !p.isActive })} disabled={patchMutation.isPending}
                          title={p.isActive ? "Deactivate" : "Activate"}
                          className={cn("p-2 rounded-lg transition-colors", p.isActive ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20" : "text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10")}>
                          <Power size={14} />
                        </button>
                        <button onClick={() => setDeletingId(p.id)} title="Delete"
                          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-[#0f1117] border-t border-white/5">
                    <RedemptionsList promoId={p.id} />
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
