"use strict";
/**
 * PROFILE ROUTES
 *
 * Handles user profile operations including AI portrait generation.
 * Enforces a limit of 3 portrait generations per person per calendar month.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const aiPortraitService_1 = require("../services/aiPortraitService");
const costTracking_1 = require("../services/costTracking");
const requireAuth_1 = require("../middleware/requireAuth");
const supabaseClient_1 = require("../services/supabaseClient");
const router = new hono_1.Hono();
const PORTRAIT_MONTHLY_LIMIT = 3;
// All profile routes require authentication
router.use('*', requireAuth_1.requireAuth);
// ═══════════════════════════════════════════════════════════════════════════
// PORTRAIT LIMIT HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Check whether the portrait_generation_count should be reset (new calendar month).
 * If reset is needed, resets the counter in DB and returns 0. Otherwise returns current count.
 */
async function getPortraitCountForPerson(supabase, userId, personId) {
    // Build query to find the person row
    let query = supabase
        .from('library_people')
        .select('portrait_generation_count, portrait_generation_reset_at')
        .eq('user_id', userId);
    if (personId) {
        query = query.eq('client_person_id', personId);
    }
    else {
        query = query.eq('is_user', true);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
        return { count: 0, error: error.message };
    }
    // Person row doesn't exist yet — they haven't been inserted, count is 0
    if (!data) {
        return { count: 0 };
    }
    const currentCount = data.portrait_generation_count || 0;
    const resetAt = data.portrait_generation_reset_at ? new Date(data.portrait_generation_reset_at) : null;
    const now = new Date();
    // Check if we need a monthly reset: different year or month
    const needsReset = !resetAt
        || resetAt.getUTCFullYear() !== now.getUTCFullYear()
        || resetAt.getUTCMonth() !== now.getUTCMonth();
    if (needsReset && currentCount > 0) {
        // Reset the counter in DB
        let resetQuery = supabase
            .from('library_people')
            .update({
            portrait_generation_count: 0,
            portrait_generation_reset_at: now.toISOString(),
        })
            .eq('user_id', userId);
        if (personId) {
            resetQuery = resetQuery.eq('client_person_id', personId);
        }
        else {
            resetQuery = resetQuery.eq('is_user', true);
        }
        await resetQuery;
        return { count: 0 };
    }
    return { count: currentCount };
}
/**
 * Increment the portrait generation counter for a person after successful generation.
 */
async function incrementPortraitCount(supabase, userId, personId) {
    // We use RPC or raw increment. Since Supabase JS doesn't have atomic increment,
    // we read + write. The race window is acceptable for this use case.
    let query = supabase
        .from('library_people')
        .select('portrait_generation_count, portrait_generation_reset_at')
        .eq('user_id', userId);
    if (personId) {
        query = query.eq('client_person_id', personId);
    }
    else {
        query = query.eq('is_user', true);
    }
    const { data } = await query.maybeSingle();
    const currentCount = data?.portrait_generation_count || 0;
    const now = new Date();
    let updateQuery = supabase
        .from('library_people')
        .update({
        portrait_generation_count: currentCount + 1,
        portrait_generation_reset_at: data?.portrait_generation_reset_at || now.toISOString(),
    })
        .eq('user_id', userId);
    if (personId) {
        updateQuery = updateQuery.eq('client_person_id', personId);
    }
    else {
        updateQuery = updateQuery.eq('is_user', true);
    }
    await updateQuery;
}
/**
 * Calculate the next monthly reset date (1st of next month, midnight UTC).
 */
function getNextResetDate() {
    const now = new Date();
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return nextMonth.toISOString();
}
// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * POST /api/profile/portrait
 *
 * Generate an AI portrait from an uploaded photo.
 * Enforces: 3 generations per person per calendar month.
 *
 * Body:
 * - photoBase64: Base64 encoded JPEG/PNG image
 * - personId: Optional - library_people client_person_id to associate with
 *
 * Headers:
 * Requires: Authorization Bearer token
 */
