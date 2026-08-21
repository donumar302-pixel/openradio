import { Coins, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Shared "estimated cost / your balance" strip shown on every generation
 * form that creates an /api/os task. Estimates mirror the server's rules
 * (see lib/os-cost.ts); the server may reconcile to the real provider cost.
 */
export function OsCostEstimate({
  estimate,
  estimating = false,
  className,
}: {
  /** Estimated credits, or null/undefined when it can't be computed yet (e.g. no file selected). */
  estimate: number | null | undefined;
  /** True while a dynamic quote is being fetched (e.g. image pricing). */
  estimating?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const balance = user?.credits;
  const insufficient =
    !user?.isAdmin && typeof estimate === "number" && typeof balance === "number" && estimate > balance;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        insufficient ? "border-red-200 bg-red-50" : "border-border bg-secondary/50",
        className,
      )}
      data-testid="os-cost-estimate"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Coins size={15} className={insufficient ? "text-red-500" : "text-primary"} />
          Estimated cost:{" "}
          {estimating ? (
            <Loader2 size={13} className="animate-spin text-muted-foreground" />
          ) : typeof estimate === "number" ? (
            <span className={insufficient ? "text-red-600" : undefined}>
              {Math.max(1, Math.ceil(estimate)).toLocaleString()} credits
            </span>
          ) : (
            <span className="text-muted-foreground font-normal">—</span>
          )}
        </span>
        {typeof balance === "number" && (
          <span className="text-muted-foreground">
            Your balance: <span className="font-semibold text-foreground">{balance.toLocaleString()}</span>
          </span>
        )}
      </div>
      <p className={cn("text-xs mt-1", insufficient ? "text-red-600" : "text-muted-foreground")}>
        {insufficient
          ? "You may not have enough credits for this generation."
          : "Final cost may differ — unused reserved credits are refunded."}
      </p>
    </div>
  );
}
