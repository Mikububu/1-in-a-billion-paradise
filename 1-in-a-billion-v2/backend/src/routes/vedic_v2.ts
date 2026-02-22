import { Hono } from 'hono';
import {
    VedicPersonVector,
    matchVedicPair,
    matchBatch
} from '../services/vedic/vedic_ashtakoota.vectorized.engine';

const vedicV2 = new Hono();

// Helper: Assert vector shape
function assertVedicVector(v: any): asserts v is VedicPersonVector {
    if (!v || typeof v !== 'object') throw new Error('Invalid vector');
    if (typeof v.gender !== 'number' || ![0, 1].includes(v.gender))
        throw new Error('gender must be 0 or 1');

    if (![
        'moon_rashi', 'moon_nakshatra', 'gana', 'yoni',
        'mars_house', 'seventh_house_ruler', 'dasha_lord', 'mahadasha_index'
    ].every(f => typeof v[f] === 'number')) {
        throw new Error('All vector fields must be numbers');
    }
}

/**
 * POST /api/vedic/match
 * Matches two profiles.
 */
vedicV2.post('/match', async (c) => {
    try {
        const body = await c.req.json();
        const { person_a, person_b } = body;

        assertVedicVector(person_a);
        assertVedicVector(person_b);

        const result = matchVedicPair(person_a, person_b);

        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

/**
 * POST /api/vedic/match/batch
 * One-to-many matching
 * Payload: { source: VedicPersonVector, targets: VedicPersonVector[] }
 */
vedicV2.post('/match/batch', async (c) => {
    try {
        const body = await c.req.json();
        const { source, targets } = body;

        if (!source) throw new Error('source required');
        if (!Array.isArray(targets)) throw new Error('targets must be an array');

        assertVedicVector(source);
        targets.forEach(assertVedicVector);

        const results = matchBatch(source, targets);

        return c.json({ results });
    } catch (e: any) {
        return c.json({ error: e.message }, 400);
    }
});

/**
 * GET /api/vedic/health
 */
vedicV2.get('/health', (c) => {
    return c.json({ status: 'ok', engine: 'vectorized-spec-v2' });
});

export default vedicV2;
