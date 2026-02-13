import { VedicMatchOptions } from './matchmaking';
import { SpiceRankOptions } from './spiceRanking';
import {
    KootaScoreBreakdown,
    PersonChart,
    RankedVedicCandidate,
    VedicEligibilityGate,
    VedicMatchmakingResult,
    VedicPerson,
} from './types';

export interface VedicMatchRequestPayload {
    person_a: PersonChart;
    person_b: PersonChart;
    options?: VedicMatchOptions;
}

export interface VedicScoreRequestPayload {
    person_a: VedicPerson;
    person_b: VedicPerson;
    options?: VedicMatchOptions;
}

export interface VedicScoreResponsePayload {
    total: number;
    breakdown: KootaScoreBreakdown;
    eligibility: VedicEligibilityGate;
}

export interface VedicRankRequestPayload {
    source: VedicPerson;
    candidates: VedicPerson[];
    options?: SpiceRankOptions;
}

export interface VedicRankResponsePayload {
    matches: RankedVedicCandidate[];
    total_candidates: number;
    matches_found: number;
    excluded_by_gate: number;
}

export interface VedicMatchResponsePayload {
    result: VedicMatchmakingResult;
}
