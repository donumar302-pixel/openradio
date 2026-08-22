import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Platform settings stored in app_settings (key → JSON string).
 * Known keys:
 *  - banner: { enabled: boolean; text: string }
 *  - features: { [provider: string]: boolean }  // false = killed
 */
export type BannerSetting = { enabled: boolean; text: string };
export type FeatureSwitches = Record<string, boolean>;

/**
 * A manual/offline payment method shown to customers on the checkout page.
 * Customer-visible account fields are exposed publicly for enabled methods;
 * `instructions` is a free-form note (e.g. "send within 30 minutes").
 */
export type PaymentMethod = {
  id: string;
  label: string;
  provider: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions: string;
  logoUrl: string;
  enabled: boolean;
};

const DEFAULTS: Record<string, unknown> = {
  banner: { enabled: false, text: "" } satisfies BannerSetting,
  payment_methods: [] as PaymentMethod[],
  features: {
    elevenlabs: true,
    minimax: true,
    fishaudio: true,
    edge: true,
    "voice-cloning": true,
    // OpenSpeaker tool suite — one independent kill-switch per tool.
    "os-tts": true,
    "os-dialogue": true,
    "os-dictionary": true,
    "os-voice-clone": true,
    "os-dubbing": true,
    "os-voice-changer": true,
    "os-voice-isolation": true,
    "os-speech-to-text": true,
    "os-sound-effects": true,
    "os-music": true,
    "os-image": true,
  } satisfies FeatureSwitches,
};

// Small cache so hot paths (TTS routes) don't hit the DB on every request.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; at: number }>();

export async function getSetting<T>(key: string): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  let value: unknown = DEFAULTS[key];
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      const def = DEFAULTS[key];
      if (Array.isArray(def)) {
        // Array-valued settings are replaced wholesale, never merged; fall
        // back to the default only when the stored value is not an array.
        value = Array.isArray(parsed) ? parsed : def;
      } else if (typeof def === "object" && def !== null) {
        value = { ...(def as object), ...(parsed as object) };
      } else {
        value = parsed;
      }
    } catch {
      /* keep default on corrupt value */
    }
  }
  cache.set(key, { value, at: Date.now() });
  return value as T;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await db.insert(appSettingsTable)
    .values({ key, value: json, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: json, updatedAt: new Date() } });
  cache.delete(key);
}

export async function isFeatureEnabled(feature: string): Promise<boolean> {
  const features = await getSetting<FeatureSwitches>("features");
  return features[feature] !== false;
}

export function knownSettingKeys(): string[] {
  return Object.keys(DEFAULTS);
}

export function settingDefault(key: string): unknown {
  return DEFAULTS[key];
}

/* ── Payment methods ─────────────────────────────────────────────────── */

const PM_MAX = 40; // hard cap on number of methods
const PM_FIELD_MAX = 500; // hard cap on any single string field

function clampStr(v: unknown, max = PM_FIELD_MAX): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function isSafeLogoUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Strictly validate and normalize an admin-supplied payment_methods payload
 * into the canonical PaymentMethod[] shape. Rejects non-arrays and any entry
 * missing an id/label. Ids are normalized and de-duplicated.
 */
export function normalizePaymentMethods(input: unknown): PaymentMethod[] {
  if (!Array.isArray(input)) {
    throw new Error("payment_methods must be an array");
  }
  if (input.length > PM_MAX) {
    throw new Error(`Too many payment methods (max ${PM_MAX})`);
  }
  const out: PaymentMethod[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Each payment method must be an object");
    }
    const r = raw as Record<string, unknown>;
    let id = clampStr(r.id, 64).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const label = clampStr(r.label);
    if (!label) throw new Error("Each payment method needs a label");
    if (!id) id = label.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "method";
    // Ensure uniqueness of ids.
    let unique = id;
    let n = 1;
    while (seen.has(unique)) unique = `${id}-${++n}`;
    seen.add(unique);
    const provider = clampStr(r.provider);
    const accountTitle = clampStr(r.accountTitle);
    const accountNumber = clampStr(r.accountNumber);
    const instructions = clampStr(r.instructions, 2000);
    const logoUrl = clampStr(r.logoUrl, 2000);
    const enabled = r.enabled === true;
    if (enabled && (!provider || !accountTitle || !accountNumber || !instructions)) {
      throw new Error("Enabled payment methods need a provider, account title, account number, and instructions");
    }
    if (!isSafeLogoUrl(logoUrl)) {
      throw new Error("Logo URL must use HTTPS or be a local path");
    }
    out.push({
      id: unique,
      label,
      provider,
      accountTitle,
      accountNumber,
      iban: clampStr(r.iban),
      instructions,
      logoUrl,
      enabled,
    });
  }
  return out;
}

/** All configured payment methods (admin view). */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return getSetting<PaymentMethod[]>("payment_methods");
}

/** Customer-visible fields for a single enabled method, or null. */
export function publicPaymentMethod(m: PaymentMethod) {
  return {
    id: m.id,
    label: m.label,
    provider: m.provider,
    accountTitle: m.accountTitle,
    accountNumber: m.accountNumber,
    iban: m.iban,
    instructions: m.instructions,
    logoUrl: m.logoUrl,
  };
}
