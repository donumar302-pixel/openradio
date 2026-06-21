import { useQuery } from "@tanstack/react-query";
import { Users, Search, RefreshCw, Calendar } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users").then(r => r.json()),
  });

  const filtered = users.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const colors = ["text-primary", "text-blue-400", "text-violet-400", "text-green-400", "text-amber-400", "text-pink-400"];

  return (
    <div className="px-6 py-6 space-y-5">
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
        <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-0">
          {/* Header */}
          <div className="col-span-4 grid grid-cols-[48px_1fr_1fr_120px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
            <span>#</span>
            <span>Name</span>
            <span>Email</span>
            <span className="text-right">Joined</span>
          </div>

          {isLoading ? (
            <div className="col-span-4 py-12 text-center text-white/20 text-[13px]">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-4 py-12 text-center text-white/20 text-[13px]">
              {search ? "No users match search" : "No users yet"}
            </div>
          ) : (
            filtered.map((u: any, i) => {
              const color = colors[u.id % colors.length];
              return (
                <div key={u.id} className="col-span-4 grid grid-cols-[48px_1fr_1fr_120px] px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] items-center transition-colors">
                  <span className="text-[12px] text-white/20 font-mono">{i + 1}</span>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn("w-7 h-7 rounded-full bg-white/5 flex items-center justify-center font-black text-[11px] shrink-0", color)}>
                      {u.name?.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-[13px] font-semibold text-white truncate">{u.name}</span>
                  </div>
                  <span className="text-[12px] text-white/40 truncate">{u.email}</span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Calendar size={10} className="text-white/20" />
                    <span className="text-[11px] text-white/30">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
