import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, RefreshCw, Calendar, Trash2, Edit2, Check, X, Crown, Zap, Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLANS = [
  { value: "free", label: "Free", color: "text-white/40", bg: "bg-white/5" },
  { value: "starter", label: "Starter", color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: "pro", label: "Pro", color: "text-violet-400", bg: "bg-violet-500/10" },
  { value: "enterprise", label: "Enterprise", color: "text-amber-400", bg: "bg-amber-500/10" },
];

function PlanBadge({ plan }: { plan: string }) {
  const p = PLANS.find(p => p.value === plan) ?? PLANS[0];
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", p.color, p.bg)}>
      {p.label}
    </span>
  );
}

const avatarColors = ["text-primary", "text-blue-400", "text-violet-400", "text-green-400", "text-amber-400", "text-pink-400"];

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState("free");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const qc = useQueryClient();

  const { data: users = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, plan }: { id: number; name: string; plan: string }) =>
      fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, plan }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setDeletingId(null); },
  });

  const filtered = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (u: any) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditPlan(u.plan ?? "free");
  };

  const planCounts = PLANS.map(p => ({
    ...p,
    count: users.filter((u: any) => (u.plan ?? "free") === p.value).length,
  }));

  return (
    <div className="px-6 py-6 space-y-5">
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
      <div className="grid grid-cols-4 gap-3">
        {planCounts.map(p => (
          <div key={p.value} className="bg-[#161b22] border border-white/5 rounded-xl p-4">
            <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", p.color)}>{p.label}</p>
            <p className="text-2xl font-black text-white">{p.count}</p>
            <p className="text-[10px] text-white/20 mt-0.5">users</p>
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
        <div className="grid grid-cols-[40px_1fr_1fr_110px_130px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>#</span>
          <span>Name</span>
          <span>Email</span>
          <span>Plan</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">
            {search ? "No users match search" : "No users yet"}
          </div>
        ) : (
          filtered.map((u: any, i) => {
            const color = avatarColors[u.id % avatarColors.length];
            const isEditing = editingId === u.id;
            const isDeleting = deletingId === u.id;

            return (
              <div key={u.id} className={cn(
                "grid grid-cols-[40px_1fr_1fr_110px_130px] px-5 py-3.5 border-b border-white/5 items-center transition-colors",
                isEditing ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
              )}>
                <span className="text-[12px] text-white/20 font-mono">{i + 1}</span>

                {/* Name */}
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div className={cn("w-7 h-7 rounded-full bg-white/5 flex items-center justify-center font-black text-[11px] shrink-0", color)}>
                    {u.name?.slice(0, 1).toUpperCase()}
                  </div>
                  {isEditing ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none focus:border-primary/50 min-w-0"
                    />
                  ) : (
                    <span className="text-[13px] font-semibold text-white truncate">{u.name}</span>
                  )}
                </div>

                {/* Email */}
                <span className="text-[12px] text-white/40 truncate pr-3">{u.email}</span>

                {/* Plan */}
                {isEditing ? (
                  <select
                    value={editPlan}
                    onChange={e => setEditPlan(e.target.value)}
                    className="bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1 text-[12px] text-white focus:outline-none focus:border-primary/50"
                  >
                    {PLANS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                ) : (
                  <PlanBadge plan={u.plan ?? "free"} />
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 justify-end">
                  {isDeleting ? (
                    <>
                      <button
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/30 transition-colors"
                      >
                        <Check size={10} /> Confirm
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : isEditing ? (
                    <>
                      <button
                        onClick={() => updateMutation.mutate({ id: u.id, name: editName, plan: editPlan })}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary text-[11px] font-bold hover:bg-primary/30 transition-colors"
                      >
                        <Check size={10} /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(u)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingId(u.id)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
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
  );
}
