import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Mic2, AudioWaveform, MessageSquareText, Radio,
  Languages, Copy, Clock, Play, Plus, Volume2,
  ArrowUpRight, Sparkles, ChevronRight,
  MessagesSquare, Layers, Drum, Music4,
  Image as ImageIcon, BookAudio, BookOpenText,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ── Tool cards ─────────────────────────────────────────────── */
const TOOLS: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  name: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
}[] = [
  {
    href: "/studio",
    icon: Mic2,
    name: "Text to Speech",
    desc: "Convert any text to natural-sounding speech in seconds",
    iconBg: "bg-orange-100", iconColor: "text-orange-500",
  },
  {
    href: "/voice-cloning",
    icon: Copy,
    name: "Voice Cloning",
    desc: "Create a digital copy of any voice for free",
    iconBg: "bg-emerald-100", iconColor: "text-emerald-500",
  },
  {
    href: "/speech-to-speech",
    icon: AudioWaveform,
    name: "Speech to Speech",
    desc: "Transform any voice into a completely different one",
    iconBg: "bg-blue-100", iconColor: "text-blue-500",
  },
  {
    href: "/audio-isolation",
    icon: Radio,
    name: "Audio Isolation",
    desc: "Remove background noise and keep crystal clear voice",
    iconBg: "bg-violet-100", iconColor: "text-violet-500",
  },
  {
    href: "/dubbing",
    icon: Languages,
    name: "Dubbing",
    desc: "Dub any video into 29+ languages automatically",
    iconBg: "bg-rose-100", iconColor: "text-rose-500",
  },
  {
    href: "/speech-to-text",
    icon: MessageSquareText,
    name: "Speech to Text",
    desc: "Transcribe audio and video files in any language",
    iconBg: "bg-sky-100", iconColor: "text-sky-500",
  },
  {
    href: "/dialogue",
    icon: MessagesSquare,
    name: "Text to Dialogue",
    desc: "Create multi-speaker conversations with different voices",
    iconBg: "bg-indigo-100", iconColor: "text-indigo-500",
    badge: "New",
  },
  {
    href: "/batch",
    icon: Layers,
    name: "Bulk TTS",
    desc: "Convert many texts to speech in one go",
    iconBg: "bg-cyan-100", iconColor: "text-cyan-600",
    badge: "New",
  },
  {
    href: "/sound-effects",
    icon: Drum,
    name: "Sound Effects",
    desc: "Generate any sound effect from a text description",
    iconBg: "bg-amber-100", iconColor: "text-amber-600",
    badge: "New",
  },
  {
    href: "/music",
    icon: Music4,
    name: "AI Music",
    desc: "Create full songs and background music with AI",
    iconBg: "bg-pink-100", iconColor: "text-pink-500",
    badge: "New",
  },
  {
    href: "/images",
    icon: ImageIcon,
    name: "AI Images",
    desc: "Generate stunning images from text prompts",
    iconBg: "bg-teal-100", iconColor: "text-teal-600",
    badge: "New",
  },
  {
    href: "/voices",
    icon: BookAudio,
    name: "Voice Library",
    desc: "Browse thousands of voices from all providers",
    iconBg: "bg-lime-100", iconColor: "text-lime-600",
  },
  {
    href: "/dictionary",
    icon: BookOpenText,
    name: "Dictionary",
    desc: "Fix pronunciations so every word sounds right",
    iconBg: "bg-slate-100", iconColor: "text-slate-500",
  },
];

/* ── Types ───────────────────────────────────────────────────── */
interface Generation {
  id: number; text: string; voiceName: string;
  audioUrl: string; modelId: string | null;
  characterCount: number; createdAt: string;
}
interface VoiceClone { id: string; name: string; isClone?: boolean; lang?: string; }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "Just now";
}

/* ── Animated waveform bars ──────────────────────────────────── */
function WaveBars() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[3, 6, 4, 7, 5, 3, 6].map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-orange-400/70"
          animate={{ height: [`${h * 3}px`, `${(h + 4) * 3}px`, `${h * 3}px`] }}
          transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
        />
      ))}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────── */
