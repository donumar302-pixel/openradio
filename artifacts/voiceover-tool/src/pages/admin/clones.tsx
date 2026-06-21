import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";

export default function AdminClones() {
  const { data: rows = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["admin-clones"],
    queryFn: () => fetch("/api/admin/clones").then(r => r.json()),
  });

  return (
    <div className="px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Voice Clones</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{rows.length} cloned voices</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5">
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_200px_140px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>Name</span>
          <span>Voice ID</span>
          <span className="text-right">Created</span>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Copy size={20} className="text-amber-400" />
            </div>
            <p className="text-[13px] font-semibold text-white/30">No voice clones yet</p>
          </div>
        ) : (
          rows.map((c: any) => (
            <div key={c.id} className="grid grid-cols-[1fr_200px_140px] px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] items-center transition-colors">
              <div>
                <p className="text-[13px] font-semibold text-white">{c.name}</p>
                {c.description && <p className="text-[11px] text-white/30 mt-0.5">{c.description}</p>}
              </div>
              <p className="text-[11px] text-white/30 font-mono truncate">{c.voiceId}</p>
              <p className="text-[11px] text-white/20 text-right">
                {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
