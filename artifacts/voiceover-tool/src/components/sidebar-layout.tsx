import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Home,
  Mic2,
  LogOut,
  User,
  Menu,
  X,
  AudioWaveform,
  MessageSquareText,
  Languages,
  Radio,
  Settings,
  BookAudio,
  Sparkles,
  Copy,
  Zap,
  CreditCard,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const generalItems: NavItem[] = [
  { label: "Home",          href: "/",         icon: <Home size={18} /> },
  { label: "Voice Library", href: "/voices",   icon: <BookAudio size={18} /> },
];

const elItems: NavItem[] = [
  { label: "Text to Speech",   href: "/studio",           icon: <Mic2 size={18} /> },
  { label: "Speech to Speech", href: "/speech-to-speech", icon: <AudioWaveform size={18} /> },
  { label: "Speech to Text",   href: "/speech-to-text",   icon: <MessageSquareText size={18} /> },
  { label: "Audio Isolation",  href: "/audio-isolation",  icon: <Radio size={18} /> },
  { label: "Dubbing",          href: "/dubbing",          icon: <Languages size={18} /> },
];

const minimaxItems: NavItem[] = [
  { label: "Fire TTS",      href: "/minimax",        icon: <Zap size={18} />,      badge: "Hot", badgeColor: "bg-red-100 text-red-500" },
  { label: "Voice Cloning", href: "/voice-cloning",  icon: <Copy size={18} />,     badge: "Free", badgeColor: "bg-green-100 text-green-600" },
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
        active
          ? "bg-[#f3f4f6] text-foreground font-semibold"
          : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-foreground font-normal"
      )}>
        <span className={cn("shrink-0 transition-colors", active ? "text-foreground" : "text-[#9ca3af] group-hover:text-[#6b7280]")}>
          {icon}
        </span>
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
    <div className="pt-6 pb-1.5 px-3 flex items-center gap-2">
      <p className="text-[11px] text-[#9ca3af] font-bold uppercase tracking-widest flex-1">{children}</p>
      {extra}
    </div>
  );
}

function UserCard({ user, logout }: { user: any; logout: () => void }) {
  const [open, setOpen] = useState(false);
  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const colors = [
    "bg-orange-500", "bg-violet-500", "bg-blue-500",
    "bg-green-500", "bg-pink-500", "bg-amber-500",
  ];
  const colorIdx = user?.name ? user.name.charCodeAt(0) % colors.length : 0;
  const avatarColor = colors[colorIdx];

  return (
    <div className="p-3 border-t border-[#f3f4f6] shrink-0">
      {/* Upgrade button */}
      <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[13px] font-bold shadow-sm hover:from-orange-600 hover:to-orange-500 transition-all mb-3">
        <Zap size={14} className="fill-white" />
        Upgrade Now
      </button>

      {/* User row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#f9fafb] transition-colors group"
      >
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-[13px]", avatarColor)}>
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold truncate text-foreground leading-none">{user?.name ?? "User"}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280] shrink-0 leading-none">Free</span>
          </div>
          <p className="text-[11px] text-[#9ca3af] truncate mt-0.5">{user?.email ?? ""}</p>
        </div>
        <ChevronUp size={14} className={cn("text-[#9ca3af] transition-transform shrink-0", open ? "rotate-180" : "")} />
      </button>

      {/* Expanded menu */}
      {open && (
        <div className="mt-1 mx-1 rounded-xl border border-[#f3f4f6] bg-white shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[#f9fafb]">
            <p className="text-[11px] text-[#9ca3af]">Plan</p>
            <p className="text-[13px] font-semibold text-foreground">Free — 0 Credits</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors font-medium"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-black text-[15px] leading-none">B</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-black text-[17px] tracking-tight text-foreground">Bunny</span>
            <span className="font-black text-[17px] tracking-tight text-primary">TTS</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {/* General */}
        {generalItems.map(item => <NavLink key={item.href} {...item} />)}

        {/* Products */}
        <SectionLabel>Products</SectionLabel>
        {elItems.map(item => <NavLink key={item.href} {...item} />)}

        {/* AI Tools */}
        <SectionLabel extra={
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">New</span>
        }>
          AI Tools
        </SectionLabel>
        {minimaxItems.map(item => <NavLink key={item.href} {...item} />)}

        {/* Platform */}
        <SectionLabel>Platform</SectionLabel>
        {platformItems.map(item => <NavLink key={item.href} {...item} />)}

        <div className="h-4" />
      </nav>

      {/* User */}
      <UserCard user={user} logout={logout} />
    </div>
  );

  return (
    <div className="min-h-screen flex bg-white text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-white border-r border-[#f3f4f6] w-64 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white border-r border-[#f3f4f6] flex flex-col shadow-xl">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-[#f3f4f6]">
          <button onClick={() => setMobileOpen(true)} className="text-[#6b7280]">
            <Menu size={20} />
          </button>
          <div className="flex items-baseline gap-0.5">
            <span className="font-black text-[15px] tracking-tight text-foreground">Bunny</span>
            <span className="font-black text-[15px] tracking-tight text-primary">TTS</span>
          </div>
          {mobileOpen && (
            <button className="ml-auto text-[#6b7280]" onClick={() => setMobileOpen(false)}>
              <X size={20} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
