import { useQuery } from "@tanstack/react-query";
import {
  Users, Mic2, Key, Hash, Copy, Activity,
  RefreshCw, ShoppingCart, Clock, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = {
  free: "text-white/50",
  starter: "text-blue-400",
  pro: "text-violet-400",
  enterprise: "text-amber-400",
};
const PLAN_BG: Record<string, string> = {
  free: "bg-white/5",
  starter: "bg-blue-500/10",
  pro: "bg-violet-500/10",
  enterprise: "bg-amber-500/10",
};

function StatCard({
  label, value, icon: Icon, accent, sub, href,
}: { label: string; value: string | number; icon: any; accent: string; sub?: string; href?: string }) {
  const inner = (
    <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
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
  return href ? <Link href={href}>{inner}</Link> : inner;
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

  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["admin-orders"],
    queryFn: () => fetch("/api/admin/orders").then(r => r.json()),
  });

  const planCounts: Record<string, number> = stats?.planCounts ?? {};
  const planKeys = ["free", "starter", "pro", "enterprise"];

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, accent: "text-primary", href: "/admin/users" },
    { label: "Total Generations", value: stats?.totalGenerations ?? 0, icon: Mic2, accent: "text-blue-400", href: "/admin/generations" },
    { label: "Active API Keys", value: `${stats?.activeKeys ?? 0} / ${stats?.totalKeys ?? 0}`, icon: Key, accent: "text-green-400", href: "/admin/keys" },
    { label: "Characters Used", value: (stats?.totalCharacters ?? 0).toLocaleString(), icon: Hash, accent: "text-violet-400" },
    { label: "Pending Orders", value: stats?.pendingOrders ?? 0, icon: Clock, accent: "text-amber-400", href: "/admin/orders" },
    { label: "System Status", value: "Online", icon: Activity, accent: "text-green-400", sub: "All services running" },
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
          <StatCard key={c.label} label={c.label} value={isLoading ? "…" : c.value}
            icon={c.icon} accent={c.accent} sub={(c as any).sub} href={(c as any).href} />
        ))}
      </div>

      {/* Plan distribution */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-primary" />
          <p className="text-[13px] font-bold text-white">Plan Distribution</p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary ml-auto">{users.length} total</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {planKeys.map(plan => {
            const cnt = planCounts[plan] ?? 0;
            const pct = users.length > 0 ? Math.round((cnt / users.length) * 100) : 0;
            return (
              <div key={plan} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", PLAN_COLORS[plan])}>{plan}</span>
                  <span className="text-[12px] font-black text-white">{cnt}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", PLAN_BG[plan])}
                    style={{ width: `${pct}%`, background: plan === "free" ? "rgba(255,255,255,0.15)" : undefined }}
                  />
                </div>
                <p className="text-[10px] text-white/20">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two col: recent users + orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary" />
              <p className="text-[13px] font-bold text-white">Recent Users</p>
            </div>
            <Link href="/admin/users">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 cursor-pointer">{users.length}</span>
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {users.slice(0, 6).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-[11px] shrink-0">
                  {u.name?.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{u.name}</p>
                  <p className="text-[11px] text-white/30 truncate">{u.email}</p>
                </div>
                <span className={cn("text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md", PLAN_BG[u.plan ?? "free"], PLAN_COLORS[u.plan ?? "free"])}>
                  {u.plan ?? "free"}
                </span>
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-white/20">No users yet</div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <ShoppingCart size={14} className="text-amber-400" />
              <p className="text-[13px] font-bold text-white">Recent Orders</p>
            </div>
            <Link href="/admin/orders">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 cursor-pointer">
                {(orders as any[]).filter((o: any) => o.status === "pending").length} pending
              </span>
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {(orders as any[]).slice(0, 6).map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5",
                  o.status === "approved" ? "bg-green-400" : o.status === "rejected" ? "bg-red-400" : "bg-amber-400"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white truncate">{o.userName}</p>
                  <p className="text-[11px] text-white/30">Requested <span className={cn("font-bold", PLAN_COLORS[o.plan])}>{o.plan}</span> plan</p>
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md",
                  o.status === "approved" ? "bg-green-500/10 text-green-400"
                    : o.status === "rejected" ? "bg-red-500/10 text-red-400"
                    : "bg-amber-500/10 text-amber-400"
                )}>
                  {o.status}
                </span>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-white/20">No orders yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
