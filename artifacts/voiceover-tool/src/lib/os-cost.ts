/**
 * Client-side mirrors of the server's credit-estimation rules for
 * OpenSpeaker tasks (see artifacts/api-server/src/routes/openspeaker.ts).
 * Keep these in sync with the server — they are estimates only; the server
 * reserves the estimate and may reconcile to the provider's real cost.
 */

/**
 * TTS: 1 credit per character. The same rate applies to the direct studio
 * engines (ElevenLabs /api/tts, MiniMax /api/minimax/tts, Fish Audio
 * /api/fishaudio/tts) — all reserve text.length credits.
 */
export function estimateTtsCost(text: string): number {
  return text.length;
}

/** Edge TTS: 1 credit per 500 characters, minimum 1 (see /api/edge-tts). */
export function estimateEdgeTtsCost(text: string): number {
  return Math.max(1, Math.ceil(text.length / 500));
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
