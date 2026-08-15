import { useQuery } from "@tanstack/react-query";
import { BarChart2, Mic2, TrendingUp, DollarSign, PieChart as PieIcon } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Analytics = {
  signupsDaily: { day: string; n: number }[];
  signupsMonthly: { month: string; n: number }[];
  generationsDaily: { day: string; n: number; chars: number }[];
  revenueMonthly: { month: string; usd: number }[];
  planDistribution: { plan: string; n: number }[];
};

const PLAN_PIE_COLORS: Record<string, string> = {
  free: "#8b93a1",
  starter: "#60a5fa",
  pro: "#a78bfa",
  enterprise: "#fbbf24",
};
const PIE_FALLBACK = ["#60a5fa", "#a78bfa", "#fbbf24", "#34d399", "#f472b6", "#8b93a1"];

const chartTheme = {
  grid: "rgba(255,255,255,0.05)",
  axis: "rgba(255,255,255,0.3)",
};

function tooltipStyle() {
  return {
    contentStyle: {
      background: "#0f1117",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      fontSize: 12,
    },
    labelStyle: { color: "rgba(255,255,255,0.6)", fontWeight: 700 },
    itemStyle: { color: "#fff" },
  };
}

function ChartCard({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={14} className={color} />
        <p className="text-[13px] font-bold text-white">{title}</p>
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["admin-analytics"],
    queryFn: () => fetch("/api/admin/analytics").then(r => r.json()),
  });

  const signupsDaily = data?.signupsDaily ?? [];
  const signupsMonthly = data?.signupsMonthly ?? [];
  const generationsDaily = data?.generationsDaily ?? [];
  const revenueMonthly = data?.revenueMonthly ?? [];
  const planDistribution = data?.planDistribution ?? [];

  const totalSignups = signupsDaily.reduce((a, d) => a + d.n, 0);
  const totalGens = generationsDaily.reduce((a, d) => a + d.n, 0);
  const totalRevenue = revenueMonthly.reduce((a, d) => a + d.usd, 0);

  const metricCards = [
    { label: "Signups (30d)", value: totalSignups, icon: TrendingUp, color: "text-primary" },
    { label: "Generations (30d)", value: totalGens.toLocaleString(), icon: Mic2, color: "text-blue-400" },
    { label: "Revenue (total)", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-400" },
  ];

  const tt = tooltipStyle();

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
            <p className="text-3xl font-black text-white">{isLoading ? "…" : c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily signups */}
        <ChartCard title="Daily Signups (30 days)" icon={TrendingUp} color="text-primary">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={signupsDaily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTheme.axis }} tickFormatter={(v: string) => v?.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} allowDecimals={false} />
              <Tooltip {...tt} />
              <Area type="monotone" dataKey="n" name="Signups" stroke="#818cf8" strokeWidth={2} fill="url(#gradSignups)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Monthly signups */}
        <ChartCard title="Monthly Signups" icon={BarChart2} color="text-blue-400">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={signupsMonthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartTheme.axis }} />
              <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} allowDecimals={false} />
              <Tooltip {...tt} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="n" name="Signups" fill="#60a5fa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Daily generations + characters */}
        <ChartCard title="Daily Generations & Characters" icon={Mic2} color="text-violet-400">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={generationsDaily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradChars" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartTheme.axis }} tickFormatter={(v: string) => v?.slice(5)} interval="preserveStartEnd" />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: chartTheme.axis }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: chartTheme.axis }} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="left" type="monotone" dataKey="n" name="Generations" stroke="#a78bfa" strokeWidth={2} fill="url(#gradGens)" />
              <Area yAxisId="right" type="monotone" dataKey="chars" name="Characters" stroke="#34d399" strokeWidth={2} fill="url(#gradChars)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Monthly revenue */}
        <ChartCard title="Monthly Revenue (USD)" icon={DollarSign} color="text-emerald-400">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueMonthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartTheme.axis }} />
              <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip {...tt} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v: any) => [`$${v}`, "Revenue"]} />
              <Bar dataKey="usd" name="Revenue" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Plan distribution pie */}
      <ChartCard title="Plan Distribution" icon={PieIcon} color="text-amber-400">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={planDistribution}
              dataKey="n"
              nameKey="plan"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={45}
              paddingAngle={2}
              label={(e: any) => `${e.plan} (${e.n})`}
              labelLine={false}
            >
              {planDistribution.map((entry, i) => (
                <Cell key={entry.plan} fill={PLAN_PIE_COLORS[entry.plan] ?? PIE_FALLBACK[i % PIE_FALLBACK.length]} stroke="#0f1117" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip {...tt} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
