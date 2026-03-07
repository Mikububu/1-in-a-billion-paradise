"use strict";
/*
FILE: vedic_ashtakoota.adapters.ts
SCOPE: Adapter layer between string-based legacy engine and numeric vectorized tables
PURPOSE: Convert string lookups to numeric indices for clean separation of concerns
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLANET_NAMES = exports.NAKSHATRA_NAMES = exports.RASHI_NAMES = void 0;
exports.getVarnaScore = getVarnaScore;
exports.getVashyaScore = getVashyaScore;
exports.getTaraScore = getTaraScore;
exports.getYoniScore = getYoniScore;
exports.getGrahaMaitriScore = getGrahaMaitriScore;
exports.getPlanetFriendshipScore = getPlanetFriendshipScore;
exports.getRashiLord = getRashiLord;
exports.getGanaScore = getGanaScore;
exports.getBhakootScore = getBhakootScore;
exports.getNadiScore = getNadiScore;
const vedic_ashtakoota_tables_1 = require("./vedic_ashtakoota.tables");
// ============================================================================
// CONSTANTS
// ============================================================================
exports.RASHI_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];
exports.NAKSHATRA_NAMES = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];
exports.PLANET_NAMES = [
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'
];
// ============================================================================
// INDEX CONVERSION HELPERS
// ============================================================================
function getRashiIndex(rashi) {
    const idx = exports.RASHI_NAMES.indexOf(rashi);
    return idx === -1 ? -1 : idx;
}
function getNakshatraIndex(nakshatra) {
    const idx = exports.NAKSHATRA_NAMES.indexOf(nakshatra);
    return idx === -1 ? -1 : idx;
}
function getPlanetIndex(planet) {
    const idx = exports.PLANET_NAMES.indexOf(planet);
    return idx === -1 ? -1 : idx;
}
// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================
/**
 * Get Varna score between two moon signs
 */
function getVarnaScore(rashiA, rashiB) {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1)
        return 0;
    return vedic_ashtakoota_tables_1.VARNA_TABLE[idxA][idxB];
}
/**
 * Get Vashya score between two moon signs
 */
function getVashyaScore(rashiA, rashiB) {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1)
        return 0;
    return vedic_ashtakoota_tables_1.VASHYA_TABLE[idxA][idxB];
}
/**
 * Get Tara score between two nakshatras
 */
function getTaraScore(nakshatraA, nakshatraB) {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1)
        return 0;
    return vedic_ashtakoota_tables_1.TARA_TABLE[idxA][idxB];
}
/**
 * Get Yoni score between two nakshatras
 */
function getYoniScore(nakshatraA, nakshatraB) {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1)
        return 2; // Default neutral
    // Get yoni indices from nakshatra indices
    const yoniIdxA = vedic_ashtakoota_tables_1.NAKSHATRA_TO_YONI[idxA];
    const yoniIdxB = vedic_ashtakoota_tables_1.NAKSHATRA_TO_YONI[idxB];
    if (yoniIdxA === undefined || yoniIdxB === undefined)
        return 2;
    return vedic_ashtakoota_tables_1.YONI_TABLE[yoniIdxA][yoniIdxB];
}
/**
 * Get Graha Maitri score between two moon signs
 */
function getGrahaMaitriScore(rashiA, rashiB) {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1)
        return 1; // Default neutral
    return vedic_ashtakoota_tables_1.GRAHA_MAITRI_TABLE[idxA][idxB];
}
/**
 * Get planet friendship score between two planets
 */
function getPlanetFriendshipScore(planetA, planetB) {
    const idxA = getPlanetIndex(planetA);
    const idxB = getPlanetIndex(planetB);
    if (idxA === -1 || idxB === -1)
        return 1; // Default neutral
    return vedic_ashtakoota_tables_1.PLANET_FRIENDSHIP[idxA][idxB];
}
/**
 * Get ruling planet for a rashi
 */
function getRashiLord(rashi) {
    const idx = getRashiIndex(rashi);
    if (idx === -1)
        return null;
    const lordIdx = vedic_ashtakoota_tables_1.RASHI_LORD[idx];
    return exports.PLANET_NAMES[lordIdx] || null;
}
/**
 * Get Gana score between two nakshatras
 */
function getGanaScore(nakshatraA, nakshatraB) {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1)
        return 0;
    // Get gana indices from nakshatra indices
    const ganaIdxA = vedic_ashtakoota_tables_1.NAKSHATRA_TO_GANA[idxA];
    const ganaIdxB = vedic_ashtakoota_tables_1.NAKSHATRA_TO_GANA[idxB];
    if (ganaIdxA === undefined || ganaIdxB === undefined)
        return 0;
    return vedic_ashtakoota_tables_1.GANA_TABLE[ganaIdxA][ganaIdxB];
}
/**
 * Get Bhakoot score between two moon signs
 */
function getBhakootScore(rashiA, rashiB) {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1)
        return 0;
    return vedic_ashtakoota_tables_1.BHAKOOT_TABLE[idxA][idxB];
}
/**
 * Get Nadi score between two nakshatras
 */
function getNadiScore(nakshatraA, nakshatraB) {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1)
        return 8; // Default - different nadis
    return vedic_ashtakoota_tables_1.NADI_TABLE[idxA][idxB];
}
/* END FILE */
//# sourceMappingURL=vedic_tables.adapter.js.map