import { Link, useLocation } from "wouter";
import { Mic2, LayoutDashboard } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" data-testid="link-home">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30 group-hover:shadow-primary/50 transition-shadow">
              <span className="text-white font-bold text-lg leading-none">B</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="font-extrabold text-lg tracking-tight text-foreground">Bunny</span>
              <span className="font-extrabold text-lg tracking-tight text-primary">TTS</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                location === "/"
                  ? "bg-primary text-white shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              data-testid="nav-studio"
            >
              <Mic2 size={15} />
              <span className="hidden sm:inline">Studio</span>
            </Link>
            <Link
              href="/admin"
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                location.startsWith("/admin")
                  ? "bg-primary text-white shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              data-testid="nav-admin"
            >
              <LayoutDashboard size={15} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border bg-secondary/40 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Bunny TTS &middot; <a href="https://flowbybunny.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">flowbybunny.com</a>
        </div>
      </footer>
    </div>
  );
}
