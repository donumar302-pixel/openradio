import { useQuery } from "@tanstack/react-query";
import {
  Users, Mic2, Key, Hash, Copy, Activity,
  TrendingUp, RefreshCw, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({
  label, value, icon: Icon, accent, sub,
}: { label: string; value: string | number; icon: any; accent: string; sub?: string }) {
  return (
    <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">{label}</p>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", accent + "/15")}>
          <Icon size={15} className={accent} />
        </div>
      </div>
      <p className="text-3xl font-black text-white tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-white/30 font-semibold -mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: recentGen = [] } = useQuery<any[]>({
    queryKey: ["admin-generations"],
    queryFn: () => fetch("/api/admin/generations").then(r => r.json()),
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  const statCards = [
    { label: "Total Users",       value: stats?.totalUsers ?? 0,       icon: Users,    accent: "text-primary" },
    { label: "Total Generations", value: stats?.totalGenerations ?? 0, icon: Mic2,     accent: "text-blue-400" },
    { label: "Active API Keys",   value: `${stats?.activeKeys ?? 0} / ${stats?.totalKeys ?? 0}`, icon: Key, accent: "text-green-400" },
    { label: "Characters Used",   value: (stats?.totalCharacters ?? 0).toLocaleString(), icon: Hash, accent: "text-violet-400" },
    { label: "Voice Clones",      value: stats?.totalClones ?? 0,       icon: Copy,     accent: "text-amber-400" },
    { label: "System Status",     value: "Online",                      icon: Activity, accent: "text-green-400", sub: "All services running" },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">System Overview</h1>
          <p className="text-[13px] text-white/40 mt-0.5">Real-time platform statistics</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(c => (
          <StatCard key={c.label} label={c.label} value={isLoading ? "…" : c.value} icon={c.icon} accent={c.accent} sub={(c as any).sub} />
        ))}
      </div>

      {/* Two col: recent users + recent generations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary" />
              <p className="text-[13px] font-bold text-white">Recent Users</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{users.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {users.slice(0, 8).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-[11px] shrink-0">
                  {u.name?.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{u.name}</p>
                  <p className="text-[11px] text-white/30 truncate">{u.email}</p>
                </div>
                <p className="text-[10px] text-white/20 shrink-0">
                  {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-white/20">No users yet</div>
            )}
          </div>
        </div>

        {/* Recent Generations */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Mic2 size={14} className="text-blue-400" />
              <p className="text-[13px] font-bold text-white">Recent Generations</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/15 text-blue-400">{recentGen.length}</span>
          </div>
          <div className="divide-y divide-white/5">
            {recentGen.slice(0, 8).map((g: any) => (
              <div key={g.id} className="flex items-start gap-3 px-5 py-3">
                <Mic2 size={12} className="text-blue-400/50 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white/80 truncate">{g.text}</p>
                  <p className="text-[11px] text-white/30">{g.voiceName} · {g.characterCount} chars</p>
                </div>
                <p className="text-[10px] text-white/20 shrink-0 mt-0.5">
                  {new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
            {recentGen.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-white/20">No generations yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
