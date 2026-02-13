import { isManglik } from './manglik';
import { scorePair } from './scoring';
import {
    getBhakootDoshaType,
    getTaraTypeAndScore,
    getYoniScore,
    isNakshatra,
    yoniRelationshipFromScore,
} from './tables';
import {
    CompatibilityGrade,
    PersonChart,
    VedicEligibilityGate,
    VedicMatchmakingResult,
    ViabilityStatus,
} from './types';

export interface VedicMatchOptions {
    minimumViableScore?: number;
    allowNadiCancellation?: boolean;
    applySimpleManglikGate?: boolean;
}

function gradeFromTotal(total: number): CompatibilityGrade {
    if (total <= 17) {
        return 'poor';
    }
    if (total <= 24) {
        return 'average';
    }
    if (total <= 32) {
        return 'good';
    }
    if (total <= 35) {
        return 'excellent';
    }
    return 'exceptional';
}

function viabilityFromTotal(total: number): ViabilityStatus {
    if (total <= 17) {
        return 'not_recommended';
    }
    if (total <= 24) {
        return 'conditional';
    }
    if (total <= 32) {
        return 'recommended';
    }
    return 'highly_recommended';
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

function buildEligibilityGate(params: {
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

export function computeVedicMatch(
    personA: PersonChart,
    personB: PersonChart,
    options: VedicMatchOptions = {},
): VedicMatchmakingResult {
    const {
        minimumViableScore = 18,
        allowNadiCancellation = true,
        applySimpleManglikGate = true,
    } = options;

    const scores = scorePair(personA, personB);

    const nakA = isNakshatra(personA.moon_nakshatra) ? personA.moon_nakshatra : null;
    const nakB = isNakshatra(personB.moon_nakshatra) ? personB.moon_nakshatra : null;

    const tara = nakA && nakB
        ? getTaraTypeAndScore(nakA, nakB)
        : { tara_type: 'janma' as const, score: 0 };

    const yoniScore = nakA && nakB ? getYoniScore(nakA, nakB) : 2;

    const nadiPresent = scores.nadi === 0;
    const sameNakshatra = personA.moon_nakshatra === personB.moon_nakshatra;
    const nadiCancelled = shouldCancelNadi(scores.total, scores.graha_maitri, sameNakshatra, allowNadiCancellation);

    const personAManglik = typeof personA.mars_placement_house === 'number'
        ? isManglik(personA.mars_placement_house)
        : false;
    const personBManglik = typeof personB.mars_placement_house === 'number'
        ? isManglik(personB.mars_placement_house)
        : false;

    const manglikCompatible = personAManglik === personBManglik;

    const eligibility = buildEligibilityGate({
        total: scores.total,
        minimumViableScore,
        nadiPresent,
        nadiCancelled,
        manglikCompatible,
        applySimpleManglikGate,
    });

    return {
        schema_version: '1.0.0',
        person_a: personA,
        person_b: personB,
        ashtakoota: {
            varna: { score: scores.varna, max_score: 1 },
            vashya: { score: scores.vashya, max_score: 2 },
            tara: {
                score: tara.score,
                max_score: 3,
                tara_type: tara.tara_type,
            },
            yoni: {
                score: yoniScore,
                max_score: 4,
                relationship: yoniRelationshipFromScore(yoniScore),
            },
            graha_maitri: { score: scores.graha_maitri, max_score: 5 },
            gana: { score: scores.gana, max_score: 6 },
            bhakoot: {
                score: scores.bhakoot,
                max_score: 7,
                dosha_type: getBhakootDoshaType(personA.moon_sign, personB.moon_sign),
            },
            nadi: {
                score: scores.nadi,
                max_score: 8,
                dosha_present: nadiPresent,
            },
            total_points: scores.total,
        },
        doshas: {
            manglik: {
                person_a_present: personAManglik,
                person_b_present: personBManglik,
                cancellation_applied: false,
                status: personAManglik || personBManglik
                    ? (manglikCompatible ? 'cancelled' : 'present')
                    : 'none',
            },
            nadi: {
                present: nadiPresent,
                severity: !nadiPresent ? 'none' : nadiCancelled ? 'low' : 'high',
                exception_applied: nadiCancelled,
            },
            bhakoot: {
                present: scores.bhakoot === 0,
                type: getBhakootDoshaType(personA.moon_sign, personB.moon_sign),
                cancelled: false,
            },
        },
        seventh_house: {
            person_a_strength: 0,
            person_b_strength: 0,
            mutual_aspect_quality: 'neutral',
            relationship_stability_score: 0,
        },
        dasha_context: {
            person_a_current_dasha: 'unknown',
            person_b_current_dasha: 'unknown',
            overlap_quality: 'neutral',
        },
        final_score: {
            numeric_score: scores.total,
            grade: gradeFromTotal(scores.total),
            viability: viabilityFromTotal(scores.total),
        },
        eligibility,
    };
}
