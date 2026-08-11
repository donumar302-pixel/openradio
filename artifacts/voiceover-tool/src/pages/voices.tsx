import { useState, useMemo } from "react";
import { useListVoices, getListVoicesQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Zap, BookAudio, PlayCircle, StopCircle, Copy, Check, Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface MiniMaxVoice { id: string; name: string; lang?: string; style?: string; isClone?: boolean; }
interface FishVoice    { id: string; name: string; lang?: string; languages?: string[]; style?: string; tags?: string[]; description?: string | null; preview?: string | null; likeCount?: number; taskCount?: number; }
interface EdgeVoice    { id: string; name: string; shortName: string; locale: string; gender: string; provider: string; }

type Tab    = "all" | "el" | "mm" | "fa" | "edge";
type Gender = "all" | "male" | "female";

const FA_LANG_OPTIONS = [
  { code: "",   label: "All Languages" },
  { code: "en", label: "🇺🇸 English" },
  { code: "zh", label: "🇨🇳 Chinese" },
  { code: "ja", label: "🇯🇵 Japanese" },
  { code: "ko", label: "🇰🇷 Korean" },
  { code: "hi", label: "🇮🇳 Hindi" },
  { code: "ur", label: "🇵🇰 Urdu" },
  { code: "ar", label: "🇸🇦 Arabic" },
  { code: "es", label: "🇪🇸 Spanish" },
  { code: "fr", label: "🇫🇷 French" },
  { code: "de", label: "🇩🇪 German" },
  { code: "ru", label: "🇷🇺 Russian" },
  { code: "pt", label: "🇧🇷 Portuguese" },
  { code: "it", label: "🇮🇹 Italian" },
  { code: "tr", label: "🇹🇷 Turkish" },
  { code: "id", label: "🇮🇩 Indonesian" },
  { code: "vi", label: "🇻🇳 Vietnamese" },
  { code: "th", label: "🇹🇭 Thai" },
  { code: "pl", label: "🇵🇱 Polish" },
  { code: "nl", label: "🇳🇱 Dutch" },
  { code: "sv", label: "🇸🇪 Swedish" },
  { code: "cs", label: "🇨🇿 Czech" },
  { code: "ro", label: "🇷🇴 Romanian" },
  { code: "hu", label: "🇭🇺 Hungarian" },
  { code: "el", label: "🇬🇷 Greek" },
  { code: "da", label: "🇩🇰 Danish" },
  { code: "fi", label: "🇫🇮 Finnish" },
  { code: "nb", label: "🇳🇴 Norwegian" },
  { code: "uk", label: "🇺🇦 Ukrainian" },
  { code: "ms", label: "🇲🇾 Malay" },
  { code: "fil", label: "🇵🇭 Filipino" },
];

function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio, setAudio]         = useState<HTMLAudioElement | null>(null);
  const toggle = (id: string, url: string) => {
    if (playingId === id) { audio?.pause(); setPlayingId(null); setAudio(null); return; }
    audio?.pause();
    const a = new Audio(url);
    a.play();
    a.onended = () => { setPlayingId(null); setAudio(null); };
    setPlayingId(id);
    setAudio(a);
  };
  return { playingId, toggle };
}

type Provider = "el" | "mm" | "fa" | "edge";

const BADGE: Record<Provider, { label: string; cls: string; avatar: string }> = {
  el:   { label: "ElevenLabs", cls: "bg-orange-100 text-orange-600",  avatar: "bg-orange-500"  },
  mm:   { label: "Fire TTS",   cls: "bg-violet-100 text-violet-600",  avatar: "bg-violet-500"  },
  fa:   { label: "Fish Audio", cls: "bg-emerald-100 text-emerald-600", avatar: "bg-emerald-500" },
  edge: { label: "Edge TTS",   cls: "bg-sky-100 text-sky-600",         avatar: "bg-sky-500"     },
};

function VoiceCard({ id, name, tag, provider, preview, description, onUse, playingId, onPlay }: {
  id: string; name: string; tag: string; provider: Provider;
  preview?: string | null; description?: string | null;
  onUse: () => void; playingId: string | null;
  onPlay: (id: string, url: string) => void;
}) {
  const playing = playingId === id;
  const [copied, setCopied] = useState(false);
  const b = BADGE[provider];
  const copyId = () => { navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 flex flex-col gap-3 hover:border-[#d1d5db] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-[12px] font-black", b.avatar)}>
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground truncate leading-tight">{name}</p>
            <p className="text-[11px] text-[#9ca3af] truncate leading-tight mt-0.5">{tag}</p>
          </div>
        </div>
        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 mt-0.5", b.cls)}>{b.label}</span>
      </div>

      {description && <p className="text-[12px] text-[#6b7280] line-clamp-2 leading-relaxed">{description}</p>}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {preview ? (
          <button onClick={() => onPlay(id, preview)} className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
            playing ? "bg-orange-100 text-orange-600" : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb] hover:text-foreground"
          )}>
            {playing ? <StopCircle size={13} /> : <PlayCircle size={13} />}
            {playing ? "Stop" : "Preview"}
          </button>
        ) : <div className="flex-1" />}
        <button onClick={copyId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb] transition-colors" title="Copy voice ID">
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? "Copied" : "ID"}
        </button>
        <button onClick={onUse} className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
          Use
        </button>
      </div>
    </div>
  );
}

