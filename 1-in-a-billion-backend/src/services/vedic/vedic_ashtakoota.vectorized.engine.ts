/* 
FILE: vedic_ashtakoota.vectorized.engine.ts

AUTHORITATIVE BACKEND SPECIFICATION
VEDIC ASHTAKOOTA MATCHING ENGINE
VECTOR ONLY
NO UI
NO INTERPRETATION
*/

import {
    VARNA_TABLE,
    VASHYA_TABLE,
    TARA_TABLE,
    GRAHA_MAITRI_TABLE,
    BHAKOOT_TABLE,
    NADI_TABLE,
} from "./vedic_ashtakoota.tables";

import {
    MARS_DOSHA_BY_HOUSE,
    hasManglikDosha,
    marsMutualCancellation,
} from "./vedic_mars_manglik.tables";

import {
    YONI_MATRIX,
    GANA_MATRIX,
    dashaCompatibilityScore,
} from "./vedic_yoni_gana_dasha.tables";

/* ================================
   1. CORE NUMERIC TYPES
================================ */

export type Gender = 0 | 1;

export type RashiIndex = number;   // 0..11
export type NakshatraIndex = number; // 0..26
export type GanaIndex = 0 | 1 | 2;
export type YoniIndex = number;    // 0..13
export type PlanetIndex = number;  // 0..8
export type HouseIndex = number;   // 1..12

/* ================================
   2. INPUT VECTOR
================================ */

export interface VedicPersonVector {
    gender: Gender;

    moon_rashi: RashiIndex;
    moon_nakshatra: NakshatraIndex;

    gana: GanaIndex;
    yoni: YoniIndex;

    mars_house: HouseIndex;
    mars_rashi?: RashiIndex; // Optional for sign-based cancellation
    seventh_house_ruler: PlanetIndex;

    dasha_lord: PlanetIndex;
    mahadasha_index: number;
}

/* ================================
   3. DOSHA ENUMS
================================ */

export type ManglikStatus = "none" | "active" | "cancelled";

export interface DoshaResult {
    manglik: ManglikStatus;
    nadi: boolean;
    bhakoot: boolean;
}

/* ================================
   4. DASHA SYNC RESULT
================================ */

export interface DashaSyncResult {
    alignment_score: number;
    phase_relation: "same" | "supportive" | "conflicting";
}

/* ================================
   5. MATCH RESULT
================================ */

export interface VedicMatchResult {
    guna_total: number;

    guna_breakdown: {
        varna: number;
        vashya: number;
        tara: number;
        yoni: number;
        graha_maitri: number;
        gana: number;
        bhakoot: number;
        nadi: number;
    };

    dosha: DoshaResult;
    dasha: DashaSyncResult;

    verdict_band: "reject" | "average" | "good" | "excellent";
}

/* ================================
   6. CORE ENGINE
================================ */

export function matchVedicPair(
    a: VedicPersonVector,
    b: VedicPersonVector
): VedicMatchResult {

    const varna = VARNA_TABLE[a.moon_rashi][b.moon_rashi];
    const vashya = VASHYA_TABLE[a.moon_rashi][b.moon_rashi];
    const tara = TARA_TABLE[a.moon_nakshatra][b.moon_nakshatra];
    const yoni = YONI_MATRIX[a.yoni][b.yoni];
    const graha_maitri = GRAHA_MAITRI_TABLE[a.moon_rashi][b.moon_rashi];
    const gana = GANA_MATRIX[a.gana][b.gana];
    const bhakoot = BHAKOOT_TABLE[a.moon_rashi][b.moon_rashi];
    const nadi = NADI_TABLE[a.moon_nakshatra][b.moon_nakshatra];

    const guna_total =
        varna +
        vashya +
        tara +
        yoni +
        graha_maitri +
        gana +
        bhakoot +
        nadi;

    const dosha = computeDoshas(a, b, nadi, bhakoot);
    const dasha = computeDashaSync(a, b);
    const verdict_band = computeVerdict(guna_total, dosha);

    return {
        guna_total,
        guna_breakdown: {
            varna,
            vashya,
            tara,
            yoni,
            graha_maitri,
            gana,
            bhakoot,
            nadi
        },
        dosha,
        dasha,
        verdict_band
    };
}

/* ================================
   7. DOSHA LOGIC
================================ */

function computeDoshas(
    a: VedicPersonVector,
    b: VedicPersonVector,
    nadiScore: number,
    bhakootScore: number
): DoshaResult {

    // Use table-based Manglik detection with optional sign cancellation
    const aManglik = a.mars_rashi !== undefined
        ? hasManglikDosha(a.mars_house, a.mars_rashi)
        : MARS_DOSHA_BY_HOUSE[a.mars_house - 1] === 1;

    const bManglik = b.mars_rashi !== undefined
        ? hasManglikDosha(b.mars_house, b.mars_rashi)
        : MARS_DOSHA_BY_HOUSE[b.mars_house - 1] === 1;

    let manglik: ManglikStatus = "none";
    if (aManglik && bManglik) manglik = "cancelled";
    else if (aManglik || bManglik) manglik = "active";

    return {
        manglik,
        nadi: nadiScore === 0,
        bhakoot: bhakootScore === 0
    };
}


/* ================================
   8. DASHA SYNC
================================ */

function computeDashaSync(
    a: VedicPersonVector,
    b: VedicPersonVector
): DashaSyncResult {

    const score = dashaCompatibilityScore(a.dasha_lord, b.dasha_lord);

    // Map 0, 1, 2 to phase relation
    let phase: DashaSyncResult['phase_relation'] = 'conflicting';
    if (score === 2) phase = 'same'; // Or 'excellent' semantically
    else if (score === 1) phase = 'supportive';

    return {
        alignment_score: score,
        phase_relation: phase
    };
}

/* ================================
   9. VERDICT
================================ */

function computeVerdict(score: number, dosha: DoshaResult): VedicMatchResult["verdict_band"] {
    // Hard reject if critical doshas active
    if (dosha.nadi && dosha.manglik === "active") return "reject";

    if (score < 18) return "reject";
    if (score < 25) return "average";
    if (score < 33) return "good";
    return "excellent";
}

/* ================================
   10. BATCH VECTOR MATCHER
================================ */

export function matchBatch(
    source: VedicPersonVector,
    targets: VedicPersonVector[]
): VedicMatchResult[] {
    return targets.map(t => matchVedicPair(source, t));
}

/* END OF FILE */
