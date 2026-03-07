"use strict";
/*
FILE: vedic_ashtakoota.vectorized.engine.ts

AUTHORITATIVE BACKEND SPECIFICATION
VEDIC ASHTAKOOTA MATCHING ENGINE
VECTOR ONLY
NO UI
NO INTERPRETATION
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchVedicPair = matchVedicPair;
exports.matchBatch = matchBatch;
const vedic_ashtakoota_tables_1 = require("./vedic_ashtakoota.tables");
const vedic_mars_manglik_tables_1 = require("./vedic_mars_manglik.tables");
const vedic_yoni_gana_dasha_tables_1 = require("./vedic_yoni_gana_dasha.tables");
/* ================================
   6. CORE ENGINE
================================ */
function matchVedicPair(a, b) {
    const varna = vedic_ashtakoota_tables_1.VARNA_TABLE[a.moon_rashi][b.moon_rashi];
    const vashya = vedic_ashtakoota_tables_1.VASHYA_TABLE[a.moon_rashi][b.moon_rashi];
    const tara = vedic_ashtakoota_tables_1.TARA_TABLE[a.moon_nakshatra][b.moon_nakshatra];
    const yoni = vedic_yoni_gana_dasha_tables_1.YONI_MATRIX[a.yoni][b.yoni];
    const graha_maitri = vedic_ashtakoota_tables_1.GRAHA_MAITRI_TABLE[a.moon_rashi][b.moon_rashi];
    const gana = vedic_yoni_gana_dasha_tables_1.GANA_MATRIX[a.gana][b.gana];
    const bhakoot = vedic_ashtakoota_tables_1.BHAKOOT_TABLE[a.moon_rashi][b.moon_rashi];
    const nadi = vedic_ashtakoota_tables_1.NADI_TABLE[a.moon_nakshatra][b.moon_nakshatra];
    const guna_total = varna +
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
function computeDoshas(a, b, nadiScore, bhakootScore) {
    // Use table-based Manglik detection with optional sign cancellation
    const aManglik = a.mars_rashi !== undefined
        ? (0, vedic_mars_manglik_tables_1.hasManglikDosha)(a.mars_house, a.mars_rashi)
        : vedic_mars_manglik_tables_1.MARS_DOSHA_BY_HOUSE[a.mars_house - 1] === 1;
    const bManglik = b.mars_rashi !== undefined
        ? (0, vedic_mars_manglik_tables_1.hasManglikDosha)(b.mars_house, b.mars_rashi)
        : vedic_mars_manglik_tables_1.MARS_DOSHA_BY_HOUSE[b.mars_house - 1] === 1;
    let manglik = "none";
    if (aManglik && bManglik)
        manglik = "cancelled";
    else if (aManglik || bManglik)
        manglik = "active";
    return {
        manglik,
        nadi: nadiScore === 0,
        bhakoot: bhakootScore === 0
    };
}
/* ================================
   8. DASHA SYNC
================================ */
function computeDashaSync(a, b) {
    const score = (0, vedic_yoni_gana_dasha_tables_1.dashaCompatibilityScore)(a.dasha_lord, b.dasha_lord);
    // Map 0, 1, 2 to phase relation
    let phase = 'conflicting';
    if (score === 2)
        phase = 'same'; // Or 'excellent' semantically
    else if (score === 1)
        phase = 'supportive';
    return {
        alignment_score: score,
        phase_relation: phase
    };
}
/* ================================
   9. VERDICT
================================ */
function computeVerdict(score, dosha) {
    // Hard reject if critical doshas active
    if (dosha.nadi && dosha.manglik === "active")
        return "reject";
    if (score < 18)
        return "reject";
    if (score < 25)
        return "average";
    if (score < 33)
        return "good";
    return "excellent";
}
/* ================================
   10. BATCH VECTOR MATCHER
================================ */
function matchBatch(source, targets) {
    return targets.map(t => matchVedicPair(source, t));
}
/* END OF FILE */
//# sourceMappingURL=vedic_ashtakoota.vectorized.engine.js.map