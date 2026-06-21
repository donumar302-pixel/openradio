import { useQuery } from "@tanstack/react-query";
import { Mic2, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

export default function AdminGenerations() {
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["admin-generations"],
    queryFn: () => fetch("/api/admin/generations").then(r => r.json()),
  });

  const filtered = rows.filter((g: any) =>
    g.text?.toLowerCase().includes(search.toLowerCase()) ||
    g.voiceName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Generations</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{rows.length} total audio generations</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search text or voice name..."
          className="w-full max-w-sm pl-9 pr-4 py-2.5 bg-[#161b22] border border-white/5 rounded-xl text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_80px_120px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>Text</span>
          <span>Voice</span>
          <span className="text-right">Chars</span>
          <span className="text-right">Date</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">
            {search ? "No results" : "No generations yet"}
          </div>
        ) : (
          filtered.map((g: any) => (
            <div key={g.id} className="grid grid-cols-[1fr_140px_80px_120px] px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] items-center transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mic2 size={12} className="text-blue-400/50 shrink-0" />
                <p className="text-[12px] text-white/70 truncate">{g.text}</p>
              </div>
              <p className="text-[12px] text-white/40 truncate">{g.voiceName}</p>
              <p className="text-[12px] text-white/30 font-mono text-right">{g.characterCount}</p>
              <p className="text-[11px] text-white/20 text-right">
                {new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
