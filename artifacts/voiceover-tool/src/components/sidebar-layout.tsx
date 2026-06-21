import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Home,
  Mic2,
  LayoutDashboard,
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const aiGenerationTools: NavItem[] = [
  { label: "Text to Speech", href: "/studio",           icon: <Mic2 size={16} />,              badge: "New" },
];

const aiTools: NavItem[] = [
  { label: "Speech to Speech", href: "/speech-to-speech", icon: <AudioWaveform size={16} /> },
  { label: "Speech to Text",   href: "/speech-to-text",   icon: <MessageSquareText size={16} /> },
  { label: "Audio Isolation",  href: "/audio-isolation",  icon: <Radio size={16} /> },
  { label: "Dubbing",          href: "/dubbing",          icon: <Languages size={16} />,        badge: "New" },
];

function NavLink({ href, icon, label, badge }: NavItem) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors select-none",
        active
          ? "bg-[#f3f4f6] text-foreground font-medium"
          : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-foreground font-normal"
      )}>
        <span className={cn("shrink-0", active ? "text-foreground" : "text-[#9ca3af]")}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {badge && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-primary shrink-0">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = location.startsWith("/admin");
  const isSettings = location === "/settings";
  const isHome = location === "/";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm leading-none">B</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="font-black text-[15px] tracking-tight text-foreground">Bunny</span>
            <span className="font-black text-[15px] tracking-tight text-primary">TTS</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-0.5">
        {/* Home */}
        <Link href="/">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors select-none",
            isHome
              ? "bg-[#f3f4f6] text-foreground font-medium"
              : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-foreground font-normal"
          )}>
            <Home size={16} className={cn("shrink-0", isHome ? "text-foreground" : "text-[#9ca3af]")} />
            <span>Home</span>
          </div>
        </Link>

        {/* Voice Library */}
        <Link href="/studio">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors select-none",
            location === "/voices"
              ? "bg-[#f3f4f6] text-foreground font-medium"
              : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-foreground font-normal"
          )}>
            <BookAudio size={16} className="shrink-0 text-[#9ca3af]" />
            <span>Voice Library</span>
          </div>
        </Link>

        {/* AI Generation */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-xs text-[#9ca3af] font-medium">AI Generation</p>
        </div>
        {aiGenerationTools.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {/* AI Tools */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-xs text-[#9ca3af] font-medium">AI Tools</p>
        </div>
        {aiTools.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {/* Manage */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-xs text-[#9ca3af] font-medium">Manage</p>
        </div>

        <Link href="/settings">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors select-none",
            isSettings
              ? "bg-[#f3f4f6] text-foreground font-medium"
              : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-foreground font-normal"
          )}>
            <Settings size={16} className={cn("shrink-0", isSettings ? "text-foreground" : "text-[#9ca3af]")} />
            <span>Settings</span>
          </div>
        </Link>
      </nav>

      {/* Bottom user area */}
      <div className="p-3 border-t border-[#f3f4f6] shrink-0">
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <User size={13} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate text-foreground leading-none mb-0.5">{user.name}</p>
              <p className="text-[11px] text-[#9ca3af] truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-[#e5e7eb] text-sm text-[#6b7280] hover:text-foreground hover:border-[#d1d5db] transition-colors font-medium"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-white text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col bg-white border-r border-[#f3f4f6] w-56 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 bg-white border-r border-[#f3f4f6] flex flex-col shadow-xl">
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