export default function VoiceLibraryPage() {
  const [, navigate] = useLocation();
  const { playingId, toggle } = useAudioPreview();

  const [search,     setSearch]     = useState("");
  const [tab,        setTab]        = useState<Tab>("all");
  const [gender,     setGender]     = useState<Gender>("all");
  const [langFilter, setLangFilter] = useState("all");
  const [faLang,     setFaLang]     = useState("");

  const { data: elVoices = [], isLoading: loadingEl } = useListVoices({ query: { queryKey: getListVoicesQueryKey() } });

  const { data: mmData, isLoading: loadingMm } = useQuery<{ builtin: MiniMaxVoice[]; clones: MiniMaxVoice[] }>({
    queryKey: ["minimax-voices"],
    queryFn:  () => fetch("/api/minimax/voices").then(r => r.json()),
    staleTime: 60_000,
  });
  const mmVoices: MiniMaxVoice[] = [
    ...(mmData?.clones ?? []).map(c => ({ ...c, isClone: true })),
    ...(mmData?.builtin ?? []),
  ];

  const [faPage, setFaPage] = useState(1);
  const resetFaPage = (lang: string) => { setFaLang(lang); setFaPage(1); };

  const [edgeLang, setEdgeLang] = useState("");
  const { data: edgeData, isLoading: loadingEdge } = useQuery<{ voices: EdgeVoice[]; total: number }>({
    queryKey: ["edge-voices", edgeLang],
    queryFn:  () => fetch(`/api/edge/voices${edgeLang ? `?language=${edgeLang}` : ""}`).then(r => r.json()),
    staleTime: 3_600_000,
  });
  const edgeVoices: EdgeVoice[] = edgeData?.voices ?? [];

  const { data: faData, isLoading: loadingFa } = useQuery<{ voices: FishVoice[]; total: number; totalPages: number }>({
    queryKey: ["fishaudio-voices", faLang, faPage],
    queryFn:  () => fetch(`/api/fishaudio/voices?page=${faPage}${faLang ? `&language=${faLang}` : ""}`).then(r => r.json()),
    staleTime: 120_000,
  });
  const faVoices: FishVoice[] = (faData?.voices ?? []).filter(v => v.id !== "default");
  const faTotalPages = faData?.totalPages ?? 1;
  const faTotal = faData?.total ?? 0;

  const allVoices = useMemo(() => {
    const el = elVoices.map(v => ({
      id: v.voiceId, name: v.name, provider: "el" as Provider,
      tag: v.category ?? "General", description: v.description ?? null,
      preview: v.previewUrl ?? null, lang: "English", tags: [] as string[],
    }));
    const mm = mmVoices.map(v => ({
      id: v.id, name: v.name, provider: "mm" as Provider,
      tag: v.isClone ? "My Clone" : `${v.lang ?? ""} · ${v.style ?? ""}`,
      description: null, preview: null, lang: v.lang ?? "Other", tags: [] as string[],
    }));
    const fa = faVoices.map(v => ({
      id: v.id, name: v.name, provider: "fa" as Provider,
      tag: (v.tags ?? []).slice(0, 3).join(" · ") || v.lang || "Fish Audio",
      description: v.description ?? null,
      preview: v.preview ?? null,
      lang: v.lang ?? "Multi",
      tags: v.tags ?? [],
    }));
    const edge = edgeVoices.map(v => ({
      id: v.id, name: v.name, provider: "edge" as Provider,
      tag: `${v.gender} · ${v.locale}`,
      description: null, preview: null,
      lang: v.locale.split("-")[0]?.toUpperCase() ?? "Multi",
      tags: [] as string[],
    }));
    return [...el, ...mm, ...fa, ...edge];
  }, [elVoices, mmVoices, faVoices, edgeVoices]);

  const elLangs = useMemo(() => {
    const s = new Set(elVoices.map(() => "English"));
    return ["all", ...Array.from(s).sort()];
  }, [elVoices]);

  const mmLangs = useMemo(() => {
    const s = new Set(mmVoices.map(v => v.lang ?? "Other").filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [mmVoices]);

  const allLangs = useMemo(() => {
    const s = new Set(allVoices.filter(v => v.provider !== "fa").map(v => v.lang).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [allVoices]);

  const langs = tab === "el" ? elLangs : tab === "mm" ? mmLangs : (tab === "fa" || tab === "edge") ? [] : allLangs;

  const filtered = useMemo(() => {
    return allVoices.filter(v => {
      if (tab === "el"   && v.provider !== "el")   return false;
      if (tab === "mm"   && v.provider !== "mm")   return false;
      if (tab === "fa"   && v.provider !== "fa")   return false;
      if (tab === "edge" && v.provider !== "edge") return false;
      if (v.provider !== "fa" && v.provider !== "edge" && langFilter !== "all" && v.lang !== langFilter) return false;
      if (gender === "male"   && !/male|man|boy/i.test(v.name + v.tag))   return false;
      if (gender === "female" && !/female|woman|girl/i.test(v.name + v.tag)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!v.name.toLowerCase().includes(q) && !v.tag.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allVoices, tab, langFilter, gender, search]);

  const isLoading = loadingEl || loadingMm || loadingFa || loadingEdge;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "all",  label: "All Voices", icon: <BookAudio size={14} />, count: allVoices.length },
    { id: "el",   label: "ElevenLabs", icon: <Mic2 size={14} />,      count: elVoices.length },
    { id: "mm",   label: "Fire TTS",   icon: <Zap size={14} />,       count: mmVoices.length },
    { id: "fa",   label: "Fish Audio", icon: <span className="text-[11px]">🐟</span>, count: faVoices.length },
    { id: "edge", label: "Edge TTS",   icon: <span className="text-[11px]">🪟</span>, count: edgeVoices.length },
  ];

  return (
    <div className="min-h-full bg-[#fafafa]">
      <div className="bg-white border-b border-[#f3f4f6] px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-foreground leading-tight">Voice Library</h1>
            <p className="text-[13px] text-[#6b7280] mt-0.5">
              {isLoading ? "Loading..." : `${allVoices.length} voices from all providers`}
            </p>
          </div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search voices..."
              className="w-full pl-8 pr-4 py-2 text-[13px] border border-[#e5e7eb] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 mt-5 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors",
              tab === t.id ? "bg-[#f3f4f6] text-foreground" : "text-[#6b7280] hover:text-foreground hover:bg-[#f9fafb]"
            )}>
              {t.icon} {t.label}
              <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-primary text-white" : "bg-[#e5e7eb] text-[#6b7280]")}>
                {t.count}
              </span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Fish Audio language selector */}
            {(tab === "fa" || tab === "all") && (
              <select
                value={faLang} onChange={e => resetFaPage(e.target.value)}
                className="text-[12px] border border-emerald-200 rounded-xl px-3 py-2 bg-white text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-emerald-200 cursor-pointer"
              >
                {FA_LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            )}

            {/* Gender */}
            <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-xl p-1 bg-white">
              {(["all", "male", "female"] as Gender[]).map(g => (
                <button key={g} onClick={() => setGender(g)} className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors",
                  gender === g ? "bg-[#f3f4f6] text-foreground" : "text-[#9ca3af] hover:text-foreground"
                )}>
                  {g === "all" ? "Any" : g}
                </button>
              ))}
            </div>

            {/* Lang filter (EL / MM) */}
            {tab !== "fa" && langs.length > 1 && (
              <select
                value={langFilter} onChange={e => setLangFilter(e.target.value)}
                className="text-[12px] border border-[#e5e7eb] rounded-xl px-3 py-2 bg-white text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {langs.map(l => <option key={l} value={l}>{l === "all" ? "All Languages" : l}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

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
            <p className="text-[12px] text-[#9ca3af] font-semibold mb-4">
              {tab === "fa"
                ? `${faTotal.toLocaleString()} voices total · page ${faPage} of ${faTotalPages}`
                : `${filtered.length} voices`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(v => (
                <VoiceCard
                  key={`${v.provider}:${v.id}`}
                  id={v.id} name={v.name} tag={v.tag}
                  provider={v.provider}
                  preview={v.preview}
                  description={v.description}
                  playingId={playingId}
                  onPlay={toggle}
                  onUse={() => navigate(`/studio?voice=${v.provider}:${v.id}`)}
                />
              ))}
            </div>
            {/* Fish Audio pagination */}
            {tab === "fa" && faTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  disabled={faPage <= 1}
                  onClick={() => setFaPage(p => p - 1)}
                  className="px-4 py-2 text-[13px] font-semibold border border-[#e5e7eb] rounded-xl bg-white hover:bg-[#f3f4f6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >← Prev</button>
                <span className="text-[13px] text-[#6b7280] font-medium px-3">
                  {faPage} / {faTotalPages}
                </span>
                <button
                  disabled={faPage >= faTotalPages}
                  onClick={() => setFaPage(p => p + 1)}
                  className="px-4 py-2 text-[13px] font-semibold border border-[#e5e7eb] rounded-xl bg-white hover:bg-[#f3f4f6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
