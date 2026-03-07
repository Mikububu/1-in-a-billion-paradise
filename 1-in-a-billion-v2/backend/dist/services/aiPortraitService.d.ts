/**
 * AI PORTRAIT SERVICE
 *
 * Transforms user photos into AI-styled portraits
 * using Google AI Studio (image-to-image transformation).
 *
 * Purpose: Privacy-preserving profile images for the matching system.
 * When users match, they see each other's AI-generated portraits, not real photos.
 */
export interface AIPortraitResult {
    success: boolean;
    imageUrl?: string;
    originalUrl?: string;
    storagePath?: string;
    error?: string;
    cost?: number;
}
/**
 * Generate an AI-styled portrait from a user's photo
 *
 * Single-step image-to-image transformation using Google AI Studio.
 * Sends photo + style prompt directly to generate AI portrait.
 */
export declare function generateAIPortrait(photoBase64: string, userId: string, personId?: string): Promise<AIPortraitResult>;
/**
 * Check if a user/person already has a AI portrait
 */
export declare function getAIPortrait(userId: string, personId?: string): Promise<string | null>;
//# sourceMappingURL=aiPortraitService.d.ts.map