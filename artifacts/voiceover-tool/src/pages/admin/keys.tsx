import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, Edit2, Check, X, RotateCcw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { value: "elevenlabs", label: "ElevenLabs", color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: "minimax", label: "Fire TTS", color: "text-violet-400", bg: "bg-violet-500/10" },
];

function ProviderBadge({ provider }: { provider: string }) {
  const p = PROVIDERS.find(p => p.value === provider) ?? PROVIDERS[0];
  return (
    <span className={cn("text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full", p.color, p.bg)}>
      {p.label}
    </span>
  );
}

function CreditBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-[11px] text-white/20">Unlimited</span>;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30">{used.toLocaleString()} / {limit.toLocaleString()}</span>
        <span className={cn("text-[10px] font-bold", pct >= 90 ? "text-red-400" : pct >= 70 ? "text-amber-400" : "text-green-400")}>{pct}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden w-24">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type NewKeyForm = { label: string; key: string; provider: string; creditLimit: string };

export default function AdminKeys() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<NewKeyForm>({ label: "", key: "", provider: "elevenlabs", creditLimit: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editLimit, setEditLimit] = useState("");

  const { data: keys = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["admin-keys"],
    queryFn: () => fetch("/api/admin/keys").then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => fetch("/api/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-keys"] }); setShowAdd(false); setForm({ label: "", key: "", provider: "elevenlabs", creditLimit: "" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => fetch(`/api/admin/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-keys"] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-keys"] }),
  });

  const resetCredits = (id: number) => {
    updateMutation.mutate({ id, creditsUsed: 0 });
  };

  const elKeys = keys.filter((k: any) => k.provider === "elevenlabs");
  const mmKeys = keys.filter((k: any) => k.provider === "minimax");

  const startEdit = (k: any) => {
    setEditingId(k.id);
    setEditLabel(k.label);
    setEditLimit(k.creditLimit != null ? String(k.creditLimit) : "");
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">API Keys</h1>
          <p className="text-[13px] text-white/40 mt-0.5">
            {elKeys.length} ElevenLabs · {mmKeys.length} Fire TTS · auto-rotation enabled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/5 transition-all">
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-[12px] font-bold transition-all"
          >
            <Plus size={13} />
            Add Key
          </button>
        </div>
      </div>

      {/* Add Key Form */}
      {showAdd && (
        <div className="bg-[#161b22] border border-primary/20 rounded-2xl p-5 space-y-4">
          <p className="text-[13px] font-bold text-white">Add New API Key</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Provider */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Provider</label>
              <div className="flex gap-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setForm(f => ({ ...f, provider: p.value }))}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all",
                      form.provider === p.value
                        ? cn("border-primary/40 bg-primary/10", p.color)
                        : "border-white/5 bg-white/3 text-white/30 hover:text-white/60"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Label */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Label</label>
              <input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Account 1"
                className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
              />
            </div>
            {/* Credit Limit */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Credit Limit <span className="text-white/20 normal-case font-normal">(optional)</span></label>
              <input
                value={form.creditLimit}
                onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
                placeholder="e.g. 10000 (chars/credits)"
                type="number"
                className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
              />
            </div>
            {/* API Key */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                {form.provider === "minimax" ? "MiniMax API Key" : "ElevenLabs API Key"}
              </label>
              <input
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                placeholder={form.provider === "minimax" ? "Your MiniMax API key..." : "sk-..."}
                type="password"
                className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => addMutation.mutate({
                label: form.label, key: form.key, provider: form.provider,
                creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
              })}
              disabled={!form.label || !form.key || addMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              <Check size={12} /> {addMutation.isPending ? "Saving..." : "Save Key"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-[12px] font-bold text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rotation info */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
        <RotateCcw size={13} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[12px] text-white/40">
          <span className="text-blue-400 font-bold">Auto-rotation active —</span> when a key reaches its credit limit, the next active key is used automatically. Keys rotate per-provider (ElevenLabs keys rotate with ElevenLabs, Fire TTS with Fire TTS).
        </p>
      </div>

      {/* Keys table */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[700px]">
        <div className="grid grid-cols-[1fr_110px_120px_90px_130px_70px] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>Label / Key</span>
          <span>Provider</span>
          <span>Status</span>
          <span>Uses</span>
          <span>Credits Used</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Key size={20} className="text-primary" />
            </div>
            <p className="text-[13px] font-semibold text-white/40">No API keys yet</p>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold">
              <Plus size={13} /> Add First Key
            </button>
          </div>
        ) : (
          keys.map((k: any) => {
            const isEditing = editingId === k.id;
            const isExhausted = k.creditLimit != null && k.creditsUsed >= k.creditLimit;
            return (
              <div key={k.id} className={cn(
                "grid grid-cols-[1fr_110px_120px_90px_130px_70px] px-5 py-4 border-b border-white/5 items-center transition-colors",
                isEditing ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
              )}>
                {/* Label / key */}
                <div className="min-w-0 pr-2">
                  {isEditing ? (
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1 text-[13px] text-white focus:outline-none focus:border-primary/50 w-full"
                    />
                  ) : (
                    <p className="text-[13px] font-semibold text-white truncate">{k.label}</p>
                  )}
                  <p className="text-[10px] text-white/25 font-mono mt-0.5">{k.keyPreview}</p>
                  {isExhausted && (
                    <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">LIMIT REACHED</span>
                  )}
                </div>

                {/* Provider */}
                <ProviderBadge provider={k.provider} />

                {/* Status */}
                <button
                  onClick={() => updateMutation.mutate({ id: k.id, isActive: !k.isActive })}
                  className="flex items-center gap-1.5 w-fit"
                >
                  {k.isActive
                    ? <CheckCircle2 size={14} className="text-green-400" />
                    : <XCircle size={14} className="text-white/20" />}
                  <span className={cn("text-[11px] font-bold", k.isActive ? "text-green-400" : "text-white/20")}>
                    {k.isActive ? "Active" : "Inactive"}
                  </span>
                </button>

                {/* Usage count */}
                <span className="text-[12px] text-white/40 font-mono">{k.usageCount}</span>

                {/* Credits */}
                <div>
                  {isEditing ? (
                    <input
                      value={editLimit}
                      onChange={e => setEditLimit(e.target.value)}
                      placeholder="Unlimited"
                      type="number"
                      className="bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-primary/50 w-24"
                    />
                  ) : (
                    <CreditBar used={k.creditsUsed ?? 0} limit={k.creditLimit} />
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 justify-end">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => updateMutation.mutate({ id: k.id, label: editLabel, creditLimit: editLimit || "" })}
                        className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors">
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => resetCredits(k.id)} title="Reset credits used" className="p-1.5 rounded-lg text-white/20 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <RotateCcw size={11} />
                      </button>
                      <button onClick={() => startEdit(k)} className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete "${k.label}"?`)) deleteMutation.mutate(k.id); }}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
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
      </div>
    </div>
  );
}
