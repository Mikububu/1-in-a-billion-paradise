"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultOutputLengthContract = getDefaultOutputLengthContract;
exports.normalizeOutputLengthContract = normalizeOutputLengthContract;
const wordCounts_1 = require("../prompts/config/wordCounts");
const FULL_READING_FALLBACK = {
    targetWordsMin: wordCounts_1.WORD_COUNT_LIMITS.min,
    targetWordsMax: wordCounts_1.WORD_COUNT_LIMITS.max,
    hardFloorWords: wordCounts_1.WORD_COUNT_LIMITS.min,
    note: 'Keep this as a full-length deep reading. No compressed output.',
};
const OVERLAY_READING_FALLBACK = {
    targetWordsMin: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
    targetWordsMax: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.max,
    hardFloorWords: wordCounts_1.WORD_COUNT_LIMITS_OVERLAY.min,
    note: 'Overlay must cover both people deeply and keep the relationship field concrete.',
};
const VERDICT_READING_FALLBACK = {
    targetWordsMin: wordCounts_1.WORD_COUNT_LIMITS_VERDICT.min,
    targetWordsMax: wordCounts_1.WORD_COUNT_LIMITS_VERDICT.max,
    hardFloorWords: wordCounts_1.WORD_COUNT_LIMITS_VERDICT.min,
    note: 'Verdict must integrate all systems with clear synthesis and high density.',
};
const DEFAULT_BY_READING_KIND = {
    individual: FULL_READING_FALLBACK,
    synastry: OVERLAY_READING_FALLBACK,
    verdict: VERDICT_READING_FALLBACK,
};
function getDefaultOutputLengthContract(readingKind) {
    return DEFAULT_BY_READING_KIND[readingKind];
}
function normalizeOutputLengthContract(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const targetWordsMin = Number(raw.targetWordsMin);
    const targetWordsMax = Number(raw.targetWordsMax);
    const hardFloorWords = Number(raw.hardFloorWords);
    const note = typeof raw.note === 'string' ? raw.note.trim() : '';
    if (!Number.isFinite(targetWordsMin) || !Number.isFinite(targetWordsMax) || !Number.isFinite(hardFloorWords)) {
        return undefined;
    }
    const min = Math.max(200, Math.round(targetWordsMin));
    const max = Math.max(min, Math.round(targetWordsMax));
    const floor = Math.max(200, Math.min(max, Math.round(hardFloorWords)));
    return {
        targetWordsMin: min,
        targetWordsMax: max,
        hardFloorWords: floor,
        note: note || 'Do not add filler text just to increase length.',
    };
}
//# sourceMappingURL=outputLengthProfiles.js.map