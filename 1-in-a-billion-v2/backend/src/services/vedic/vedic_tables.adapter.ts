/*
FILE: vedic_ashtakoota.adapters.ts
SCOPE: Adapter layer between string-based legacy engine and numeric vectorized tables
PURPOSE: Convert string lookups to numeric indices for clean separation of concerns
*/

import {
    VASHYA_TABLE,
    TARA_TABLE,
    YONI_TABLE,
    NAKSHATRA_TO_YONI,
    GRAHA_MAITRI_TABLE,
    RASHI_LORD,
    PLANET_FRIENDSHIP,
    GANA_TABLE,
    NAKSHATRA_TO_GANA,
    BHAKOOT_TABLE,
    NADI_TABLE,
    NAKSHATRA_TO_NADI,
    VARNA_TABLE,
    RASHI_TO_VARNA
} from './vedic_ashtakoota.tables';

import { Nakshatra } from './vedic_matchmaking.types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const RASHI_NAMES = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

export const NAKSHATRA_NAMES = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
] as const;

export const PLANET_NAMES = [
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'
] as const;

export type RashiName = typeof RASHI_NAMES[number];
export type NakshatraName = typeof NAKSHATRA_NAMES[number];
export type PlanetName = typeof PLANET_NAMES[number];

// ============================================================================
// INDEX CONVERSION HELPERS
// ============================================================================

function getRashiIndex(rashi: string): number {
    const idx = RASHI_NAMES.indexOf(rashi as RashiName);
    return idx === -1 ? -1 : idx;
}

function getNakshatraIndex(nakshatra: string | Nakshatra): number {
    const idx = NAKSHATRA_NAMES.indexOf(nakshatra as NakshatraName);
    return idx === -1 ? -1 : idx;
}

function getPlanetIndex(planet: string): number {
    const idx = PLANET_NAMES.indexOf(planet as PlanetName);
    return idx === -1 ? -1 : idx;
}

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

/**
 * Get Varna score between two moon signs
 */
export function getVarnaScore(rashiA: string, rashiB: string): number {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1) return 0;

    return VARNA_TABLE[idxA][idxB];
}

/**
 * Get Vashya score between two moon signs
 */
export function getVashyaScore(rashiA: string, rashiB: string): number {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1) return 0;

    return VASHYA_TABLE[idxA][idxB];
}

/**
 * Get Tara score between two nakshatras
 */
export function getTaraScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1) return 0;

    return TARA_TABLE[idxA][idxB];
}

/**
 * Get Yoni score between two nakshatras
 */
export function getYoniScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1) return 2; // Default neutral

    // Get yoni indices from nakshatra indices
    const yoniIdxA = NAKSHATRA_TO_YONI[idxA];
    const yoniIdxB = NAKSHATRA_TO_YONI[idxB];

    if (yoniIdxA === undefined || yoniIdxB === undefined) return 2;

    return YONI_TABLE[yoniIdxA][yoniIdxB];
}

/**
 * Get Graha Maitri score between two moon signs
 */
export function getGrahaMaitriScore(rashiA: string, rashiB: string): number {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1) return 1; // Default neutral

    return GRAHA_MAITRI_TABLE[idxA][idxB];
}

/**
 * Get planet friendship score between two planets
 */
export function getPlanetFriendshipScore(planetA: PlanetName, planetB: PlanetName): number {
    const idxA = getPlanetIndex(planetA);
    const idxB = getPlanetIndex(planetB);
    if (idxA === -1 || idxB === -1) return 1; // Default neutral

    return PLANET_FRIENDSHIP[idxA][idxB];
}

/**
 * Get ruling planet for a rashi
 */
export function getRashiLord(rashi: string): PlanetName | null {
    const idx = getRashiIndex(rashi);
    if (idx === -1) return null;

    const lordIdx = RASHI_LORD[idx];
    return PLANET_NAMES[lordIdx] || null;
}

/**
 * Get Gana score between two nakshatras
 */
export function getGanaScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1) return 0;

    // Get gana indices from nakshatra indices
    const ganaIdxA = NAKSHATRA_TO_GANA[idxA];
    const ganaIdxB = NAKSHATRA_TO_GANA[idxB];

    if (ganaIdxA === undefined || ganaIdxB === undefined) return 0;

    return GANA_TABLE[ganaIdxA][ganaIdxB];
}

/**
 * Get Bhakoot score between two moon signs
 */
export function getBhakootScore(rashiA: string, rashiB: string): number {
    const idxA = getRashiIndex(rashiA);
    const idxB = getRashiIndex(rashiB);
    if (idxA === -1 || idxB === -1) return 0;

    return BHAKOOT_TABLE[idxA][idxB];
}

/**
 * Get Nadi score between two nakshatras
 */
export function getNadiScore(nakshatraA: string | Nakshatra, nakshatraB: string | Nakshatra): number {
    const idxA = getNakshatraIndex(nakshatraA);
    const idxB = getNakshatraIndex(nakshatraB);
    if (idxA === -1 || idxB === -1) return 8; // Default - different nadis

    return NADI_TABLE[idxA][idxB];
}

/* END FILE */
