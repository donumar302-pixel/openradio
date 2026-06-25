import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Mic2, AudioWaveform, MessageSquareText, Radio,
  Languages, Copy, Clock, ChevronRight,
  Play, Plus, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Tool cards (top strip) ──────────────────────────────────── */
const TOOLS = [
  {
    href: "/studio",
    icon: <Mic2 size={22} />,
    name: "Text to Speech",
    desc: "Convert any text to natural-sounding speech in seconds",
    iconBg: "bg-orange-50", iconColor: "text-orange-500",
  },
  {
    href: "/voice-cloning",
    icon: <Copy size={22} />,
    name: "Voice Cloning",
    desc: "Create a digital copy of any voice for free",
    iconBg: "bg-green-50", iconColor: "text-green-500",
    badge: "Free",
  },
  {
    href: "/speech-to-speech",
    icon: <AudioWaveform size={22} />,
    name: "Speech to Speech",
    desc: "Transform any voice into a completely different one",
    iconBg: "bg-blue-50", iconColor: "text-blue-500",
  },
  {
    href: "/audio-isolation",
    icon: <Radio size={22} />,
    name: "Audio Isolation",
    desc: "Remove background noise and keep crystal clear voice",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-500",
  },
  {
    href: "/dubbing",
    icon: <Languages size={22} />,
    name: "Dubbing",
    desc: "Dub any video into 29+ languages automatically",
    iconBg: "bg-rose-50", iconColor: "text-rose-500",
  },
  {
    href: "/speech-to-text",
    icon: <MessageSquareText size={22} />,
    name: "Speech to Text",
    desc: "Transcribe audio and video files in any language",
    iconBg: "bg-sky-50", iconColor: "text-sky-500",
  },
];

/* ── Generation item ─────────────────────────────────────────── */
interface Generation {
  id: number;
  text: string;
  voiceName: string;
  audioUrl: string;
  modelId: string | null;
  characterCount: number;
  createdAt: string;
}

