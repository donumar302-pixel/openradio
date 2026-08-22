export type PlanId = "free" | "starter" | "pro" | "max";

export const PLAN_CREDITS: Record<string, number> = {
  free: 5000,
  starter: 100000,
  pro: 500000,
  max: 1000000,
  // kept for backwards-compatibility with any legacy rows
  enterprise: 2000000,
};

export const PLAN_DURATION_DAYS = 30;

// USD base prices (monthly). Other currencies are derived from these.
// Derived from the PKR base prices at 290 PKR = 1 USD.
export const PLAN_PRICE_USD: Record<PlanId, number> = {
  free: 0,
  starter: 3.96, // ₨1,149 / 290
  pro: 6.89,     // ₨1,999 / 290
  max: 10.86,    // ₨3,149 / 290
};

// Exchange rates relative to USD. Kept server-side only — never exposed to the
// client. The pricing endpoint returns already-converted prices, not the rates.
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  PKR: 290,
  INR: 95,
  EUR: 1.2,
};

export const CURRENCIES: { code: string; symbol: string }[] = [
  { code: "USD", symbol: "$" },
  { code: "PKR", symbol: "₨" },
  { code: "INR", symbol: "₹" },
  { code: "EUR", symbol: "€" },
];

export function planCredits(plan: string): number {
  return PLAN_CREDITS[plan] ?? 0;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

// Exact PKR prices (not derived from USD × rate).
export const PLAN_PRICE_PKR: Record<PlanId, number> = {
  free: 0,
  starter: 1149,
  pro: 1999,
  max: 3149,
};

export function priceInCurrency(plan: PlanId, currency: string): number {
  if (currency === "PKR") return PLAN_PRICE_PKR[plan] ?? 0;
  const usd = PLAN_PRICE_USD[plan] ?? 0;
  const rate = EXCHANGE_RATES[currency] ?? 1;
  const raw = usd * rate;
  // Whole numbers for PKR/INR; up to 2 decimals for USD/EUR.
  if (currency === "PKR" || currency === "INR") return Math.round(raw);
  return Math.round(raw * 100) / 100;
}

/* ── Feature gating ─────────────────────────────────────────────────────── */

export type FeatureKey =
  | "tts"
  | "fire-tts"
  | "voice-cloning"
  | "speech-to-speech"
  | "speech-to-text"
  | "sound-effects"
  | "audio-isolation"
  | "music"
  | "dubbing"
  | "dialogue"
  | "dictionary"
  | "image";

// Features available on the free plan. Everything else requires a paid plan.
const FREE_FEATURES: Set<FeatureKey> = new Set(["tts", "fire-tts", "dictionary"]);

export function planAllowsFeature(plan: string, feature: FeatureKey): boolean {
  if (plan !== "free") return true;
  return FREE_FEATURES.has(feature);
}

/* ── Model gating ───────────────────────────────────────────────────────── */

// Ordered model id lists per provider (must match the frontend dropdowns).
export const ELEVENLABS_MODEL_IDS = [
  "eleven_v3",
  "eleven_turbo_v2_5",
];
export const MINIMAX_MODEL_IDS = [
  "speech-02-hd",
];

export const FISH_AUDIO_MODEL_IDS = [
  "s2.1-pro-free",
];

// Free users only get the first N models of each provider.
export const FREE_MODEL_LIMIT = 5;

export function allowedModels(plan: string, provider: "elevenlabs" | "minimax" | "fishaudio"): string[] {
  if (provider === "minimax") {
    return plan !== "free" ? MINIMAX_MODEL_IDS : MINIMAX_MODEL_IDS.slice(0, FREE_MODEL_LIMIT);
  }
  if (provider === "fishaudio") {
    return plan !== "free" ? FISH_AUDIO_MODEL_IDS : ["s2.1-pro-free"];
  }
  return plan !== "free" ? ELEVENLABS_MODEL_IDS : ELEVENLABS_MODEL_IDS.slice(0, FREE_MODEL_LIMIT);
}

export function modelAllowedForPlan(plan: string, provider: "elevenlabs" | "minimax" | "fishaudio", modelId: string): boolean {
  return allowedModels(plan, provider).includes(modelId);
}

/* ── Pricing-page plan definitions ──────────────────────────────────────── */

function fmtCredits(n: number): string {
  return n.toLocaleString("en-US");
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  credits: number;
  durationDays: number;
  highlight: boolean;
  cta: string;
  features: string[];
  /** Extra detail lines shown behind a "See more" toggle on the pricing page. */
  more?: string[];
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Basic",
    credits: PLAN_CREDITS.free,
    durationDays: PLAN_DURATION_DAYS,
    highlight: false,
    cta: "Get Started",
    features: [
      `${fmtCredits(PLAN_CREDITS.free)} characters / 30 days`,
      "Text to Speech — all models",
      "Bulk TTS — all models",
      "MP3 downloads",
      "Community support",
    ],
    more: [
      "ElevenLabs — Eleven v3",
      "ElevenLabs — Multilingual v2.5",
      "Fish Audio — S2.1 Pro",
      "Fire TTS — Speech-02 HD",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    credits: PLAN_CREDITS.starter,
    durationDays: PLAN_DURATION_DAYS,
    highlight: true,
    cta: "Choose Starter",
    features: [
      `${fmtCredits(PLAN_CREDITS.starter)} characters / 30 days`,
      "Everything in Basic",
      "Voice Cloning",
      "Speech to Speech",
      "Speech to Text",
      "Sound Effects",
      "AI Music — Suno",
      "Pronunciation Dictionary",
      "Email support",
    ],
    more: [
      "Voice Cloning — Fire TTS engine",
      "Speech to Speech — ElevenLabs STS v2",
      "Speech to Text — ElevenLabs Scribe v1",
      "Sound Effects — ElevenLabs",
      "AI Music — Suno full songs & background music",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    credits: PLAN_CREDITS.pro,
    durationDays: PLAN_DURATION_DAYS,
    highlight: false,
    cta: "Get Pro",
    features: [
      `${fmtCredits(PLAN_CREDITS.pro)} characters / 30 days`,
      "Everything in Starter",
      "Audio Isolation",
      "Multilingual Dubbing — 29 languages",
      "Text to Dialogue",
      "AI Images — 20 models",
      "Voice Library",
      "Priority support",
    ],
    more: [
      "Audio Isolation — ElevenLabs",
      "Text to Dialogue — Eleven v3 multi-speaker",
      "Voice Library — thousands of voices, all providers",
      "AI Images: GPT Image 2, GPT Image 1.5, GPT Image 1",
      "Gemini 3 Pro, Gemini 3.1 Flash, Gemini 2.5 Flash",
      "Seedream 5 Pro, Seedream 5 Lite, Seedream 4.5, Seedream 4",
      "Flux 2 Pro, Flux 1 Kontext, Recraft v4.1",
      "Krea 2 Large, Krea 2 Medium, Kling Omni Image",
      "Runway Gen-4 Image, Runway Gen-4 Turbo, Wan 2.5",
    ],
  },
  {
    id: "max",
    name: "Pro Max",
    credits: PLAN_CREDITS.max,
    durationDays: PLAN_DURATION_DAYS,
    highlight: false,
    cta: "Get Pro Max",
    features: [
      `${fmtCredits(PLAN_CREDITS.max)} characters / 30 days`,
      "Everything in Pro",
      "All premium & emotional voices",
      "Commercial license",
      "Highest priority support",
    ],
  },
];
