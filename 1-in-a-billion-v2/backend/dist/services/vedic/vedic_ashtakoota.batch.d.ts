/**
 * VEDIC MATCHMAKING BATCH PROCESSOR
 *
 * Efficiently compute Ashta Koota scores for:
 * - One person against N people
 * - N by M population matching
 *
 * Deterministic. Stateless. Parallel safe.
 */
import { VedicPerson, KootaScoreBreakdown } from './vedic_matchmaking.types';
export declare function scorePair(a: VedicPerson, b: VedicPerson): KootaScoreBreakdown;
export declare function matchOneToMany(source: VedicPerson, targets: VedicPerson[]): {
    target_id: string;
    scores: KootaScoreBreakdown;
}[];
export declare function matchManyToMany(groupA: VedicPerson[], groupB: VedicPerson[]): {
    a_id: string;
    b_id: string;
    scores: KootaScoreBreakdown;
}[];
/**
 * Early rejection before full scoring.
 * Rejects if Nadi is same (0 points) OR Bhakoot is 0 points.
 */
export declare function fastReject(a: VedicPerson, b: VedicPerson): boolean;
//# sourceMappingURL=vedic_ashtakoota.batch.d.ts.map