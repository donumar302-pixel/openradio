import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Home,
  ChevronDown,
  ChevronRight,
  Mic2,
  LayoutDashboard,
  LogOut,
  User,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  children?: { label: string; href: string; badge?: string }[];
}

const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: <Home size={16} /> },
  {
    label: "ElevenLabs",
    icon: (
      <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">E</div>
    ),
    children: [
      { label: "Text to Speech", href: "/studio", badge: "AI" },
    ],
  },
];

function NavSection({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(true);

  if (item.href) {
    const active = location === item.href;
    return (
      <Link href={item.href}>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <span className="shrink-0">{item.icon}</span>
          {!collapsed && <span>{item.label}</span>}
        </div>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-foreground hover:bg-secondary transition-all"
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </>
        )}
      </button>
      {open && !collapsed && item.children && (
        <div className="ml-7 mt-1 space-y-1">
          {item.children.map((child) => {
            const active = location === child.href;
            return (
              <Link key={child.href} href={child.href}>
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-pointer",
                    active
                      ? "bg-primary text-white font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary font-medium"
                  )}
                >
                  <span>{child.label}</span>
                  {child.badge && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                      active ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    )}>
                      {child.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = location.startsWith("/admin");

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
          <span className="text-white font-bold text-base leading-none">B</span>
        </div>
        {!collapsed && (
          <div className="flex items-baseline gap-0.5">
            <span className="font-extrabold text-base tracking-tight text-foreground">Bunny</span>
            <span className="font-extrabold text-base tracking-tight text-primary">TTS</span>
          </div>
        )}
        <button
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors hidden lg:block"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            AI Generation
          </p>
        )}
        {navItems.map((item) => (
          <NavSection key={item.label} item={item} collapsed={collapsed} />
        ))}

        {/* Admin link */}
        <div className="pt-4">
          {!collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Manage
            </p>
          )}
          <Link href="/admin">
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                isAdmin
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <LayoutDashboard size={16} className="shrink-0" />
              {!collapsed && <span>Admin Panel</span>}
            </div>
          </Link>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        {user && !collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
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
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-white border-r border-border transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 bg-white border-r border-border flex flex-col">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
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
