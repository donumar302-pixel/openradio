import { useState, useMemo } from "react";
import { useListVoices, getListVoicesQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Play, Square, Mic2, Zap, BookAudio, Filter, ChevronDown,
  Globe, User2, PlayCircle, StopCircle, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface MiniMaxVoice { id: string; name: string; lang?: string; style?: string; isClone?: boolean; }

type Tab = "all" | "el" | "mm";
type Gender = "all" | "male" | "female";

/* ─── small audio preview hook ─────────────────────────────────────── */
function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const toggle = (id: string, url: string) => {
    if (playingId === id) {
      audio?.pause();
      setPlayingId(null);
      setAudio(null);
    } else {
      audio?.pause();
      const a = new Audio(url);
      a.play();
      a.onended = () => { setPlayingId(null); setAudio(null); };
      setPlayingId(id);
      setAudio(a);
    }
  };

  return { playingId, toggle };
}

/* ─── Voice card ─────────────────────────────────────────────────── */
function VoiceCard({
  id, name, tag, badge, badgeColor, preview, description, onUse, playingId, onPlay,
}: {
  id: string; name: string; tag: string; badge: string; badgeColor: string;
  preview?: string | null; description?: string | null;
  onUse: () => void; playingId: string | null;
  onPlay: (id: string, url: string) => void;
}) {
  const playing = playingId === id;
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 flex flex-col gap-3 hover:border-[#d1d5db] hover:shadow-sm transition-all group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-[12px] font-black",
            badge === "ElevenLabs" ? "bg-orange-500" : "bg-violet-500"
          )}>
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground truncate leading-tight">{name}</p>
            <p className="text-[11px] text-[#9ca3af] truncate leading-tight mt-0.5">{tag}</p>
          </div>
        </div>
        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 mt-0.5", badgeColor)}>
          {badge}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-[12px] text-[#6b7280] line-clamp-2 leading-relaxed">{description}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        {preview ? (
          <button
            onClick={() => onPlay(id, preview)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
              playing
                ? "bg-orange-100 text-orange-600"
                : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb] hover:text-foreground"
            )}
          >
            {playing ? <StopCircle size={13} /> : <PlayCircle size={13} />}
            {playing ? "Stop" : "Preview"}
          </button>
        ) : (
          <div className="flex-1" />
        )}
        <button
          onClick={copyId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb] transition-colors"
          title="Copy voice ID"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? "Copied" : "ID"}
        </button>
        <button
          onClick={onUse}
          className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Use
        </button>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function VoiceLibraryPage() {
  const [, navigate] = useLocation();
  const { playingId, toggle } = useAudioPreview();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [gender, setGender] = useState<Gender>("all");
  const [langFilter, setLangFilter] = useState("all");

  /* fetch ElevenLabs voices */
  const { data: elVoices = [], isLoading: loadingEl } = useListVoices({
    query: { queryKey: getListVoicesQueryKey() },
  });

  /* fetch MiniMax voices */
  const { data: mmData, isLoading: loadingMm } = useQuery<{ builtin: MiniMaxVoice[]; clones: MiniMaxVoice[] }>({
    queryKey: ["minimax-voices"],
    queryFn: () => fetch("/api/minimax/voices").then(r => r.json()),
    staleTime: 60_000,
  });
  const mmVoices: MiniMaxVoice[] = [
    ...(mmData?.clones ?? []).map(c => ({ ...c, isClone: true })),
    ...(mmData?.builtin ?? []),
  ];

  /* build unified list */
  const allVoices = useMemo(() => {
    const el = elVoices.map(v => ({
      id: `el:${v.voiceId}`, rawId: v.voiceId, name: v.name,
      provider: "el" as const,
      tag: v.category ?? "General",
      description: v.description ?? null,
      preview: v.previewUrl ?? null,
      lang: "English",
    }));
    const mm = mmVoices.map(v => ({
      id: `mm:${v.id}`, rawId: v.id, name: v.name,
      provider: "mm" as const,
      tag: v.isClone ? "My Clone" : `${v.lang ?? ""} · ${v.style ?? ""}`,
      description: null,
      preview: null,
      lang: v.lang ?? "Other",
    }));
    return [...el, ...mm];
  }, [elVoices, mmVoices]);

  /* langs for filter */
  const langs = useMemo(() => {
    const set = new Set(allVoices.map(v => v.lang).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [allVoices]);

  /* filtered list */
  const filtered = useMemo(() => {
    return allVoices.filter(v => {
      if (tab === "el" && v.provider !== "el") return false;
      if (tab === "mm" && v.provider !== "mm") return false;
      if (langFilter !== "all" && v.lang !== langFilter) return false;
      if (gender === "male" && !/male|man|boy/i.test(v.name + v.tag)) return false;
      if (gender === "female" && !/female|woman|girl/i.test(v.name + v.tag)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!v.name.toLowerCase().includes(q) && !v.tag.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allVoices, tab, langFilter, gender, search]);

  const isLoading = loadingEl || loadingMm;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "all", label: "All Voices", icon: <BookAudio size={14} />, count: allVoices.length },
    { id: "el",  label: "ElevenLabs", icon: <Mic2 size={14} />,     count: elVoices.length },
    { id: "mm",  label: "Fire TTS",   icon: <Zap size={14} />,      count: mmVoices.length },
  ];

  return (
    <div className="min-h-full bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-[#f3f4f6] px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-foreground leading-tight">Voice Library</h1>
            <p className="text-[13px] text-[#6b7280] mt-0.5">
              {isLoading ? "Loading..." : `${allVoices.length} voices from all providers`}
            </p>
          </div>
          {/* Search */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search voices..."
              className="w-full pl-8 pr-4 py-2 text-[13px] border border-[#e5e7eb] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors",
                tab === t.id
                  ? "bg-[#f3f4f6] text-foreground"
                  : "text-[#6b7280] hover:text-foreground hover:bg-[#f9fafb]"
              )}
            >
              {t.icon}
              {t.label}
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                tab === t.id ? "bg-primary text-white" : "bg-[#e5e7eb] text-[#6b7280]"
              )}>
                {t.count}
              </span>
            </button>
          ))}

          {/* Gender filter */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-xl p-1 bg-white">
              {(["all", "male", "female"] as Gender[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors",
                    gender === g ? "bg-[#f3f4f6] text-foreground" : "text-[#9ca3af] hover:text-foreground"
                  )}
                >
                  {g === "all" ? "Any" : g}
                </button>
              ))}
            </div>

            {/* Language filter */}
            <select
              value={langFilter}
              onChange={e => setLangFilter(e.target.value)}
              className="text-[12px] border border-[#e5e7eb] rounded-xl px-3 py-2 bg-white text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {langs.map(l => (
                <option key={l} value={l}>{l === "all" ? "All Languages" : l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-[#9ca3af]">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[14px] font-medium">Loading voices from all providers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2 text-[#9ca3af]">
            <BookAudio size={36} className="opacity-30" />
            <p className="text-[14px] font-semibold">No voices found</p>
            <p className="text-[12px]">Try a different search or filter</p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-[#9ca3af] font-semibold mb-4">{filtered.length} voices</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(v => (
                <VoiceCard
                  key={v.id}
                  id={v.rawId}
                  name={v.name}
                  tag={v.tag}
                  badge={v.provider === "el" ? "ElevenLabs" : "Fire TTS"}
                  badgeColor={v.provider === "el" ? "bg-orange-100 text-orange-600" : "bg-violet-100 text-violet-600"}
                  preview={v.preview}
                  description={v.description}
                  playingId={playingId}
                  onPlay={toggle}
                  onUse={() => navigate(`/studio?voice=${v.provider}:${v.rawId}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
