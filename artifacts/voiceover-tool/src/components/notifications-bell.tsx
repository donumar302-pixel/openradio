import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
interface NotificationsResponse {
  unread: number;
  notifications: Notification[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "Just now";
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
  });

  const readAll = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unread = data?.unread ?? 0;
  const notifications = data?.notifications ?? [];

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) readAll.mutate();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        title="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-[#f3f4f6] text-[#6b7280] transition-colors"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-11 right-0 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f3f4f6] flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Notifications</p>
            {unread > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                {unread} new
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#9ca3af]">
                <BellOff size={26} className="mb-2" />
                <p className="text-[13px] font-semibold">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-[#f6f7f8] last:border-b-0",
                    !n.read && "bg-indigo-50/60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground">{n.title}</p>
                      <p className="text-[12px] text-[#6b7280] mt-0.5 whitespace-pre-wrap break-words">{n.body}</p>
                      <p className="text-[10px] text-[#9ca3af] font-semibold mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
