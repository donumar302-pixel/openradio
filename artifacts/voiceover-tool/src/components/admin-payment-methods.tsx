import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2, Edit2, GripVertical, Check, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaymentMethod {
  id: string;
  label: string;
  provider: string;
  accountTitle: string;
  accountNumber: string;
  iban?: string;
  instructions: string;
  logoUrl?: string;
  enabled: boolean;
}

export function AdminPaymentMethods({ methods: initialMethods }: { methods?: PaymentMethod[] }) {
  const qc = useQueryClient();
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods || []);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialMethods) setMethods(initialMethods);
  }, [initialMethods]);

  const saveMutation = useMutation({
    mutationFn: (value: PaymentMethod[]) =>
      fetch("/api/admin/settings/payment_methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save payment methods");
        }
        return r.json();
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      if (Array.isArray(data?.payment_methods)) {
        setMethods(data.payment_methods);
      } else if (Array.isArray(data)) {
        setMethods(data);
      }
      setEditingId(null);
    }
  });

  const handleAdd = () => {
    const newMethod: PaymentMethod = {
      id: Math.random().toString(36).substring(2, 11),
      label: "New Method",
      provider: "Bank Transfer",
      accountTitle: "",
      accountNumber: "",
      instructions: "Please transfer the amount and upload proof.",
      enabled: false,
    };
    const updated = [...methods, newMethod];
    setMethods(updated);
    setEditingId(newMethod.id);
  };

  const handleSave = () => {
    saveMutation.mutate(methods);
  };

  const updateMethod = (id: string, updates: Partial<PaymentMethod>) => {
    setMethods(methods.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const removeMethod = (id: string) => {
    setMethods(methods.filter(m => m.id !== id));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newMethods = [...methods];
    const temp = newMethods[index - 1];
    newMethods[index - 1] = newMethods[index];
    newMethods[index] = temp;
    setMethods(newMethods);
  };

  const moveDown = (index: number) => {
    if (index === methods.length - 1) return;
    const newMethods = [...methods];
    const temp = newMethods[index + 1];
    newMethods[index + 1] = newMethods[index];
    newMethods[index] = temp;
    setMethods(newMethods);
  };

  return (
    <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard size={14} className="text-orange-400" />
          <p className="text-[13px] font-bold text-white">Payment Methods</p>
        </div>
        <button 
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-[11px] font-bold transition-colors border border-white/10"
        >
          <Plus size={12} /> Add Method
        </button>
      </div>

      <div className="space-y-3">
        {methods.map((m, index) => {
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className="border border-white/5 bg-[#0f1117] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col gap-1 text-white/20">
                  <button onClick={() => moveUp(index)} disabled={index === 0} className="hover:text-white disabled:opacity-30"><GripVertical size={12} className="rotate-90" /></button>
                  <button onClick={() => moveDown(index)} disabled={index === methods.length - 1} className="hover:text-white disabled:opacity-30"><GripVertical size={12} className="rotate-90" /></button>
                </div>

                {m.logoUrl ? (
                  <img src={m.logoUrl} alt={m.label} className="w-8 h-8 rounded-md object-cover bg-white/5" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center text-white/20">
                    <ImageIcon size={14} />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-white">{m.label}</p>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full", m.enabled ? "bg-green-500/10 text-green-400" : "bg-white/10 text-white/40")}>
                        {m.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">{m.provider} &bull; {m.accountNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingId(isEditing ? null : m.id)} className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg">
                    {isEditing ? <X size={14} /> : <Edit2 size={14} />}
                  </button>
                  <button onClick={() => removeMethod(m.id)} className="p-1.5 text-red-400/60 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="p-4 border-t border-white/5 bg-[#161b22]/50 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Label</label>
                      <input value={m.label} onChange={e => updateMethod(m.id, { label: e.target.value })} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Provider (e.g. Bank, PayPal)</label>
                      <input value={m.provider} onChange={e => updateMethod(m.id, { provider: e.target.value })} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Account Title / Name</label>
                      <input value={m.accountTitle} onChange={e => updateMethod(m.id, { accountTitle: e.target.value })} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Account Number / Email</label>
                      <input value={m.accountNumber} onChange={e => updateMethod(m.id, { accountNumber: e.target.value })} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">IBAN / SWIFT (Optional)</label>
                      <input value={m.iban || ""} onChange={e => updateMethod(m.id, { iban: e.target.value })} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Logo URL (Optional)</label>
                      <input value={m.logoUrl || ""} onChange={e => updateMethod(m.id, { logoUrl: e.target.value })} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none" placeholder="https://..." />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Status</label>
                    <div className="pt-1">
                      <button onClick={() => updateMethod(m.id, { enabled: !m.enabled })} className={cn("relative w-11 h-6 rounded-full transition-colors", m.enabled ? "bg-orange-500" : "bg-white/10")}>
                        <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform", m.enabled && "translate-x-5")} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Instructions</label>
                    <textarea value={m.instructions} onChange={e => updateMethod(m.id, { instructions: e.target.value })} rows={2} className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white focus:border-orange-500/50 outline-none resize-none" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {methods.length === 0 && (
          <div className="text-center py-6 text-white/30 text-[12px]">No payment methods configured.</div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-end gap-3">
        {saveMutation.isSuccess && <span className="text-[11px] text-green-400">Saved successfully</span>}
        {saveMutation.isError && <span className="text-[11px] text-red-400">{(saveMutation.error as Error)?.message}</span>}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-[12px] font-bold transition-colors disabled:opacity-50"
        >
          <Check size={14} /> {saveMutation.isPending ? "Saving..." : "Save Methods"}
        </button>
      </div>
    </div>
  );
}