router.post('/portrait', async (c) => {
    const userId = c.get('userId');
    try {
        const body = await c.req.json();
        const { photoBase64, personId } = body;
        if (!photoBase64) {
            return c.json({ success: false, error: 'Missing photoBase64' }, 400);
        }
        if (photoBase64.length < 1000) {
            return c.json({ success: false, error: 'Invalid image data' }, 400);
        }
        // ── Enforce portrait generation limit ──────────────────────────────
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (supabase) {
            const { count, error: countError } = await getPortraitCountForPerson(supabase, userId, personId);
            if (countError) {
                console.warn(`⚠️ [Profile] Could not check portrait limit: ${countError}`);
                // Don't block on read errors — allow the generation
            }
            else if (count >= PORTRAIT_MONTHLY_LIMIT) {
                console.log(`🚫 [Profile] User ${userId} hit portrait limit (${count}/${PORTRAIT_MONTHLY_LIMIT}) for person ${personId || 'self'}`);
                return c.json({
                    success: false,
                    error: 'Monthly portrait limit reached',
                    limitReached: true,
                    used: count,
                    limit: PORTRAIT_MONTHLY_LIMIT,
                    resetsAt: getNextResetDate(),
                }, 429);
            }
        }
        console.log(`🎨 [Profile] Generating AI portrait for user ${userId}...`);
        const result = await (0, aiPortraitService_1.generateAIPortrait)(photoBase64, userId, personId);
        // ── Increment counter on success ──────────────────────────────────
        if (result.success && supabase) {
            await incrementPortraitCount(supabase, userId, personId);
        }
        if (result.success && result.cost) {
            await (0, costTracking_1.logCost)({
                jobId: personId || `profile-${userId}`,
                provider: 'openai',
                model: 'gpt-4o + dall-e-3',
                costUsd: result.cost,
                label: 'ai_portrait',
            });
        }
        return c.json(result);
    }
    catch (error) {
        console.error('❌ [Profile] AI portrait error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
/**
 * GET /api/profile/portrait-limit/:personId
 *
 * Get remaining portrait generations for a specific person.
 * Returns { remaining, limit, used, resetsAt }.
 */
router.get('/portrait-limit/:personId', async (c) => {
    const userId = c.get('userId');
    const personId = c.req.param('personId');
    try {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (!supabase) {
            return c.json({ remaining: PORTRAIT_MONTHLY_LIMIT, limit: PORTRAIT_MONTHLY_LIMIT, used: 0, resetsAt: getNextResetDate() });
        }
        const { count } = await getPortraitCountForPerson(supabase, userId, personId);
        const remaining = Math.max(0, PORTRAIT_MONTHLY_LIMIT - count);
        return c.json({
            remaining,
            limit: PORTRAIT_MONTHLY_LIMIT,
            used: count,
            resetsAt: getNextResetDate(),
        });
    }
    catch (error) {
        return c.json({ remaining: PORTRAIT_MONTHLY_LIMIT, limit: PORTRAIT_MONTHLY_LIMIT, used: 0, resetsAt: getNextResetDate() });
    }
});
/**
 * GET /api/profile/portrait-limit
 *
 * Get remaining portrait generations for the user's own photo.
 */
router.get('/portrait-limit', async (c) => {
    const userId = c.get('userId');
    try {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (!supabase) {
            return c.json({ remaining: PORTRAIT_MONTHLY_LIMIT, limit: PORTRAIT_MONTHLY_LIMIT, used: 0, resetsAt: getNextResetDate() });
        }
        const { count } = await getPortraitCountForPerson(supabase, userId);
        const remaining = Math.max(0, PORTRAIT_MONTHLY_LIMIT - count);
        return c.json({
            remaining,
            limit: PORTRAIT_MONTHLY_LIMIT,
            used: count,
            resetsAt: getNextResetDate(),
        });
    }
    catch (error) {
        return c.json({ remaining: PORTRAIT_MONTHLY_LIMIT, limit: PORTRAIT_MONTHLY_LIMIT, used: 0, resetsAt: getNextResetDate() });
    }
});
/**
 * GET /api/profile/portrait/:personId
 *
 * Get existing AI portrait URL for a person.
 */
router.get('/portrait/:personId', async (c) => {
    const userId = c.get('userId');
    const personId = c.req.param('personId');
    try {
        const imageUrl = await (0, aiPortraitService_1.getAIPortrait)(userId, personId);
        if (imageUrl) {
            return c.json({ success: true, imageUrl });
        }
        else {
            return c.json({ success: false, error: 'No AI portrait found' }, 404);
        }
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
/**
 * GET /api/profile/portrait
 *
 * Get the user's own AI portrait.
 */
router.get('/portrait', async (c) => {
    const userId = c.get('userId');
    try {
        const imageUrl = await (0, aiPortraitService_1.getAIPortrait)(userId);
        if (imageUrl) {
            return c.json({ success: true, imageUrl });
        }
        else {
            return c.json({ success: false, error: 'No AI portrait found' }, 404);
        }
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
exports.default = router;
//# sourceMappingURL=profile.js.map