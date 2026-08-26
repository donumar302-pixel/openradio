import { ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { OsTaskResult, OsTaskHistory } from "@/components/os/task-panel";
import { useOsInsufficientCredits } from "@/components/os/cost-estimate";
import { useOsTask } from "@/hooks/use-os-task";
import { OsApiError, osJson, osCreateTaskForm } from "@/lib/os-api";
import { cn } from "@/lib/utils";

interface ImageModel {
  id?: string;
  model_id?: string;
  name?: string;
  parameters?: Record<string, { options?: (string | number)[]; default?: unknown }> | null;
  model_parameters?: Record<string, { options?: (string | number)[]; default?: unknown }> | null;
}

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const QUOTE_FAILURE_TTL_MS = 60_000;

function imageModelId(model: ImageModel): string {
  return String(model.model_id ?? model.id ?? "");
}

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
  const [failedQuoteAt, setFailedQuoteAt] = useState<Record<string, number>>({});
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const fallbackActive = useRef(false);
  const { task, submitting, run, working, cancel, cancelling } = useOsTask("image");

  const { data: modelsData } = useQuery({
    queryKey: ["os-image-models"],
    queryFn: () => osJson<any>("/image/models"),
    staleTime: 10 * 60 * 1000,
  });

  const models: ImageModel[] = useMemo(() => {
    const raw = modelsData?.data ?? modelsData?.models ?? (Array.isArray(modelsData) ? modelsData : []);
    return Array.isArray(raw) ? raw : [];
  }, [modelsData]);

  const modelParameters = useMemo(() => ({ aspect_ratio: aspectRatio }), [aspectRatio]);
  const quoteConfigKey = useMemo(
    () => `${imgCount}:${aspectRatio}:${refs.length}`,
    [imgCount, aspectRatio, refs.length],
  );

  const unavailableModelIds = useMemo(() => {
    const now = Date.now();
    return new Set(models
      .map(imageModelId)
      .filter((id) => {
        const failedAt = failedQuoteAt[`${quoteConfigKey}:${id}`];
        return failedAt !== undefined && now - failedAt < QUOTE_FAILURE_TTL_MS;
      }));
  }, [failedQuoteAt, models, quoteConfigKey]);

  useEffect(() => {
    if (modelId || models.length === 0) return;
    const firstAvailable = models.map(imageModelId).find((id) => id && !unavailableModelIds.has(id));
    if (firstAvailable) setModelId(firstAvailable);
  }, [modelId, models, unavailableModelIds]);

  useEffect(() => {
    fallbackActive.current = false;
    setAvailabilityMessage("");
  }, [quoteConfigKey]);

  useEffect(() => {
    const expiries = Object.values(failedQuoteAt).map((failedAt) => failedAt + QUOTE_FAILURE_TTL_MS);
    if (expiries.length === 0) return;
    const delay = Math.max(0, Math.min(...expiries) - Date.now()) + 25;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setFailedQuoteAt((current) => Object.fromEntries(
        Object.entries(current).filter(([, failedAt]) => now - failedAt < QUOTE_FAILURE_TTL_MS),
      ));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [failedQuoteAt]);

  const {
    data: priceData,
    error: priceQueryError,
    isFetching: priceLoading,
    isError: priceError,
  } = useQuery({
    queryKey: ["os-image-price", modelId, imgCount, aspectRatio, refs.length],
    queryFn: () => osJson<{ credits: number }>("/image/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, generationsCount: imgCount, modelParameters, assets: refs.length }),
    }),
    enabled: !!modelId,
    staleTime: 60_000,
  });

  useEffect(() => {
    const isModelQuoteFailure = priceQueryError instanceof OsApiError
      && (priceQueryError.status === 400 || priceQueryError.status === 422 || priceQueryError.status === 502);
    if (!isModelQuoteFailure || priceLoading || !modelId) return;

    const failedModel = models.find((model) => imageModelId(model) === modelId);
    const failedLabel = failedModel?.name ?? modelMeta(modelId).label;
    const failedKey = `${quoteConfigKey}:${modelId}`;
    const failedIds = new Set(unavailableModelIds);
    failedIds.add(modelId);
    setFailedQuoteAt((current) => ({ ...current, [failedKey]: Date.now() }));

    const ids = models.map(imageModelId).filter(Boolean);
    const currentIndex = ids.indexOf(modelId);
    const orderedCandidates = currentIndex >= 0
      ? [...ids.slice(currentIndex + 1), ...ids.slice(0, currentIndex)]
      : ids;
    const nextModel = orderedCandidates.find((id) => !failedIds.has(id));

    if (!fallbackActive.current) {
      toast({
        title: "Model unavailable",
        description: nextModel
          ? `${failedLabel} cannot be priced for these settings. Trying another model.`
          : `${failedLabel} cannot be priced for these settings.`,
        variant: "destructive",
      });
      fallbackActive.current = true;
    }

    setAvailabilityMessage(nextModel
      ? `${failedLabel} is unavailable for these settings. Trying another model…`
      : "No image model can be priced for these settings. Try changing the settings or adding a reference image.");
    setModelId(nextModel ?? "");
  }, [modelId, models, priceLoading, priceQueryError, quoteConfigKey, toast, unavailableModelIds]);

  useEffect(() => {
    if (priceData && !priceLoading && fallbackActive.current) {
      const selected = models.find((model) => imageModelId(model) === modelId);
      const selectedLabel = selected?.name ?? (modelId ? modelMeta(modelId).label : "another model");
      setAvailabilityMessage(`Switched to ${selectedLabel}, which is available for these settings.`);
      fallbackActive.current = false;
    }
  }, [modelId, models, priceData, priceLoading]);

  const insufficient = useOsInsufficientCredits(priceData?.credits ?? null);
  const noAvailableModels = models.length > 0 && models.every((model) => unavailableModelIds.has(imageModelId(model)));

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
            <Select
              value={modelId}
              onValueChange={(value) => {
                fallbackActive.current = false;
                setAvailabilityMessage("");
                setModelId(value);
              }}
            >
              <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a model" /></SelectTrigger>
              <SelectContent>
                {models.map((m) => {
                  const id = imageModelId(m);
                  const meta = modelMeta(id);
                  const unavailable = unavailableModelIds.has(id);
                  return (
                    <SelectItem key={id} value={id} disabled={unavailable}>
                      <span className="flex items-center gap-2">
                        {meta.logo && <img src={meta.logo} alt="" className="w-4 h-4 rounded-[4px] object-contain" />}
                        <span>{m.name ?? meta.label}</span>
                        {meta.brand && <span className="text-[10px] text-muted-foreground">{meta.brand}</span>}
                        {unavailable && <span className="text-[10px] text-destructive">Unavailable for these settings</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {availabilityMessage && (
              <p className={cn("text-xs", noAvailableModels ? "text-destructive" : "text-muted-foreground")}>
                {availabilityMessage}
              </p>
            )}
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

        <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            This generation will use
          </span>
          <span className="text-sm font-extrabold text-primary">
            {!modelId && noAvailableModels
              ? "No model available"
              : priceError
              ? "Price unavailable"
              : priceLoading || !priceData
                ? "Calculating…"
                : `${priceData.credits.toLocaleString()} credits`}
          </span>
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

        <Button onClick={handleSubmit} disabled={working || !modelId || priceLoading || !priceData || priceError || insufficient} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {submitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting…</>
            : !modelId && noAvailableModels
              ? <>No priced model available</>
            : priceLoading || (!priceData && !priceError)
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Calculating price…</>
              : priceError
                ? <>Price unavailable</>
            : insufficient
              ? <>Not enough credits</>
              : <><Sparkles className="mr-2 h-4 w-4" />Generate</>}
        </Button>
      </div>

      <OsTaskResult task={task} onCancel={cancel} cancelling={cancelling} />
      <OsTaskHistory tool="image" />
    </div>
  );
}
