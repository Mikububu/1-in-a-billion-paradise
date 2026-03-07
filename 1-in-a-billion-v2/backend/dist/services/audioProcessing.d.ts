/**
 * AUDIO PROCESSING UTILITIES - Shared audio chunking and concatenation logic
 *
 * This module provides reusable functions for:
 * - Text chunking (sentence-aware, never cuts mid-sentence)
 * - WAV buffer concatenation with crossfade transitions
 * - WAV format detection and conversion (IEEE Float to PCM)
 * - Per-chunk silence trimming (removes Chatterbox leading/trailing dead-air)
 *
 * CONFIGURATION: All tunable parameters are at the top for easy adjustment
 */
export declare const AUDIO_CONFIG: {
    CHUNK_MAX_LENGTH: number;
    CHUNK_OVERFLOW_TOLERANCE: number;
    CHUNK_WORD_SPLIT_THRESHOLD: number;
    CROSSFADE_DURATION_MS: number;
    SILENCE_TRIM_ENABLED: boolean;
    SILENCE_THRESHOLD_DB: number;
    SILENCE_MIN_DURATION: number;
    INTER_CHUNK_GAP_MS: number;
    DEFAULT_SAMPLE_RATE: number;
    DEFAULT_NUM_CHANNELS: number;
    DEFAULT_BITS_PER_SAMPLE: number;
};
/**
 * Split text into chunks for TTS generation
 *
 * IMPROVED LOGIC:
 * - Always completes sentences (never cuts mid-sentence)
 * - Allows chunks to slightly exceed maxChunkLength to finish current sentence
 * - Only splits at word boundaries if a single sentence is extremely long (>2x limit)
 *
 * @param text - Text to split
 * @param maxChunkLength - Target max length per chunk (can be exceeded to complete sentences)
 * @returns Array of text chunks
 */
export declare function splitIntoChunks(text: string, maxChunkLength?: number): string[];
/**
 * Remove exact/near-exact adjacent duplicate sentences in text.
 * This does NOT remove distant thematic repetition; only immediate sentence echoes.
 */
export declare function dedupeAdjacentSentences(text: string): {
    text: string;
    removed: number;
};
/**
 * Remove sentence overlap between consecutive chunks.
 * If chunk N ends with the same sentence chunk N+1 starts with, drop the leading sentence in N+1.
 */
export declare function dedupeChunkBoundaryOverlap(chunks: string[]): {
    chunks: string[];
    removed: number;
};
/**
 * Trim leading and trailing silence from a WAV buffer using FFmpeg's silenceremove filter.
 *
 * Strategy (two-pass):
 *   1. silenceremove start_periods=1  → strips leading silence
 *   2. reverse → silenceremove start_periods=1 → reverse  → strips trailing silence
 *
 * Conservative thresholds avoid clipping actual speech.
 * Returns the trimmed WAV buffer (same sample rate / channels / bit depth).
 */
export declare function trimSilenceFromWav(wavBuffer: Buffer): Promise<Buffer>;
/**
 * Build a WAV buffer containing pure silence of the given duration.
 * Used to insert controlled inter-chunk gaps after silence trimming.
 */
export declare function buildSilenceWav(durationMs: number, sampleRate?: number, numChannels?: number): Buffer;
/**
 * Find the "data" chunk in a WAV file and return its offset and size
 */
export declare function findWavDataChunk(buffer: Buffer): {
    dataOffset: number;
    dataSize: number;
};
/**
 * Detect WAV format (16-bit PCM vs IEEE Float)
 */
export declare function getWavFormat(buffer: Buffer): {
    audioFormat: number;
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
};
/**
 * Convert IEEE Float WAV to 16-bit PCM WAV
 */
export declare function convertFloatWavToPcm(buffer: Buffer): Buffer;
/**
 * Concatenate WAV buffers with crossfade transitions
 *
 * IMPROVED LOGIC:
 * - Uses configurable crossfade duration (default 80ms)
 * - Proper overlap blending (not just fade-out/fade-in)
 * - Equal-power crossfade for perceptually smooth transitions
 * - Converts IEEE Float to 16-bit PCM if needed
 *
 * @param buffers - Array of WAV buffers to concatenate
 * @returns Single concatenated WAV buffer with crossfades
 */
export declare function concatenateWavBuffers(buffers: Buffer[]): Buffer;
//# sourceMappingURL=audioProcessing.d.ts.map