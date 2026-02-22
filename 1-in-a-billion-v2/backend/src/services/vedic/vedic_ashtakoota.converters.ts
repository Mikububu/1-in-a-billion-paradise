/**
 * VECTORIZED TYPE CONVERSION UTILITIES
 * 
 * Provides bidirectional conversion between string-based and numeric-indexed
 * representations for Vedic matchmaking data.
 * 
 * These utilities enable seamless integration between:
 * - User-facing string-based APIs
 * - High-performance vectorized computation engine
 */

import {
    NakshatraIndex,
    RashiIndex,
    GanaIndex,
    NadiIndex,
    VarnaIndex,
    YoniIndex,
    DashaLordIndex,
    VedicPersonVector,
    NAKSHATRA_NAMES,
    RASHI_NAMES,
    GANA_NAMES,
    NADI_NAMES,
    VARNA_NAMES,
    DASHA_LORD_NAMES,
    NakshatraAttributeTable,
    RashiAttributeTable
} from './vedic_ashtakoota.vectorized.types';

import { Nakshatra, Gana, Nadi, Varna } from './vedic_matchmaking.types';

// ============================================================================
// NAKSHATRA-TO-INDEX CONVERSION
// ============================================================================

/**
 * Convert Nakshatra name to numeric index (0-26)
 */
export function nakshatraToIndex(nakshatra: Nakshatra): NakshatraIndex {
    const index = NAKSHATRA_NAMES.indexOf(nakshatra);
    if (index === -1) {
        throw new Error(`Invalid Nakshatra: ${nakshatra}`);
    }
    return index;
}

/**
 * Convert numeric index to Nakshatra name
 */
export function indexToNakshatra(index: NakshatraIndex): Nakshatra {
    if (index < 0 || index > 26) {
        throw new Error(`Invalid Nakshatra index: ${index}`);
    }
    return NAKSHATRA_NAMES[index] as Nakshatra;
}

// ============================================================================
// RASHI-TO-INDEX CONVERSION
// ============================================================================

/**
 * Convert Rashi name to numeric index (0-11)
 */
export function rashiToIndex(rashi: string): RashiIndex {
    const index = RASHI_NAMES.indexOf(rashi as any);
    if (index === -1) {
        throw new Error(`Invalid Rashi: ${rashi}`);
    }
    return index;
}

/**
 * Convert numeric index to Rashi name
 */
export function indexToRashi(index: RashiIndex): string {
    if (index < 0 || index > 11) {
        throw new Error(`Invalid Rashi index: ${index}`);
    }
    return RASHI_NAMES[index];
}

// ============================================================================
// GANA-TO-INDEX CONVERSION
// ============================================================================

/**
 * Convert Gana name to numeric index (0-2)
 */
export function ganaToIndex(gana: Gana): GanaIndex {
    const normalized = gana.toLowerCase();
    switch (normalized) {
        case 'deva': return 0;
        case 'manushya': return 1;
        case 'rakshasa': return 2;
        default:
            throw new Error(`Invalid Gana: ${gana}`);
    }
}

/**
 * Convert numeric index to Gana name
 */
export function indexToGana(index: GanaIndex): Gana {
    return GANA_NAMES[index].toLowerCase() as Gana;
}

// ============================================================================
// NADI-TO-INDEX CONVERSION
// ============================================================================

/**
 * Convert Nadi name to numeric index (0-2)
 */
export function nadiToIndex(nadi: Nadi): NadiIndex {
    const normalized = nadi.toLowerCase();
    switch (normalized) {
        case 'adi': return 0;
        case 'madhya': return 1;
        case 'antya': return 2;
        default:
            throw new Error(`Invalid Nadi: ${nadi}`);
    }
}

/**
 * Convert numeric index to Nadi name
 */
export function indexToNadi(index: NadiIndex): Nadi {
    return NADI_NAMES[index].toLowerCase() as Nadi;
}

// ============================================================================
// VARNA-TO-INDEX CONVERSION
// ============================================================================

/**
 * Convert Varna name to numeric index (0-3)
 */
