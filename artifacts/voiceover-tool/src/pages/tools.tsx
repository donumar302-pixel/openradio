import { Link } from "wouter";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

/* ── Provider badge data ─────────────────────────────────────────────── */
const PROVIDERS = {
  elevenlabs: { label: "EL", bg: "#000", text: "#fff", name: "ElevenLabs" },
  minimax:    { label: "MM", bg: "#6c47ff", text: "#fff", name: "MiniMax" },
  fishaudio:  { label: "FA", bg: "#0ea5e9", text: "#fff", name: "Fish Audio" },
  edge:       { label: "ET", bg: "#2563eb", text: "#fff", name: "Edge TTS" },
};

type ProviderId = keyof typeof PROVIDERS;

function ProviderBadge({ id }: { id: ProviderId }) {
  const p = PROVIDERS[id];
  return (
    <div
      title={p.name}
      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ring-2 ring-white"
      style={{ background: p.bg, color: p.text }}
    >
      {p.label}
    </div>
  );
}

/* ── Tool rows ───────────────────────────────────────────────────────── */
interface Tool {
  num: string;
  name: string;
  desc: string;
  providers: ProviderId[];
  href: string;
  iconBg: string;
  iconChar: string;
}

const VOICE_TOOLS: Tool[] = [
  {
    num: "01",
    name: "Text to Speech",
    desc: "Natural speech from leading voice providers — ElevenLabs, MiniMax, Fish Audio and Edge TTS.",
    providers: ["elevenlabs", "minimax", "fishaudio", "edge"],
    href: "/register",
    iconBg: "#f97316",
    iconChar: "🎙",
  },
  {
    num: "02",
    name: "Voice Cloning",
    desc: "Clone any voice from a short audio sample. Powered by ElevenLabs and Fish Audio.",
    providers: ["elevenlabs", "fishaudio"],
    href: "/register",
    iconBg: "#a855f7",
    iconChar: "🔮",
  },
  {
    num: "03",
    name: "Edge TTS",
    desc: "400+ multilingual voices via Microsoft Edge — zero cost, instant generation.",
    providers: ["edge"],
    href: "/register",
    iconBg: "#2563eb",
    iconChar: "⚡",
  },
  {
    num: "04",
    name: "Fire TTS — MiniMax",
    desc: "High-fidelity emotional voices and multilingual speech via MiniMax Speech-02.",
    providers: ["minimax"],
    href: "/register",
    iconBg: "#e11d48",
    iconChar: "🔥",
  },
  {
    num: "05",
    name: "Fish Audio TTS",
    desc: "Fast, expressive voice synthesis powered by Fish Audio's s2.1 model family.",
    providers: ["fishaudio"],
    href: "/register",
    iconBg: "#0ea5e9",
    iconChar: "🐟",
  },
];

function ToolRow({ tool, index }: { tool: Tool; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: index * 0.06, duration: 0.45 }}
    >
      <Link href={tool.href}>
        <div className="group flex items-center gap-5 py-6 px-6 rounded-2xl hover:bg-white/80 transition-all cursor-pointer border border-transparent hover:border-black/6 hover:shadow-sm">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm"
            style={{ background: tool.iconBg + "22" }}
          >
            {tool.iconChar}
          </div>

          {/* Number */}
          <span className="text-[12px] font-black text-black/20 w-6 shrink-0">{tool.num}</span>

          {/* Name + desc */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[18px] font-black text-black tracking-tight leading-snug group-hover:text-orange-500 transition-colors">
              {tool.name}
            </h3>
            <p className="text-[13px] text-black/45 font-medium mt-0.5 leading-relaxed max-w-lg">
              {tool.desc}
            </p>
          </div>

          {/* Provider badges */}
          <div className="hidden sm:flex items-center -space-x-1.5 shrink-0">
            {tool.providers.map(p => (
              <ProviderBadge key={p} id={p} />
            ))}
          </div>

          {/* Arrow */}
          <div className="w-8 h-8 rounded-full bg-black/5 group-hover:bg-orange-500 flex items-center justify-center transition-colors shrink-0 ml-2">
            <ArrowRight size={14} className="text-black/40 group-hover:text-white transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ToolsPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "#f4f0e8" }}>
      <MarketingNav />

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* Label */}
            <div className="flex items-center gap-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[11px] font-black tracking-[0.2em] text-black/40 uppercase">
                Active Catalog · Verified Aug 2026
              </span>
            </div>

            {/* Big heading */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
              <h1 className="text-[52px] sm:text-[72px] lg:text-[88px] font-black tracking-tight leading-[0.95] text-black max-w-2xl">
                The active<br />voice tool<br />catalog.
              </h1>

              <div className="md:max-w-xs pb-2">
                <p className="text-[15px] text-black/50 font-medium leading-relaxed mb-5">
                  This catalog reflects every voice and audio tool available on OpenRadio — live providers and processing paths.
                </p>
                <Link href="/register">
                  <button className="inline-flex items-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-xl text-[14px] font-black transition-colors">
                    Start creating <ArrowUpRight size={14} />
                  </button>
                </Link>
              </div>
            </div>

            {/* Stats bar */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/8 rounded-2xl overflow-hidden border border-black/8">
              {[
                { value: "5", label: "Voice Tools" },
                { value: "4", label: "Voice Providers" },
                { value: "400+", label: "Available Voices" },
                { value: "✓", label: "Source-Verified Catalog", accent: true },
              ].map((s, i) => (
                <div key={i} className="bg-[#f4f0e8] px-6 py-5">
                  <div className={`text-[32px] font-black leading-none mb-1 ${s.accent ? "text-orange-500" : "text-black"}`}>
                    {s.value}
                  </div>
                  <div className="text-[11px] font-bold text-black/30 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Tool Section: Voice & Audio ────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">

          {/* Section header */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-end justify-between border-b border-black/10 pb-4 mb-4 mt-6"
          >
            <div>
              <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center mb-3">
                <span className="text-white text-[13px] font-black">01</span>
              </div>
              <h2 className="text-[36px] sm:text-[48px] font-black tracking-tight text-black leading-none">
                Voice &amp; audio
              </h2>
              <p className="text-[14px] text-black/40 font-medium mt-2">
                Generate speech, clone voices, and process audio at scale.
              </p>
            </div>
            <span className="text-[80px] sm:text-[120px] font-black text-black/[0.04] leading-none select-none hidden sm:block">
              0{VOICE_TOOLS.length}
            </span>
          </motion.div>

          {/* Tool rows */}
          <div className="flex flex-col divide-y divide-black/[0.05]">
            {VOICE_TOOLS.map((tool, i) => (
              <ToolRow key={tool.num} tool={tool} index={i} />
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #d4f0b0 0%, #e8f5d0 40%, #c8e8f8 100%)" }}
          >
            <div className="px-8 sm:px-14 py-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xl">🎙</span>
                </div>
                <div>
                  <h3 className="text-[24px] sm:text-[32px] font-black text-black tracking-tight leading-snug">
                    Create more.<br className="sm:hidden" /> Spend less.
                  </h3>
                  <p className="text-[14px] text-black/50 font-medium mt-1">
                    Start generating with all active tools on OpenRadio — no credit card needed.
                  </p>
                </div>
              </div>
              <Link href="/register" className="shrink-0">
                <button className="inline-flex items-center gap-2 px-7 py-3.5 bg-black hover:bg-gray-800 text-white rounded-xl text-[14px] font-black transition-colors">
                  Start creating <ArrowUpRight size={15} />
                </button>
              </Link>
            </div>
          </motion.div>
        </section>

      </main>

      <MarketingFooter />
    </div>
  );
}
