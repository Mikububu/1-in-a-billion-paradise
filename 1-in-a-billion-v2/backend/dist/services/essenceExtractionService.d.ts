/**
 * Essence Extraction Service
 *
 * Extracts key identifiers (essences) from astrological reading texts.
 * These essences are stored in Supabase and used for:
 * 1. UI display under system names
 * 2. Future large-scale matching algorithms
 * 3. Search and filtering
 *
 * See: docs/SYSTEM_ESSENCES.md
 */
export interface SystemEssences {
    western?: {
        sunSign: string;
        moonSign: string;
        risingSign: string;
    };
    vedic?: {
        nakshatra: string;
        pada?: number;
        lagna: string;
        moonSign?: string;
    };
    humanDesign?: {
        type: string;
        profile: string;
    };
    geneKeys?: {
        lifesWork: number;
        evolution?: number;
    };
    kabbalah?: {
        primarySephirah?: string;
    };
    verdict?: null;
}
/**
 * Extract Vedic essences from reading text
 * Looks for: Nakshatra, Pada, Lagna, Moon sign
 */
export declare function extractVedicEssences(readingText: string): SystemEssences['vedic'] | null;
/**
 * Extract Human Design essences from reading text
 * Looks for: Type and Profile
 */
export declare function extractHumanDesignEssences(readingText: string): SystemEssences['humanDesign'] | null;
/**
 * Extract Gene Keys essences from reading text
 * Looks for: Life's Work and Evolution gene key numbers
 */
export declare function extractGeneKeysEssences(readingText: string): SystemEssences['geneKeys'] | null;
/**
 * Extract Kabbalah essences from reading text
 * Looks for: Primary Sephirah
 */
export declare function extractKabbalahlahEssences(readingText: string): SystemEssences['kabbalah'] | null;
/**
 * Extract all essences from a complete set of readings
 *
 * @param readingsBySystem - Object with system IDs as keys and reading text as values
 * @returns Complete essences object ready to save to Supabase
 */
export declare function extractAllEssences(readingsBySystem: Record<string, string>): SystemEssences;
/**
 * Generate essences directly from deterministic placements
 * This is the MOST RELIABLE source for essences.
 */
export declare function generateEssencesFromPlacements(placements: any): SystemEssences;
//# sourceMappingURL=essenceExtractionService.d.ts.map