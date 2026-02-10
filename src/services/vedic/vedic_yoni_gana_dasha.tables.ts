/*
FILE: vedic_yoni_gana_dasha.tables.ts
SCOPE: Vedic matchmaking core tables
STYLE: Numeric, vectorized, backend-only
*/

/* =====================================================
   YONI
   Nakshatra index 0–26
   Yoni index 0–13
===================================================== */

export const NAKSHATRA_TO_YONI: number[] = [
    0,  // Ashwini        Horse
    1,  // Bharani        Elephant
    2,  // Krittika       Sheep
    3,  // Rohini         Serpent
    4,  // Mrigashira     Deer
    5,  // Ardra          Dog
    6,  // Punarvasu      Cat
    7,  // Pushya         Sheep
    8,  // Ashlesha       Cat
    9,  // Magha          Rat
    10, // Purva Phalguni Rat
    11, // Uttara Phalguni Cow
    12, // Hasta          Buffalo
    13, // Chitra         Tiger
    14, // Swati          Buffalo
    15, // Vishakha       Tiger
    16, // Anuradha       Deer
    17, // Jyeshtha       Deer
    18, // Mula           Dog
    19, // Purva Ashada   Monkey
    20, // Uttara Ashada  Mongoose
    21, // Shravana       Monkey
    22, // Dhanishta      Lion
    23, // Shatabhisha    Horse
    24, // Purva Bhadra   Lion
    25, // Uttara Bhadra  Cow
    26  // Revati         Elephant
];

/*
Yoni compatibility matrix
Score values: 0, 1, 2, 3, 4
*/

export const YONI_MATRIX: number[][] = [
    /*            Ho El Sh Se De Do Ca Ra Co Bu Ti Mo Mg Li */
    [4, 2, 2, 1, 3, 1, 2, 1, 3, 2, 3, 2, 1, 2], // Horse
    [2, 4, 2, 1, 3, 1, 2, 1, 3, 2, 3, 2, 1, 2], // Elephant
    [2, 2, 4, 2, 3, 2, 3, 2, 3, 2, 3, 2, 2, 2], // Sheep
    [1, 1, 2, 4, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1], // Serpent
    [3, 3, 3, 1, 4, 2, 3, 2, 4, 3, 4, 3, 2, 3], // Deer
    [1, 1, 2, 1, 2, 4, 1, 1, 2, 1, 2, 1, 1, 1], // Dog
    [2, 2, 3, 1, 3, 1, 4, 1, 3, 2, 3, 2, 1, 2], // Cat
    [1, 1, 2, 1, 2, 1, 1, 4, 2, 1, 2, 1, 1, 1], // Rat
    [3, 3, 3, 2, 4, 2, 3, 2, 4, 3, 4, 3, 2, 3], // Cow
    [2, 2, 2, 1, 3, 1, 2, 1, 3, 4, 3, 2, 1, 2], // Buffalo
    [3, 3, 3, 2, 4, 2, 3, 2, 4, 3, 4, 3, 2, 3], // Tiger
    [2, 2, 2, 1, 3, 1, 2, 1, 3, 2, 3, 4, 1, 2], // Monkey
    [1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 4, 1], // Lion
    [2, 2, 2, 1, 3, 1, 2, 1, 3, 2, 3, 2, 1, 4], // Mongoose
];

/* =====================================================
   GANA
   Nakshatra index 0–26
   Gana index 0–2
   0 Deva  1 Manushya  2 Rakshasa
===================================================== */

export const NAKSHATRA_TO_GANA: number[] = [
    0, 0, 1, 1, 1, 2, 0, 0, 2, 2, 0, 0, 0,
    2, 1, 2, 0, 2, 2, 1, 1, 0, 2, 2, 2, 0
];

export const GANA_MATRIX: number[][] = [
    [6, 5, 1], // Deva
    [5, 6, 3], // Manushya
    [1, 3, 6], // Rakshasa
];

/* =====================================================
   DASHA SYNCHRONIZATION
   Mahadasha Lord index 0–8
   0 Sun 1 Moon 2 Mars 3 Mercury 4 Jupiter
   5 Venus 6 Saturn 7 Rahu 8 Ketu
===================================================== */

export const DASHA_FRIENDSHIP_MATRIX: number[][] = [
    /*        Su Mo Ma Me Ju Ve Sa Ra Ke */
    [2, 1, 0, 1, 2, 1, 0, 0, 0], // Sun
    [1, 2, 1, 1, 2, 1, 0, 0, 0], // Moon
    [0, 1, 2, 1, 1, 0, 0, 0, 0], // Mars
    [1, 1, 1, 2, 1, 1, 0, 0, 0], // Mercury
    [2, 2, 1, 1, 2, 1, 0, 0, 0], // Jupiter
    [1, 1, 0, 1, 1, 2, 1, 0, 0], // Venus
    [0, 0, 0, 0, 0, 1, 2, 0, 0], // Saturn
    [0, 0, 0, 0, 0, 0, 0, 2, 1], // Rahu
    [0, 0, 0, 0, 0, 0, 0, 1, 2], // Ketu
];

export function dashaCompatibilityScore(
    lordA: number,
    lordB: number
): number {
    return DASHA_FRIENDSHIP_MATRIX[lordA][lordB];
}

/* END FILE */
