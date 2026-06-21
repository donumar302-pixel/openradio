import { useQuery } from "@tanstack/react-query";
import { BarChart2, Mic2, Hash, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminAnalytics() {
  const { data: stats } = useQuery<any>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then(r => r.json()),
  });
  const { data: rows = [] } = useQuery<any[]>({
    queryKey: ["admin-generations"],
    queryFn: () => fetch("/api/admin/generations").then(r => r.json()),
  });

  // Count by voice
  const byVoice: Record<string, number> = {};
  for (const g of rows) {
    byVoice[g.voiceName] = (byVoice[g.voiceName] ?? 0) + 1;
  }
  const topVoices = Object.entries(byVoice).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCount = topVoices[0]?.[1] ?? 1;

  // Count by day (last 7 days)
  const dayMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    dayMap[d.toLocaleDateString("en-US", { weekday: "short" })] = 0;
  }
  for (const g of rows) {
    const d = new Date(g.createdAt);
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff < 7) {
      const key = d.toLocaleDateString("en-US", { weekday: "short" });
      dayMap[key] = (dayMap[key] ?? 0) + 1;
    }
  }
  const days = Object.entries(dayMap);
  const maxDay = Math.max(1, ...days.map(d => d[1]));

  const metricCards = [
    { label: "Total Generations", value: stats?.totalGenerations ?? 0, icon: Mic2, color: "text-blue-400" },
    { label: "Characters Used", value: (stats?.totalCharacters ?? 0).toLocaleString(), icon: Hash, color: "text-violet-400" },
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="px-6 py-6 space-y-5">
      <div>
        <h1 className="text-[22px] font-black text-white">Analytics</h1>
        <p className="text-[13px] text-white/40 mt-0.5">Platform usage overview</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        {metricCards.map(c => (
          <div key={c.label} className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <c.icon size={14} className={c.color} />
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">{c.label}</p>
            </div>
            <p className="text-3xl font-black text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last 7 days */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={14} className="text-primary" />
            <p className="text-[13px] font-bold text-white">Last 7 Days</p>
          </div>
          <div className="flex items-end gap-2 h-32">
            {days.map(([day, cnt]) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                <p className="text-[10px] text-white/30 font-bold">{cnt}</p>
                <div className="w-full rounded-t-lg bg-primary/20 hover:bg-primary/40 transition-colors" style={{ height: `${Math.max(4, (cnt / maxDay) * 96)}px` }} />
                <p className="text-[9px] text-white/20 font-bold">{day}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top voices */}
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Mic2 size={14} className="text-blue-400" />
            <p className="text-[13px] font-bold text-white">Top Voices</p>
          </div>
          <div className="space-y-3">
            {topVoices.length === 0 ? (
              <p className="text-[12px] text-white/20 text-center py-6">No data yet</p>
            ) : topVoices.map(([name, cnt]) => (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-white/70 truncate">{name}</p>
                  <p className="text-[11px] text-white/30 font-mono shrink-0 ml-2">{cnt}</p>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${(cnt / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
