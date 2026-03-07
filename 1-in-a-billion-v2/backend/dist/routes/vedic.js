"use strict";
/**
 * VEDIC MATCHMAKING API ROUTES
 *
 * REST endpoints for Jyotish matchmaking computation.
 * Uses verified scoring engine and vectorized tables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const vedic_matchmaking_engine_1 = require("../services/vedic/vedic_matchmaking.engine");
const vedic_ashtakoota_batch_1 = require("../services/vedic/vedic_ashtakoota.batch");
const vedicRoutes = new hono_1.Hono();
// ============================================================================
// 1. ONE-TO-ONE MATCH
// ============================================================================
/**
 * POST /api/vedic/match
 *
 * Compute detailed matchmaking analysis for two individuals.
 *
 * Request Body:
 * {
 *   "person_a": PersonChart,
 *   "person_b": PersonChart
 * }
 *
 * Response:
 * {
 *   "schema_version": "1.0.0",
 *   "ashtakoota": { ... },
 *   "doshas": { ... },
 *   "final_score": { ... }
 * }
 */
vedicRoutes.post('/match', async (c) => {
    try {
        const body = await c.req.json();
        const { person_a, person_b } = body;
        if (!person_a || !person_b) {
            return c.json({ error: 'Missing person_a or person_b' }, 400);
        }
        const result = (0, vedic_matchmaking_engine_1.computeVedicMatch)(person_a, person_b);
        return c.json(result);
    }
    catch (error) {
        console.error('Error in /match:', error);
        return c.json({ error: error.message }, 500);
    }
});
// ============================================================================
// 2. ONE-TO-MANY BATCH MATCH
// ============================================================================
/**
 * POST /api/vedic/match/batch
 *
 * Compute compatibility scores for one person against multiple candidates.
 * Uses fast rejection filtering for efficiency.
 *
 * Request Body:
 * {
 *   "source": VedicPerson,
 *   "candidates": VedicPerson[],
 *   "min_score": number (optional, default 18)
 * }
 *
 * Response:
 * {
 *   "matches": [
 *     {
 *       "target_id": "uuid",
 *       "scores": { varna: 1, vashya: 2, ... total: 28 }
 *     }
 *   ],
 *   "total_candidates": number,
 *   "matches_found": number,
 *   "rejected_early": number
 * }
 */
vedicRoutes.post('/match/batch', async (c) => {
    try {
        const body = await c.req.json();
        const { source, candidates, min_score = 18 } = body;
        if (!source || !candidates || !Array.isArray(candidates)) {
            return c.json({ error: 'Invalid request: source and candidates[] required' }, 400);
        }
        // Validate candidate count
        if (candidates.length > 50000) {
            return c.json({ error: 'Too many candidates. Maximum is 50,000.' }, 400);
        }
        // Fast rejection filter
        const viable = candidates.filter(candidate => !(0, vedic_ashtakoota_batch_1.fastReject)(source, candidate));
        const rejected_early = candidates.length - viable.length;
        // For large batches, limit results to prevent memory issues
        const maxResults = candidates.length > 10000 ? 1000 : Infinity;
        // Score viable candidates
        const results = (0, vedic_ashtakoota_batch_1.matchOneToMany)(source, viable);
        // Filter by minimum score
        let matches = results.filter(r => r.scores.total >= min_score);
        // Sort by total score descending
        matches.sort((a, b) => b.scores.total - a.scores.total);
        // Limit results for very large batches
        if (matches.length > maxResults) {
            matches = matches.slice(0, maxResults);
        }
        return c.json({
            matches,
            total_candidates: candidates.length,
            matches_found: matches.length,
            rejected_early
        });
    }
    catch (error) {
        console.error('Error in /match/batch:', error);
        return c.json({ error: error.message }, 500);
    }
});
// ============================================================================
// 3. QUICK SCORE (Lightweight)
// ============================================================================
/**
 * POST /api/vedic/score
 *
 * Compute only the Ashtakoota score (no detailed breakdown).
 * Optimized for high-throughput ranking.
 *
 * Request Body:
 * {
 *   "person_a": VedicPerson,
 *   "person_b": VedicPerson
 * }
 *
 * Response:
 * {
 *   "total": 28,
 *   "breakdown": { varna: 1, vashya: 2, ... }
 * }
 */
vedicRoutes.post('/score', async (c) => {
    try {
        const body = await c.req.json();
        const { person_a, person_b } = body;
        if (!person_a || !person_b) {
            return c.json({ error: 'Missing person_a or person_b' }, 400);
        }
        const scores = (0, vedic_ashtakoota_batch_1.scorePair)(person_a, person_b);
        return c.json({
            total: scores.total,
            breakdown: scores
        });
    }
    catch (error) {
        console.error('Error in /score:', error);
        return c.json({ error: error.message }, 500);
    }
});
// ============================================================================
// 4. HEALTH CHECK
// ============================================================================
/**
 * GET /api/vedic/health
 *
 * Verify API and computation engine availability.
 */
vedicRoutes.get('/health', (c) => {
    return c.json({
        status: 'ok',
        service: 'vedic-matchmaking-api',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
exports.default = vedicRoutes;
//# sourceMappingURL=vedic.js.map