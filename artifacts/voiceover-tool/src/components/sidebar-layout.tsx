import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Home, Mic2, LogOut, Menu, X, AudioWaveform, MessageSquareText,
  Languages, Radio, Settings, BookAudio, Copy, Zap, CreditCard,
  ChevronRight, User, BarChart2, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string; href: string; icon: React.ReactNode;
  badge?: string; badgeColor?: string;
}

const generalItems: NavItem[] = [
  { label: "Home",          href: "/",       icon: <Home size={18} /> },
  { label: "Voice Library", href: "/voices", icon: <BookAudio size={18} /> },
];
const elItems: NavItem[] = [
  { label: "Text to Speech",   href: "/studio",           icon: <Mic2 size={18} /> },
  { label: "Speech to Speech", href: "/speech-to-speech", icon: <AudioWaveform size={18} /> },
  { label: "Speech to Text",   href: "/speech-to-text",   icon: <MessageSquareText size={18} /> },
  { label: "Audio Isolation",  href: "/audio-isolation",  icon: <Radio size={18} /> },
  { label: "Dubbing",          href: "/dubbing",          icon: <Languages size={18} /> },
];
const minimaxItems: NavItem[] = [
  { label: "Fire TTS",      href: "/minimax",       icon: <Zap size={18} />,  badge: "Hot",  badgeColor: "bg-red-100 text-red-500" },
  { label: "Voice Cloning", href: "/voice-cloning", icon: <Copy size={18} />, badge: "Free", badgeColor: "bg-green-100 text-green-600" },
];
const platformItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
  { label: "Billing",  href: "/billing",  icon: <CreditCard size={18} /> },
];

function NavLink({ href, icon, label, badge, badgeColor }: NavItem) {
  const [location] = useLocation();
  const active = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] cursor-pointer transition-all select-none group",
        active ? "bg-[#f3f4f6] text-foreground font-semibold" : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-foreground"
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
      "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer text-left",
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
          <Link href="/billing" onClick={onClose}>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-primary text-white cursor-pointer hover:bg-primary/90 transition-colors">
              Upgrade
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#f9fafb] rounded-xl p-2.5">
            <p className="text-[10px] text-[#9ca3af] font-semibold mb-0.5">Total</p>
            <p className="text-sm font-extrabold text-foreground">0 credits</p>
          </div>
          <div className="bg-[#f9fafb] rounded-xl p-2.5">
            <p className="text-[10px] text-[#9ca3af] font-semibold mb-0.5">Remaining</p>
            <p className="text-sm font-extrabold text-foreground">0</p>
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
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">Free plan</span>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-1">
        <MenuItem icon={<Settings size={15} />}   label="Account Settings" href="/settings" />
        <MenuItem icon={<CreditCard size={15} />} label="Subscription"      href="/billing" />
        <MenuItem icon={<BarChart2 size={15} />}  label="Usage analytics"   href="/billing" />
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
        Free
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
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-black text-[14px] leading-none">B</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-black text-[16px] tracking-tight text-foreground">Bunny</span>
            <span className="font-black text-[16px] tracking-tight text-primary">TTS</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {generalItems.map(item => <NavLink key={item.href} {...item} />)}
        <SectionLabel>Products</SectionLabel>
        {elItems.map(item => <NavLink key={item.href} {...item} />)}
        <SectionLabel extra={
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">New</span>
        }>AI Tools</SectionLabel>
        {minimaxItems.map(item => <NavLink key={item.href} {...item} />)}
        <SectionLabel>Platform</SectionLabel>
        {platformItems.map(item => <NavLink key={item.href} {...item} />)}
        <div className="h-4" />
      </nav>

      {/* Upgrade button */}
      <div className="p-3 border-t border-[#f3f4f6] shrink-0">
        <Link href="/billing">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[13px] font-bold shadow-sm hover:from-orange-600 hover:to-orange-500 transition-all">
            <Zap size={14} className="fill-white" />
            Upgrade Now
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
        {/* Universal top header — always visible, separated by border */}
        <header className="flex items-center justify-between px-5 h-13 border-b border-[#f3f4f6] bg-white shrink-0 z-30">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button onClick={() => setMobileOpen(true)} className="text-[#6b7280]">
              <Menu size={20} />
            </button>
            <div className="flex items-baseline gap-0.5">
              <span className="font-black text-[15px] tracking-tight text-foreground">Bunny</span>
              <span className="font-black text-[15px] tracking-tight text-primary">TTS</span>
            </div>
          </div>
          {/* Desktop: empty left side */}
          <div className="hidden lg:block" />

          {/* Right: plan badge + avatar — always in the header */}
          <TopRightUserBtn user={user} onClick={() => setPanelOpen(v => !v)} />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Sliding account panel */}
      {panelOpen && <AccountPanel user={user} logout={logout} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
