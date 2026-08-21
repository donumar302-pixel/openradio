import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Megaphone, ToggleRight, AlertTriangle, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type FeatureKey =
  | "elevenlabs" | "minimax" | "fishaudio" | "edge" | "voice-cloning"
  | "os-tts" | "os-dialogue" | "os-dictionary" | "os-voice-clone" | "os-dubbing"
  | "os-voice-changer" | "os-voice-isolation" | "os-speech-to-text"
  | "os-sound-effects" | "os-music" | "os-image";

type AdminSettings = {
  banner: { enabled: boolean; text: string };
  features: Record<FeatureKey, boolean>;
};

const FEATURE_LABELS: { key: FeatureKey; label: string; desc: string }[] = [
  { key: "elevenlabs", label: "ElevenLabs TTS", desc: "Premium ElevenLabs text-to-speech voices" },
  { key: "minimax", label: "MiniMax TTS", desc: "MiniMax text-to-speech engine" },
  { key: "fishaudio", label: "Fish Audio TTS", desc: "Fish Audio text-to-speech engine" },
  { key: "edge", label: "Edge TTS", desc: "Microsoft Edge free text-to-speech" },
  { key: "voice-cloning", label: "Voice Cloning (Fire)", desc: "MiniMax custom voice cloning feature" },
];

const OS_FEATURE_LABELS: { key: FeatureKey; label: string; desc: string }[] = [
  { key: "os-tts", label: "Voice Library TTS", desc: "Unified voice library text-to-speech in the Studio" },
  { key: "os-dialogue", label: "Text to Dialogue", desc: "Multi-speaker conversation generation" },
  { key: "os-dictionary", label: "Pronunciation Dictionary", desc: "Custom pronunciation rules for TTS" },
  { key: "os-voice-clone", label: "Voice Cloning (Multilingual)", desc: "Voice cloning usable across the voice library tools" },
  { key: "os-dubbing", label: "Dubbing", desc: "Automatic audio/video dubbing into other languages" },
  { key: "os-voice-changer", label: "Voice Changer", desc: "Re-voice recordings with library voices" },
  { key: "os-voice-isolation", label: "Audio Isolation", desc: "Background noise removal / vocal isolation" },
  { key: "os-speech-to-text", label: "Speech to Text", desc: "Transcription with SRT subtitles" },
  { key: "os-sound-effects", label: "Sound Effects", desc: "Text-to-sound-effect generation" },
  { key: "os-music", label: "AI Music", desc: "Suno music generation" },
  { key: "os-image", label: "AI Images", desc: "Image generation studio" },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled}
      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", checked ? "bg-primary" : "bg-white/10", disabled && "opacity-50")}>
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery<AdminSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => fetch("/api/admin/settings").then(r => r.json()),
  });

  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerText, setBannerText] = useState("");

  useEffect(() => {
    if (data?.banner) {
      setBannerEnabled(!!data.banner.enabled);
      setBannerText(data.banner.text ?? "");
    }
  }, [data?.banner?.enabled, data?.banner?.text]);

  const bannerMutation = useMutation({
    mutationFn: (value: { enabled: boolean; text: string }) =>
      fetch("/api/admin/settings/banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
  });

  const featuresMutation = useMutation({
    mutationFn: (value: Record<string, boolean>) =>
      fetch("/api/admin/settings/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
  });

  const features = data?.features;

  const toggleFeature = (key: FeatureKey) => {
    if (!features) return;
    featuresMutation.mutate({ ...features, [key]: !features[key] });
  };

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black text-white">Settings</h1>
          <p className="text-[13px] text-white/40 mt-0.5">Platform configuration</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[12px] font-bold transition-all border border-white/5"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-white/20 text-[13px]">Loading...</div>
      ) : (
        <>
          {/* Announcement banner */}
          <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={14} className="text-amber-400" />
              <p className="text-[13px] font-bold text-white">Announcement Banner</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-white">Enable banner</p>
                  <p className="text-[11px] text-white/40 mt-0.5">Show a site-wide announcement to all users</p>
                </div>
                <Toggle checked={bannerEnabled} onChange={() => setBannerEnabled(v => !v)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Banner text</label>
                <textarea value={bannerText} onChange={e => setBannerText(e.target.value)} rows={2} placeholder="e.g. Scheduled maintenance this Sunday..."
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => bannerMutation.mutate({ enabled: bannerEnabled, text: bannerText })} disabled={bannerMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary text-[12px] font-bold hover:bg-primary/30 disabled:opacity-40 transition-colors">
                  <Check size={13} /> {bannerMutation.isPending ? "Saving..." : "Save Banner"}
                </button>
                {bannerMutation.isSuccess && <p className="text-[11px] text-emerald-400">Saved.</p>}
                {bannerMutation.isError && <p className="text-[11px] text-red-400">{(bannerMutation.error as Error)?.message}</p>}
              </div>
            </div>
          </div>

          {/* Feature switches */}
          <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ToggleRight size={14} className="text-primary" />
              <p className="text-[13px] font-bold text-white">Features</p>
            </div>
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-400/90 font-medium">
                Turning off a feature blocks it for all users instantly. Changes take effect immediately.
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {FEATURE_LABELS.map(f => (
                <div key={f.key} className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-white">{f.label}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{f.desc}</p>
                  </div>
                  <Toggle checked={!!features?.[f.key]} onChange={() => toggleFeature(f.key)} disabled={featuresMutation.isPending} />
                </div>
              ))}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mt-6 mb-1">Voice Library Suite</p>
            <div className="divide-y divide-white/5">
              {OS_FEATURE_LABELS.map(f => (
                <div key={f.key} className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-white">{f.label}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{f.desc}</p>
                  </div>
                  <Toggle checked={!!features?.[f.key]} onChange={() => toggleFeature(f.key)} disabled={featuresMutation.isPending} />
                </div>
              ))}
            </div>
            {featuresMutation.isError && <p className="text-[11px] text-red-400 mt-2">{(featuresMutation.error as Error)?.message}</p>}
          </div>
        </>
      )}
    </div>
  );
}
