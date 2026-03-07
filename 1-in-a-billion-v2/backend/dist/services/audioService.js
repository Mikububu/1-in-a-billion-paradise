"use strict";
/**
 * AUDIO SERVICE
 *
 * Legacy endpoint - main TTS is now via /tts endpoint using Chatterbox.
 * This service is kept for backwards compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioService = exports.AudioService = void 0;
class AudioService {
    async requestGeneration(readingId) {
        // Legacy endpoint - returns processing status
        // Actual TTS generation is done via /tts endpoint with Chatterbox
        console.log(`[AudioService] Legacy generate called for: ${readingId}`);
        return {
            audioId: readingId,
            status: 'processing',
            message: 'Use /tts endpoint with Chatterbox for actual audio generation'
        };
    }
}
exports.AudioService = AudioService;
exports.audioService = new AudioService();
//# sourceMappingURL=audioService.js.map