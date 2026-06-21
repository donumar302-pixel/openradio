import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, LogIn } from "lucide-react";

export function MarketingNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Home", href: "/" },
    { label: "Pricing", href: "/pricing" },
    { label: "Developer API", href: "/pricing" },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-black/[0.04]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="Bunny TTS" className="w-8 h-8 object-contain" />
          <span className="font-black text-[19px] tracking-tight text-gray-900">
            Bunny<span className="text-[#f97316]">TTS</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {links.map((l, i) => {
            const active = l.href === "/" ? location === "/" : location === l.href;
            return (
              <Link
                key={i}
                href={l.href}
                className={
                  "px-4 py-2 rounded-full text-[14px] font-semibold transition-colors " +
                  (active
                    ? "bg-black/[0.06] text-gray-900"
                    : "text-gray-500 hover:text-gray-900")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-bold transition-colors"
          >
            Sign in <LogIn size={14} />
          </Link>
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-black/5"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-black/[0.04] bg-white px-4 py-3 space-y-1">
          {links.map((l, i) => (
            <Link
              key={i}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-black/5"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block mt-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[15px] font-bold text-center"
          >
            Sign in
          </Link>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-black/[0.05] bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Bunny TTS" className="w-7 h-7 object-contain" />
          <span className="font-black text-[16px] tracking-tight text-gray-900">
            Bunny<span className="text-[#f97316]">TTS</span>
          </span>
        </div>
        <p className="text-[13px] text-gray-400">
          © {new Date().getFullYear()} BunnyTTS. All rights reserved.
        </p>
        <div className="flex items-center gap-5 text-[13px] font-medium text-gray-500">
          <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
          <Link href="/login" className="hover:text-gray-900">Sign in</Link>
          <Link href="/register" className="hover:text-gray-900">Get Started</Link>
        </div>
      </div>
    </footer>
  );
}
