import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Home,
  Mic2,
  LogOut,
  Menu,
  X,
  AudioWaveform,
  MessageSquareText,
  Languages,
  Radio,
  Settings,
  BookAudio,
  Copy,
  Zap,
  CreditCard,
  ChevronDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
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
    <div className="pt-5 pb-1.5 px-3 flex items-center gap-2">
      <p className="text-[11px] text-[#9ca3af] font-bold uppercase tracking-widest flex-1">{children}</p>
      {extra}
    </div>
  );
}

function UserAccountButton({ user, logout }: { user: any; logout: () => void }) {
  const [open, setOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const colors = ["bg-orange-500", "bg-violet-500", "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-amber-500"];
  const colorIdx = user?.name ? user.name.charCodeAt(0) % colors.length : 0;
  const avatarColor = colors[colorIdx];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f3f4f6] transition-colors group border border-transparent hover:border-[#e5e7eb]">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-black text-[12px]", avatarColor)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold truncate text-foreground leading-tight">{user?.name ?? "User"}</p>
            <p className="text-[11px] text-[#9ca3af] truncate leading-tight">{user?.email ?? ""}</p>
          </div>
          <ChevronDown size={13} className={cn("text-[#9ca3af] transition-transform shrink-0", open && "rotate-180")} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0 shadow-lg border border-[#e5e7eb] rounded-2xl overflow-hidden" align="start" side="right" sideOffset={8}>
        {/* Account header */}
        <div className="p-4 bg-gradient-to-br from-orange-50 to-white border-b border-[#f3f4f6]">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0", avatarColor)}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-foreground">{user?.name ?? "User"}</p>
              <p className="text-[11px] text-[#9ca3af] truncate">{user?.email ?? ""}</p>
            </div>
          </div>

          {/* Plan & credits */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl p-2.5 border border-[#e5e7eb] text-center">
              <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wide">Plan</p>
              <p className="text-sm font-black text-foreground mt-0.5">Free</p>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-[#e5e7eb] text-center">
              <p className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wide">Credits</p>
              <p className="text-sm font-black text-foreground mt-0.5">0</p>
            </div>
          </div>
        </div>

        {/* Upgrade button */}
        <div className="px-3 pt-3">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[13px] font-bold shadow-sm hover:from-orange-600 hover:to-orange-500 transition-all">
            <Zap size={13} className="fill-white" />
            Upgrade Now
          </button>
        </div>

        {/* Menu items */}
        <div className="p-2">
          <Link href="/settings" onClick={() => setOpen(false)}>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-foreground hover:bg-[#f9fafb] transition-colors font-medium text-left">
              <User size={14} className="text-[#9ca3af]" />
              Account Settings
            </button>
          </Link>
          <Link href="/billing" onClick={() => setOpen(false)}>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-foreground hover:bg-[#f9fafb] transition-colors font-medium text-left">
              <CreditCard size={14} className="text-[#9ca3af]" />
              Billing
            </button>
          </Link>
        </div>

        {/* Sign out */}
        <div className="px-2 pb-2 border-t border-[#f3f4f6] pt-1.5 mt-1">
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors font-medium"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidebarContent({ user, logout }: { user: any; logout: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo + User account */}
      <div className="px-4 pt-4 pb-2 shrink-0 space-y-2">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-1 mb-1">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-black text-[14px] leading-none">B</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-black text-[16px] tracking-tight text-foreground">Bunny</span>
            <span className="font-black text-[16px] tracking-tight text-primary">TTS</span>
          </div>
        </div>

        {/* User account button */}
        <UserAccountButton user={user} logout={logout} />
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

      {/* Bottom: Upgrade button only */}
      <div className="p-3 border-t border-[#f3f4f6] shrink-0">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 text-white text-[13px] font-bold shadow-sm hover:from-orange-600 hover:to-orange-500 transition-all">
          <Zap size={14} className="fill-white" />
          Upgrade Now
        </button>
      </div>
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex bg-white text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-white border-r border-[#f3f4f6] w-64 shrink-0 h-full">
        <SidebarContent user={user} logout={logout} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white border-r border-[#f3f4f6] flex flex-col h-full shadow-xl">
            <SidebarContent user={user} logout={logout} />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main — only this scrolls */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-[#f3f4f6] shrink-0">
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

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
