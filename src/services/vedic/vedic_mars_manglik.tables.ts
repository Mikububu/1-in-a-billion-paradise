/*
FILE: vedic_mars_manglik.tables.ts
AUTHORITATIVE NUMERIC TABLES
MARS DOSHA AND CANCELLATION
*/

/* ================================
   MARS HOUSE DOSHA
   HOUSE INDEX 0–11 (1st–12th)
================================ */

export const MARS_DOSHA_BY_HOUSE: number[] = [
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

export const MARS_DOSHA_SEVERITY: number[] = [
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

export function marsMutualCancellation(
    marsHouseA: number,
    marsHouseB: number
): boolean {
    return (
        MARS_DOSHA_BY_HOUSE[marsHouseA - 1] === 1 &&
        MARS_DOSHA_BY_HOUSE[marsHouseB - 1] === 1
    );
}

/* ================================
   SIGN BASED CANCELLATION
   RASHI INDEX 0–11
================================ */

export const MARS_SIGN_CANCELLATION: number[] = [
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

export function hasManglikDosha(
    marsHouse: number,
    marsRashi: number
): boolean {
    if (MARS_SIGN_CANCELLATION[marsRashi] === 1) return false;
    return MARS_DOSHA_BY_HOUSE[marsHouse - 1] === 1;
}

/* ================================
   DOSHA SCORE IMPACT
================================ */

export function marsDoshaPenalty(
    house: number
): number {
    const severity = MARS_DOSHA_SEVERITY[house - 1];
    if (severity === 2) return -8;
    if (severity === 1) return -4;
    return 0;
}

/* END FILE */
