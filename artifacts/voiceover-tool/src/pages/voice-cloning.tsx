import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Trash2, Mic2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { OsCostEstimate } from "@/components/os/cost-estimate";
import { VOICE_CLONE_CREATE_COST } from "@/lib/os-cost";

interface VoiceClone {
  id: number;
  name: string;
  voiceId: string;
  description?: string | null;
}

type Engine = "minimax" | "openspeaker";

export default function VoiceCloningPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [engine, setEngine] = useState<Engine>("openspeaker");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: mmData } = useQuery<{ builtin: any[]; clones: { dbId: number; voiceId: string; name: string; description?: string | null }[] }>({
    queryKey: ["minimax-voices"],
    queryFn: () => fetch("/api/minimax/voices").then(r => r.json()),
  });

  const { data: osData } = useQuery<{ clones: VoiceClone[] }>({
    queryKey: ["os-voice-clones"],
    queryFn: () => fetch("/api/os/voice-clones").then(r => r.json()),
  });

  const mmClones: VoiceClone[] = (mmData?.clones ?? []).map(c => ({
    id: c.dbId, voiceId: c.voiceId, name: c.name, description: c.description,
  }));
  const osClones = osData?.clones ?? [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleClone = async () => {
    if (!file || !name.trim()) {
      toast({ title: "Name and audio file required", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Consent required", description: "Please confirm you have the right to clone this voice.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("name", name.trim());
      form.append("consent", "true");
      if (engine === "minimax" && description.trim()) form.append("description", description.trim());

      const url = engine === "minimax" ? "/api/minimax/voice-clone" : "/api/os/voice-clone";
      const res = await fetch(url, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Cloning failed");
      }
      toast({
        title: "Voice cloned!",
        description: engine === "minimax"
          ? `"${name}" is ready to use in Fire TTS.`
          : `"${name}" is ready — find it under My Clones in the Voice Library.`,
      });
      setFile(null);
      setName("");
      setDescription("");
      setConsent(false);
      qc.invalidateQueries({ queryKey: [engine === "minimax" ? "minimax-voices" : "os-voice-clones"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (clone: VoiceClone, eng: Engine) => {
    const url = eng === "minimax" ? `/api/minimax/voice-clone/${clone.id}` : `/api/os/voice-clones/${clone.id}`;
    await fetch(url, { method: "DELETE" });
    toast({ title: "Deleted", description: `"${clone.name}" removed.` });
    qc.invalidateQueries({ queryKey: [eng === "minimax" ? "minimax-voices" : "os-voice-clones"] });
  };

  const copyId = (voiceId: string) => {
    navigator.clipboard.writeText(voiceId);
    setCopiedId(voiceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CloneList = ({ clones, eng, accent, hint }: { clones: VoiceClone[]; eng: Engine; accent: string; hint: string }) => (
    <div className="space-y-3">
      <h2 className="font-bold text-base text-foreground">{eng === "minimax" ? "Fire TTS Clones" : "Multilingual Clones"} ({clones.length})</h2>
      {clones.length === 0 ? (
        <div className="bg-white border border-dashed border-[#e5e7eb] rounded-2xl p-8 flex flex-col items-center text-center">
          <Mic2 className="h-8 w-8 text-[#d1d5db] mb-2" />
          <p className="text-sm font-medium text-[#6b7280]">No clones yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clones.map(clone => (
            <div key={`${eng}-${clone.id}`} className="bg-white border border-[#f3f4f6] rounded-xl p-4 flex items-center gap-3 hover:border-violet-200 transition-colors shadow-sm">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-base", accent)}>
                {clone.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{clone.name}</p>
                {clone.description && <p className="text-xs text-[#9ca3af] truncate">{clone.description}</p>}
                <div className="flex items-center gap-1 mt-1">
                  <code className="text-[10px] text-[#9ca3af] bg-[#f9fafb] px-1.5 py-0.5 rounded truncate max-w-[140px]">{clone.voiceId}</code>
                  <button onClick={() => copyId(clone.voiceId)} className="p-1 rounded hover:bg-[#f3f4f6] text-[#9ca3af] hover:text-foreground transition-colors">
                    {copiedId === clone.voiceId ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
              <button onClick={() => handleDelete(clone, eng)}
                className="p-2 rounded-lg hover:bg-red-50 text-[#9ca3af] hover:text-red-500 transition-colors shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {clones.length > 0 && <p className="text-xs text-[#9ca3af] text-center">{hint}</p>}
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 sm:space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-foreground">Voice Cloning</h1>
        </div>
        <p className="text-[#6b7280] text-sm">Upload a voice sample and create a custom AI clone. Charges only apply when generating audio.</p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Clone Any Voice", desc: "Create a custom AI clone easily", color: "bg-green-50 border-green-200 text-green-700" },
          { title: "Min. 10 Seconds", desc: "Short audio sample is enough", color: "bg-blue-50 border-blue-200 text-blue-700" },
          { title: "Ready in Seconds", desc: "Clone is available instantly", color: "bg-violet-50 border-violet-200 text-violet-700" },
        ].map(c => (
          <div key={c.title} className={`rounded-xl border p-4 ${c.color}`}>
            <p className="font-bold text-sm">{c.title}</p>
            <p className="text-xs mt-1 opacity-80">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create clone form */}
        <div className="bg-white border border-[#f3f4f6] rounded-2xl p-6 space-y-5 shadow-sm">
          <h2 className="font-bold text-base text-foreground">Create New Clone</h2>

          {/* Engine */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#f3f4f6] rounded-xl">
            {([
              { id: "openspeaker" as const, label: "Multilingual" },
              { id: "minimax" as const, label: "Fire TTS" },
            ]).map(e => (
              <button key={e.id} onClick={() => setEngine(e.id)}
                className={cn("py-2 rounded-lg text-sm font-bold transition-all",
                  engine === e.id ? "bg-white shadow-sm text-foreground" : "text-[#9ca3af] hover:text-foreground")}>
                {e.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#9ca3af]">
            {engine === "openspeaker"
              ? "Works in the Studio Voice Library, Voice Changer and Dubbing. Sample must be 3–30 seconds, under 10 MB."
              : "Optimized for Fire TTS generation with emotions."}
          </p>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Clone Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My Voice, Ahmad Narrator"
              className="w-full h-10 px-3 text-sm border border-[#e5e7eb] rounded-lg outline-none focus:border-violet-400 transition-colors"
            />
          </div>

          {/* Description (Fire only) */}
          {engine === "minimax" && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Description <span className="text-[#9ca3af] font-normal">(optional)</span></label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Male deep voice, calm tone"
                className="w-full h-10 px-3 text-sm border border-[#e5e7eb] rounded-lg outline-none focus:border-violet-400 transition-colors"
              />
            </div>
          )}

          {/* Audio upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Voice Sample</label>
            <label className={cn(
              "flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all",
              file ? "border-violet-400 bg-violet-50" : "border-[#e5e7eb] hover:border-violet-300 hover:bg-violet-50/30"
            )}>
              <Upload size={22} className={file ? "text-violet-500 mb-2" : "text-[#9ca3af] mb-2"} />
              <p className="text-sm font-medium text-foreground">{file ? file.name : "Click to upload audio"}</p>
              <p className="text-xs text-[#9ca3af] mt-1">MP3, WAV, M4A {engine === "openspeaker" ? "• 3–30 seconds" : "• Min. 10 seconds"}</p>
              <input type="file" accept="audio/*" onChange={handleFile} className="hidden" />
            </label>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-violet-600" />
            <span className="text-xs text-[#6b7280] leading-relaxed">
              I confirm this is my own voice, or I have explicit permission from the voice owner to clone it,
              and I will not use it to impersonate, deceive, or harm anyone.
            </span>
          </label>

          <OsCostEstimate
            estimate={VOICE_CLONE_CREATE_COST}
            footnote="Creating a clone is free — credits are only charged when you generate audio with it (e.g. 1 credit per character in TTS)."
          />

          <button
            onClick={handleClone}
            disabled={loading || !file || !name.trim() || !consent}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
              loading || !file || !name.trim() || !consent
                ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
            )}
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Cloning...</> : <><Mic2 className="h-4 w-4" />Create Voice Clone</>}
          </button>
        </div>

        {/* My clones lists */}
        <div className="space-y-8">
          <CloneList
            clones={osClones}
            eng="openspeaker"
            accent="bg-blue-100 text-blue-600"
            hint="Available under My Clones in the Studio Voice Library, Voice Changer and Dubbing"
          />
          <CloneList
            clones={mmClones}
            eng="minimax"
            accent="bg-violet-100 text-violet-600"
            hint="Available in the Fire TTS voice selector"
          />
        </div>
      </div>
    </div>
  );
}
