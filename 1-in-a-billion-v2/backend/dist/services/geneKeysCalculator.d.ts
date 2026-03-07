/**
 * Gene Keys Calculator
 *
 * Calculates Gene Keys Hologenetic Profile from planetary positions.
 * Uses the same 64-gate zodiacal wheel as Human Design.
 *
 * Ported from frontend implementation.
 */
export interface GeneKeyData {
    shadow: string;
    gift: string;
    siddhi: string;
}
export interface GeneKeyPosition {
    geneKey: number;
    line: number;
    shadow: string;
    gift: string;
    siddhi: string;
}
export interface HologeneticProfile {
    lifesWork?: GeneKeyPosition;
    evolution?: GeneKeyPosition;
    radiance?: GeneKeyPosition;
    purpose?: GeneKeyPosition;
    attraction?: GeneKeyPosition;
    iq?: GeneKeyPosition;
    eq?: GeneKeyPosition;
    sq?: GeneKeyPosition;
    vocation?: GeneKeyPosition;
    culture?: GeneKeyPosition;
    pearl?: GeneKeyPosition;
}
export declare const GENE_KEYS_DATA: Record<number, GeneKeyData>;
export declare const GATE_SEQUENCE: number[];
/**
 * Convert tropical zodiac longitude to Gene Key number and line.
 *
 * The Gene Keys wheel (identical to Human Design):
 * - Starts at Gate 41 at 2° Aquarius (302° tropical)
 * - Each Gene Key spans 5.625° (360/64)
 * - Each Line spans 0.9375° (5.625/6)
 *
 * @param longitude Tropical zodiac longitude in degrees (0-360)
 * @returns {GeneKeyPosition} gene_key, line, shadow, gift, siddhi
 */
export declare function tropicalLongitudeToGeneKey(longitude: number): GeneKeyPosition;
export interface PlanetaryPositions {
    personality: {
        sun?: number;
        earth?: number;
        moon?: number;
        venus?: number;
        mars?: number;
        jupiter?: number;
        [key: string]: number | undefined;
    };
    design: {
        sun?: number;
        earth?: number;
        moon?: number;
        venus?: number;
        mars?: number;
        jupiter?: number;
        [key: string]: number | undefined;
    };
}
/**
 * Calculate the Hologenetic Profile spheres from planetary positions.
 *
 * The Activation Sequence uses:
 * - Life's Work: Conscious Sun (personality)
 * - Evolution: Conscious Earth (opposite Sun)
 * - Radiance: Conscious Sun from Design (88 days prior)
 * - Purpose: Conscious Earth from Design
 *
 * The Venus Sequence uses:
 * - Attraction: Venus
 * - IQ (Intelligence): Design Mars
 * - EQ (Emotional): Design Venus
 * - SQ (Spiritual): Conscious Moon
 *
 * The Pearl Sequence uses:
 * - Vocation: Conscious Mars
 * - Culture: Design Jupiter
 * - Pearl: Conscious Sun (same as Life's Work)
 */
export declare function calculateGeneKeys(planetaryPositions: PlanetaryPositions): HologeneticProfile;
//# sourceMappingURL=geneKeysCalculator.d.ts.map