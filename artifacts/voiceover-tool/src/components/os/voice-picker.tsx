import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Play, Search, Square } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { osJson, osProviderLogo, OS_PROVIDERS, type OsVoice } from "@/lib/os-api";

interface Props {
  value: string;              // prefixed voice_id or ""
  valueName?: string;         // display name of the current selection
  onChange: (voiceId: string, name: string) => void;
  placeholder?: string;
  excludeClones?: boolean;
}

function useDebounced<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function previewUrl(v: OsVoice): string | null {
  return v.preview_url || v.languages?.find((l) => l.preview_url)?.preview_url || null;
}

/** Searchable, paginated voice picker over the unified OpenSpeaker voice library. */
export function OsVoicePicker({ value, valueName, onChange, placeholder = "Choose a voice", excludeClones }: Props) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<string>("elevenlabs");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [provider, debouncedSearch]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const providers = useMemo(
    () => OS_PROVIDERS.filter((p) => !(excludeClones && p.id === "clone")),
    [excludeClones],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["os-voices", provider, debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ provider, page: String(page), page_size: "24" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      return osJson<{ data: OsVoice[]; pagination?: { total?: number; page_size?: number } }>(`/voices?${params}`);
    },
    enabled: open,
    staleTime: 60_000,
  });

  const tabLogo = osProviderLogo(provider);
  const voices: OsVoice[] = data?.data ?? [];
  const total = data?.pagination?.total ?? voices.length;
  const pageSize = data?.pagination?.page_size ?? 24;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const togglePreview = (v: OsVoice) => {
    const url = previewUrl(v);
    if (!url) return;
    if (playing === v.voice_id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;
    setPlaying(v.voice_id);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2 text-sm bg-white hover:border-primary/40 transition-colors text-left"
      >
        <span className={cn("truncate", value ? "text-foreground font-medium" : "text-muted-foreground")}>
          {value ? (valueName || value) : placeholder}
        </span>
        <ChevronDown size={15} className="text-muted-foreground shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { audioRef.current?.pause(); setPlaying(null); } setOpen(o); }}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-lg font-extrabold">Voice Library</DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-3 space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
                    provider === p.id ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.logo && (
                    <img src={p.logo} alt="" className={cn("w-3.5 h-3.5 rounded-[3px] object-contain", provider === p.id && "bg-white/90 p-px")} />
                  )}
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voices by name or language..."
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>

          <div className="h-[380px] overflow-y-auto px-5 pb-2 border-t border-border">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : voices.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {provider === "clone" ? "You have no cloned voices yet. Create one in Voice Cloning." : "No voices found."}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-1.5 py-3">
                {voices.map((v) => {
                  const selected = v.voice_id === value;
                  const hasPreview = !!previewUrl(v);
                  return (
                    <div
                      key={v.voice_id}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-all",
                        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                      )}
                      onClick={() => { onChange(v.voice_id, v.name); setOpen(false); }}
                    >
                      {hasPreview ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); togglePreview(v); }}
                          className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary/20"
                        >
                          {playing === v.voice_id ? <Square size={11} className="fill-primary" /> : <Play size={11} className="fill-primary ml-0.5" />}
                        </button>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-secondary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{v.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[v.language, v.gender].filter(Boolean).join(" · ") || v.category || ""}
                        </p>
                      </div>
                      {tabLogo && <img src={tabLogo} alt="" className="w-4 h-4 rounded-[4px] object-contain shrink-0 opacity-80" />}
                      {selected && <Check size={15} className="text-primary shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground">{total.toLocaleString()} voices</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
