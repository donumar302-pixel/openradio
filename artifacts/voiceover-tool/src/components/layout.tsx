import { BrandWordmark } from "@/components/brand-wordmark";
import { Link, useLocation } from "wouter";
import { Mic2 } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center group" data-testid="link-home">
            <BrandWordmark textClass="font-extrabold text-xl tracking-tight text-foreground" imgClass="h-[1.15em] w-auto" />
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
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border bg-secondary/40 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          OpenRadio.io &middot; <a href="https://openradio.io" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">openradio.io</a>
        </div>
      </footer>
    </div>
  );
}
