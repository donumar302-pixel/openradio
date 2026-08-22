import { ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { OsTaskResult, OsTaskHistory } from "@/components/os/task-panel";
import { useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { osJson, osCreateTaskForm } from "@/lib/os-api";
import { cn } from "@/lib/utils";

interface ImageModel {
  id?: string;
  model_id?: string;
  name?: string;
  parameters?: Record<string, { options?: (string | number)[]; default?: unknown }> | null;
  model_parameters?: Record<string, { options?: (string | number)[]; default?: unknown }> | null;
}

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

/* ── Model branding: real provider logos + friendly names ─────────────── */
const MODEL_LOGO = (name: string) => `${import.meta.env.BASE_URL}logos/${name}.png`;

const MODEL_BRANDS: { prefix: string; logo: string; brand: string }[] = [
  { prefix: "bytedance-seedream", logo: MODEL_LOGO("bytedance"), brand: "ByteDance" },
  { prefix: "gpt-image",          logo: MODEL_LOGO("openai"),    brand: "OpenAI" },
  { prefix: "gemini",             logo: MODEL_LOGO("gemini"),    brand: "Google" },
  { prefix: "recraft",            logo: MODEL_LOGO("recraft"),   brand: "Recraft" },
  { prefix: "krea",               logo: MODEL_LOGO("krea"),      brand: "Krea" },
  { prefix: "kling",              logo: MODEL_LOGO("kling"),     brand: "Kling" },
  { prefix: "flux",               logo: MODEL_LOGO("flux"),      brand: "Black Forest Labs" },
  { prefix: "runway",             logo: MODEL_LOGO("runway"),    brand: "Runway" },
  { prefix: "wan",                logo: MODEL_LOGO("wan"),       brand: "Alibaba Wan" },
];

const MODEL_NAMES: Record<string, string> = {
  "bytedance-seedream-5-pro": "Seedream 5 Pro",
  "bytedance-seedream-5-lite": "Seedream 5 Lite",
  "bytedance-seedream-4.5": "Seedream 4.5",
  "bytedance-seedream-4": "Seedream 4",
  "recraft-v4.1": "Recraft V4.1",
  "gpt-image-2": "GPT Image 2",
  "gpt-image-1.5": "GPT Image 1.5",
  "gpt-image-1": "GPT Image 1",
  "gemini-3.1-flash-lite-image": "Gemini 3.1 Flash Lite",
  "gemini-3.1-flash-image-preview": "Gemini 3.1 Flash (Nano Banana Pro)",
  "gemini-3-pro-image-preview": "Gemini 3 Pro Image",
  "gemini-2.5-flash-image": "Gemini 2.5 Flash (Nano Banana)",
  "krea-2-medium": "Krea 2 Medium",
  "krea-2-large": "Krea 2 Large",
  "kling-omni-image": "Kling Omni Image",
  "flux-2-pro": "FLUX.2 Pro",
  "flux-1-kontext": "FLUX.1 Kontext",
  "runway-gen4-image": "Runway Gen-4 Image",
  "runway-gen4-image-turbo": "Runway Gen-4 Turbo",
  "wan-2.5-preview-image": "Wan 2.5",
};

function modelMeta(id: string): { label: string; logo: string | null; brand: string | null } {
  const b = MODEL_BRANDS.find((x) => id.startsWith(x.prefix));
  const label = MODEL_NAMES[id]
    ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, logo: b?.logo ?? null, brand: b?.brand ?? null };
}

export default function ImageStudioPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imgCount, setImgCount] = useState(1);
  const [refs, setRefs] = useState<File[]>([]);
  const { task, submitting, run, working } = useOsTask("image");

  const { data: modelsData } = useQuery({
    queryKey: ["os-image-models"],
    queryFn: () => osJson<any>("/image/models"),
    staleTime: 10 * 60 * 1000,
  });

  const models: ImageModel[] = useMemo(() => {
    const raw = modelsData?.data ?? modelsData?.models ?? (Array.isArray(modelsData) ? modelsData : []);
    return Array.isArray(raw) ? raw : [];
  }, [modelsData]);

  useEffect(() => {
    if (!modelId && models.length > 0) {
      const first = models[0];
      setModelId(String(first.model_id ?? first.id ?? ""));
    }
  }, [models, modelId]);

  const modelParameters = useMemo(() => ({ aspect_ratio: aspectRatio }), [aspectRatio]);

  const { data: priceData } = useQuery({
    queryKey: ["os-image-price", modelId, imgCount, aspectRatio, refs.length],
    queryFn: () => osJson<{ credits: number }>("/image/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, generationsCount: imgCount, modelParameters, assets: refs.length }),
    }),
    enabled: !!modelId,
    staleTime: 60_000,
  });

  const insufficient = useOsInsufficientCredits(priceData?.credits ?? null);

  const handleSubmit = () => {
    if (!prompt.trim()) { toast({ title: "Missing prompt", description: "Describe the image you want.", variant: "destructive" }); return; }
    if (!modelId) { toast({ title: "No model", description: "Choose a model first.", variant: "destructive" }); return; }
    run(() => {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("modelId", modelId);
      form.append("generationsCount", String(imgCount));
      form.append("modelParameters", JSON.stringify(modelParameters));
      for (const f of refs) form.append("assets", f);
      return osCreateTaskForm("/image/generate", form);
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ImageIcon size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">AI Image Studio</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Generate images with 20+ top models — Seedream, GPT Image, Gemini, Flux and more</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="space-y-2">
          <Label className="font-semibold">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder="A beautiful sunset over the ocean in watercolor style"
            className="text-sm resize-none"
          />
          {refs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Tip: reference your uploads as <code className="font-mono bg-secondary px-1 rounded">@img1</code>{refs.length > 1 && <>, <code className="font-mono bg-secondary px-1 rounded">@img2</code>…</>} in the prompt.
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a model" /></SelectTrigger>
              <SelectContent>
                {models.map((m) => {
                  const id = String(m.model_id ?? m.id ?? "");
                  const meta = modelMeta(id);
                  return (
                    <SelectItem key={id} value={id}>
                      <span className="flex items-center gap-2">
                        {meta.logo && <img src={meta.logo} alt="" className="w-4 h-4 rounded-[4px] object-contain" />}
                        <span>{m.name ?? meta.label}</span>
                        {meta.brand && <span className="text-[10px] text-muted-foreground">{meta.brand}</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Number of images</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => setImgCount(n)}
                className={cn("flex-1 py-2 rounded-lg text-sm font-bold border transition-all",
                  imgCount === n ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Reference images <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="flex gap-2 flex-wrap">
            {refs.map((f, i) => (
              <div key={i} className="relative w-16 h-16">
                <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                <button onClick={() => setRefs((r) => r.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                  <X size={10} />
                </button>
              </div>
            ))}
            {refs.length < 6 && (
              <label className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/40 text-muted-foreground">
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setRefs((r) => [...r, ...files].slice(0, 6));
                  }} />
                +
              </label>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={working || !modelId || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</>
            : insufficient
              ? <>Not enough credits</>
              : <><Sparkles className="mr-2 h-4 w-4" />Generate</>}
        </Button>
      </div>

      <OsTaskResult task={task} />
      <OsTaskHistory tool="image" />
    </div>
  );
}
