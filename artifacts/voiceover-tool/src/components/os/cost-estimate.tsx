import { Coins, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * True when the estimated cost exceeds the signed-in user's balance (admins
 * are exempt). Used by generation forms to disable their submit button —
 * a UX guard only; the server still enforces credits (402).
 */
export function useOsInsufficientCredits(estimate: number | null | undefined): boolean {
  const { user } = useAuth();
  const balance = user?.credits;
  return (
    !user?.isAdmin && typeof estimate === "number" && typeof balance === "number" && estimate > balance
  );
}

/**
 * Shared "estimated cost / your balance" strip shown on every generation
 * form that creates an /api/os task. Estimates mirror the server's rules
 * (see lib/os-cost.ts); the server may reconcile to the real provider cost.
 */
export function OsCostEstimate({
  estimate,
  estimating = false,
  footnote,
  className,
}: {
  /** Estimated credits (0 renders as "Free"), or null/undefined when it can't be computed yet (e.g. no file selected). */
  estimate: number | null | undefined;
  /** True while a dynamic quote is being fetched (e.g. image pricing). */
  estimating?: boolean;
  /** Overrides the default "final cost may differ" footnote (shown only when credits are sufficient). */
  footnote?: string;
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
              {estimate === 0 ? "Free" : `${Math.max(1, Math.ceil(estimate)).toLocaleString()} credits`}
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
        {insufficient ? (
          <>
            Not enough credits for this generation.{" "}
            <Link
              href="/pricing"
              className="font-semibold underline underline-offset-2 hover:text-red-700"
              data-testid="link-buy-credits"
            >
              Buy credits
            </Link>
          </>
        ) : (
          footnote ?? "Final cost may differ — unused reserved credits are refunded."
        )}
      </p>
    </div>
  );
}
