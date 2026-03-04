/**
 * BACKEND i18n - Central export for all language boundary modules.
 *
 * Language boundaries:
 *   1. languages.ts   - prompt instructions + language config (source of truth)
 *   2. voiceRegistry  - Replicate/Chatterbox fallback voice config (dormant when MiniMax active)
 *   3. chunkRules     - language-specific text chunking for TTS
 *   4. spokenIntro    - localized spoken introductions
 *
 * Active TTS provider is MiniMax (see apiKeysHelper.activeTtsProvider()).
 * voiceRegistry is only used when provider is switched to 'replicate'.
 */

export { getVoiceConfig, hasVoiceSupport, type VoiceConfig, type TTSProvider } from './voiceRegistry';
export { getChunkConfig, type ChunkConfig } from './chunkRules';
