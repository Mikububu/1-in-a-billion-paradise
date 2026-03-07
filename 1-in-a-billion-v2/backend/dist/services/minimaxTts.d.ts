/**
 * Downloads a wav file from a URL and uploads it to MiniMax
 */
export declare function getMinimaxSequenceForUrl(url: string, filename: string): Promise<string>;
/**
 * Generates an MP3 using the MiniMax T2A Async API.
 *
 * @param language - ISO 639-1 language code (e.g. 'en', 'de', 'ja') for language_boost.
 *                   Enables cross-lingual voice cloning so cloned voices speak the target language natively.
 */
export declare function generateMinimaxAsync(text: string, voiceId: string, clonePromptFileId?: string, speed?: number, volume?: number, language?: string): Promise<Buffer>;
/**
 * Register a voice clone permanently with MiniMax Voice Clone API.
 *
 * This creates a persistent voice_id that can be used directly in T2A calls
 * without needing clone_prompt. Produces better quality than inline cloning.
 *
 * Requirements:
 * - Audio must be 10s-5min (uploaded with purpose='voice_clone')
 * - voice_id: min 8 chars, alphanumeric, starts with letter, must be unique per account
 * - Registered voices are deleted after 7 days if never used in a T2A call
 * - Limit: ~4 registered voices per account (use them wisely)
 *
 * @returns The registered voice_id (same as input) and optional demo audio URL
 */
export declare function registerVoiceClone(audioFileId: string, voiceId: string, model?: string): Promise<{
    success: boolean;
    voiceId: string;
    demoAudio?: string;
}>;
/**
 * Upload audio for Voice Clone API registration (requires 10s-5min audio).
 * Use this with registerVoiceClone() for permanent voice registration.
 */
export declare function uploadForVoiceClone(wavBuffer: Buffer, filename?: string): Promise<string>;
//# sourceMappingURL=minimaxTts.d.ts.map