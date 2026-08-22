import { BrandWordmark } from "@/components/brand-wordmark";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { NotificationsBell } from "@/components/notifications-bell";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Home, Mic2, LogOut, Menu, X, AudioWaveform, MessageSquareText,
  Languages, Radio, Settings, BookAudio, Copy, Zap, CreditCard,
  ChevronRight, User, Moon, Lock, Layers, LifeBuoy,
  MessagesSquare, BookOpenText, Drum, Music4, ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

function planLabel(plan?: string | null): string {
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

interface NavItem {
  label: string; href: string; icon: React.ReactNode;
  badge?: string; badgeColor?: string; premium?: boolean;
}

const generalItems: NavItem[] = [
  { label: "Home",          href: "/",       icon: <Home size={18} /> },
  { label: "Voice Library", href: "/voices", icon: <BookAudio size={18} /> },
];
const elItems: NavItem[] = [
  { label: "Text to Speech",   href: "/studio",           icon: <Mic2 size={18} /> },
  { label: "Text to Dialogue", href: "/dialogue",         icon: <MessagesSquare size={18} />, premium: true, badge: "New", badgeColor: "bg-blue-100 text-blue-600" },
  { label: "Voice Changer",    href: "/speech-to-speech", icon: <AudioWaveform size={18} />, premium: true },
  { label: "Speech to Text",   href: "/speech-to-text",   icon: <MessageSquareText size={18} />, premium: true },
  { label: "Audio Isolation",  href: "/audio-isolation",  icon: <Radio size={18} />, premium: true },
  { label: "Dubbing",          href: "/dubbing",          icon: <Languages size={18} />, premium: true },
];
const minimaxItems: NavItem[] = [
  { label: "Bulk TTS",       href: "/batch",         icon: <Layers size={18} />, badge: "New",  badgeColor: "bg-blue-100 text-blue-600" },
  { label: "Voice Cloning",  href: "/voice-cloning", icon: <Copy size={18} />,   premium: true },
  { label: "Sound Effects",  href: "/sound-effects", icon: <Drum size={18} />,   premium: true, badge: "New", badgeColor: "bg-blue-100 text-blue-600" },
  { label: "AI Music",       href: "/music",         icon: <Music4 size={18} />, premium: true, badge: "New", badgeColor: "bg-blue-100 text-blue-600" },
  { label: "AI Images",      href: "/images",        icon: <ImageIcon size={18} />, premium: true, badge: "New", badgeColor: "bg-blue-100 text-blue-600" },
  { label: "Dictionary",     href: "/dictionary",    icon: <BookOpenText size={18} /> },
];
const platformItems: NavItem[] = [
  { label: "Support",  href: "/support",  icon: <LifeBuoy size={18} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
];

function NavLink({ href, icon, label, badge, badgeColor, locked }: NavItem & { locked?: boolean }) {
  const [location] = useLocation();
  const active = location === href || (href !== "/" && location.startsWith(href));
  if (locked) {
    return (
      <Link href="/pricing">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] cursor-pointer transition-all select-none group text-[#9ca3af] hover:bg-[#f9fafb]" title="Upgrade to unlock">
          <span className="shrink-0 text-[#cbd5e1] group-hover:text-[#9ca3af]">{icon}</span>
          <span className="flex-1 truncate">{label}</span>
          <Lock size={13} className="text-[#cbd5e1] shrink-0 group-hover:text-primary" />
        </div>
      </Link>
    );
  }
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] cursor-pointer transition-all select-none group",
        active ? "bg-[#f3f4f6] text-foreground font-bold" : "text-[#6b7280] font-semibold hover:bg-[#f9fafb] hover:text-foreground"
      )}>
        <span className={cn("shrink-0", active ? "text-foreground" : "text-[#9ca3af] group-hover:text-[#6b7280]")}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {badge && (
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", badgeColor ?? "bg-orange-100 text-orange-600")}>
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

function SectionLabel({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="pt-5 pb-1.5 px-3 flex items-center gap-2">
      <p className="text-[11px] text-[#9ca3af] font-bold uppercase tracking-widest flex-1">{children}</p>
      {extra}
    </div>
  );
}

/* ─── Account panel — opens from top-right ──────────────────────────── */
function AccountPanel({ user, logout, onClose }: { user: any; logout: () => void; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";
  const colors = ["bg-orange-500", "bg-violet-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-amber-500"];
  const avatarColor = colors[user?.name ? user.name.charCodeAt(0) % colors.length : 0];

  function MenuItem({ icon, label, href, chevron, red, onClick }: {
    icon: React.ReactNode; label: string; href?: string;
    chevron?: boolean; red?: boolean; onClick?: () => void;
  }) {
    const cls = cn(
      "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer text-left",
      red ? "text-red-500 hover:bg-red-50" : "text-foreground hover:bg-[#f9fafb]"
    );
    const inner = (
      <>
        <span className={cn("shrink-0", red ? "text-red-400" : "text-[#9ca3af]")}>{icon}</span>
        <span className="flex-1">{label}</span>
        {chevron && <ChevronRight size={13} className="text-[#d1d5db] shrink-0" />}
      </>
    );
    if (href) return <Link href={href} onClick={() => { onClose(); onClick?.(); }}><div className={cls}>{inner}</div></Link>;
    return <button className={cls} onClick={onClick}>{inner}</button>;
  }

  return (
    /* Fixed panel anchored to top-right */
    <div
      ref={panelRef}
      className={cn(
        "fixed top-14 right-3 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] flex flex-col overflow-hidden",
        "transition-all duration-200 ease-out",
        visible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-2 opacity-0 scale-95"
      )}
      style={{ maxHeight: "calc(100vh - 72px)" }}
    >
      {/* Balance */}
      <div className="px-4 pt-4 pb-3 border-b border-[#f3f4f6]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Moon size={14} className="text-[#9ca3af]" />
            Balance
          </div>
          <Link href="/pricing" onClick={onClose}>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-primary text-white cursor-pointer hover:bg-primary/90 transition-colors">
              Upgrade
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#f9fafb] rounded-xl p-2.5">
            <p className="text-[10px] text-[#9ca3af] font-semibold mb-0.5">Total</p>
            <p className="text-sm font-extrabold text-foreground">{((user?.credits ?? 0) + (user?.creditsUsed ?? 0)).toLocaleString()}</p>
          </div>
          <div className="bg-[#f9fafb] rounded-xl p-2.5">
            <p className="text-[10px] text-[#9ca3af] font-semibold mb-0.5">Remaining</p>
            <p className="text-sm font-extrabold text-foreground">{(user?.credits ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Workspace / plan */}
      <div className="px-4 py-3 border-b border-[#f3f4f6]">
        <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wide mb-1.5">Current workspace</p>
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[12px] shrink-0", avatarColor)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold truncate text-foreground">{user?.name ?? "My Workspace"}</p>
            <p className="text-[11px] text-[#9ca3af] truncate">{user?.email ?? ""}</p>
          </div>
        </div>
        <div className="mt-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">{planLabel(user?.plan)} plan</span>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-1">
        <MenuItem icon={<Settings size={15} />}   label="Account Settings" href="/settings" />
        <MenuItem icon={<CreditCard size={15} />} label="Subscription"      href="/pricing" />
        <MenuItem icon={<User size={15} />}       label="Profile"           href="/settings" />
        <div className="my-1 border-t border-[#f3f4f6]" />
        <MenuItem icon={<LogOut size={15} />} label="Sign out" red onClick={() => { onClose(); logout(); }} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#f3f4f6] bg-[#fafafa]">
        <p className="text-[10px] text-[#9ca3af]">
          Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
        </p>
      </div>
    </div>
  );
}

/* ─── Top-right avatar button ────────────────────────────────────────── */
function TopRightUserBtn({ user, onClick }: { user: any; onClick: () => void }) {
  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";
  const colors = ["bg-orange-500", "bg-violet-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-amber-500"];
  const avatarColor = colors[user?.name ? user.name.charCodeAt(0) % colors.length : 0];

  return (
    <button
      onClick={onClick}
      title={user?.name ?? "Account"}
      className="flex items-center gap-2 hover:opacity-90 transition-opacity py-1 px-1 rounded-xl hover:bg-[#f3f4f6]"
    >
      {/* Plan badge */}
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb] shadow-sm">
        {planLabel(user?.plan)}
      </span>
      {/* Avatar circle */}
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center",
        "text-white font-black text-[13px] shadow-md ring-2 ring-white",
        avatarColor
      )}>
        {initials}
      </div>
    </button>
  );
}

/* ─── Sidebar nav only (no user button here) ─────────────────────────── */
function SidebarContent() {
  const { user } = useAuth();
  const isPaid = !!user && (user.isAdmin || (user.plan && user.plan !== "free"));
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <div className="flex items-center">
          <BrandWordmark textClass="font-black text-[19px] tracking-tight text-foreground" imgClass="h-[1.2em] w-auto" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {generalItems.map(item => <NavLink key={item.href} {...item} />)}
        <SectionLabel>Products</SectionLabel>
        {elItems.map(item => <NavLink key={item.href} {...item} locked={item.premium && !isPaid} />)}
        <SectionLabel extra={
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">New</span>
        }>AI Tools</SectionLabel>
        {minimaxItems.map(item => <NavLink key={item.href} {...item} locked={item.premium && !isPaid} />)}
        <SectionLabel>Platform</SectionLabel>
        {platformItems.map(item => <NavLink key={item.href} {...item} />)}
        <div className="h-4" />
      </nav>

      {/* Upgrade link (compact) */}
      <div className="px-3 py-2 border-t border-[#f3f4f6] shrink-0">
        <Link href="/pricing">
          <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold text-orange-500 hover:bg-orange-50 transition-colors">
            <Zap size={12} className="fill-orange-500" />
            Upgrade
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────── */
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="h-screen flex bg-white text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-white border-r border-[#f3f4f6] w-64 shrink-0 h-full">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white border-r border-[#f3f4f6] flex flex-col h-full shadow-xl">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Announcement banner */}
        <AnnouncementBanner />

        {/* Universal top header — always visible, separated by border */}
        <header className="flex items-center justify-between px-5 h-13 border-b border-[#f3f4f6] bg-white shrink-0 z-30">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button onClick={() => setMobileOpen(true)} className="text-[#6b7280]">
              <Menu size={20} />
            </button>
            <BrandWordmark textClass="font-black text-[17px] tracking-tight text-foreground" imgClass="h-[1.2em] w-auto" />
          </div>
          {/* Desktop: empty left side */}
          <div className="hidden lg:block" />

          {/* Right: bell + plan badge + avatar — always in the header */}
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <TopRightUserBtn user={user} onClick={() => setPanelOpen(v => !v)} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Sliding account panel */}
      {panelOpen && <AccountPanel user={user} logout={logout} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
