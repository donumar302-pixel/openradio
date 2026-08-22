import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Check, X, Search, Clock, CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp, ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PLANS = [
  { value: "starter", label: "Starter", color: "text-blue-400" },
  { value: "pro", label: "Pro", color: "text-violet-400" },
  { value: "max", label: "Pro Max", color: "text-amber-400" },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock },
  approved: { label: "Approved", color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full", s.color, s.bg)}>
      <Icon size={9} /> {s.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const p = PLANS.find(p => p.value === plan);
  return (
    <span className={cn("text-[11px] font-bold", p?.color ?? "text-white/40")}>
      {p?.label ?? plan}
    </span>
  );
}

export default function AdminOrders() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [actionId, setActionId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [proofFailedIds, setProofFailedIds] = useState<Set<number>>(new Set());

  const qc = useQueryClient();

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const response = await fetch("/api/admin/orders");
      if (!response.ok) throw new Error("Failed to load orders");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to review order");
      }
      return response.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setActionId(null);
      setAdminNote("");
      setActionType(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete order");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const pendingCount = orders.filter((o: any) => o.status === "pending").length;

  const filtered = orders.filter((o: any) => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const matchSearch =
      o.userName?.toLowerCase().includes(search.toLowerCase()) ||
      o.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
      o.plan?.toLowerCase().includes(search.toLowerCase()) ||
      o.transactionReference?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleAction = (id: number, type: "approve" | "reject") => {
    setActionId(id);
    setActionType(type);
    setAdminNote("");
  };

  const confirmAction = (id: number) => {
    updateMutation.mutate({
      id,
      status: actionType === "approve" ? "approved" : "rejected",
      adminNote: adminNote || undefined,
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    if (expandedId !== id) {
      setActionId(null); // Reset action panel if opening details
    }
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-black text-white">Orders</h1>
            {pendingCount > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="text-[13px] text-white/40 mt-0.5">{orders.length} total plan requests</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {["pending", "approved", "rejected"].map(s => {
          const st = STATUS_MAP[s];
          const Icon = st.icon;
          const c = orders.filter((o: any) => o.status === s).length;
          return (
            <div key={s} className="bg-[#161b22] border border-white/5 rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", st.bg)}>
                <Icon size={15} className={st.color} />
              </div>
              <div>
                <p className="text-xl font-black text-white">{c}</p>
                <p className={cn("text-[10px] font-black uppercase tracking-widest", st.color)}>{st.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search reference, user..."
            className="pl-9 pr-4 py-2.5 bg-[#161b22] border border-white/5 rounded-xl text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 w-full sm:w-56"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-[#161b22] border border-white/5 rounded-xl p-1">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors",
                filterStatus === s ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-[#161b22] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[700px]">
        <div className="grid grid-cols-[1fr_120px_100px_100px_100px_auto] px-5 py-3 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/20">
          <span>User & Ref</span>
          <span>Plan</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
          <span className="text-right">Actions</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-white/20 text-[13px]">
            {search || filterStatus !== "all" ? "No orders match filter" : "No orders yet"}
          </div>
        ) : (
          filtered.map((o: any) => {
            const isActioning = actionId === o.id;
            const isExpanded = expandedId === o.id;
            const dateStr = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const hasAmount = Number.isInteger(o.amountMinor) && !!o.currency;
            const formattedAmount = hasAmount
              ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(o.amountMinor / 100)
              : null;
            const method = o.paymentMethodSnapshot as { label?: string; provider?: string; accountNumber?: string } | null;

            return (
              <div key={o.id} className={cn(
                "border-b border-white/5 transition-colors",
                (isActioning || isExpanded) ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
              )}>
                <div className="grid grid-cols-[1fr_120px_100px_100px_100px_auto] px-5 py-3.5 items-center">
                  {/* User & Ref */}
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-white truncate">{o.userName}</p>
                      {o.transactionReference && (
                        <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/60">
                          {o.transactionReference}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 truncate">{o.userEmail}</p>
                  </div>

                  {/* Plan */}
                  <PlanBadge plan={o.plan} />

                  {/* Amount */}
                  <div>
                    {hasAmount ? (
                      <p className="text-[12px] font-bold text-white">{formattedAmount} <span className="text-[10px] text-white/40">{o.currency}</span></p>
                    ) : (
                      <p className="text-[12px] text-white/20">-</p>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge status={o.status} />

                  {/* Date */}
                  <p className="text-[11px] text-white/40">{dateStr}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => toggleExpand(o.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white text-[11px] font-bold transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Details
                    </button>

                    {o.status === "pending" && !isActioning && !isExpanded && (
                      <>
                        <button
                          onClick={() => handleAction(o.id, "approve")}
                          className="px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                          title="Approve"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => handleAction(o.id, "reject")}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Reject"
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                    {o.status !== "pending" && (
                      <button
                        onClick={() => deleteMutation.mutate(o.id)}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0f1117] p-5 rounded-xl border border-white/5">

                      {/* Left: Info */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Customer Details</h4>
                          <div className="space-y-1">
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Name:</span> <span className="font-bold text-white">{o.customerName || o.userName}</span></p>
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Email:</span> <span className="text-white">{o.userEmail}</span></p>
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">WhatsApp:</span> <span className="text-white font-mono">{o.whatsapp || 'N/A'}</span></p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Transaction Details</h4>
                          <div className="space-y-1">
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Reference:</span> <span className="text-white font-mono bg-white/10 px-1 rounded">{o.transactionReference || 'N/A'}</span></p>
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Method:</span> <span className="text-white">{method?.label || o.paymentMethodId || "N/A"}{method?.provider ? ` (${method.provider})` : ""}</span></p>
                            {method?.accountNumber && <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Paid to:</span> <span className="text-white font-mono">{method.accountNumber}</span></p>}
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Date:</span> <span className="text-white">{new Date(o.createdAt).toLocaleString()}</span></p>
                            <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Value:</span> <span className="font-bold text-white">{hasAmount ? `${formattedAmount} ${o.currency}` : "Legacy / Unknown"}</span></p>
                            {o.reviewedAt && <p className="text-[12px]"><span className="text-white/40 inline-block w-24">Reviewed:</span> <span className="text-white">{new Date(o.reviewedAt).toLocaleString()} by admin #{o.reviewedBy ?? "unknown"}</span></p>}
                          </div>
                        </div>

                        {(o.adminNote || o.notes) && (
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Notes</h4>
                            <p className="text-[12px] text-white/80 bg-white/5 p-2 rounded-lg italic">
                              {o.adminNote || o.notes}
                            </p>
                          </div>
                    )}

                        {/* Action buttons inside expanded view */}
                        {o.status === "pending" && (
                          <div className="pt-2 flex gap-2">
                            <button
                              onClick={() => handleAction(o.id, "approve")}
                              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/15 text-green-400 text-[12px] font-bold hover:bg-green-500/25 transition-colors"
                            >
                              <Check size={14} /> Approve Order
                            </button>
                            <button
                              onClick={() => handleAction(o.id, "reject")}
                              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-[12px] font-bold hover:bg-red-500/20 transition-colors"
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right: Proof Preview */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Payment Proof</h4>
                        <div className="rounded-xl border border-white/10 bg-black/50 overflow-hidden flex items-center justify-center min-h-[200px]">
                          {o.hasProof && !proofFailedIds.has(o.id) ? (
                            <img
                              src={`/api/orders/${o.id}/proof`}
                              alt="Payment proof"
                              className="max-w-full max-h-[300px] object-contain"
                              onError={() => setProofFailedIds((ids) => new Set(ids).add(o.id))}
                            />
                          ) : (
                            <div className="text-white/30 flex flex-col items-center gap-2">
                              <ImageIcon size={24} />
                              <span className="text-[11px]">No proof image available</span>
                            </div>
                          )}
                        </div>
                        {o.hasProof && (
                          <a
                            href={`/api/orders/${o.id}/proof`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block mt-2 text-[11px] text-center text-white/40 hover:text-white transition-colors"
                          >
                            Open image in new tab
                          </a>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* Confirm action panel */}
                {isActioning && (
                  <div className={cn(
                    "mx-5 mb-4 p-4 rounded-xl border",
                    actionType === "approve" ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                  )}>
                    <p className={cn("text-[12px] font-bold mb-2", actionType === "approve" ? "text-green-400" : "text-red-400")}>
                      {actionType === "approve"
                        ? `Approve & upgrade ${o.userName} to ${o.plan.charAt(0).toUpperCase() + o.plan.slice(1)} plan?`
                        : `Reject ${o.userName}'s request?`}
                    </p>
                    <textarea
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Admin note (optional)..."
                      rows={2}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 resize-none mb-3"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => confirmAction(o.id)}
                        disabled={updateMutation.isPending}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-colors",
                          actionType === "approve"
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        )}
                      >
                        <Check size={11} />
                        {updateMutation.isPending ? "Processing..." : actionType === "approve" ? "Confirm Approve" : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => { setActionId(null); setActionType(null); }}
                        className="px-4 py-2 rounded-lg text-[12px] font-bold text-white/30 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {(updateMutation.isError || deleteMutation.isError) && (
                  <div className="mx-5 mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
                    {(updateMutation.error as Error | null)?.message || (deleteMutation.error as Error | null)?.message}
                  </div>
                )}
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