export function varnaToIndex(varna: Varna): VarnaIndex {
    const normalized = varna.toLowerCase();
    switch (normalized) {
        case 'brahmin': return 0;
        case 'kshatriya': return 1;
        case 'vaishya': return 2;
        case 'shudra': return 3;
        default:
            throw new Error(`Invalid Varna: ${varna}`);
    }
}

/**
 * Convert numeric index to Varna name
 */
export function indexToVarna(index: VarnaIndex): Varna {
    return VARNA_NAMES[index].toLowerCase() as Varna;
}

// ============================================================================
// DASHA LORD CONVERSION
// ============================================================================

/**
 * Convert planet name to Dasha lord index (0-8)
 */
export function dashaLordToIndex(planet: string): DashaLordIndex {
    const index = DASHA_LORD_NAMES.indexOf(planet as any);
    if (index === -1) {
        throw new Error(`Invalid Dasha lord: ${planet}`);
    }
    return index as DashaLordIndex;
}

/**
 * Convert numeric index to Dasha lord name
 */
export function indexToDashaLord(index: DashaLordIndex): string {
    return DASHA_LORD_NAMES[index];
}

// ============================================================================
// NAKSHATRA ATTRIBUTE TABLES
// ============================================================================

/**
 * Nakshatra to Gana mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 */
export const NAKSHATRA_GANA_TABLE: GanaIndex[] = [
    0, 2, 2,  // Ashwini (Deva), Bharani (Rakshasa), Krittika (Rakshasa)
    1, 0, 2,  // Rohini (Manushya), Mrigashira (Deva), Ardra (Rakshasa)
    0, 0, 2,  // Punarvasu (Deva), Pushya (Deva), Ashlesha (Rakshasa)
    2, 1, 1,  // Magha (Rakshasa), Purva Phalguni (Manushya), Uttara Phalguni (Manushya)
    0, 2, 0,  // Hasta (Deva), Chitra (Rakshasa), Swati (Deva)
    2, 1, 2,  // Vishakha (Rakshasa), Anuradha (Manushya), Jyeshtha (Rakshasa)
    2, 1, 1,  // Mula (Rakshasa), Purva Ashadha (Manushya), Uttara Ashadha (Manushya)
    0, 2, 2,  // Shravana (Deva), Dhanishta (Rakshasa), Shatabhisha (Rakshasa)
    1, 1, 0   // Purva Bhadrapada (Manushya), Uttara Bhadrapada (Manushya), Revati (Deva)
];

/**
 * Nakshatra to Nadi mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 */
export const NAKSHATRA_NADI_TABLE: NadiIndex[] = [
    0, 1, 2,  // Ashwini (Adi), Bharani (Madhya), Krittika (Antya)
    1, 2, 0,  // Rohini (Madhya), Mrigashira (Antya), Ardra (Adi)
    2, 0, 1,  // Punarvasu (Antya), Pushya (Adi), Ashlesha (Madhya)
    0, 1, 2,  // Magha (Adi), Purva Phalguni (Madhya), Uttara Phalguni (Antya)
    1, 2, 0,  // Hasta (Madhya), Chitra (Antya), Swati (Adi)
    2, 0, 1,  // Vishakha (Antya), Anuradha (Adi), Jyeshtha (Madhya)
    0, 1, 2,  // Mula (Adi), Purva Ashadha (Madhya), Uttara Ashadha (Antya)
    1, 2, 0,  // Shravana (Madhya), Dhanishta (Antya), Shatabhisha (Adi)
    2, 0, 1   // Purva Bhadrapada (Antya), Uttara Bhadrapada (Adi), Revati (Madhya)
];

/**
 * Nakshatra to Yoni mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 * Yoni indices: 0=Horse, 1=Elephant, 2=Sheep, 3=Serpent, 4=Dog, 5=Cat, 6=Rat,
 *               7=Cow, 8=Buffalo, 9=Tiger, 10=Deer, 11=Monkey, 12=Mongoose, 13=Lion
 */
