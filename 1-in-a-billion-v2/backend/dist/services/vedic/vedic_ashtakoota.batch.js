"use strict";
/**
 * VEDIC MATCHMAKING BATCH PROCESSOR
 *
 * Efficiently compute Ashta Koota scores for:
 * - One person against N people
 * - N by M population matching
 *
 * Deterministic. Stateless. Parallel safe.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scorePair = scorePair;
exports.matchOneToMany = matchOneToMany;
exports.matchManyToMany = matchManyToMany;
exports.fastReject = fastReject;
const vedic_matchmaking_engine_1 = require("./vedic_matchmaking.engine");
// ===================================
// 1. SINGLE PAIR SCORER
// ===================================
function scorePair(a, b) {
    const varna = (0, vedic_matchmaking_engine_1.scoreVarna)(a, b);
    const vashya = (0, vedic_matchmaking_engine_1.scoreVashya)(a, b);
    const tara = (0, vedic_matchmaking_engine_1.scoreTara)(a, b);
    const yoni = (0, vedic_matchmaking_engine_1.scoreYoni)(a, b);
    const graha_maitri = (0, vedic_matchmaking_engine_1.scoreGrahaMaitri)(a, b);
    const gana = (0, vedic_matchmaking_engine_1.scoreGana)(a, b);
    const bhakoot = (0, vedic_matchmaking_engine_1.scoreBhakoot)(a, b);
    const nadi = (0, vedic_matchmaking_engine_1.scoreNadi)(a, b); // Note: Engine returns 8 or 0.
    const total = varna +
        vashya +
        tara +
        yoni +
        graha_maitri +
        gana +
        bhakoot +
        nadi;
    return {
        varna,
        vashya,
        tara,
        yoni,
        graha_maitri,
        gana,
        bhakoot,
        nadi,
        total
    };
}
// ===================================
// 2. ONE TO MANY MATCHING
// ===================================
function matchOneToMany(source, targets) {
    return targets.map(t => ({
        target_id: t.id,
        scores: scorePair(source, t)
    }));
}
// ===================================
// 3. MANY TO MANY MATRIX
// ===================================
function matchManyToMany(groupA, groupB) {
    const results = [];
    for (let i = 0; i < groupA.length; i++) {
        for (let j = 0; j < groupB.length; j++) {
            results.push({
                a_id: groupA[i].id,
                b_id: groupB[j].id,
                scores: scorePair(groupA[i], groupB[j])
            });
        }
    }
    return results;
}
// ===================================
// 4. FAST FILTER MODE
// ===================================
/**
 * Early rejection before full scoring.
 * Rejects if Nadi is same (0 points) OR Bhakoot is 0 points.
 */
function fastReject(a, b) {
    if (a.nadi === b.nadi)
        return true;
    if ((0, vedic_matchmaking_engine_1.scoreBhakoot)(a, b) === 0)
        return true;
    return false;
}
//# sourceMappingURL=vedic_ashtakoota.batch.js.map