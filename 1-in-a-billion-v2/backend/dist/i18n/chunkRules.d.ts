/**
 * CHUNK RULES - Language-specific text chunking for TTS.
 *
 * Different languages have different optimal chunk sizes
 * and sentence boundary patterns.
 *
 * NOTE: MiniMax handles full text natively (no chunking needed).
 * These rules are used by the Replicate/Chatterbox fallback path
 * which requires text to be split into smaller chunks.
 * maxChars is still used by audioWorker to set chunk size.
 */
import { OutputLanguage } from '../config/languages';
export interface ChunkConfig {
    /** Maximum characters per TTS chunk */
    maxChars: number;
    /** Regex for sentence boundary splitting */
    splitPattern: RegExp;
    /** Minimum chunk size (don't split below this) */
    minChars: number;
}
/**
 * Get chunk config for a language.
 * Falls back to English if language not found.
 */
export declare function getChunkConfig(lang: OutputLanguage): ChunkConfig;
//# sourceMappingURL=chunkRules.d.ts.map