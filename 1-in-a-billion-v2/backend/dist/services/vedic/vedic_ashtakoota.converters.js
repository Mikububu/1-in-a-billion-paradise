"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RASHI_ATTRIBUTES = exports.RASHI_LORD_TABLE = exports.RASHI_VARNA_TABLE = exports.NAKSHATRA_ATTRIBUTES = exports.NAKSHATRA_YONI_TABLE = exports.NAKSHATRA_NADI_TABLE = exports.NAKSHATRA_GANA_TABLE = void 0;
exports.nakshatraToIndex = nakshatraToIndex;
exports.indexToNakshatra = indexToNakshatra;
exports.rashiToIndex = rashiToIndex;
exports.indexToRashi = indexToRashi;
exports.ganaToIndex = ganaToIndex;
exports.indexToGana = indexToGana;
exports.nadiToIndex = nadiToIndex;
exports.indexToNadi = indexToNadi;
exports.varnaToIndex = varnaToIndex;
exports.indexToVarna = indexToVarna;
exports.dashaLordToIndex = dashaLordToIndex;
exports.indexToDashaLord = indexToDashaLord;
exports.getGanaFromNakshatra = getGanaFromNakshatra;
exports.getNadiFromNakshatra = getNadiFromNakshatra;
exports.getYoniFromNakshatra = getYoniFromNakshatra;
exports.getVarnaFromRashi = getVarnaFromRashi;
exports.getLordFromRashi = getLordFromRashi;
const vedic_ashtakoota_vectorized_types_1 = require("./vedic_ashtakoota.vectorized.types");
// ============================================================================
// NAKSHATRA-TO-INDEX CONVERSION
// ============================================================================
/**
 * Convert Nakshatra name to numeric index (0-26)
 */
function nakshatraToIndex(nakshatra) {
    const index = vedic_ashtakoota_vectorized_types_1.NAKSHATRA_NAMES.indexOf(nakshatra);
    if (index === -1) {
        throw new Error(`Invalid Nakshatra: ${nakshatra}`);
    }
    return index;
}
/**
 * Convert numeric index to Nakshatra name
 */
function indexToNakshatra(index) {
    if (index < 0 || index > 26) {
        throw new Error(`Invalid Nakshatra index: ${index}`);
    }
    return vedic_ashtakoota_vectorized_types_1.NAKSHATRA_NAMES[index];
}
// ============================================================================
// RASHI-TO-INDEX CONVERSION
// ============================================================================
/**
 * Convert Rashi name to numeric index (0-11)
 */
function rashiToIndex(rashi) {
    const index = vedic_ashtakoota_vectorized_types_1.RASHI_NAMES.indexOf(rashi);
    if (index === -1) {
        throw new Error(`Invalid Rashi: ${rashi}`);
    }
    return index;
}
/**
 * Convert numeric index to Rashi name
 */
function indexToRashi(index) {
    if (index < 0 || index > 11) {
        throw new Error(`Invalid Rashi index: ${index}`);
    }
    return vedic_ashtakoota_vectorized_types_1.RASHI_NAMES[index];
}
// ============================================================================
// GANA-TO-INDEX CONVERSION
// ============================================================================
/**
 * Convert Gana name to numeric index (0-2)
 */