export const NAKSHATRA_YONI_TABLE: YoniIndex[] = [
    0, 1, 2,   // Ashwini (Horse), Bharani (Elephant), Krittika (Sheep)
    3, 3, 4,   // Rohini (Serpent), Mrigashira (Serpent), Ardra (Dog)
    5, 6, 5,   // Punarvasu (Cat), Pushya (Rat), Ashlesha (Cat)
    6, 6, 7,   // Magha (Rat), Purva Phalguni (Rat), Uttara Phalguni (Cow)
    8, 9, 8,   // Hasta (Buffalo), Chitra (Tiger), Swati (Buffalo)
    9, 10, 10, // Vishakha (Tiger), Anuradha (Deer), Jyeshtha (Deer)
    4, 11, 11, // Mula (Dog), Purva Ashadha (Monkey), Uttara Ashadha (Monkey)
    11, 13, 0, // Shravana (Monkey), Dhanishta (Lion), Shatabhisha (Horse)
    13, 7, 1   // Purva Bhadrapada (Lion), Uttara Bhadrapada (Cow), Revati (Elephant)
];

/**
 * Complete Nakshatra attribute table
 */
export const NAKSHATRA_ATTRIBUTES: NakshatraAttributeTable = {
    gana: NAKSHATRA_GANA_TABLE,
    nadi: NAKSHATRA_NADI_TABLE,
    yoni: NAKSHATRA_YONI_TABLE
};

// ============================================================================
// RASHI ATTRIBUTE TABLES
// ============================================================================

/**
 * Rashi to Varna mapping (12 entries)
 * Source: VECTORIZED_BATCH_MATCHER.md
 */
export const RASHI_VARNA_TABLE: VarnaIndex[] = [
    1, 2, 3,  // Aries (Kshatriya), Taurus (Vaishya), Gemini (Shudra)
    0, 1, 2,  // Cancer (Brahmin), Leo (Kshatriya), Virgo (Vaishya)
    3, 0, 1,  // Libra (Shudra), Scorpio (Brahmin), Sagittarius (Kshatriya)
    2, 3, 0   // Capricorn (Vaishya), Aquarius (Shudra), Pisces (Brahmin)
];

/**
 * Rashi to ruling planet (lord) mapping (12 entries)
 * 0=Sun, 1=Moon, 2=Mars, 3=Mercury, 4=Jupiter, 5=Venus, 6=Saturn, 7=Rahu, 8=Ketu
 */
export const RASHI_LORD_TABLE: DashaLordIndex[] = [
    2, 5, 3,  // Aries (Mars), Taurus (Venus), Gemini (Mercury)
    1, 0, 3,  // Cancer (Moon), Leo (Sun), Virgo (Mercury)
    5, 2, 4,  // Libra (Venus), Scorpio (Mars), Sagittarius (Jupiter)
    6, 6, 4   // Capricorn (Saturn), Aquarius (Saturn), Pisces (Jupiter)
];

/**
 * Complete Rashi attribute table
 */
export const RASHI_ATTRIBUTES: RashiAttributeTable = {
    varna: RASHI_VARNA_TABLE,
    lord: RASHI_LORD_TABLE
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get Gana from Nakshatra index
 */
export function getGanaFromNakshatra(nakshatraIndex: NakshatraIndex): GanaIndex {
    return NAKSHATRA_GANA_TABLE[nakshatraIndex];
}

/**
 * Get Nadi from Nakshatra index
 */
export function getNadiFromNakshatra(nakshatraIndex: NakshatraIndex): NadiIndex {
    return NAKSHATRA_NADI_TABLE[nakshatraIndex];
}

/**
 * Get Yoni from Nakshatra index
 */
export function getYoniFromNakshatra(nakshatraIndex: NakshatraIndex): YoniIndex {
    return NAKSHATRA_YONI_TABLE[nakshatraIndex];
}

/**
 * Get Varna from Rashi index
 */
export function getVarnaFromRashi(rashiIndex: RashiIndex): VarnaIndex {
    return RASHI_VARNA_TABLE[rashiIndex];
}

/**
 * Get ruling planet from Rashi index
 */
export function getLordFromRashi(rashiIndex: RashiIndex): DashaLordIndex {
    return RASHI_LORD_TABLE[rashiIndex];
}
