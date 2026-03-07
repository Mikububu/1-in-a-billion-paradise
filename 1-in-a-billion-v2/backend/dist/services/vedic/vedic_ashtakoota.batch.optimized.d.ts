/**
 * VEDIC MATCHMAKING BATCH PROCESSOR - OPTIMIZED FOR LARGE SCALE
 *
 * Efficiently compute Ashta Koota scores for:
 * - One person against N people (10,000+ candidates)
 * - N by M population matching
 *
 * Optimizations:
 * - Chunked processing to avoid memory issues
 * - Early rejection before full scoring
 * - Streaming results instead of loading all in memory
 * - Progress tracking for large batches
 * - Configurable batch sizes
 *
 * Deterministic. Stateless. Parallel safe.
 */
import { VedicPerson, KootaScoreBreakdown } from './vedic_matchmaking.types';
export declare function scorePair(a: VedicPerson, b: VedicPerson): KootaScoreBreakdown;
/**
 * Early rejection before full scoring.
 * Rejects if Nadi is same (0 points) OR Bhakoot is 0 points.
 * This is O(1) and should be checked BEFORE full scoring.
 */
export declare function fastReject(a: VedicPerson, b: VedicPerson): boolean;
export interface MatchOneToManyOptions {
    chunkSize?: number;
    minScore?: number;
    maxResults?: number;
    onProgress?: (processed: number, total: number) => void;
}
export interface MatchOneToManyResult {
    matches: {
        target_id: string;
        scores: KootaScoreBreakdown;
    }[];
    total_candidates: number;
    rejected_early: number;
    processed: number;
}
/**
 * Optimized one-to-many matching with chunking and early rejection.
 *
 * For 10,000 candidates:
 * - Processes in chunks of 1000
 * - Early rejection filters out incompatible pairs
 * - Only scores viable candidates
 * - Updates progress during processing
 */
export declare function matchOneToManyOptimized(source: VedicPerson, targets: VedicPerson[], options?: MatchOneToManyOptions): MatchOneToManyResult;
/**
 * Legacy function - kept for backward compatibility
 * Now uses optimized version internally
 */
export declare function matchOneToMany(source: VedicPerson, targets: VedicPerson[]): {
    target_id: string;
    scores: KootaScoreBreakdown;
}[];
export interface MatchManyToManyOptions {
    chunkSize?: number;
    minScore?: number;
    onProgress?: (processed: number, total: number) => void;
}
/**
 * Optimized many-to-many matching with chunking.
 *
 * For 1000x1000 matrix:
 * - Processes in chunks to avoid memory issues
 * - Early rejection before full scoring
 * - Progress tracking
 */
export declare function matchManyToManyOptimized(groupA: VedicPerson[], groupB: VedicPerson[], options?: MatchManyToManyOptions): {
    a_id: string;
    b_id: string;
    scores: KootaScoreBreakdown;
}[];
/**
 * Legacy function - kept for backward compatibility
 */
export declare function matchManyToMany(groupA: VedicPerson[], groupB: VedicPerson[]): {
    a_id: string;
    b_id: string;
    scores: KootaScoreBreakdown;
}[];
/**
 * Stream matches as they're computed (for 10,000+ candidates).
 * Useful for real-time display or saving to database incrementally.
 */
export declare function matchOneToManyStreaming(source: VedicPerson, targets: VedicPerson[], options?: MatchOneToManyOptions): AsyncGenerator<{
    target_id: string;
    scores: KootaScoreBreakdown;
}, void, unknown>;
//# sourceMappingURL=vedic_ashtakoota.batch.optimized.d.ts.map