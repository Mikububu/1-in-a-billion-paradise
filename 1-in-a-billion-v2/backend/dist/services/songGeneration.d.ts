/**
 * SONG GENERATION SERVICE
 *
 * Generates a full song with vocals using MiniMax Music API.
 * Takes lyrics and generates a 3-minute song with deep male vocals,
 * dark poetic style (70% Leonard Cohen, 20% Paul Simon, 10% Tom Waits).
 *
 * Updated January 2026 for Music 2.5:
 * - New API endpoint: api.minimax.io (not platform.minimax.io)
 * - Enhanced structure tags: [Intro], [Verse], [Pre Chorus], [Chorus],
 *   [Interlude], [Bridge], [Outro], [Post Chorus], [Transition], [Break],
 *   [Hook], [Build Up], [Inst], [Solo]
 * - Better vocal performance with humanized timbre
 * - Improved instrumentation and mixing
 */
export interface Persona {
    id: string;
    name: string;
    weight: number;
    style_tags: string[];
}
export interface SongGenerationInput {
    lyrics: string;
    personName: string;
    style?: string;
    emotion?: string;
    duration?: number;
    personas?: Persona[];
    customPrompt?: string;
}
export interface SongGenerationResult {
    audioUrl?: string;
    audioBase64?: string;
    duration: number;
    traceId?: string;
}
/**
 * Generate a full song with vocals using MiniMax Music API
 *
 * Cost: ~$0.0825 per song (1 credit = 1 song)
 */
export declare function generateSong(input: SongGenerationInput): Promise<SongGenerationResult>;
/**
 * Download audio from URL and convert to base64 if needed
 */
export declare function downloadSongAudio(audioUrl: string): Promise<string>;
//# sourceMappingURL=songGeneration.d.ts.map