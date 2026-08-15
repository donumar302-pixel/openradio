import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert, RefreshCw, ChevronDown, ChevronRight, Globe, ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = {
  free: "text-white/50",
  starter: "text-blue-400",
  pro: "text-violet-400",
  enterprise: "text-amber-400",
};

type AbuseUser = {
  id: number; name: string; email: string; plan: string; status: string; createdAt: string;
};

type AbuseGroup = { ip: string; count: number; users: AbuseUser[] };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminAbuse() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: groups = [], isLoading, refetch, isFetching } = useQuery<AbuseGroup[]>({
    queryKey: ["admin-abuse"],
    queryFn: () => fetch("/api/admin/abuse").then(r => r.json()),
  });

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Abuse Detection</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{groups.length} suspicious IP groups</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="bg-[#161b22] border border-white/5 rounded-2xl py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck size={22} className="text-emerald-400" />
          </div>
          <p className="text-[14px] font-bold text-white">No suspicious signups found</p>
          <p className="text-[12px] text-white/40">No IP addresses are shared across multiple accounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const isExpanded = expanded === g.ip;
            return (
              <div key={g.ip} className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : g.ip)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left">
                  <span className="text-white/30">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <ShieldAlert size={16} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} className="text-white/30 shrink-0" />
                      <span className="text-[14px] font-mono font-bold text-white truncate">{g.ip}</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">Shared across {g.count} accounts</p>
                  </div>
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 shrink-0">
                    {g.count} accounts
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/5">
                    <div className="grid grid-cols-[1.4fr_90px_90px_110px] px-5 py-2.5 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
                      <span>User</span>
                      <span>Plan</span>
                      <span>Status</span>
                      <span className="text-right">Signed up</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {g.users.map(u => (
                        <div key={u.id} className="grid grid-cols-[1.4fr_90px_90px_110px] px-5 py-3 items-center">
                          <div className="min-w-0 pr-3">
                            <p className="text-[13px] font-semibold text-white truncate">{u.name}</p>
                            <p className="text-[11px] text-white/40 truncate">{u.email}</p>
                          </div>
                          <span className={cn("text-[11px] font-bold uppercase", PLAN_COLORS[u.plan] ?? "text-white/50")}>{u.plan}</span>
                          <span className={cn("text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded w-fit",
                            u.status === "blocked" ? "bg-red-500/15 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                            {u.status === "blocked" ? "Blocked" : "Active"}
                          </span>
                          <span className="text-[11px] text-white/30 text-right">{fmtDate(u.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
