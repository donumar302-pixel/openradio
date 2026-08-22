import { useState } from "react";
import { PenLine, Sparkles, Copy, Check, Mic2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const LANGUAGES = ["English", "Urdu", "Hindi", "Arabic", "Spanish", "French", "German", "Turkish", "Indonesian", "Portuguese"];
const TONES = [
  { value: "conversational", label: "Conversational" },
  { value: "professional", label: "Professional" },
  { value: "energetic", label: "Energetic" },
  { value: "calm and soothing", label: "Calm & Soothing" },
  { value: "dramatic", label: "Dramatic" },
  { value: "funny", label: "Funny" },
  { value: "inspirational", label: "Inspirational" },
];
const LENGTHS = [
  { value: "short", label: "Short (~30 sec)" },
  { value: "medium", label: "Medium (~1 min)" },
  { value: "long", label: "Long (~2-3 min)" },
];

export default function ScriptWriterPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState("conversational");
  const [length, setLength] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: topic.trim(), language, tone, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setScript(data.script);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast({ title: "Script ready!", description: data.creditsCharged > 0 ? `${data.creditsCharged} credits used.` : undefined });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyScript = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <PenLine size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">AI Script Writer</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Describe your topic and get a ready-to-narrate voiceover script — 10 credits per script.</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-4">
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">What is your video / voiceover about?</Label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. A 1-minute YouTube intro about the benefits of waking up early, aimed at students"
            rows={3}
            maxLength={600}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{topic.length}/600</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">Length</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTHS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={generate} disabled={!topic.trim() || loading} className="w-full font-bold">
          <Sparkles size={15} className="mr-1.5" />
          {loading ? "Writing your script…" : "Generate Script (10 credits)"}
        </Button>
      </div>

      {script && (
        <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Your script</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyScript} className="font-semibold">
                {copied ? <><Check size={14} className="mr-1 text-green-600" /> Copied</> : <><Copy size={14} className="mr-1" /> Copy</>}
              </Button>
              <Link href="/studio">
                <Button size="sm" className="font-semibold" onClick={() => sessionStorage.setItem("script-handoff", script)}>
                  <Mic2 size={14} className="mr-1" /> Use in Text to Speech
                </Button>
              </Link>
            </div>
          </div>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={12}
            className="text-[14px] leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
