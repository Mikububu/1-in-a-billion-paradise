/**
 * VEDIC MATCHMAKING BATCH PROCESSOR
 * 
 * Efficiently compute Ashta Koota scores for:
 * - One person against N people
 * - N by M population matching
 * 
 * Deterministic. Stateless. Parallel safe.
 */

import {
    VedicPerson,
    KootaScoreBreakdown
} from './vedic_matchmaking.types';

import {
    scoreVarna,
    scoreVashya,
    scoreTara,
    scoreYoni,
    scoreGrahaMaitri,
    scoreGana,
    scoreBhakoot,
    scoreNadi
} from './vedic_matchmaking.engine';

// ===================================
// 1. SINGLE PAIR SCORER
// ===================================

export function scorePair(a: VedicPerson, b: VedicPerson): KootaScoreBreakdown {
    const varna = scoreVarna(a, b);
    const vashya = scoreVashya(a, b);
    const tara = scoreTara(a, b);
    const yoni = scoreYoni(a, b);
    const graha_maitri = scoreGrahaMaitri(a, b);
    const gana = scoreGana(a, b);
    const bhakoot = scoreBhakoot(a, b);
    const nadi = scoreNadi(a, b); // Note: Engine returns 8 or 0.

    const total =
        varna +
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

export function matchOneToMany(
    source: VedicPerson,
    targets: VedicPerson[]
): { target_id: string; scores: KootaScoreBreakdown }[] {
    return targets.map(t => ({
        target_id: t.id,
        scores: scorePair(source, t)
    }));
}

// ===================================
// 3. MANY TO MANY MATRIX
// ===================================

export function matchManyToMany(
    groupA: VedicPerson[],
    groupB: VedicPerson[]
): { a_id: string; b_id: string; scores: KootaScoreBreakdown }[] {
    const results: { a_id: string; b_id: string; scores: KootaScoreBreakdown }[] = [];

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
export function fastReject(a: VedicPerson, b: VedicPerson): boolean {
    if (a.nadi === b.nadi) return true;
    if (scoreBhakoot(a, b) === 0) return true;
    return false;
}
