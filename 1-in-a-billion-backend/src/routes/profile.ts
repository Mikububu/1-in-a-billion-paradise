/**
 * PROFILE ROUTES
 * 
 * Handles user profile operations including claymation portrait generation.
 */

import { Hono } from 'hono';
import { generateClaymationPortrait, getClaymationPortrait } from '../services/claymationService';
import { logCost } from '../services/costTracking';

const router = new Hono();

/**
 * POST /api/profile/claymation
 * 
 * Generate a claymation portrait from an uploaded photo.
 * 
 * Body:
 * - photoBase64: Base64 encoded JPEG/PNG image
 * - personId: Optional - library_people ID to associate with
 * 
 * Headers:
 * - X-User-Id: Required - User ID
 */
router.post('/claymation', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  try {
    const body = await c.req.json();
    const { photoBase64, personId } = body;

    if (!photoBase64) {
      return c.json({ success: false, error: 'Missing photoBase64' }, 400);
    }

    // Validate base64 (basic check)
    if (photoBase64.length < 1000) {
      return c.json({ success: false, error: 'Invalid image data' }, 400);
    }

    console.log(`🎨 [Profile] Generating claymation for user ${userId}...`);

    const result = await generateClaymationPortrait(photoBase64, userId, personId);

    if (result.success && result.cost) {
      // Log the cost
      await logCost({
        jobId: personId || `profile-${userId}`,
        provider: 'openai',
        model: 'gpt-4o + dall-e-3',
        costUsd: result.cost,
        label: 'claymation_portrait',
      });
    }

    return c.json(result);

  } catch (error: any) {
    console.error('❌ [Profile] Claymation error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/profile/claymation/:personId
 * 
 * Get existing claymation portrait URL for a person.
 */
router.get('/claymation/:personId', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  const personId = c.req.param('personId');

  try {
    const imageUrl = await getClaymationPortrait(userId, personId);
    
    if (imageUrl) {
      return c.json({ success: true, imageUrl });
    } else {
      return c.json({ success: false, error: 'No claymation portrait found' }, 404);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/profile/claymation
 * 
 * Get the user's own claymation portrait.
 */
router.get('/claymation', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  try {
    const imageUrl = await getClaymationPortrait(userId);
    
    if (imageUrl) {
      return c.json({ success: true, imageUrl });
    } else {
      return c.json({ success: false, error: 'No claymation portrait found' }, 404);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default router;
