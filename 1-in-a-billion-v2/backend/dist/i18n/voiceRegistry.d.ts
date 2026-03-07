/**
 * VOICE REGISTRY - Replicate/Chatterbox Fallback Configuration
 *
 * ⚠️  DORMANT: Only used when active_tts_provider = 'replicate' in api_keys table.
 *     MiniMax is the default/active TTS provider (see apiKeysHelper.ts).
 *
 * Maps language -> Replicate Chatterbox model + voice configuration:
 *   - English → chatterbox-turbo (fastest)
 *   - All others → chatterbox-multilingual (language_id param)
 */
import { OutputLanguage } from '../config/languages';
export type TTSProvider = 'chatterbox' | 'chatterbox-multilingual';
export interface VoiceConfig {
    provider: TTSProvider;
    /** Replicate model identifier */
    modelId: string;
    /** Language ID for chatterbox-multilingual (ISO 639-1) */
    languageId: string;
    /** Human-readable label for logs/debug */
    label: string;
    /** Whether this voice supports voice cloning / reference audio */
    supportsCloning: boolean;
}
/**
 * Get voice config for a language.
 * Falls back to English if language not found.
 */
export declare function getVoiceConfig(lang: OutputLanguage): VoiceConfig;
/**
 * Check if a language has voice support configured.
 * Now returns true for all 5 launch languages since
 * Chatterbox Multilingual supports them all.
 */
export declare function hasVoiceSupport(lang: OutputLanguage): boolean;
//# sourceMappingURL=voiceRegistry.d.ts.map