interface VoiceClone {
  id: string; name: string; isClone?: boolean; lang?: string;
}

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
    <div className="min-h-full bg-[#fafafa]">
      <div className="max-w-5xl mx-auto px-4 sm:px-7 py-6 sm:py-8 space-y-8 sm:space-y-10">

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-foreground mb-1">
            Home
          </h1>
          <p className="text-[#9ca3af] text-[14px]">
            Welcome back, <span className="font-semibold text-foreground">{user?.name ?? "there"}</span>. What would you like to create today?
          </p>
        </div>

        {/* ── Tool cards strip ── */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {TOOLS.map(tool => (
              <Link key={tool.href} href={tool.href}>
                <div className="group bg-white border border-[#f0f0f0] rounded-2xl p-5 cursor-pointer hover:border-[#e0e0e0] hover:shadow-md transition-all">
                  {/* Icon */}
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105",
                    tool.iconBg, tool.iconColor
                  )}>
                    {tool.icon}
                  </div>
                  {/* Name + badge */}
                  <div className="flex items-start gap-1.5 mb-1.5 flex-wrap">
                    <p className="text-[14px] font-bold text-foreground leading-snug">{tool.name}</p>
                    {tool.badge && (
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5",
                        tool.badge === "Free" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                      )}>
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#9ca3af] leading-snug">{tool.desc}</p>
                </div>
              </Link>
            ))}

            {/* New project card */}
            <Link href="/studio">
              <div className="group bg-white border-2 border-dashed border-[#e5e7eb] rounded-2xl p-5 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all flex flex-col items-center justify-center min-h-[130px] text-center">
                <div className="w-11 h-11 rounded-xl bg-[#f9fafb] group-hover:bg-orange-100 flex items-center justify-center mb-3 transition-colors">
                  <Plus size={20} className="text-[#9ca3af] group-hover:text-orange-500 transition-colors" />
                </div>
                <p className="text-[13px] font-bold text-[#6b7280] group-hover:text-foreground transition-colors">New Project</p>
                <p className="text-[11px] text-[#9ca3af] mt-1">Start generating audio</p>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Generation History ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#9ca3af]" />
              <h2 className="text-[16px] font-bold text-foreground">Generation History</h2>
              {genData?.total != null && genData.total > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">
                  {genData.total}
                </span>
              )}
            </div>
            {recentGenerations.length > 0 && (
              <Link href="/studio">
                <button className="flex items-center gap-1 text-[12px] font-semibold text-[#6b7280] hover:text-foreground transition-colors">
                  View all <ChevronRight size={13} />
                </button>
              </Link>
            )}
          </div>

          {recentGenerations.length === 0 ? (
            <div className="bg-white border border-[#f0f0f0] rounded-2xl p-12 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f9fafb] flex items-center justify-center mb-4">
                <Clock size={24} className="text-[#d1d5db]" />
              </div>
              <p className="text-[15px] font-bold text-foreground mb-1">No history yet</p>
              <p className="text-[13px] text-[#9ca3af] mb-5">Generate your first audio to see it here</p>
              <Link href="/studio">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary/90 transition-colors shadow-sm">
                  <Mic2 size={14} /> Open Studio
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentGenerations.map(gen => (
                <div key={gen.id} className="bg-white border border-[#f0f0f0] rounded-xl px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-[#e0e0e0] hover:shadow-sm transition-all">
                  {/* Top row: icon + info + time */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                      <Play size={14} className="text-primary fill-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">
                        {gen.text.length > 80 ? gen.text.slice(0, 80) + "…" : gen.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[12px] text-[#9ca3af]">{gen.voiceName}</span>
                        <span className="text-[12px] text-[#d1d5db]">·</span>
                        <span className="text-[12px] text-[#9ca3af]">{gen.characterCount} chars</span>
                        <span className="text-[11px] text-[#9ca3af] font-medium sm:hidden">{timeAgo(gen.createdAt)}</span>
                      </div>
                    </div>
                    <span className="hidden sm:block text-[11px] text-[#9ca3af] font-medium shrink-0">{timeAgo(gen.createdAt)}</span>
                  </div>
                  {/* Audio player */}
                  {gen.audioUrl && (
                    <audio controls className="h-7 w-full sm:w-36 shrink-0" src={gen.audioUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── My Voices ── */}
        <div className="pb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-[#9ca3af]" />
              <h2 className="text-[16px] font-bold text-foreground">My Voices</h2>
              {myClones.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">
                  {myClones.length}
                </span>
              )}
            </div>
            <Link href="/voice-cloning">
              <button className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6b7280] hover:text-foreground transition-colors">
                <Plus size={13} /> Add Voice
              </button>
            </Link>
          </div>

          {myClones.length === 0 ? (
            <div className="bg-white border border-[#f0f0f0] rounded-2xl p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f9fafb] flex items-center justify-center mb-4">
                <Volume2 size={24} className="text-[#d1d5db]" />
              </div>
              <p className="text-[15px] font-bold text-foreground mb-1">No voices yet</p>
              <p className="text-[13px] text-[#9ca3af] mb-5">Clone a voice for free — upload a 10-second sample</p>
              <Link href="/voice-cloning">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[13px] font-bold hover:bg-violet-700 transition-colors shadow-sm">
                  <Copy size={14} /> Clone a Voice
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {myClones.map((voice) => (
                <Link key={voice.id} href="/voice-cloning">
                  <div className="bg-white border border-[#f0f0f0] rounded-2xl p-4 cursor-pointer hover:border-violet-200 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-3 text-violet-600 font-black text-[18px] group-hover:bg-violet-200 transition-colors">
                      {voice.name[0].toUpperCase()}
                    </div>
                    <p className="text-[13px] font-bold text-foreground truncate">{voice.name}</p>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">Custom Clone</p>
                  </div>
                </Link>
              ))}

              {/* Add new voice card */}
              <Link href="/voice-cloning">
                <div className="bg-white border-2 border-dashed border-[#e5e7eb] rounded-2xl p-4 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all flex flex-col items-center justify-center min-h-[100px] text-center group">
                  <div className="w-10 h-10 rounded-xl bg-[#f9fafb] group-hover:bg-violet-100 flex items-center justify-center mb-2 transition-colors">
                    <Plus size={18} className="text-[#9ca3af] group-hover:text-violet-500 transition-colors" />
                  </div>
                  <p className="text-[12px] font-bold text-[#9ca3af] group-hover:text-foreground transition-colors">Add Voice</p>
                </div>
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
