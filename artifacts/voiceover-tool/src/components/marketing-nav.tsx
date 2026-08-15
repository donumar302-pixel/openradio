import { BrandWordmark } from "@/components/brand-wordmark";
import { Link, useLocation } from "wouter";
import { useState, useRef } from "react";
import { Menu, X, LogIn, Wand2, Mic, AudioLines, ChevronDown } from "lucide-react";

const PRODUCT_ITEMS = [
  {
    icon: Wand2,
    label: "Create",
    desc: "Generate voices from any text",
    href: "/register",
  },
  {
    icon: Mic,
    label: "Voice Cloning",
    desc: "Clone any voice in seconds",
    href: "/register",
  },
  {
    icon: AudioLines,
    label: "Generate Audio",
    desc: "Studio-grade MP3 downloads",
    href: "/register",
  },
];

export function MarketingNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDropdown = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setProductOpen(true);
  };
  const closeDropdown = () => {
    closeTimer.current = setTimeout(() => setProductOpen(false), 120);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-black/[0.04]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <BrandWordmark textClass="font-black text-[30px] tracking-tight text-gray-900" imgClass="h-[1.15em] w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {/* Home */}
          <Link
            href="/"
            className={
              "px-4 py-2 rounded-full text-[14px] font-semibold transition-colors " +
              (location === "/" ? "bg-black/[0.06] text-gray-900" : "text-gray-500 hover:text-gray-900")
            }
          >
            Home
          </Link>

          {/* Product dropdown */}
          <div
            className="relative"
            onMouseEnter={openDropdown}
            onMouseLeave={closeDropdown}
          >
            <button
              onClick={() => setProductOpen(v => !v)}
              className={
                "flex items-center gap-1 px-4 py-2 rounded-full text-[14px] font-semibold transition-colors " +
                (productOpen ? "bg-black/[0.06] text-gray-900" : "text-gray-500 hover:text-gray-900")
              }
            >
              Product
              <ChevronDown
                size={14}
                className={"transition-transform duration-200 " + (productOpen ? "rotate-180" : "")}
              />
            </button>

            {/* Dropdown panel */}
            {productOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-black/[0.06] overflow-hidden py-2"
                onMouseEnter={openDropdown}
                onMouseLeave={closeDropdown}
              >
                {PRODUCT_ITEMS.map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setProductOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center flex-shrink-0 transition-colors">
                      <item.icon size={17} className="text-orange-500" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-gray-900">{item.label}</div>
                      <div className="text-[12px] text-gray-400 font-medium">{item.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tools */}
          <Link
            href="/tools"
            className={
              "px-4 py-2 rounded-full text-[14px] font-semibold transition-colors " +
              (location === "/tools" ? "bg-black/[0.06] text-gray-900" : "text-gray-500 hover:text-gray-900")
            }
          >
            Tools
          </Link>

          {/* Pricing */}
          <Link
            href="/pricing"
            className={
              "px-4 py-2 rounded-full text-[14px] font-semibold transition-colors " +
              (location === "/pricing" ? "bg-black/[0.06] text-gray-900" : "text-gray-500 hover:text-gray-900")
            }
          >
            Pricing
          </Link>
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
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-black/5"
          >
            Home
          </Link>
          <div className="px-4 py-1.5">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Product</div>
            {PRODUCT_ITEMS.map(item => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 py-2.5 text-[15px] font-semibold text-gray-700 hover:text-orange-500 transition-colors"
              >
                <item.icon size={16} className="text-orange-400" />
                {item.label}
              </Link>
            ))}
          </div>
          <Link
            href="/tools"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-black/5"
          >
            Tools
          </Link>
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-black/5"
          >
            Pricing
          </Link>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="OpenRadio" className="w-11 h-11 object-contain" />
            <span className="font-black text-[20px] tracking-tight text-gray-900">
              Open<span className="text-[#f97316]">Radio</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-gray-500">
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/tools" className="hover:text-gray-900">Tools</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
            <Link href="/refund-policy" className="hover:text-gray-900">Refund Policy</Link>
            <Link href="/cookies" className="hover:text-gray-900">Cookie Policy</Link>
            <Link href="/contact" className="hover:text-gray-900">Contact</Link>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-black/[0.05] flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[13px] text-gray-400">
            © {new Date().getFullYear()} OpenRadio.io. All rights reserved.
          </p>
          <p className="text-[13px] font-semibold text-gray-500">
            Made in Pakistan <span aria-hidden>🇵🇰</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
