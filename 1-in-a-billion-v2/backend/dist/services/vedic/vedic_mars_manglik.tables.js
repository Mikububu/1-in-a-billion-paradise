"use strict";
/*
FILE: vedic_mars_manglik.tables.ts
AUTHORITATIVE NUMERIC TABLES
MARS DOSHA AND CANCELLATION
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARS_SIGN_CANCELLATION = exports.MARS_DOSHA_SEVERITY = exports.MARS_DOSHA_BY_HOUSE = void 0;
exports.marsMutualCancellation = marsMutualCancellation;
exports.hasManglikDosha = hasManglikDosha;
exports.marsDoshaPenalty = marsDoshaPenalty;
/* ================================
   MARS HOUSE DOSHA
   HOUSE INDEX 0-11 (1st-12th)
================================ */
exports.MARS_DOSHA_BY_HOUSE = [
    1, // 1st house  -> Manglik
    0, // 2nd
    1, // 3rd -> Manglik
    0, // 4th
    1, // 5th -> Manglik
    0, // 6th
    1, // 7th -> Manglik
    0, // 8th
    1, // 9th -> Manglik
    0, // 10th
    1, // 11th -> Manglik
    0, // 12th
];
/* ================================
   MARS DOSHA SEVERITY
   0 none
   1 mild
   2 strong
================================ */
exports.MARS_DOSHA_SEVERITY = [
    2, // 1st
    0, // 2nd
    1, // 3rd
    0, // 4th
    1, // 5th
    0, // 6th
    2, // 7th
    0, // 8th
    1, // 9th
    0, // 10th
    1, // 11th
    0, // 12th
];
/* ================================
   MUTUAL MARS CANCELLATION
   BOTH PARTNERS MANGLIK
================================ */
function marsMutualCancellation(marsHouseA, marsHouseB) {
    return (exports.MARS_DOSHA_BY_HOUSE[marsHouseA - 1] === 1 &&
        exports.MARS_DOSHA_BY_HOUSE[marsHouseB - 1] === 1);
}
/* ================================
   SIGN BASED CANCELLATION
   RASHI INDEX 0-11
================================ */
exports.MARS_SIGN_CANCELLATION = [
    1, // Aries
    0, // Taurus
    1, // Gemini
    0, // Cancer
    1, // Leo
    0, // Virgo
    1, // Libra
    1, // Scorpio
    1, // Sagittarius
    0, // Capricorn
    0, // Aquarius
    1, // Pisces
];
/* ================================
   FULL DOSHA FLAG
================================ */
function hasManglikDosha(marsHouse, marsRashi) {
    if (exports.MARS_SIGN_CANCELLATION[marsRashi] === 1)
        return false;
    return exports.MARS_DOSHA_BY_HOUSE[marsHouse - 1] === 1;
}
/* ================================
   DOSHA SCORE IMPACT
================================ */
function marsDoshaPenalty(house) {
    const severity = exports.MARS_DOSHA_SEVERITY[house - 1];
    if (severity === 2)
        return -8;
    if (severity === 1)
        return -4;
    return 0;
}
/* END FILE */
//# sourceMappingURL=vedic_mars_manglik.tables.js.map