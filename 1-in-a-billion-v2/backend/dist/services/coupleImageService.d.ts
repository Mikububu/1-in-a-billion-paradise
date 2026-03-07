/**
 * COUPLE IMAGE SERVICE
 *
 * Creates AI-generated romantic couple portraits by composing two
 * already-generated individual styled portraits together.
 *
 * ⚠️ CRITICAL - DO NOT CHANGE THIS APPROACH:
 *
 * This service MUST take already-styled portraits (from aiPortraitService.ts)
 * as inputs, NOT original photos. This is the ONLY way to ensure facial
 * features are preserved in couple portraits regardless of artistic style.
 *
 * Workflow:
 * 1. Generate individual portrait for Person 1 (original photo → styled portrait)
 * 2. Generate individual portrait for Person 2 (original photo → styled portrait)
 * 3. Compose couple portrait (styled portrait 1 + styled portrait 2 → couple image)
 *
 * This approach works for ANY artistic style (linoleum, clay, watercolor, etc.)
 * and ensures both faces remain recognizable in the couple composition.
 */
export interface CoupleImageResult {
    success: boolean;
    coupleImageUrl?: string;
    storagePath?: string;
    error?: string;
}
/**
 * Generate a romantic couple portrait using AI
 *
 * Takes two already-generated styled portraits (e.g., linoleum/AI portrait style)
 * and composes them into an intimate "lovers" composition.
 *
 * The AI preserves the facial features from both input portraits while creating
 * a unified romantic composition. This approach ensures face consistency regardless
 * of the artistic style used.
 */
export declare function composeCoupleImage(userId: string, person1Id: string, person2Id: string, portrait1Url: string, portrait2Url: string): Promise<CoupleImageResult>;
/**
 * Get existing couple image URL, or generate if it doesn't exist
 */
export declare function getCoupleImage(userId: string, person1Id: string, person2Id: string, portrait1Url: string, portrait2Url: string, forceRegenerate?: boolean): Promise<CoupleImageResult>;
//# sourceMappingURL=coupleImageService.d.ts.map