export default function Home() {
  const { user } = useAuth();

  const { data: genData } = useQuery<{ items: Generation[]; total: number }>({
    queryKey: ["generations"],
    queryFn: () => fetch("/api/generations?limit=5").then(r => r.json()),
    staleTime: 30_000,
  });

  const { data: voiceData } = useQuery<{ builtin: VoiceClone[]; clones: VoiceClone[] }>({
    queryKey: ["minimax-voices"],
    queryFn: () => fetch("/api/minimax/voices").then(r => r.json()),
    staleTime: 60_000,
  });

  const recentGenerations = genData?.items ?? [];
  const myClones = voiceData?.clones ?? [];

  return (
    <div className="min-h-full bg-[#f7f7f6]">
      <div className="max-w-5xl mx-auto px-4 sm:px-7 py-7 sm:py-9 space-y-8">

        {/* ── Greeting ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-black leading-tight">
            Welcome back, <span className="text-orange-500">{user?.name?.split(" ")[0] ?? "there"}</span> —
          </h1>
          <p className="text-base text-black/40 font-semibold mt-0.5">what would you like to create today?</p>
        </motion.div>

        {/* ── Tool Cards Grid ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.13 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {TOOLS.map((tool, i) => (
            <motion.div
              key={tool.href + tool.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <Link href={tool.href}>
                <div className="group relative bg-white border border-black/8 rounded-2xl p-5 flex items-start gap-3.5 cursor-pointer hover:shadow-md hover:border-black/15 transition-all">
                  {/* Icon */}
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", tool.iconBg, tool.iconColor)}>
                    <tool.icon size={20} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[14px] font-black text-black leading-snug">{tool.name}</span>
                      {tool.badge && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 uppercase tracking-wide">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-black/45 font-medium leading-snug">{tool.desc}</p>
                  </div>

                  {/* Arrow */}
                  <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/[0.04] group-hover:bg-black flex items-center justify-center transition-all">
                    <ArrowUpRight size={13} className="text-black/30 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}

          {/* New Project card */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Link href="/studio">
              <div className="group bg-white border-2 border-dashed border-black/12 rounded-2xl p-5 cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition-all flex flex-col items-center justify-center min-h-[88px] text-center">
                <div className="w-9 h-9 rounded-xl bg-black/[0.04] group-hover:bg-orange-100 flex items-center justify-center mb-2 transition-colors">
                  <Plus size={18} className="text-black/25 group-hover:text-orange-500 transition-colors" />
                </div>
                <p className="text-[13px] font-black text-black/35 group-hover:text-black transition-colors">New Project</p>
                <p className="text-[11px] text-black/25 mt-0.5">Start generating audio</p>
              </div>
            </Link>
          </motion.div>
        </motion.div>

        {/* ── Generation History ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Clock size={15} className="text-black/30" />
              <h2 className="text-[15px] font-black text-black">Generation History</h2>
              {genData?.total != null && genData.total > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/6 text-black/40">
                  {genData.total}
                </span>
              )}
            </div>
            {recentGenerations.length > 0 && (
              <Link href="/studio">
                <button className="flex items-center gap-1 text-[12px] font-bold text-black/35 hover:text-black transition-colors">
                  View all <ChevronRight size={13} />
                </button>
              </Link>
            )}
          </div>

          {recentGenerations.length === 0 ? (
            <div className="bg-white border border-black/8 rounded-2xl p-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-black/4 flex items-center justify-center mb-3">
                <Sparkles size={22} className="text-black/20" />
              </div>
              <p className="text-[14px] font-black text-black mb-1">No history yet</p>
              <p className="text-[12px] text-black/40 font-medium mb-5">Generate your first audio to see it here</p>
              <Link href="/studio">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[13px] font-bold transition-colors shadow shadow-orange-500/20">
                  <Mic2 size={14} /> Open Studio
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentGenerations.map(gen => (
                <div key={gen.id} className="bg-white border border-black/8 rounded-xl px-4 sm:px-5 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-black/15 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <Play size={13} className="text-orange-500 fill-orange-500 ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-black truncate">
                        {gen.text.length > 80 ? gen.text.slice(0, 80) + "…" : gen.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-black/35">{gen.voiceName}</span>
                        <span className="text-black/20">·</span>
                        <span className="text-[11px] text-black/35">{gen.characterCount} chars</span>
                        <span className="text-[10px] text-black/30 font-medium sm:hidden">{timeAgo(gen.createdAt)}</span>
                      </div>
                    </div>
                    <span className="hidden sm:block text-[11px] text-black/30 font-medium shrink-0">{timeAgo(gen.createdAt)}</span>
                  </div>
                  {gen.audioUrl && (
                    <audio controls className="h-7 w-full sm:w-36 shrink-0" src={gen.audioUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── My Voices ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28 }}
          className="pb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Volume2 size={15} className="text-black/30" />
              <h2 className="text-[15px] font-black text-black">My Voices</h2>
              {myClones.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-black/6 text-black/40">
                  {myClones.length}
                </span>
              )}
            </div>
            <Link href="/voice-cloning">
              <button className="flex items-center gap-1.5 text-[12px] font-bold text-black/35 hover:text-black transition-colors">
                <Plus size={12} /> Add Voice
              </button>
            </Link>
          </div>

          {myClones.length === 0 ? (
            <div className="bg-white border border-black/8 rounded-2xl p-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-black/4 flex items-center justify-center mb-3">
                <Volume2 size={22} className="text-black/20" />
              </div>
              <p className="text-[14px] font-black text-black mb-1">No voices yet</p>
              <p className="text-[12px] text-black/40 font-medium mb-5">Clone a voice for free — upload a 10-second sample</p>
              <Link href="/voice-cloning">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-[13px] font-bold transition-colors shadow shadow-violet-500/20">
                  <Copy size={14} /> Clone a Voice
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {myClones.map((voice) => (
                <Link key={voice.id} href="/voice-cloning">
                  <div className="bg-white border border-black/8 rounded-2xl p-4 cursor-pointer hover:border-violet-200 hover:shadow-md transition-all group">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center mb-3 text-violet-600 font-black text-lg group-hover:bg-violet-200 transition-colors">
                      {voice.name[0].toUpperCase()}
                    </div>
                    <p className="text-[13px] font-bold text-black truncate">{voice.name}</p>
                    <p className="text-[11px] text-black/35 mt-0.5">Custom Clone</p>
                  </div>
                </Link>
              ))}
              <Link href="/voice-cloning">
                <div className="bg-white border-2 border-dashed border-black/12 rounded-2xl p-4 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all flex flex-col items-center justify-center min-h-[100px] text-center group">
                  <div className="w-9 h-9 rounded-xl bg-black/4 group-hover:bg-violet-100 flex items-center justify-center mb-2 transition-colors">
                    <Plus size={16} className="text-black/25 group-hover:text-violet-500 transition-colors" />
                  </div>
                  <p className="text-[12px] font-black text-black/30 group-hover:text-black transition-colors">Add Voice</p>
                </div>
              </Link>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
