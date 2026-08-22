import { Music4, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { OsTaskResult, OsTaskHistory } from "@/components/os/task-panel";
import { OsCostEstimate, useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osCreateTaskJson } from "@/lib/os-api";
import { MUSIC_COST_ESTIMATE } from "@/lib/os-cost";
import { cn } from "@/lib/utils";

export default function AiMusicPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"simple" | "custom">("simple");
  const [description, setDescription] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [tags, setTags] = useState("");
  const [vocalGender, setVocalGender] = useState<string>("any");
  const { task, submitting, run, working } = useOsTask("music");
  const insufficient = useOsInsufficientCredits(MUSIC_COST_ESTIMATE);

  const handleSubmit = () => {
    if (mode === "simple" && !description.trim()) {
      toast({ title: "Describe your song", description: "Tell the AI what to create.", variant: "destructive" });
      return;
    }
    if (mode === "custom" && !lyrics.trim() && !tags.trim()) {
      toast({ title: "Missing input", description: "Custom mode needs lyrics or styles.", variant: "destructive" });
      return;
    }
    run(() => osCreateTaskJson("/music", {
      mode,
      description: mode === "simple" ? description : undefined,
      makeInstrumental: mode === "simple" ? instrumental : undefined,
      title: mode === "custom" ? title : undefined,
      lyrics: mode === "custom" ? lyrics : undefined,
      tags: mode === "custom" ? tags : undefined,
      vocalGender: mode === "custom" && vocalGender !== "any" ? vocalGender : undefined,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Music4 size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">AI Music</h1>
          <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            <img src={`${import.meta.env.BASE_URL}logos/suno.png`} alt="" className="w-3.5 h-3.5 rounded-[3px] object-contain" />
            Suno
          </span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Create complete songs with vocals from a description or your own lyrics</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
          {(["simple", "custom"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("py-2 rounded-lg text-sm font-bold transition-all",
                mode === m ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {m === "simple" ? "Simple" : "Custom"}
            </button>
          ))}
        </div>

        {mode === "simple" ? (
          <>
            <div className="space-y-2">
              <Label className="font-semibold">Song description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="An upbeat indie pop song about summer road trips, catchy chorus, female vocals"
                className="text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/500</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Instrumental</Label>
                <p className="text-xs text-muted-foreground">No vocals, music only</p>
              </div>
              <Switch checked={instrumental} onCheckedChange={setInstrumental} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="font-semibold">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="My Song" className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Lyrics</Label>
              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value.slice(0, 5000))}
                rows={7}
                placeholder={"[Verse 1]\nI walk the line between two lives…"}
                className="text-sm resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground text-right">{lyrics.length}/5000</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Styles</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value.slice(0, 1000))}
                placeholder="indie pop, emotional, cinematic drums" className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Vocals</Label>
              <Select value={vocalGender} onValueChange={setVocalGender}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="f">Female</SelectItem>
                  <SelectItem value="m">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <OsCostEstimate estimate={MUSIC_COST_ESTIMATE} />

        <Button onClick={handleSubmit} disabled={working || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</> : insufficient ? <>Not enough credits</> : <><Sparkles className="mr-2 h-4 w-4" />Generate Music</>}
        </Button>
        <p className="text-xs text-muted-foreground text-center">Songs take a few minutes to generate — track progress in History below.</p>
      </div>

      <OsTaskResult task={task} />
      <OsTaskHistory tool="music" />
    </div>
  );
}
