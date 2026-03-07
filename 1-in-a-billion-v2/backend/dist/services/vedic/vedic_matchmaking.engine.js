"use strict";
/**
 * VEDIC MATCHMAKING ENGINE
 *
 * A pure, deterministic implementation of Vedic matchmaking logic.
 * Implements granular scoring functions exported for batch usage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreVarna = scoreVarna;
exports.scoreVashya = scoreVashya;
exports.scoreTara = scoreTara;
exports.scoreYoni = scoreYoni;
exports.scoreGrahaMaitri = scoreGrahaMaitri;
exports.scoreGana = scoreGana;
exports.scoreBhakoot = scoreBhakoot;
exports.scoreNadi = scoreNadi;
exports.computeVedicMatch = computeVedicMatch;
const vedic_tables_adapter_1 = require("./vedic_tables.adapter");
function getMoonSign(p) {
    return p.moon_sign || ''; // Must be provided for most kootas
}
// ============================================================================
// SCORING FUNCTIONS
// ============================================================================
// 1. VARNA
function scoreVarna(a, b) {
    return (0, vedic_tables_adapter_1.getVarnaScore)(a.moon_sign || '', b.moon_sign || '');
}
// 2. VASHYA
function scoreVashya(a, b) {
    return (0, vedic_tables_adapter_1.getVashyaScore)(a.moon_sign || '', b.moon_sign || '');
}
// 3. TARA
function scoreTara(a, b) {
    return (0, vedic_tables_adapter_1.getTaraScore)(a.moon_nakshatra, b.moon_nakshatra);
}
// 4. YONI
function scoreYoni(a, b) {
    return (0, vedic_tables_adapter_1.getYoniScore)(a.moon_nakshatra, b.moon_nakshatra);
}
// 5. GRAHA MAITRI
function scoreGrahaMaitri(a, b) {
    return (0, vedic_tables_adapter_1.getGrahaMaitriScore)(a.moon_sign || '', b.moon_sign || '');
}
// 6. GANA
function scoreGana(a, b) {
    return (0, vedic_tables_adapter_1.getGanaScore)(a.moon_nakshatra, b.moon_nakshatra);
}
// 7. BHAKOOT
function scoreBhakoot(a, b) {
    return (0, vedic_tables_adapter_1.getBhakootScore)(a.moon_sign || '', b.moon_sign || '');
}
// 8. NADI
function scoreNadi(a, b) {
    return (0, vedic_tables_adapter_1.getNadiScore)(a.moon_nakshatra, b.moon_nakshatra);
}
// ===================================
// MAIN ENGINE WRAPPER
// ===================================
function computeVedicMatch(personA, personB, context) {
    // Adapt inputs to ScorablePerson
    const scorableA = {
        moon_sign: personA.moon_sign,
        moon_nakshatra: personA.moon_nakshatra,
        yoni: personA.yoni,
        gana: personA.gana,
        nadi: personA.nadi,
        moon_sign_lord: personA.moon_rashi_lord
    };
    const scorableB = {
        moon_sign: personB.moon_sign,
        moon_nakshatra: personB.moon_nakshatra,
        yoni: personB.yoni,
        gana: personB.gana,
        nadi: personB.nadi,
        moon_sign_lord: personB.moon_rashi_lord
    };
    const varna = scoreVarna(scorableA, scorableB);
    const vashya = scoreVashya(scorableA, scorableB);
    const tara = scoreTara(scorableA, scorableB);
    const yoni = scoreYoni(scorableA, scorableB);
    const graha = scoreGrahaMaitri(scorableA, scorableB);
    const gana = scoreGana(scorableA, scorableB);
    const bhakoot = scoreBhakoot(scorableA, scorableB);
    const nadi = scoreNadi(scorableA, scorableB);
    const total = varna + vashya + tara + yoni + graha + gana + bhakoot + nadi;
    return {
        schema_version: "1.0.0",
        person_a: personA,
        person_b: personB,
        ashtakoota: {
            varna: { score: varna, max_score: 1 },
            vashya: { score: vashya, max_score: 2 },
            tara: { score: tara, max_score: 3, tara_type: 'sampat' }, // Placeholder type
            yoni: { score: yoni, max_score: 4, relationship: 'neutral' }, // Placeholder
            graha_maitri: { score: graha, max_score: 5 },
            gana: { score: gana, max_score: 6 },
            bhakoot: { score: bhakoot, max_score: 7, dosha_type: 'none' }, // Placeholder
            nadi: { score: nadi, max_score: 8, dosha_present: nadi === 0 },
            total_points: total
        },
        doshas: {
            manglik: { person_a_present: false, person_b_present: false, cancellation_applied: false, status: 'none' },
            nadi: { present: nadi === 0, severity: nadi === 0 ? 'high' : 'none', exception_applied: false },
            bhakoot: { present: bhakoot === 0, type: 'none', cancelled: false }
        },
        seventh_house: { person_a_strength: 0, person_b_strength: 0, mutual_aspect_quality: 'neutral', relationship_stability_score: 0 },
        dasha_context: { person_a_current_dasha: 'unknown', person_b_current_dasha: 'unknown', overlap_quality: 'neutral' },
        final_score: {
            numeric_score: total,
            grade: total >= 18 ? 'good' : 'poor',
            viability: total >= 18 ? 'recommended' : 'not_recommended'
        }
    };
}
//# sourceMappingURL=vedic_matchmaking.engine.js.map