"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scorePair = scorePair;
exports.fastReject = fastReject;
exports.matchOneToManyOptimized = matchOneToManyOptimized;
exports.matchOneToMany = matchOneToMany;
exports.matchManyToManyOptimized = matchManyToManyOptimized;
exports.matchManyToMany = matchManyToMany;
exports.matchOneToManyStreaming = matchOneToManyStreaming;
const vedic_matchmaking_engine_1 = require("./vedic_matchmaking.engine");
// Configuration
const DEFAULT_CHUNK_SIZE = 1000; // Process 1000 candidates at a time
const MAX_CANDIDATES = 50000; // Hard limit to prevent memory issues
// ===================================
// 1. SINGLE PAIR SCORER (unchanged)
// ===================================
function scorePair(a, b) {
    const varna = (0, vedic_matchmaking_engine_1.scoreVarna)(a, b);
    const vashya = (0, vedic_matchmaking_engine_1.scoreVashya)(a, b);
    const tara = (0, vedic_matchmaking_engine_1.scoreTara)(a, b);
    const yoni = (0, vedic_matchmaking_engine_1.scoreYoni)(a, b);
    const graha_maitri = (0, vedic_matchmaking_engine_1.scoreGrahaMaitri)(a, b);
    const gana = (0, vedic_matchmaking_engine_1.scoreGana)(a, b);
    const bhakoot = (0, vedic_matchmaking_engine_1.scoreBhakoot)(a, b);
    const nadi = (0, vedic_matchmaking_engine_1.scoreNadi)(a, b);
    const total = varna +
        vashya +
        tara +
        yoni +
        graha_maitri +
        gana +
        bhakoot +
        nadi;
    return {
        varna,
        vashya,
        tara,
        yoni,
        graha_maitri,
        gana,
        bhakoot,
        nadi,
        total
    };
}
// ===================================
// 2. FAST REJECTION (early filter)
// ===================================
/**
 * Early rejection before full scoring.
 * Rejects if Nadi is same (0 points) OR Bhakoot is 0 points.
 * This is O(1) and should be checked BEFORE full scoring.
 */
function fastReject(a, b) {
    if (a.nadi === b.nadi)
        return true;
    if ((0, vedic_matchmaking_engine_1.scoreBhakoot)(a, b) === 0)
        return true;
    return false;
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
function matchOneToManyOptimized(source, targets, options = {}) {
    const { chunkSize = DEFAULT_CHUNK_SIZE, minScore = 18, maxResults = 1000, onProgress } = options;
    // Validate input size
    if (targets.length > MAX_CANDIDATES) {
        throw new Error(`Too many candidates: ${targets.length}. Maximum is ${MAX_CANDIDATES}`);
    }
    // Step 1: Fast rejection filter (O(n) but very fast)
    const viable = [];
    let rejected_early = 0;
    for (const candidate of targets) {
        if (fastReject(source, candidate)) {
            rejected_early++;
        }
        else {
            viable.push(candidate);
        }
    }
    // Step 2: Process in chunks to avoid memory issues
    const matches = [];
    const totalViable = viable.length;
    let processed = 0;
    for (let chunkStart = 0; chunkStart < totalViable; chunkStart += chunkSize) {
        const chunkEnd = Math.min(chunkStart + chunkSize, totalViable);
        const chunk = viable.slice(chunkStart, chunkEnd);
        processed = chunkEnd;
        // Process chunk
        for (const candidate of chunk) {
            const scores = scorePair(source, candidate);
            // Only add if meets minimum score
            if (scores.total >= minScore) {
                matches.push({
                    target_id: candidate.id,
                    scores
                });
            }
        }
        // Progress callback
        if (onProgress) {
            onProgress(chunkEnd, totalViable);
        }
        // Early exit if we have enough results
        if (matches.length >= maxResults) {
            break;
        }
    }
    // Step 3: Sort by total score (descending)
    matches.sort((a, b) => b.scores.total - a.scores.total);
    // Step 4: Limit results
    const finalMatches = matches.slice(0, maxResults);
    return {
        matches: finalMatches,
        total_candidates: targets.length,
        rejected_early,
        processed
    };
}
/**
 * Legacy function - kept for backward compatibility
 * Now uses optimized version internally
 */
function matchOneToMany(source, targets) {
    const result = matchOneToManyOptimized(source, targets, {
        minScore: 0, // No filtering
        maxResults: Infinity // Return all
    });
    return result.matches;
}
/**
 * Optimized many-to-many matching with chunking.
 *
 * For 1000x1000 matrix:
 * - Processes in chunks to avoid memory issues
 * - Early rejection before full scoring
 * - Progress tracking
 */
function matchManyToManyOptimized(groupA, groupB, options = {}) {
    const { chunkSize = DEFAULT_CHUNK_SIZE, minScore = 18, onProgress } = options;
    const results = [];
    const totalPairs = groupA.length * groupB.length;
    let processed = 0;
    // Process groupA in chunks
    for (let i = 0; i < groupA.length; i++) {
        const personA = groupA[i];
        // Process groupB in chunks
        for (let j = 0; j < groupB.length; j++) {
            const personB = groupB[j];
            // Early rejection
            if (fastReject(personA, personB)) {
                processed++;
                continue;
            }
            // Score pair
            const scores = scorePair(personA, personB);
            // Only add if meets minimum score
            if (scores.total >= minScore) {
                results.push({
                    a_id: personA.id,
                    b_id: personB.id,
                    scores
                });
            }
            processed++;
            // Progress callback every chunk
            if (onProgress && processed % chunkSize === 0) {
                onProgress(processed, totalPairs);
            }
        }
    }
    // Sort by total score (descending)
    results.sort((a, b) => b.scores.total - a.scores.total);
    return results;
}
/**
 * Legacy function - kept for backward compatibility
 */
function matchManyToMany(groupA, groupB) {
    return matchManyToManyOptimized(groupA, groupB, {
        minScore: 0,
        chunkSize: DEFAULT_CHUNK_SIZE
    });
}
// ===================================
// 5. STREAMING MATCHER (for very large datasets)
// ===================================
/**
 * Stream matches as they're computed (for 10,000+ candidates).
 * Useful for real-time display or saving to database incrementally.
 */
async function* matchOneToManyStreaming(source, targets, options = {}) {
    const { chunkSize = DEFAULT_CHUNK_SIZE, minScore = 18, maxResults = 1000 } = options;
    if (targets.length > MAX_CANDIDATES) {
        throw new Error(`Too many candidates: ${targets.length}. Maximum is ${MAX_CANDIDATES}`);
    }
    // Fast rejection filter
    const viable = targets.filter(candidate => !fastReject(source, candidate));
    let resultCount = 0;
    // Process in chunks
    for (let chunkStart = 0; chunkStart < viable.length; chunkStart += chunkSize) {
        const chunkEnd = Math.min(chunkStart + chunkSize, viable.length);
        const chunk = viable.slice(chunkStart, chunkEnd);
        // Process chunk and yield results
        for (const candidate of chunk) {
            const scores = scorePair(source, candidate);
            if (scores.total >= minScore) {
                yield {
                    target_id: candidate.id,
                    scores
                };
                resultCount++;
                // Stop if we've reached max results
                if (resultCount >= maxResults) {
                    return;
                }
            }
        }
    }
}
//# sourceMappingURL=vedic_ashtakoota.batch.optimized.js.map