import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, BookAudio, PlayCircle, StopCircle, Copy, Check, Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { osJson, type OsVoice } from "@/lib/os-api";

/* ── Providers ──────────────────────────────────────────────────────────── */

const LOGO = (name: string) => `${import.meta.env.BASE_URL}logos/${name}.png`;

type ProviderId = "elevenlabs" | "minimax" | "fishaudio" | "edge" | "vbee" | "clone";
type Tab = "all" | ProviderId;

const OS_PROVIDER_IDS = ["elevenlabs", "minimax", "fishaudio", "edge", "vbee"] as const;

const PROVIDER_META: Record<ProviderId, { label: string; logo?: string; icon?: React.ReactNode; cls: string }> = {
  elevenlabs: { label: "ElevenLabs", logo: LOGO("elevenlabs"), cls: "bg-orange-100 text-orange-700" },
  minimax:    { label: "Fire TTS",   logo: LOGO("minimax"),    cls: "bg-violet-100 text-violet-600" },
  fishaudio:  { label: "Fish Audio", logo: LOGO("fishaudio"),  cls: "bg-emerald-100 text-emerald-600" },
  edge:       { label: "Edge TTS",   logo: LOGO("edge"),       cls: "bg-sky-100 text-sky-600" },
  vbee:       { label: "Vbee",       logo: LOGO("vbee"),       cls: "bg-indigo-100 text-indigo-600" },
  clone:      { label: "My Clones",  icon: <Mic2 size={13} />, cls: "bg-purple-100 text-purple-600" },
};

const PAGE_SIZE = 24;

const LANG_OPTIONS = [
  { code: "",   label: "All Languages" },
  { code: "en", label: "🇺🇸 English" },
  { code: "ur", label: "🇵🇰 Urdu" },
  { code: "hi", label: "🇮🇳 Hindi" },
  { code: "ar", label: "🇸🇦 Arabic" },
  { code: "zh", label: "🇨🇳 Chinese" },
  { code: "ja", label: "🇯🇵 Japanese" },
  { code: "ko", label: "🇰🇷 Korean" },
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
  { code: "nl", label: "🇳🇱 Dutch" },
  { code: "pl", label: "🇵🇱 Polish" },
  { code: "sv", label: "🇸🇪 Swedish" },
  { code: "fil", label: "🇵🇭 Filipino" },
  { code: "ms", label: "🇲🇾 Malay" },
];

type Gender = "" | "male" | "female";

/* ── Helpers ────────────────────────────────────────────────────────────── */

function useDebounced<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function previewOf(v: OsVoice): string | null {
  return v.preview_url || v.languages?.find((l) => l.preview_url)?.preview_url || null;
}

