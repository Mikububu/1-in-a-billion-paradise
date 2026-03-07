"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEVENTH_HOUSE_SCORE = exports.DASHA_FRIENDSHIP = exports.GANA_SCORE_MATRIX = exports.YONI_SCORE_MATRIX = void 0;
exports.yoni_score = yoni_score;
exports.gana_score = gana_score;
exports.dasha_score = dasha_score;
exports.seventh_house_score = seventh_house_score;
exports.match_pair = match_pair;
exports.batch_match = batch_match;
/* =====================================================
   YONI TABLE
===================================================== */
exports.YONI_SCORE_MATRIX = [
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
function yoni_score(a, b) {
    return exports.YONI_SCORE_MATRIX[a][b];
}
/* =====================================================
   GANA TABLE
===================================================== */
exports.GANA_SCORE_MATRIX = [
    [6, 5, 1],
    [5, 6, 2],
    [1, 2, 6]
];
function gana_score(a, b) {
    return exports.GANA_SCORE_MATRIX[a][b];
}
/* =====================================================
   DASHA COMPATIBILITY
===================================================== */
exports.DASHA_FRIENDSHIP = [
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
function dasha_score(a, b) {
    return exports.DASHA_FRIENDSHIP[a][b];
}
/* =====================================================
   SEVENTH HOUSE COMPATIBILITY
===================================================== */
exports.SEVENTH_HOUSE_SCORE = [
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
function seventh_house_score(a, b) {
    return exports.SEVENTH_HOUSE_SCORE[a][b];
}
function match_pair(a, b) {
    const yoni = yoni_score(a.yoni, b.yoni);
    const gana = gana_score(a.gana, b.gana);
    const dasha = dasha_score(a.dasha_lord, b.dasha_lord);
    const seventh_house = seventh_house_score(a.seventh_house_lord, b.seventh_house_lord);
    return {
        pair_id: a.id + "_" + b.id,
        yoni,
        gana,
        dasha,
        seventh_house,
        total: yoni + gana + dasha + seventh_house
    };
}
function batch_match(people) {
    const results = [];
    for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
            results.push(match_pair(people[i], people[j]));
        }
    }
    return results;
}
//# sourceMappingURL=vedic_matchmaking_full.engine.js.map