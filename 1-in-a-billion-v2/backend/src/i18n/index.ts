/**
 * BACKEND i18n — Central export for all language boundary modules.
 *
 * The multilingual system has 3 boundaries (plus frontend i18n):
 *   1. promptWrapper  — wraps English prompts with language output directive
 *   2. voiceRegistry  — maps language -> TTS provider + voice config
 *   3. chunkRules     — language-specific text chunking for TTS
 *
 * All boundaries are NO-OPs for English. The core app behaves
 * identically when language === 'en'.
 */

export { wrapForLanguage, getLanguageLabel } from './promptWrapper';
export { getVoiceConfig, hasVoiceSupport, type VoiceConfig, type TTSProvider } from './voiceRegistry';
export { getChunkConfig, type ChunkConfig } from './chunkRules';
