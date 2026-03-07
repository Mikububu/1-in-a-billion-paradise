/**
 * AUDIO SERVICE
 *
 * Legacy endpoint - main TTS is now via /tts endpoint using Chatterbox.
 * This service is kept for backwards compatibility.
 */
export declare class AudioService {
    requestGeneration(readingId: string): Promise<{
        audioId: string;
        status: "processing";
        message: string;
    }>;
}
export declare const audioService: AudioService;
//# sourceMappingURL=audioService.d.ts.map