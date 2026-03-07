/**
 * VECTORIZED VEDIC MATCHMAKING TYPE DEFINITIONS
 *
 * This file defines the numeric-indexed type system for high-performance
 * vectorized Vedic Jyotish matchmaking as specified in VECTORIZED_BATCH_MATCHER.md
 *
 * All types use numeric indices (0-based) for O(1) lookup table access.
 * String-based types are defined in vedic_matchmaking.types.ts
 */
/**
 * Nakshatra index: 0-26
 * Maps to the 27 Nakshatras in order:
 * 0=Ashwini, 1=Bharani, 2=Krittika, ..., 26=Revati
 */
export type NakshatraIndex = number;
/**
 * Rashi (Moon sign) index: 0-11
 * Maps to the 12 Rashis in order:
 * 0=Aries, 1=Taurus, 2=Gemini, ..., 11=Pisces
 */
export type RashiIndex = number;
/**
 * Gana index: 0-2
 * 0=Deva, 1=Manushya, 2=Rakshasa
 */
export type GanaIndex = 0 | 1 | 2;
/**
 * Nadi index: 0-2
 * 0=Adi (Vata), 1=Madhya (Pitta), 2=Antya (Kapha)
 */
export type NadiIndex = 0 | 1 | 2;
/**
 * Varna index: 0-3
 * 0=Brahmin, 1=Kshatriya, 2=Vaishya, 3=Shudra
 */
export type VarnaIndex = 0 | 1 | 2 | 3;
/**
 * Yoni index: 0-13
 * Maps to the 14 animal types used in Yoni Koota
 */
export type YoniIndex = number;
/**
 * Planetary house position: 1-12
 * Represents house placement relative to Lagna (Ascendant)
 */
export type HousePosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/**
 * Dasha lord index: 0-8
 * Maps to the 9 planets (Navagraha):
 * 0=Sun, 1=Moon, 2=Mars, 3=Mercury, 4=Jupiter, 5=Venus, 6=Saturn, 7=Rahu, 8=Ketu
 */
export type DashaLordIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/**
 * Ordered list of Nakshatra names for index conversion
 */
export declare const NAKSHATRA_NAMES: readonly ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
/**
 * Ordered list of Rashi names for index conversion
 */
export declare const RASHI_NAMES: readonly ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
/**
 * Ordered list of Gana names for index conversion
 */
export declare const GANA_NAMES: readonly ["Deva", "Manushya", "Rakshasa"];
/**
 * Ordered list of Nadi names for index conversion
 */
export declare const NADI_NAMES: readonly ["Adi", "Madhya", "Antya"];
/**
 * Ordered list of Varna names for index conversion
 */
export declare const VARNA_NAMES: readonly ["Brahmin", "Kshatriya", "Vaishya", "Shudra"];
/**
 * Ordered list of Dasha lord names for index conversion
 */
export declare const DASHA_LORD_NAMES: readonly ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
/**
 * Vectorized person representation using numeric indices
 * Optimized for batch processing and lookup table access
 */
export interface VedicPersonVector {
    /** Unique identifier */
    person_id: string;
    /** Moon Nakshatra index (0-26) */
    moon_nakshatra: NakshatraIndex;
    /** Moon Rashi/sign index (0-11) */
    moon_rashi: RashiIndex;
    /** Ascendant/Lagna Rashi index (0-11) */
    ascendant: RashiIndex;
    /** Mars house position (1-12), used for Manglik Dosha */
    mars_house: HousePosition;
    /** Jupiter house position (1-12), used for benefic influence */
    jupiter_house?: HousePosition;
    /** Venus house position (1-12), used for relationship analysis */
    venus_house?: HousePosition;
    /** Saturn house position (1-12), used for durability analysis */
    saturn_house?: HousePosition;
    /** Current Maha Dasha lord index (0-8) */
    dasha_lord: DashaLordIndex;
    /** Current Antardasha (sub-period) lord index (0-8) */
    sub_dasha_lord: DashaLordIndex;
}
/**
 * Ashta Koota score breakdown
 * All values are numeric scores, no metadata
 */
export interface KootaScoreVector {
    varna: number;
    vashya: number;
    tara: number;
    yoni: number;
    graha_maitri: number;
    gana: number;
    bhakoot: number;
    nadi: number;
    total_guna: number;
}
/**
 * Dosha presence flags
 * Pure boolean indicators, no severity levels
 */
export interface DoshaFlags {
    /** Manglik Dosha present (Mars in houses 1,2,4,7,8,12) */
    manglik: boolean;
    /** Nadi Dosha present (same Nadi) */
    nadi: boolean;
    /** Bhakoot Dosha present (inauspicious Rashi distance) */
    bhakoot: boolean;
}
/**
 * Additional compatibility warning flags
 */
export interface CompatibilityFlags {
    /** Sexual incompatibility (enemy Yoni) */
    sexual_incompatibility: boolean;
    /** Severe Nadi Dosha (same Nadi with no exceptions) */
    severe_nadi_dosha: boolean;
    /** Dasha timing conflict (incompatible planetary periods) */
    dasha_conflict: boolean;
    /** Dasha growth period (mutually supportive periods) */
    dasha_growth: boolean;
}
/**
 * Complete vectorized match result
 * Deterministic output for a single pair comparison
 */
export interface VectorizedMatchResult {
    /** Total Guna score (0-36) */
    total_guna: number;
    /** Detailed Koota breakdown */
    koota_breakdown: KootaScoreVector;
    /** Dosha presence flags */
    doshas: DoshaFlags;
    /** Additional compatibility flags */
    flags: CompatibilityFlags;
}
/**
 * Single pair result in batch processing
 */
export interface BatchMatchPair {
    /** Person A identifier */
    person_a_id: string;
    /** Person B identifier */
    person_b_id: string;
    /** Match result */
    result: VectorizedMatchResult;
}
/**
 * Batch match results for one-to-many or many-to-many
 */
export interface BatchMatchResults {
    /** Total pairs processed */
    total_pairs: number;
    /** Individual pair results */
    pairs: BatchMatchPair[];
    /** Processing metadata */
    metadata?: {
        /** Processing time in milliseconds */
        processing_time_ms?: number;
        /** Number of pairs rejected early (fast filter) */
        early_rejections?: number;
    };
}
/**
 * Type for functions that convert string-based to numeric-based representations
 */
export type StringToVectorConverter = (stringPerson: any) => VedicPersonVector;
/**
 * Type for functions that convert numeric indices to string names
 */
export type IndexToNameConverter<T extends number> = (index: T) => string;
/**
 * 2D lookup table for Koota scoring
 * Rows and columns represent indices, values are scores
 */
export type KootaLookupTable = number[][];
/**
 * 1D lookup table for single-dimension mappings
 */
export type SimpleLookupTable = number[];
/**
 * Nakshatra-to-attribute mapping table
 */
export interface NakshatraAttributeTable {
    gana: GanaIndex[];
    nadi: NadiIndex[];
    yoni: YoniIndex[];
}
/**
 * Rashi-to-attribute mapping table
 */
export interface RashiAttributeTable {
    varna: VarnaIndex[];
    lord: DashaLordIndex[];
}
//# sourceMappingURL=vedic_ashtakoota.vectorized.types.d.ts.map