function osVoicesQuery(provider: string, page: number, search: string, language: string, gender: string) {
  return {
    queryKey: ["os-lib-voices", provider, page, search, language, gender],
    queryFn: () => {
      const params = new URLSearchParams({ provider, page: String(page), page_size: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (language) params.set("language", language);
      if (gender) params.set("gender", gender);
      return osJson<{ data: OsVoice[]; pagination?: { total?: number } }>(`/voices?${params}`);
    },
    staleTime: 120_000,
  };
}

interface CardVoice {
  id: string;
  name: string;
  tag: string;
  provider: ProviderId;
  description?: string | null;
  preview?: string | null;
}

/* ── Provider badge (official logo) ─────────────────────────────────────── */

function ProviderBadge({ provider }: { provider: ProviderId }) {
  const m = PROVIDER_META[provider];
  return (
    <span className={cn("flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 mt-0.5", m.cls)}>
      {m.logo ? <img src={m.logo} alt="" className="w-3 h-3 rounded-[3px] object-contain" /> : m.icon}
      {m.label}
    </span>
  );
}

/* ── Voice card ─────────────────────────────────────────────────────────── */

function VoiceCard({ v, onUse, playingId, onPlay }: {
  v: CardVoice; onUse: () => void; playingId: string | null;
  onPlay: (id: string, url: string) => void;
}) {
  const playing = playingId === v.id;
  const [copied, setCopied] = useState(false);
  const m = PROVIDER_META[v.provider];
  const copyId = () => { navigator.clipboard.writeText(v.id); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="bg-white border border-[#e5e7eb] rounded-2xl p-4 flex flex-col gap-3 hover:border-[#d1d5db] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#f3f4f6] border border-[#e5e7eb] overflow-hidden">
            {m.logo
              ? <img src={m.logo} alt={m.label} className="w-5 h-5 object-contain" />
              : <span className="text-[12px] font-black text-[#6b7280]">{v.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground truncate leading-tight">{v.name}</p>
            <p className="text-[11px] text-[#9ca3af] truncate leading-tight mt-0.5">{v.tag}</p>
          </div>
        </div>
        <ProviderBadge provider={v.provider} />
      </div>

      {v.description && <p className="text-[12px] text-[#6b7280] line-clamp-2 leading-relaxed">{v.description}</p>}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {v.preview ? (
          <button onClick={() => onPlay(v.id, v.preview!)} className={cn(
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

/* ── Page ───────────────────────────────────────────────────────────────── */


export default function VoiceLibraryPage() {
  const [, navigate] = useLocation();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const togglePlay = (id: string, url: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setPlayingId(null);
    a.play().catch(() => setPlayingId(null));
    setPlayingId(id);
  };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  useEffect(() => { setPage(1); }, [tab, q, language, gender]);

  /* Aggregated catalog (single stable global page across all providers).
     Also feeds the per-provider tab badge counts via its `totals` map. */
  const aggPage = tab === "all" ? page : 1;
  const { data: aggData, isLoading: aggLoading } = useQuery({
    queryKey: ["os-lib-all", aggPage, q, language, gender],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(aggPage), page_size: String(PAGE_SIZE) });
      if (q) params.set("search", q);
      if (language) params.set("language", language);
      if (gender) params.set("gender", gender);
      return osJson<{
        data: (OsVoice & { provider: string })[];
        pagination: { total: number };
        totals: Record<string, number>;
        indexing?: boolean;
      }>(`/voices/all?${params}`);
    },
    staleTime: 120_000,
    // While the server is still sweeping the ElevenLabs catalog into its
    // index, poll so totals and pages keep growing live.
    refetchInterval: (query) => (query.state.data?.indexing ? 8_000 : false),
  });

  /* Single-provider tab query */
  const providerTab = tab !== "all" ? tab : null;
  const { data: provData, isLoading: provLoading } = useQuery({
    ...osVoicesQuery(providerTab ?? "elevenlabs", page, q, language, gender),
    enabled: !!providerTab,
    refetchInterval: (query) =>
      providerTab === "elevenlabs" && (query.state.data as any)?.indexing ? 8_000 : false,
  });

  const counts: Record<string, number> = { ...(aggData?.totals ?? {}) };
  const aggTotal = aggData?.pagination?.total ?? 0;
  const grandTotal = aggTotal;

  const isLoading = tab === "all" ? aggLoading : providerTab ? provLoading : false;

  /* Build cards */
  const cards: CardVoice[] = useMemo(() => {
    if (tab === "all") {
      return (aggData?.data ?? []).map((v): CardVoice => ({
        id: v.voice_id,
        name: v.name,
        provider: (v.provider as ProviderId) ?? "elevenlabs",
        tag: [v.language, v.gender].filter(Boolean).join(" · ") || v.category
          || PROVIDER_META[(v.provider as ProviderId) ?? "elevenlabs"]?.label || "",
        description: v.description ?? null,
        preview: previewOf(v),
      }));
    }
    return (provData?.data ?? []).map((v): CardVoice => ({
      id: v.voice_id,
      name: v.name,
      provider: tab as ProviderId,
      tag: [v.language, v.gender].filter(Boolean).join(" · ") || v.category || PROVIDER_META[tab as ProviderId].label,
      description: v.description ?? null,
      preview: previewOf(v),
    }));
  }, [tab, aggData, provData]);

  /* Pagination */
  const totalPages = useMemo(() => {
    if (tab === "all") return Math.max(1, Math.ceil(aggTotal / PAGE_SIZE));
    if (tab === "clone") return 1;
    const total = provData?.pagination?.total ?? 0;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [tab, aggTotal, provData]);

  const useVoice = (v: CardVoice) => {
    navigate(`/studio?voice=os:${v.id}`);
  };

  const tabs: { id: Tab; label: string; logo?: string; icon?: React.ReactNode; count: number }[] = [
    { id: "all", label: "All Voices", icon: <BookAudio size={14} />, count: grandTotal },
    ...(["elevenlabs", "minimax", "fishaudio", "edge", "vbee", "clone"] as ProviderId[]).map((p) => ({
      id: p as Tab,
      label: PROVIDER_META[p].label,
      logo: PROVIDER_META[p].logo,
      icon: PROVIDER_META[p].icon,
      count: counts[p] ?? 0,
    })),
  ];

  return (
    <div className="min-h-full bg-[#fafafa]">
      <div className="bg-white border-b border-[#f3f4f6] px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-black text-foreground leading-tight">Voice Library</h1>
            <p className="text-[13px] text-[#6b7280] mt-0.5">
              {grandTotal ? `${grandTotal.toLocaleString()} voices from all providers` : "Loading..."}
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
              {t.logo ? <img src={t.logo} alt="" className="w-4 h-4 rounded-[4px] object-contain" /> : t.icon}
              {t.label}
              <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full", tab === t.id ? "bg-primary text-white" : "bg-[#e5e7eb] text-[#6b7280]")}>
                {t.count > 999 ? `${(t.count / 1000).toFixed(1)}k` : t.count}
              </span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Gender — clones carry no gender metadata */}
            {tab !== "clone" && (
              <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-xl p-1 bg-white">
                {(["", "male", "female"] as Gender[]).map(g => (
                  <button key={g || "any"} onClick={() => setGender(g)} className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors",
                    gender === g ? "bg-[#f3f4f6] text-foreground" : "text-[#9ca3af] hover:text-foreground"
                  )}>
                    {g === "" ? "Any" : g}
                  </button>
                ))}
              </div>
            )}

            {/* Language — not supported for clones */}
            {tab !== "clone" && (
              <select
                value={language} onChange={e => setLanguage(e.target.value)}
                className="text-[12px] border border-[#e5e7eb] rounded-xl px-3 py-2 bg-white text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {isLoading && cards.length === 0 ? (
          <div className="flex items-center justify-center py-24 gap-3 text-[#9ca3af]">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[14px] font-medium">Loading voices...</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2 text-[#9ca3af]">
            <BookAudio size={36} className="opacity-30" />
            <p className="text-[14px] font-semibold">
              {tab === "clone" ? "You have no cloned voices yet" : "No voices found"}
            </p>
            <p className="text-[12px]">
              {tab === "clone" ? "Create one in Voice Cloning" : "Try a different search or filter"}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-[#9ca3af] font-semibold mb-4">
              {tab === "all"
                ? `Page ${page} of ${totalPages.toLocaleString()} · ${grandTotal.toLocaleString()} voices total`
                : `${(counts[tab] ?? cards.length).toLocaleString()} voices · page ${page} of ${totalPages.toLocaleString()}`}
              {(tab === "all" || tab === "elevenlabs") && aggData?.indexing && (
                <span className="ml-2 font-medium text-[#b45309]">
                  Building the ElevenLabs voice index — more voices are being added automatically…
                </span>
              )}
              {(tab === "all" || tab === "elevenlabs") && aggData?.indexing === false && !q && (
                <span className="ml-2 font-medium text-[#9ca3af]">
                  Tip: search any style, language, or name to discover even more ElevenLabs voices.
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cards.map(v => (
                <VoiceCard
                  key={`${v.provider}:${v.id}`}
                  v={v}
                  playingId={playingId}
                  onPlay={togglePlay}
                  onUse={() => useVoice(v)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 text-[13px] font-semibold border border-[#e5e7eb] rounded-xl bg-white hover:bg-[#f3f4f6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >← Prev</button>
                <span className="text-[13px] text-[#6b7280] font-medium px-3">
                  {page} / {totalPages.toLocaleString()}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
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
