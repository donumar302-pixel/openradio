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
  ChevronDown,
  ChevronRight,
  Volume2,
  AudioWaveform,
  Music2,
  MessageSquareText,
  Languages,
  Mic,
  Radio,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tool {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const pinnedTools: Tool[] = [
  { label: "Text to Speech",    href: "/studio",            icon: <Mic2 size={15} />,              badge: "AI" },
  { label: "Speech to Speech",  href: "/speech-to-speech",  icon: <AudioWaveform size={15} /> },
  { label: "Speech to Text",    href: "/speech-to-text",    icon: <MessageSquareText size={15} /> },
  { label: "Sound Effects",     href: "/sound-effects",     icon: <Volume2 size={15} /> },
  { label: "Audio Isolation",   href: "/audio-isolation",   icon: <Radio size={15} /> },
  { label: "Music Generation",  href: "/music",             icon: <Music2 size={15} /> },
  { label: "Dubbing",           href: "/dubbing",           icon: <Languages size={15} />,         badge: "New" },
];

function SidebarLink({ href, icon, label, badge }: Tool) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link href={href}>
      <div className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
        active
          ? "bg-primary text-white font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary font-medium"
      )}>
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {badge && (
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0",
            active ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
          )}>{badge}</span>
        )}
      </div>
    </Link>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(true);

  const isAdmin = location.startsWith("/admin");
  const isHome  = location === "/";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
          <span className="text-white font-bold text-base leading-none">B</span>
        </div>
        {!collapsed && (
          <div className="flex items-baseline gap-0.5 flex-1 min-w-0">
            <span className="font-extrabold text-base tracking-tight text-foreground">Bunny</span>
            <span className="font-extrabold text-base tracking-tight text-primary">TTS</span>
          </div>
        )}
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors hidden lg:block"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">

        {/* Home */}
        <Link href="/">
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            isHome ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}>
            <Home size={15} className="shrink-0" />
            {!collapsed && <span>Home</span>}
          </div>
        </Link>

        {/* Divider */}
        <div className="my-3 border-t border-border" />

        {/* Pinned section */}
        {!collapsed && (
          <button
            onClick={() => setPinnedOpen(!pinnedOpen)}
            className="w-full flex items-center justify-between px-3 py-1 mb-1"
          >
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Pinned</span>
            {pinnedOpen ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
          </button>
        )}

        {(pinnedOpen || collapsed) && (
          <div className="space-y-0.5">
            {pinnedTools.map((tool) => (
              <SidebarLink key={tool.href} {...tool} />
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="my-3 border-t border-border" />

        {/* Manage */}
        {!collapsed && (
          <p className="px-3 py-1 mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Manage
          </p>
        )}
        <Link href="/admin">
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            isAdmin ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}>
            <LayoutDashboard size={15} className="shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </div>
        </Link>

        <Link href="/settings">
          <div className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            location === "/settings" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}>
            <Settings size={15} className="shrink-0" />
            {!collapsed && <span>Settings</span>}
          </div>
        </Link>
      </nav>

      {/* User */}
      <div className="border-t border-border p-3 space-y-1">
        {user && !collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User size={13} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={15} className="shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-white border-r border-border transition-all duration-200 shrink-0",
        collapsed ? "w-[56px]" : "w-56"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 bg-white border-r border-border flex flex-col">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-white">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu size={20} />
          </button>
          <div className="flex items-baseline gap-0.5">
            <span className="font-extrabold text-base tracking-tight text-foreground">Bunny</span>
            <span className="font-extrabold text-base tracking-tight text-primary">TTS</span>
          </div>
          {mobileOpen && (
            <button className="ml-auto" onClick={() => setMobileOpen(false)}>
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
