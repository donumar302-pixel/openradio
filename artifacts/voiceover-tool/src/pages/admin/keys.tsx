import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListApiKeys, getListApiKeysQueryKey,
  useUpdateApiKey, useDeleteApiKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Key, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AdminKeys() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: keys = [], isLoading, refetch, isFetching } = useListApiKeys({
    query: { queryKey: getListApiKeysQueryKey() },
  });

  const updateKey = useUpdateApiKey();
  const deleteKey = useDeleteApiKey();

  const toggle = (id: number, current: boolean) => {
    updateKey.mutate({ id, data: { isActive: !current } }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const del = (id: number, label: string) => {
    if (!confirm(`Delete "${label}"?`)) return;
    deleteKey.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Key deleted" });
        qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  return (
    <div className="px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">API Keys</h1>
          <p className="text-[13px] text-white/40 mt-0.5">{keys.length} keys configured</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          </button>
          <Link href="/admin/keys/new">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-[12px] font-bold transition-all">
              <Plus size={13} />
              Add Key
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_100px_80px_80px_50px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>Label / Preview</span>
          <span>Provider</span>
          <span>Status</span>
          <span className="text-right">Usage</span>
          <span className="text-right">Last Used</span>
          <span />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Key size={20} className="text-primary" />
            </div>
            <p className="text-[13px] font-semibold text-white/40">No API keys yet</p>
            <Link href="/admin/keys/new">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold">
                <Plus size={13} /> Add First Key
              </button>
            </Link>
          </div>
        ) : (
          keys.map((k: any) => (
            <div key={k.id} className="grid grid-cols-[1fr_120px_100px_80px_80px_50px] px-5 py-4 border-b border-white/5 hover:bg-white/[0.02] items-center transition-colors">
              <div>
                <p className="text-[13px] font-semibold text-white">{k.label}</p>
                <p className="text-[11px] text-white/30 font-mono mt-0.5">{k.keyPreview}</p>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full w-fit",
                k.provider === "minimax" ? "bg-violet-500/15 text-violet-400" : "bg-orange-500/15 text-orange-400"
              )}>
                {k.provider === "minimax" ? "Fire TTS" : "ElevenLabs"}
              </span>
              <button
                onClick={() => toggle(k.id, k.isActive)}
                className="flex items-center gap-1.5 w-fit"
              >
                {k.isActive
                  ? <CheckCircle2 size={14} className="text-green-400" />
                  : <XCircle size={14} className="text-white/20" />}
                <span className={cn("text-[11px] font-bold", k.isActive ? "text-green-400" : "text-white/20")}>
                  {k.isActive ? "Active" : "Inactive"}
                </span>
              </button>
              <span className="text-[12px] text-white/40 font-mono text-right">{k.usageCount}</span>
              <span className="text-[11px] text-white/20 text-right">
                {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}
              </span>
              <div className="flex justify-end">
                <button
                  onClick={() => del(k.id, k.label)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
