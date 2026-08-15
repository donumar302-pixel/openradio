import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Megaphone } from "lucide-react";

interface PublicSettings {
  banner: { enabled: boolean; text: string };
  disabledFeatures: string[];
}

async function fetchPublicSettings(): Promise<PublicSettings> {
  const res = await fetch("/api/settings/public");
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ["settings", "public"],
    queryFn: fetchPublicSettings,
    staleTime: 60_000,
  });

  const banner = data?.banner;
  if (dismissed || !banner?.enabled || !banner.text?.trim()) return null;

  return (
    <div className="relative flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-indigo-500 text-white text-[13px] font-semibold shrink-0">
      <Megaphone size={15} className="shrink-0" />
      <span className="flex-1 truncate">{banner.text}</span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-0.5 rounded-md hover:bg-white/20 transition-colors"
        title="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}