function ganaToIndex(gana) {
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
function indexToGana(index) {
    return vedic_ashtakoota_vectorized_types_1.GANA_NAMES[index].toLowerCase();
}
// ============================================================================
// NADI-TO-INDEX CONVERSION
// ============================================================================
/**
 * Convert Nadi name to numeric index (0-2)
 */
function nadiToIndex(nadi) {
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
function indexToNadi(index) {
    return vedic_ashtakoota_vectorized_types_1.NADI_NAMES[index].toLowerCase();
}
// ============================================================================
// VARNA-TO-INDEX CONVERSION
// ============================================================================
/**
 * Convert Varna name to numeric index (0-3)
 */
function varnaToIndex(varna) {
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
function indexToVarna(index) {
    return vedic_ashtakoota_vectorized_types_1.VARNA_NAMES[index].toLowerCase();
}
// ============================================================================
// DASHA LORD CONVERSION
// ============================================================================
/**
 * Convert planet name to Dasha lord index (0-8)
 */
function dashaLordToIndex(planet) {
    const index = vedic_ashtakoota_vectorized_types_1.DASHA_LORD_NAMES.indexOf(planet);
    if (index === -1) {
        throw new Error(`Invalid Dasha lord: ${planet}`);
    }
    return index;
}
/**
 * Convert numeric index to Dasha lord name
 */
function indexToDashaLord(index) {
    return vedic_ashtakoota_vectorized_types_1.DASHA_LORD_NAMES[index];
}
// ============================================================================
// NAKSHATRA ATTRIBUTE TABLES
// ============================================================================
/**
 * Nakshatra to Gana mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 */
exports.NAKSHATRA_GANA_TABLE = [
    0, 2, 2, // Ashwini (Deva), Bharani (Rakshasa), Krittika (Rakshasa)
    1, 0, 2, // Rohini (Manushya), Mrigashira (Deva), Ardra (Rakshasa)
    0, 0, 2, // Punarvasu (Deva), Pushya (Deva), Ashlesha (Rakshasa)
    2, 1, 1, // Magha (Rakshasa), Purva Phalguni (Manushya), Uttara Phalguni (Manushya)
    0, 2, 0, // Hasta (Deva), Chitra (Rakshasa), Swati (Deva)
    2, 1, 2, // Vishakha (Rakshasa), Anuradha (Manushya), Jyeshtha (Rakshasa)
    2, 1, 1, // Mula (Rakshasa), Purva Ashadha (Manushya), Uttara Ashadha (Manushya)
    0, 2, 2, // Shravana (Deva), Dhanishta (Rakshasa), Shatabhisha (Rakshasa)
    1, 1, 0 // Purva Bhadrapada (Manushya), Uttara Bhadrapada (Manushya), Revati (Deva)
];
/**
 * Nakshatra to Nadi mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 */
exports.NAKSHATRA_NADI_TABLE = [
    0, 1, 2, // Ashwini (Adi), Bharani (Madhya), Krittika (Antya)
    1, 2, 0, // Rohini (Madhya), Mrigashira (Antya), Ardra (Adi)
    2, 0, 1, // Punarvasu (Antya), Pushya (Adi), Ashlesha (Madhya)
    0, 1, 2, // Magha (Adi), Purva Phalguni (Madhya), Uttara Phalguni (Antya)
    1, 2, 0, // Hasta (Madhya), Chitra (Antya), Swati (Adi)
    2, 0, 1, // Vishakha (Antya), Anuradha (Adi), Jyeshtha (Madhya)
    0, 1, 2, // Mula (Adi), Purva Ashadha (Madhya), Uttara Ashadha (Antya)
    1, 2, 0, // Shravana (Madhya), Dhanishta (Antya), Shatabhisha (Adi)
    2, 0, 1 // Purva Bhadrapada (Antya), Uttara Bhadrapada (Adi), Revati (Madhya)
];
/**
 * Nakshatra to Yoni mapping (27 entries)
 * Source: Traditional Vedic Jyotish texts
 * Yoni indices: 0=Horse, 1=Elephant, 2=Sheep, 3=Serpent, 4=Dog, 5=Cat, 6=Rat,
 *               7=Cow, 8=Buffalo, 9=Tiger, 10=Deer, 11=Monkey, 12=Mongoose, 13=Lion
 */
exports.NAKSHATRA_YONI_TABLE = [
    0, 1, 2, // Ashwini (Horse), Bharani (Elephant), Krittika (Sheep)
    3, 3, 4, // Rohini (Serpent), Mrigashira (Serpent), Ardra (Dog)
    5, 6, 5, // Punarvasu (Cat), Pushya (Rat), Ashlesha (Cat)
    6, 6, 7, // Magha (Rat), Purva Phalguni (Rat), Uttara Phalguni (Cow)
    8, 9, 8, // Hasta (Buffalo), Chitra (Tiger), Swati (Buffalo)
    9, 10, 10, // Vishakha (Tiger), Anuradha (Deer), Jyeshtha (Deer)
    4, 11, 11, // Mula (Dog), Purva Ashadha (Monkey), Uttara Ashadha (Monkey)
    11, 13, 0, // Shravana (Monkey), Dhanishta (Lion), Shatabhisha (Horse)
    13, 7, 1 // Purva Bhadrapada (Lion), Uttara Bhadrapada (Cow), Revati (Elephant)
];
/**
 * Complete Nakshatra attribute table
 */
exports.NAKSHATRA_ATTRIBUTES = {
    gana: exports.NAKSHATRA_GANA_TABLE,
    nadi: exports.NAKSHATRA_NADI_TABLE,
    yoni: exports.NAKSHATRA_YONI_TABLE
};
// ============================================================================
// RASHI ATTRIBUTE TABLES
// ============================================================================
/**
 * Rashi to Varna mapping (12 entries)
 * Source: VECTORIZED_BATCH_MATCHER.md
 */
exports.RASHI_VARNA_TABLE = [
    1, 2, 3, // Aries (Kshatriya), Taurus (Vaishya), Gemini (Shudra)
    0, 1, 2, // Cancer (Brahmin), Leo (Kshatriya), Virgo (Vaishya)
    3, 0, 1, // Libra (Shudra), Scorpio (Brahmin), Sagittarius (Kshatriya)
    2, 3, 0 // Capricorn (Vaishya), Aquarius (Shudra), Pisces (Brahmin)
];
/**
 * Rashi to ruling planet (lord) mapping (12 entries)
 * 0=Sun, 1=Moon, 2=Mars, 3=Mercury, 4=Jupiter, 5=Venus, 6=Saturn, 7=Rahu, 8=Ketu
 */
exports.RASHI_LORD_TABLE = [
    2, 5, 3, // Aries (Mars), Taurus (Venus), Gemini (Mercury)
    1, 0, 3, // Cancer (Moon), Leo (Sun), Virgo (Mercury)
    5, 2, 4, // Libra (Venus), Scorpio (Mars), Sagittarius (Jupiter)
    6, 6, 4 // Capricorn (Saturn), Aquarius (Saturn), Pisces (Jupiter)
];
/**
 * Complete Rashi attribute table
 */
exports.RASHI_ATTRIBUTES = {
    varna: exports.RASHI_VARNA_TABLE,
    lord: exports.RASHI_LORD_TABLE
};
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Get Gana from Nakshatra index
 */
function getGanaFromNakshatra(nakshatraIndex) {
    return exports.NAKSHATRA_GANA_TABLE[nakshatraIndex];
}
/**
 * Get Nadi from Nakshatra index
 */
function getNadiFromNakshatra(nakshatraIndex) {
    return exports.NAKSHATRA_NADI_TABLE[nakshatraIndex];
}
/**
 * Get Yoni from Nakshatra index
 */
function getYoniFromNakshatra(nakshatraIndex) {
    return exports.NAKSHATRA_YONI_TABLE[nakshatraIndex];
}
/**
 * Get Varna from Rashi index
 */
function getVarnaFromRashi(rashiIndex) {
    return exports.RASHI_VARNA_TABLE[rashiIndex];
}
/**
 * Get ruling planet from Rashi index
 */
function getLordFromRashi(rashiIndex) {
    return exports.RASHI_LORD_TABLE[rashiIndex];
}
//# sourceMappingURL=vedic_ashtakoota.converters.js.map