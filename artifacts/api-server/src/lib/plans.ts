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
export const PLAN_PRICE_USD: Record<PlanId, number> = {
  free: 0,
  starter: 3,
  pro: 7.5,
  max: 10,
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

export function priceInCurrency(plan: PlanId, currency: string): number {
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
      "Text to Speech — ElevenLabs, Fire TTS & Fish Audio",
      "Edge TTS — 400+ voices",
      "Pronunciation Dictionary",
      "MP3 downloads",
      "Community support",
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
      "All TTS models — ElevenLabs, Fire TTS & Fish Audio",
      "Voice Cloning",
      "Speech to Speech",
      "Speech to Text",
      "Sound Effects",
      "AI Music",
      "Email support",
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
      "Multilingual Dubbing",
      "Dialogue Studio",
      "AI Image Studio",
      "Voice Library access",
      "Priority support",
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
      "Bulk TTS",
      "All premium & emotional voices",
      "Commercial license",
      "Highest priority support",
    ],
  },
];
