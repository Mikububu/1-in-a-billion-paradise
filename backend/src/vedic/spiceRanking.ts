import { isManglik } from './manglik';
import { scorePair } from './scoring';
import { RankedVedicCandidate, SpiceAlignment, VedicEligibilityGate, VedicPerson } from './types';

const SPICE_ALIGNMENT_BY_DISTANCE: Record<number, number> = {
    0: 1.0,
    1: 0.85,
    2: 0.65,
    3: 0.35,
    4: 0.15,
};

export interface SpiceRankOptions {
    minimumViableScore?: number;
    allowNadiCancellation?: boolean;
    applySimpleManglikGate?: boolean;
    weightVedic?: number;
    weightSpice?: number;
    includeIneligible?: boolean;
}

export function normalizeSpiceLevel(input: number | null | undefined): number {
    if (!Number.isFinite(input)) {
        return 5;
    }

    const rounded = Math.round(Number(input));
    return Math.min(10, Math.max(1, rounded));
}

export function spiceAlignmentScoreFromDistance(distance: number): number {
    if (distance >= 5) {
        return 0;
    }

    return SPICE_ALIGNMENT_BY_DISTANCE[distance] ?? 0;
}

export function buildSpiceAlignment(aSpiceRaw: number | null | undefined, bSpiceRaw: number | null | undefined): SpiceAlignment {
    const userASpice = normalizeSpiceLevel(aSpiceRaw);
    const userBSpice = normalizeSpiceLevel(bSpiceRaw);
    const spiceDistance = Math.abs(userASpice - userBSpice);

    return {
        user_a_spice: userASpice,
        user_b_spice: userBSpice,
        spice_distance: spiceDistance,
        spice_alignment_score: spiceAlignmentScoreFromDistance(spiceDistance),
    };
}

function shouldCancelNadi(
    total: number,
    grahaMaitri: number,
    sameNakshatra: boolean,
    allowNadiCancellation: boolean,
): boolean {
    if (!allowNadiCancellation) {
        return false;
    }

    return total >= 28 || grahaMaitri >= 5 || sameNakshatra;
}

function buildGate(params: {
    total: number;
    minimumViableScore: number;
    nadiPresent: boolean;
    nadiCancelled: boolean;
    manglikCompatible: boolean;
    applySimpleManglikGate: boolean;
}): VedicEligibilityGate {
    const reasons: string[] = [];

    if (params.total < params.minimumViableScore) {
        reasons.push(`ashtakoota_below_minimum_${params.minimumViableScore}`);
    }

    if (params.nadiPresent && !params.nadiCancelled) {
        reasons.push('critical_nadi_dosha_uncancelled');
    }

    if (params.applySimpleManglikGate && !params.manglikCompatible) {
        reasons.push('manglik_asymmetry');
    }

    return {
        eligible: reasons.length === 0,
        reasons,
    };
}

function combinedRankScore(vedicRankScore: number, spiceAlignmentScore: number, weightVedic: number, weightSpice: number): number {
    const totalWeight = weightVedic + weightSpice;
    const normalizedVedic = totalWeight > 0 ? weightVedic / totalWeight : 0.8;
    const normalizedSpice = totalWeight > 0 ? weightSpice / totalWeight : 0.2;
    return (vedicRankScore * normalizedVedic) + (spiceAlignmentScore * normalizedSpice);
}

export function rankOneToManyByVedicAndSpice(
    source: VedicPerson,
    candidates: readonly VedicPerson[],
    options: SpiceRankOptions = {},
): RankedVedicCandidate[] {
    const {
        minimumViableScore = 18,
        allowNadiCancellation = true,
        applySimpleManglikGate = true,
        weightVedic = 0.8,
        weightSpice = 0.2,
        includeIneligible = false,
    } = options;

    const ranked = candidates.map((candidate) => {
        const scores = scorePair(source, candidate);
        const nadiPresent = scores.nadi === 0;
        const sameNakshatra = source.moon_nakshatra === candidate.moon_nakshatra;
        const nadiCancelled = shouldCancelNadi(scores.total, scores.graha_maitri, sameNakshatra, allowNadiCancellation);

        const sourceManglik = typeof source.mars_placement_house === 'number' ? isManglik(source.mars_placement_house) : false;
        const candidateManglik = typeof candidate.mars_placement_house === 'number' ? isManglik(candidate.mars_placement_house) : false;
        const manglikCompatible = sourceManglik === candidateManglik;

        const gate = buildGate({
            total: scores.total,
            minimumViableScore,
            nadiPresent,
            nadiCancelled,
            manglikCompatible,
            applySimpleManglikGate,
        });

        const spice = buildSpiceAlignment(source.relationship_preference_scale, candidate.relationship_preference_scale);
        const vedicRankScore = Math.max(0, Math.min(1, scores.total / 36));
        const finalRankScore = combinedRankScore(vedicRankScore, spice.spice_alignment_score, weightVedic, weightSpice);

        const result: RankedVedicCandidate = {
            target_id: candidate.id,
            scores,
            gate,
            spice,
            vedic_rank_score: vedicRankScore,
            final_rank_score: finalRankScore,
        };

        return result;
    });

    const filtered = includeIneligible
        ? ranked
        : ranked.filter((candidate) => candidate.gate.eligible);

    filtered.sort((a, b) => {
        if (b.final_rank_score !== a.final_rank_score) {
            return b.final_rank_score - a.final_rank_score;
        }

        if (b.scores.total !== a.scores.total) {
            return b.scores.total - a.scores.total;
        }

        return a.target_id.localeCompare(b.target_id);
    });

    return filtered;
}
