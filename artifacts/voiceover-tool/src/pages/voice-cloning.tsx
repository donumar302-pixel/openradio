import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, Trash2, Mic2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VoiceClone {
  id: number;
  name: string;
  voiceId: string;
  description?: string | null;
}

export default function VoiceCloningPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data } = useQuery<{ builtin: any[]; clones: VoiceClone[] }>({
    queryKey: ["minimax-voices"],
    queryFn: () => fetch("/api/minimax/voices").then(r => r.json()),
  });

  const clones = data?.clones ?? [];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleClone = async () => {
    if (!file || !name.trim()) {
      toast({ title: "Name and audio file required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("audio", file);
      form.append("name", name.trim());
      if (description.trim()) form.append("description", description.trim());

      const res = await fetch("/api/minimax/voice-clone", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Cloning failed");
      }
      toast({ title: "Voice cloned!", description: `"${name}" is ready to use in MiniMax TTS.` });
      setFile(null);
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["minimax-voices"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, cloneName: string) => {
    await fetch(`/api/minimax/voice-clone/${id}`, { method: "DELETE" });
    toast({ title: "Deleted", description: `"${cloneName}" removed.` });
    qc.invalidateQueries({ queryKey: ["minimax-voices"] });
  };

  const copyId = (voiceId: string) => {
    navigator.clipboard.writeText(voiceId);
    setCopiedId(voiceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-foreground">Voice Cloning</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">MiniMax</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">Free</span>
        </div>
        <p className="text-[#6b7280] text-sm">Upload a voice sample and create a custom AI clone. Cloning is completely free — charges only apply when generating audio.</p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Free to Clone", desc: "Creating voice clones costs $0", color: "bg-green-50 border-green-200 text-green-700" },
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

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Description <span className="text-[#9ca3af] font-normal">(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Male deep voice, calm tone"
              className="w-full h-10 px-3 text-sm border border-[#e5e7eb] rounded-lg outline-none focus:border-violet-400 transition-colors"
            />
          </div>

          {/* Audio upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Voice Sample</label>
            <label className={cn(
              "flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all",
              file ? "border-violet-400 bg-violet-50" : "border-[#e5e7eb] hover:border-violet-300 hover:bg-violet-50/30"
            )}>
              <Upload size={22} className={file ? "text-violet-500 mb-2" : "text-[#9ca3af] mb-2"} />
              <p className="text-sm font-medium text-foreground">{file ? file.name : "Click to upload audio"}</p>
              <p className="text-xs text-[#9ca3af] mt-1">MP3, WAV, M4A • Min. 10 seconds</p>
              <input type="file" accept="audio/*" onChange={handleFile} className="hidden" />
            </label>
          </div>

          <button
            onClick={handleClone}
            disabled={loading || !file || !name.trim()}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all",
              loading || !file || !name.trim()
                ? "bg-[#f3f4f6] text-[#9ca3af] cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
            )}
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Cloning...</> : <><Mic2 className="h-4 w-4" />Create Voice Clone</>}
          </button>
        </div>

        {/* My clones list */}
        <div className="space-y-4">
          <h2 className="font-bold text-base text-foreground">My Voice Clones ({clones.length})</h2>

          {clones.length === 0 ? (
            <div className="bg-white border border-dashed border-[#e5e7eb] rounded-2xl p-10 flex flex-col items-center text-center">
              <Mic2 className="h-10 w-10 text-[#d1d5db] mb-3" />
              <p className="text-sm font-medium text-[#6b7280]">No clones yet</p>
              <p className="text-xs text-[#9ca3af] mt-1">Create your first voice clone on the left</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clones.map(clone => (
                <div key={clone.id} className="bg-white border border-[#f3f4f6] rounded-xl p-4 flex items-center gap-3 hover:border-violet-200 transition-colors shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 text-violet-600 font-black text-base">
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
                  <button onClick={() => handleDelete(clone.id, clone.name)}
                    className="p-2 rounded-lg hover:bg-red-50 text-[#9ca3af] hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {clones.length > 0 && (
            <p className="text-xs text-[#9ca3af] text-center">Cloned voices are available in MiniMax TTS voice selector</p>
          )}
        </div>
      </div>
    </div>
  );
}
