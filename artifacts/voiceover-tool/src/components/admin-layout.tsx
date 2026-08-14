import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Key, Mic2, Copy, BarChart2,
  LogOut, ChevronRight, Menu, ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface AdminNavItem { label: string; href: string; icon: React.ReactNode; }

const navItems: AdminNavItem[] = [
  { label: "Overview",      href: "/admin",              icon: <LayoutDashboard size={16} /> },
  { label: "Users",         href: "/admin/users",        icon: <Users size={16} /> },
  { label: "Orders",        href: "/admin/orders",       icon: <ShoppingCart size={16} /> },
  { label: "API Keys",      href: "/admin/keys",         icon: <Key size={16} /> },
  { label: "Generations",   href: "/admin/generations",  icon: <Mic2 size={16} /> },
  { label: "Voice Clones",  href: "/admin/clones",       icon: <Copy size={16} /> },
  { label: "Analytics",     href: "/admin/analytics",    icon: <BarChart2 size={16} /> },
];

function AdminNav({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-[#0f1117]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="OpenRadio" className="w-11 h-11 object-contain shrink-0" />
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-black text-[15px] text-white">OpenRadio</span>
              
            </div>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest -mt-0.5">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(item => {
          const active = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={onClose}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all group",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}>
                <span className={cn("shrink-0", active ? "text-primary" : "text-white/30 group-hover:text-white/50")}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {active && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/5 shrink-0 space-y-1">
        <Link href="/">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-white/40 hover:text-white/70 hover:bg-white/5 cursor-pointer transition-all">
            <ChevronRight size={16} className="rotate-180" />
            Back to App
          </div>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex bg-[#0a0c10] text-white overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 h-full border-r border-white/5">
        <AdminNav />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 h-full shadow-2xl">
            <AdminNav onClose={() => setMobileOpen(false)} />
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 h-13 border-b border-white/5 bg-[#0f1117] shrink-0">
          <button className="lg:hidden text-white/40 hover:text-white" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[12px] text-white/40 font-semibold">System Online</span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
