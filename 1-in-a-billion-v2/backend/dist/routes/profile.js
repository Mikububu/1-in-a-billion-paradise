"use strict";
/**
 * PROFILE ROUTES
 *
 * Handles user profile operations including AI portrait generation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const aiPortraitService_1 = require("../services/aiPortraitService");
const costTracking_1 = require("../services/costTracking");
const requireAuth_1 = require("../middleware/requireAuth");
const router = new hono_1.Hono();
// All profile routes require authentication
router.use('*', requireAuth_1.requireAuth);
/**
 * POST /api/profile/portrait
 *
 * Generate an AI portrait from an uploaded photo.
 *
 * Body:
 * - photoBase64: Base64 encoded JPEG/PNG image
 * - personId: Optional - library_people ID to associate with
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
        console.log(`🎨 [Profile] Generating AI portrait for user ${userId}...`);
        const result = await (0, aiPortraitService_1.generateAIPortrait)(photoBase64, userId, personId);
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