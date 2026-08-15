import { Link } from "wouter";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ArrowUpRight, Mic2, Copy, Zap, Flame, Waves } from "lucide-react";
import { motion } from "framer-motion";

/* ── Providers (real logos) ──────────────────────────────────────────── */
const PROVIDERS = {
  elevenlabs: { name: "ElevenLabs", logo: "/providers/elevenlabs.png" },
  minimax:    { name: "MiniMax",    logo: "/providers/minimax.png" },
  fishaudio:  { name: "Fish Audio", logo: "/providers/fishaudio.png" },
  edge:       { name: "Microsoft Edge", logo: "/providers/edge.png" },
};
type ProviderId = keyof typeof PROVIDERS;

function ProviderChip({ id }: { id: ProviderId }) {
  const p = PROVIDERS[id];
  return (
    <span className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-white border border-black/8 shadow-sm">
      <img src={p.logo} alt={p.name} className="w-4 h-4 rounded-full object-contain" />
      <span className="text-[11px] font-bold text-black/60">{p.name}</span>
    </span>
  );
}

/* ── Tools ───────────────────────────────────────────────────────────── */
interface Tool {
  name: string;
  tagline: string;
  desc: string;
  providers: ProviderId[];
  href: string;
  accent: string;
  Icon: typeof Mic2;
  big?: boolean;
}

const TOOLS: Tool[] = [
  {
    name: "Text to Speech",
    tagline: "Type it. Hear it.",
    desc: "Turn any script into studio-grade narration. Pick from four engines and hundreds of voices — from calm audiobook reads to high-energy promos.",
    providers: ["elevenlabs", "minimax", "fishaudio", "edge"],
    href: "/register",
    accent: "#f97316",
    Icon: Mic2,
    big: true,
  },
  {
    name: "Voice Cloning",
    tagline: "Your voice, everywhere.",
    desc: "Upload a short sample and get a reusable digital twin of your voice for every future project.",
    providers: ["elevenlabs", "fishaudio"],
    href: "/register",
    accent: "#a855f7",
    Icon: Copy,
    big: true,
  },
  {
    name: "Edge TTS",
    tagline: "Instant & unlimited.",
    desc: "400+ multilingual voices that generate in seconds — perfect for drafts, previews and high-volume work.",
    providers: ["edge"],
    href: "/register",
    accent: "#2563eb",
    Icon: Zap,
  },
  {
    name: "Fire TTS",
    tagline: "Emotion on demand.",
    desc: "MiniMax Speech-02 delivers expressive, emotional delivery that actually sounds like acting, not reading.",
    providers: ["minimax"],
    href: "/register",
    accent: "#e11d48",
    Icon: Flame,
  },
  {
    name: "Fish Audio TTS",
    tagline: "Fast. Natural. Precise.",
    desc: "The s2.1 model family blends speed with lifelike intonation — great for dialogue and long-form audio.",
    providers: ["fishaudio"],
    href: "/register",
    accent: "#0ea5e9",
    Icon: Waves,
  },
];

/* ── Tool card ───────────────────────────────────────────────────────── */
function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const { Icon } = tool;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.05, duration: 0.45 }}
      className={tool.big ? "md:col-span-3" : "md:col-span-2"}
    >
      <Link href={tool.href}>
        <div className="group relative h-full bg-white rounded-3xl border border-black/6 p-7 sm:p-8 cursor-pointer overflow-hidden transition-all hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1">
          {/* accent glow */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.07] group-hover:opacity-[0.14] transition-opacity"
            style={{ background: tool.accent }}
          />

          <div className="flex items-start justify-between mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: tool.accent + "1a" }}
            >
              <Icon size={22} style={{ color: tool.accent }} />
            </div>
            <div className="w-9 h-9 rounded-full border border-black/8 group-hover:border-transparent group-hover:bg-black flex items-center justify-center transition-colors">
              <ArrowUpRight size={15} className="text-black/40 group-hover:text-white transition-colors" />
            </div>
          </div>

          <p className="text-[12px] font-black uppercase tracking-[0.15em] mb-1.5" style={{ color: tool.accent }}>
            {tool.tagline}
          </p>
          <h3 className="text-[24px] font-black text-black tracking-tight mb-2.5">{tool.name}</h3>
          <p className="text-[14px] text-black/50 font-medium leading-relaxed mb-6">{tool.desc}</p>

          <div className="flex flex-wrap gap-1.5">
            {tool.providers.map(p => <ProviderChip key={p} id={p} />)}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function ToolsPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fafaf8]">
      <MarketingNav />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-14 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-600 text-[12px] font-black uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Voice Studio
            </span>

            <h1 className="text-[44px] sm:text-[64px] font-black tracking-tight leading-[1.02] text-black max-w-3xl mx-auto">
              Every tool you need to{" "}
              <span className="text-orange-500">sound incredible.</span>
            </h1>

            <p className="text-[16px] text-black/50 font-medium leading-relaxed max-w-xl mx-auto mt-5">
              Five voice tools, four world-class AI engines, one studio. Write it, clone it, or generate it — OpenRadio handles the rest.
            </p>

            {/* Providers strip */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8">
              <span className="text-[12px] font-bold text-black/30 uppercase tracking-widest mr-1">Powered by</span>
              {(Object.keys(PROVIDERS) as ProviderId[]).map(p => <ProviderChip key={p} id={p} />)}
            </div>
          </motion.div>
        </section>

        {/* ── Cards grid ───────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
          <div className="grid md:grid-cols-6 gap-5">
            {TOOLS.map((tool, i) => <ToolCard key={tool.name} tool={tool} index={i} />)}
          </div>
        </section>

        {/* ── Bottom CTA ───────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-black text-white px-8 sm:px-14 py-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden"
          >
            <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="relative">
              <h3 className="text-[26px] sm:text-[34px] font-black tracking-tight leading-tight">
                Ready when you are.
              </h3>
              <p className="text-[14px] text-white/50 font-medium mt-1.5">
                Sign up free and get 5,000 characters to try every voice — no card required.
              </p>
            </div>
            <Link href="/register" className="shrink-0 relative">
              <button className="inline-flex items-center gap-2 px-7 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[14px] font-black transition-colors">
                Start creating <ArrowUpRight size={15} />
              </button>
            </Link>
          </motion.div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
