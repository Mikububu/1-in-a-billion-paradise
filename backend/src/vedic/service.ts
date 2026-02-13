import { computeVedicMatch, VedicMatchOptions } from './matchmaking';
import { scorePair } from './scoring';
import { rankOneToManyByVedicAndSpice, SpiceRankOptions } from './spiceRanking';
import { isNakshatra } from './tables';
import {
    PersonChart,
    VedicPerson,
} from './types';
import {
    VedicMatchRequestPayload,
    VedicMatchResponsePayload,
    VedicRankRequestPayload,
    VedicRankResponsePayload,
    VedicScoreRequestPayload,
    VedicScoreResponsePayload,
} from './contracts';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeSpice(value: unknown): number | undefined {
    const numeric = asNumber(value);
    if (numeric === undefined) {
        return undefined;
    }

    return Math.min(10, Math.max(1, Math.round(numeric)));
}

function parseVedicMatchOptions(value: unknown): VedicMatchOptions | undefined {
    if (!isObject(value)) {
        return undefined;
    }

    return {
        minimumViableScore: asNumber(value.minimumViableScore),
        allowNadiCancellation: asBoolean(value.allowNadiCancellation),
        applySimpleManglikGate: asBoolean(value.applySimpleManglikGate),
    };
}

function parseSpiceRankOptions(value: unknown): SpiceRankOptions | undefined {
    if (!isObject(value)) {
        return undefined;
    }

    return {
        minimumViableScore: asNumber(value.minimumViableScore),
        allowNadiCancellation: asBoolean(value.allowNadiCancellation),
        applySimpleManglikGate: asBoolean(value.applySimpleManglikGate),
        weightVedic: asNumber(value.weightVedic),
        weightSpice: asNumber(value.weightSpice),
        includeIneligible: asBoolean(value.includeIneligible),
    };
}

function parseMoonNakshatra(value: unknown, key: string): VedicPerson['moon_nakshatra'] {
    const moonNakshatra = asString(value);
    if (!moonNakshatra || !isNakshatra(moonNakshatra)) {
        throw new Error(`${key}.moon_nakshatra must be a valid Nakshatra string`);
    }

    return moonNakshatra;
}

function parseOptionalNadi(value: unknown): VedicPerson['nadi'] {
    const normalized = asString(value)?.toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'adi' || normalized === 'madhya' || normalized === 'antya') {
        return normalized;
    }
    return undefined;
}

function parseOptionalVarna(value: unknown): VedicPerson['varna'] {
    const normalized = asString(value)?.toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'brahmin' || normalized === 'kshatriya' || normalized === 'vaishya' || normalized === 'shudra') {
        return normalized;
    }
    return undefined;
}

function parseOptionalGana(value: unknown): VedicPerson['gana'] {
    const normalized = asString(value)?.toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === 'deva' || normalized === 'manushya' || normalized === 'rakshasa') {
        return normalized;
    }
    return undefined;
}

function parseMoonSign(value: unknown, key: string): string {
    const moonSign = asString(value);
    if (!moonSign) {
        throw new Error(`${key}.moon_sign is required`);
    }
    return moonSign;
}

function parseVedicPerson(value: unknown, key: string): VedicPerson {
    if (!isObject(value)) {
        throw new Error(`${key} must be an object`);
    }

    const id = asString(value.id);
    if (!id) {
        throw new Error(`${key}.id is required`);
    }

    return {
        id,
        moon_sign: parseMoonSign(value.moon_sign, key),
        moon_nakshatra: parseMoonNakshatra(value.moon_nakshatra, key),
        moon_lord: asString(value.moon_lord) ?? undefined,
        nadi: parseOptionalNadi(value.nadi),
        varna: parseOptionalVarna(value.varna),
        yoni: asString(value.yoni) ?? undefined,
        gana: parseOptionalGana(value.gana),
        vashya: asString(value.vashya) ?? undefined,
        mars_placement_house: asNumber(value.mars_placement_house),
        relationship_preference_scale: normalizeSpice(value.relationship_preference_scale),
    };
}

function parsePersonChart(value: unknown, key: string): PersonChart {
    const person = parseVedicPerson(value, key);

    return {
        id: person.id,
        moon_sign: person.moon_sign,
        moon_nakshatra: person.moon_nakshatra,
        moon_rashi_lord: person.moon_lord,
        nadi: person.nadi,
        varna: person.varna,
        yoni: person.yoni,
        gana: person.gana,
        vashya: person.vashya,
        mars_placement_house: person.mars_placement_house,
        relationship_preference_scale: person.relationship_preference_scale,
    };
}

export function parseVedicMatchRequestPayload(payload: unknown): VedicMatchRequestPayload {
    if (!isObject(payload)) {
        throw new Error('payload must be an object');
    }

    return {
        person_a: parsePersonChart(payload.person_a, 'person_a'),
        person_b: parsePersonChart(payload.person_b, 'person_b'),
        options: parseVedicMatchOptions(payload.options),
    };
}

export function parseVedicScoreRequestPayload(payload: unknown): VedicScoreRequestPayload {
    if (!isObject(payload)) {
        throw new Error('payload must be an object');
    }

    return {
        person_a: parseVedicPerson(payload.person_a, 'person_a'),
        person_b: parseVedicPerson(payload.person_b, 'person_b'),
        options: parseVedicMatchOptions(payload.options),
    };
}

export function parseVedicRankRequestPayload(payload: unknown): VedicRankRequestPayload {
    if (!isObject(payload)) {
        throw new Error('payload must be an object');
    }

    const candidatesRaw = payload.candidates;
    if (!Array.isArray(candidatesRaw)) {
        throw new Error('candidates must be an array');
    }

    return {
        source: parseVedicPerson(payload.source, 'source'),
        candidates: candidatesRaw.map((candidate, index) => parseVedicPerson(candidate, `candidates[${index}]`)),
        options: parseSpiceRankOptions(payload.options),
    };
}

export function runVedicMatch(payload: unknown): VedicMatchResponsePayload {
    const request = parseVedicMatchRequestPayload(payload);
    return {
        result: computeVedicMatch(request.person_a, request.person_b, request.options),
    };
}

export function runVedicScore(payload: unknown): VedicScoreResponsePayload {
    const request = parseVedicScoreRequestPayload(payload);
    const breakdown = scorePair(request.person_a, request.person_b);
    const result = computeVedicMatch(request.person_a, request.person_b, request.options);

    return {
        total: breakdown.total,
        breakdown,
        eligibility: result.eligibility,
    };
}

export function runVedicRank(payload: unknown): VedicRankResponsePayload {
    const request = parseVedicRankRequestPayload(payload);

    const all = rankOneToManyByVedicAndSpice(request.source, request.candidates, {
        ...request.options,
        includeIneligible: true,
    });
    const filtered = request.options?.includeIneligible
        ? all
        : all.filter((item) => item.gate.eligible);

    return {
        matches: filtered,
        total_candidates: request.candidates.length,
        matches_found: filtered.length,
        excluded_by_gate: all.length - all.filter((item) => item.gate.eligible).length,
    };
}
