import { Link, useLocation } from "wouter";
import { Mic2, LayoutDashboard, Settings } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group" data-testid="link-home">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Mic2 size={18} className="animate-pulse-slow" />
            </div>
            <span className="font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              VoiceStudio
            </span>
          </Link>
          
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link 
              href="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${location === '/' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              data-testid="nav-studio"
            >
              <Mic2 size={16} />
              <span className="hidden sm:inline">Studio</span>
            </Link>
            <Link 
              href="/admin" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${location.startsWith('/admin') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              data-testid="nav-admin"
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
