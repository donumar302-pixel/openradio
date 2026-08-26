import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { osJson } from "@/lib/os-api";

/** Advisory per-engine slowness signal from the server's rolling task window. */
export type OsEngineHealth = Record<string, { slow: boolean }>;

const ENGINE_IDS = ["elevenlabs", "minimax", "fishaudio", "edge"] as const;

/** Engine id from a prefixed voice id (elevenlabs_xxx, minimax_xxx, …); null for clones/unknown. */
export function engineOfVoiceId(voiceId: string | null | undefined): string | null {
  if (!voiceId) return null;
  for (const e of ENGINE_IDS) if (voiceId.startsWith(`${e}_`)) return e;
  return null;
}

/**
 * Poll the advisory engine-health signal. Fail-soft: on any error the query
 * just returns nothing and no notice is shown — this must never block the UI.
 */
export function useEngineHealth(enabled = true): OsEngineHealth | null {
  const { data } = useQuery<{ engines: OsEngineHealth }>({
    queryKey: ["os-engine-health"],
    queryFn: () => osJson("/engine-health"),
    enabled,
    staleTime: 60_000,
    refetchInterval: 90_000,
    retry: false,
  });
  return data?.engines ?? null;
}

export function isEngineSlow(health: OsEngineHealth | null, engine: string | null | undefined): boolean {
  return !!(engine && health?.[engine]?.slow);
}

/** Small amber advisory shown next to an engine that is currently running slow. */
export function EngineSlowNotice({ show, compact = false, className }: {
  show: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!show) return null;
  if (compact) {
    return (
      <p className={cn("flex items-center gap-1.5 text-[11px] font-semibold text-amber-700", className)} data-testid="engine-slow-notice">
        <AlertTriangle size={11} className="shrink-0" />
        This engine is experiencing high demand — generations may be slow.
      </p>
    );
  }
  return (
    <div
      className={cn("flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2", className)}
      data-testid="engine-slow-notice"
    >
      <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">
        <span className="font-semibold">This engine is experiencing high demand</span> — generations may be slower
        than usual. You can still generate; if it takes too long you can cancel for a full refund.
      </p>
    </div>
  );
}
