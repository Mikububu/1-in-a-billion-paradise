/*
FILE: vedic_matchmaking_full.engine.ts
SCOPE: Ashtakoota core modules
INCLUDES:
Yoni
Gana
Dasha
Seventh House
Vectorized Batch Matcher
STYLE: Numeric deterministic backend engine
*/

/* =====================================================
   ENUMS AND BASE TYPES
===================================================== */

export type Int = number;

export interface PersonVector {
    id: string;
    moon_nakshatra: Int;        // 0 to 26
    moon_rashi: Int;            // 0 to 11
    lagna_rashi: Int;           // 0 to 11
    mars_house: Int;            // 1 to 12
    gana: Int;                  // 0 Deva 1 Manushya 2 Rakshasa
    yoni: Int;                  // 0 to 13
    dasha_lord: Int;            // 0 to 8
    seventh_house_lord: Int;    // 0 to 8
}

/* =====================================================
   YONI TABLE
===================================================== */

export const YONI_SCORE_MATRIX: Int[][] = [
    [4, 3, 3, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 1],
    [3, 4, 3, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 1],
    [3, 3, 4, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 1],
    [2, 2, 2, 4, 3, 2, 2, 3, 3, 1, 1, 2, 2, 1],
    [2, 2, 2, 3, 4, 2, 2, 3, 3, 1, 1, 2, 2, 1],
    [3, 3, 3, 2, 2, 4, 3, 2, 2, 1, 1, 2, 2, 1],
    [3, 3, 3, 2, 2, 3, 4, 2, 2, 1, 1, 2, 2, 1],
    [2, 2, 2, 3, 3, 2, 2, 4, 3, 1, 1, 2, 2, 1],
    [2, 2, 2, 3, 3, 2, 2, 3, 4, 1, 1, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 3, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 4, 2, 2, 1],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 3, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4, 2],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 4]
];

export function yoni_score(a: Int, b: Int): Int {
    return YONI_SCORE_MATRIX[a][b];
}

/* =====================================================
   GANA TABLE
===================================================== */

export const GANA_SCORE_MATRIX: Int[][] = [
    [6, 5, 1],
    [5, 6, 2],
    [1, 2, 6]
];

export function gana_score(a: Int, b: Int): Int {
    return GANA_SCORE_MATRIX[a][b];
}

/* =====================================================
   DASHA COMPATIBILITY
===================================================== */

export const DASHA_FRIENDSHIP: Int[][] = [
    [2, 1, 1, 0, 1, 1, 0, 1, 1],
    [1, 2, 1, 0, 1, 1, 0, 1, 1],
    [1, 1, 2, 0, 1, 1, 0, 1, 1],
    [0, 0, 0, 2, 0, 0, 1, 0, 0],
    [1, 1, 1, 0, 2, 1, 0, 1, 1],
    [1, 1, 1, 0, 1, 2, 0, 1, 1],
    [0, 0, 0, 1, 0, 0, 2, 0, 0],
    [1, 1, 1, 0, 1, 1, 0, 2, 1],
    [1, 1, 1, 0, 1, 1, 0, 1, 2]
];

export function dasha_score(a: Int, b: Int): Int {
    return DASHA_FRIENDSHIP[a][b];
}

/* =====================================================
   SEVENTH HOUSE COMPATIBILITY
===================================================== */

export const SEVENTH_HOUSE_SCORE: Int[][] = [
    [3, 2, 2, 1, 2, 2, 1, 2, 2],
    [2, 3, 2, 1, 2, 2, 1, 2, 2],
    [2, 2, 3, 1, 2, 2, 1, 2, 2],
    [1, 1, 1, 3, 1, 1, 2, 1, 1],
    [2, 2, 2, 1, 3, 2, 1, 2, 2],
    [2, 2, 2, 1, 2, 3, 1, 2, 2],
    [1, 1, 1, 2, 1, 1, 3, 1, 1],
    [2, 2, 2, 1, 2, 2, 1, 3, 2],
    [2, 2, 2, 1, 2, 2, 1, 2, 3]
];

export function seventh_house_score(a: Int, b: Int): Int {
    return SEVENTH_HOUSE_SCORE[a][b];
}

/* =====================================================
   BATCH VECTOR MATCHER
===================================================== */

export interface MatchResult {
    pair_id: string;
    yoni: Int;
    gana: Int;
    dasha: Int;
    seventh_house: Int;
    total: Int;
}

export function match_pair(a: PersonVector, b: PersonVector): MatchResult {
    const yoni = yoni_score(a.yoni, b.yoni);
    const gana = gana_score(a.gana, b.gana);
    const dasha = dasha_score(a.dasha_lord, b.dasha_lord);
    const seventh_house = seventh_house_score(
        a.seventh_house_lord,
        b.seventh_house_lord
    );

    return {
        pair_id: a.id + "_" + b.id,
        yoni,
        gana,
        dasha,
        seventh_house,
        total: yoni + gana + dasha + seventh_house
    };
}

export function batch_match(
    people: PersonVector[]
): MatchResult[] {
    const results: MatchResult[] = [];
    for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
            results.push(match_pair(people[i], people[j]));
        }
    }
    return results;
}
