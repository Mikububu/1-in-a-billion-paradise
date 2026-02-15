import { ReadingKind } from './types';
import { WORD_COUNT_LIMITS } from '../prompts/config/wordCounts';

export type OutputLengthContract = {
    targetWordsMin: number;
    targetWordsMax: number;
    hardFloorWords: number;
    note?: string;
};

const FULL_READING_FALLBACK: OutputLengthContract = {
    targetWordsMin: WORD_COUNT_LIMITS.min,
    targetWordsMax: WORD_COUNT_LIMITS.max,
    hardFloorWords: WORD_COUNT_LIMITS.min,
    note: 'Keep this as a full-length deep reading. No compressed output.',
};

const DEFAULT_BY_READING_KIND: Record<ReadingKind, OutputLengthContract> = {
    individual: FULL_READING_FALLBACK,
    synastry: FULL_READING_FALLBACK,
    verdict: FULL_READING_FALLBACK,
};

export function getDefaultOutputLengthContract(readingKind: ReadingKind): OutputLengthContract {
    return DEFAULT_BY_READING_KIND[readingKind];
}

export function normalizeOutputLengthContract(raw: any): OutputLengthContract | undefined {
    if (!raw || typeof raw !== 'object') return undefined;

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
