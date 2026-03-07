"use strict";
/*
FILE: vedic_manglik.engine.ts
SCOPE: Manglik (Kuja) Dosha detection + cancellation
STYLE: Backend, numeric, rule-based
HOUSES: 1-12 (normalized to 0-11 internally)
PLANET INDEX: Mars only
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANGLIK_HOUSES = void 0;
exports.isManglik = isManglik;
exports.manglikFromLagna = manglikFromLagna;
exports.manglikFromMoon = manglikFromMoon;
exports.manglikFromVenus = manglikFromVenus;
exports.manglikCancellation = manglikCancellation;
exports.manglikMatch = manglikMatch;
exports.manglikPenalty = manglikPenalty;
/* =====================================================
   CONSTANTS
===================================================== */
// Manglik houses (1-based Jyotish)
exports.MANGLIK_HOUSES = new Set([
    1, 2, 4, 7, 8, 12
]);
/* =====================================================
   BASIC MANGLIK CHECK
===================================================== */
function isManglik(marsHouse) {
    return exports.MANGLIK_HOUSES.has(marsHouse);
}
/* =====================================================
   MANGLIK FROM LAGNA / MOON / VENUS
===================================================== */
function manglikFromLagna(input) {
    return isManglik(input.marsHouse);
}
function manglikFromMoon(marsHouse, moonHouse) {
    const rel = ((marsHouse - moonHouse + 12) % 12) + 1;
    return exports.MANGLIK_HOUSES.has(rel);
}
function manglikFromVenus(marsHouse, venusHouse) {
    const rel = ((marsHouse - venusHouse + 12) % 12) + 1;
    return exports.MANGLIK_HOUSES.has(rel);
}
/* =====================================================
   CANCELLATION RULES
===================================================== */
function manglikCancellation(marsHouse, marsSign, lagnaSign) {
    // Mars in own sign (Aries, Scorpio)
    if (marsSign === 0 || marsSign === 7)
        return true;
    // Mars exalted (Capricorn)
    if (marsSign === 9)
        return true;
    // Mars debilitated (Cancer) → weak dosha
    if (marsSign === 3)
        return true;
    // Mars in Lagna with Lagna lord strength assumed
    if (marsHouse === 1 && lagnaSign === marsSign)
        return true;
    return false;
}
function manglikMatch(male, female, maleMarsSign, femaleMarsSign) {
    const maleRaw = manglikFromLagna(male);
    const femaleRaw = manglikFromLagna(female);
    const maleCancelled = maleRaw && manglikCancellation(male.marsHouse, maleMarsSign, male.lagnaSign);
    const femaleCancelled = femaleRaw && manglikCancellation(female.marsHouse, femaleMarsSign, female.lagnaSign);
    const maleFinal = maleRaw && !maleCancelled;
    const femaleFinal = femaleRaw && !femaleCancelled;
    // Core rule: Manglik × Manglik = OK, Non × Non = OK
    const compatible = (maleFinal && femaleFinal) ||
        (!maleFinal && !femaleFinal);
    return {
        maleManglik: maleFinal,
        femaleManglik: femaleFinal,
        compatible,
        cancellationApplied: maleCancelled || femaleCancelled
    };
}
/* =====================================================
   NUMERIC SCORE IMPACT (OPTIONAL)
===================================================== */
function manglikPenalty(maleManglik, femaleManglik) {
    if (maleManglik !== femaleManglik)
        return -8;
    return 0;
}
//# sourceMappingURL=vedic_manglik.engine.js.map