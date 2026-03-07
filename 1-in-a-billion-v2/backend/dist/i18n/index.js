"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChunkConfig = exports.hasVoiceSupport = exports.getVoiceConfig = void 0;
var voiceRegistry_1 = require("./voiceRegistry");
Object.defineProperty(exports, "getVoiceConfig", { enumerable: true, get: function () { return voiceRegistry_1.getVoiceConfig; } });
Object.defineProperty(exports, "hasVoiceSupport", { enumerable: true, get: function () { return voiceRegistry_1.hasVoiceSupport; } });
var chunkRules_1 = require("./chunkRules");
Object.defineProperty(exports, "getChunkConfig", { enumerable: true, get: function () { return chunkRules_1.getChunkConfig; } });
//# sourceMappingURL=index.js.map