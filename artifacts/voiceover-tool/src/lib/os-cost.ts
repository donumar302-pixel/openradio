/**
 * Client-side mirrors of the server's credit-estimation rules for
 * OpenSpeaker tasks (see artifacts/api-server/src/routes/openspeaker.ts).
 * Keep these in sync with the server — they are estimates only; the server
 * reserves the estimate and may reconcile to the provider's real cost.
 */

/** ElevenLabs voices cost ~1.2× the character count (provider-side rate);
 *  mirror of the server's EL_TTS_COST_MULTIPLIER. */
export const EL_TTS_COST_MULTIPLIER = 1.2;

/** TTS: 1 credit per character — except ElevenLabs voices, which cost ~1.2×. */
export function estimateTtsCost(text: string, isElevenLabs = false): number {
  return isElevenLabs ? Math.ceil(text.length * EL_TTS_COST_MULTIPLIER) : text.length;
}

/** Dialogue: 1 credit per character of the full script. */
export function estimateDialogueCost(text: string): number {
  return text.length;
}

/** Dubbing: max(500, fileSize/20,000) — reconciled to real cost after creation. */
export function estimateDubbingCost(fileSize: number): number {
  return Math.max(500, Math.ceil(fileSize / 20_000));
}

/** Voice changer: max(100, fileSize/10,000). */
export function estimateVoiceChangerCost(fileSize: number): number {
  return Math.max(100, Math.ceil(fileSize / 10_000));
}

/** Voice isolation: max(100, fileSize/20,000). */
export function estimateIsolationCost(fileSize: number): number {
  return Math.max(100, Math.ceil(fileSize / 20_000));
}

/** Speech to text: max(20, fileSize/50,000). */
export function estimateSttCost(fileSize: number): number {
  return Math.max(20, Math.ceil(fileSize / 50_000));
}

/** Sound effects: 200 for auto duration, otherwise max(50, seconds×50). */
export function estimateSoundEffectCost(autoDuration: boolean, durationSeconds: number): number {
  return autoDuration ? 200 : Math.max(50, Math.ceil(durationSeconds * 50));
}

/** Music: flat 4,000-credit reserve — reconciled to the provider's real cost. */
export const MUSIC_COST_ESTIMATE = 4000;

/**
 * Voice clone creation: free. Neither /api/os/voice-clone (OpenSpeaker) nor
 * /api/minimax/voice-clone reserves credits — charges only apply later when
 * the clone is used to generate audio (e.g. per-character TTS).
 */
export const VOICE_CLONE_CREATE_COST = 0;
