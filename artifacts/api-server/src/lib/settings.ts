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

const DEFAULTS: Record<string, unknown> = {
  banner: { enabled: false, text: "" } satisfies BannerSetting,
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
      value = typeof DEFAULTS[key] === "object" && DEFAULTS[key] !== null
        ? { ...(DEFAULTS[key] as object), ...(parsed as object) }
        : parsed;
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
