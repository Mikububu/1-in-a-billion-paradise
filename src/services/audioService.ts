/**
 * AUDIO SERVICE
 * 
 * Legacy endpoint - main TTS is now via /tts endpoint using Chatterbox.
 * This service is kept for backwards compatibility.
 */

export class AudioService {
  async requestGeneration(readingId: string) {
    // Legacy endpoint - returns processing status
    // Actual TTS generation is done via /tts endpoint with Chatterbox
    console.log(`[AudioService] Legacy generate called for: ${readingId}`);
    return { 
      audioId: readingId, 
      status: 'processing' as const,
      message: 'Use /tts endpoint with Chatterbox for actual audio generation'
    };
  }
}

export const audioService = new AudioService();
