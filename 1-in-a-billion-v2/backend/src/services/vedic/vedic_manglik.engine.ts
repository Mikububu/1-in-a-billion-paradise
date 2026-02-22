/*
FILE: vedic_manglik.engine.ts
SCOPE: Manglik (Kuja) Dosha detection + cancellation
STYLE: Backend, numeric, rule-based
HOUSES: 1–12 (normalized to 0–11 internally)
PLANET INDEX: Mars only
*/

/* =====================================================
   CONSTANTS
===================================================== */

// Manglik houses (1-based Jyotish)
export const MANGLIK_HOUSES = new Set<number>([
    1, 2, 4, 7, 8, 12
]);

/* =====================================================
   INPUT TYPES
===================================================== */

export interface ManglikInput {
    marsHouse: number;          // 1–12
    lagnaSign: number;          // 0–11
    moonSign: number;           // 0–11
    venusSign?: number;         // optional, for cancellation rules
}

/* =====================================================
   BASIC MANGLIK CHECK
===================================================== */

export function isManglik(marsHouse: number): boolean {
    return MANGLIK_HOUSES.has(marsHouse);
}

/* =====================================================
   MANGLIK FROM LAGNA / MOON / VENUS
===================================================== */

export function manglikFromLagna(input: ManglikInput): boolean {
    return isManglik(input.marsHouse);
}

export function manglikFromMoon(
    marsHouse: number,
    moonHouse: number
): boolean {
    const rel = ((marsHouse - moonHouse + 12) % 12) + 1;
    return MANGLIK_HOUSES.has(rel);
}

export function manglikFromVenus(
    marsHouse: number,
    venusHouse: number
): boolean {
    const rel = ((marsHouse - venusHouse + 12) % 12) + 1;
    return MANGLIK_HOUSES.has(rel);
}

/* =====================================================
   CANCELLATION RULES
===================================================== */

export function manglikCancellation(
    marsHouse: number,
    marsSign: number,
    lagnaSign: number
): boolean {

    // Mars in own sign (Aries, Scorpio)
    if (marsSign === 0 || marsSign === 7) return true;

    // Mars exalted (Capricorn)
    if (marsSign === 9) return true;

    // Mars debilitated (Cancer) → weak dosha
    if (marsSign === 3) return true;

    // Mars in Lagna with Lagna lord strength assumed
    if (marsHouse === 1 && lagnaSign === marsSign) return true;

    return false;
}

/* =====================================================
   MATCHING LOGIC
===================================================== */

export interface ManglikMatchResult {
    maleManglik: boolean;
    femaleManglik: boolean;
    compatible: boolean;
    cancellationApplied: boolean;
}

export function manglikMatch(
    male: ManglikInput,
    female: ManglikInput,
    maleMarsSign: number,
    femaleMarsSign: number
): ManglikMatchResult {

    const maleRaw = manglikFromLagna(male);
    const femaleRaw = manglikFromLagna(female);

    const maleCancelled = maleRaw && manglikCancellation(
        male.marsHouse,
        maleMarsSign,
        male.lagnaSign
    );

    const femaleCancelled = femaleRaw && manglikCancellation(
        female.marsHouse,
        femaleMarsSign,
        female.lagnaSign
    );

    const maleFinal = maleRaw && !maleCancelled;
    const femaleFinal = femaleRaw && !femaleCancelled;

    // Core rule: Manglik × Manglik = OK, Non × Non = OK
    const compatible =
        (maleFinal && femaleFinal) ||
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

export function manglikPenalty(
    maleManglik: boolean,
    femaleManglik: boolean
): number {
    if (maleManglik !== femaleManglik) return -8;
    return 0;
}
