/**
 * LYRICS GENERATION SERVICE
 *
 * Generates personalized song lyrics from deep reading data using DeepSeek.
 * Lyrics include the person's name and reflect their soul themes, emotional patterns,
 * fears, desires, and life direction extracted from the reading.
 */
export interface LyricsGenerationInput {
    personName: string;
    readingText: string;
    relationshipContext?: string;
    systemKey?: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'verdict' | 'final_verdict';
    systemContext?: string;
}
export interface LyricsResult {
    lyrics: string;
    title: string;
    style: string;
    musicStyle: string;
    vocalist: string;
    emotion: string;
    minimaxPrompt: string;
}
/**
 * Generate personalized song lyrics from reading data
 */
export declare function generateLyrics(input: LyricsGenerationInput): Promise<LyricsResult>;
//# sourceMappingURL=lyricsGeneration.d.ts.map