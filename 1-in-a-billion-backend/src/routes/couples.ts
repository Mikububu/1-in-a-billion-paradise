/**
 * COUPLE ROUTES
 * 
 * Handles couple claymation image generation for matched pairs and synastry readings.
 */

import { Hono } from 'hono';
import { getCoupleImage } from '../services/coupleImageService';

const router = new Hono();

/**
 * GET /api/couples/health
 * Simple health check to verify deploy includes this router.
 */
router.get('/health', (c) => c.json({ ok: true }));

/**
 * POST /api/couples/image
 * 
 * Generate or retrieve couple claymation image
 * 
 * Body:
 * - person1Id: Person 1 client_person_id
 * - person2Id: Person 2 client_person_id
 * - claymation1Url: Person 1 claymation URL
 * - claymation2Url: Person 2 claymation URL
 * - forceRegenerate: Optional - regenerate even if exists
 * 
 * Headers:
 * - X-User-Id: Required - User ID
 */
router.post('/image', async (c) => {
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
  }

  try {
    const body = await c.req.json();
    const { person1Id, person2Id, claymation1Url, claymation2Url, forceRegenerate } = body;

    if (!person1Id || !person2Id || !claymation1Url || !claymation2Url) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields: person1Id, person2Id, claymation1Url, claymation2Url' 
      }, 400);
    }

    console.log(`👫 [Couples] Generating/retrieving couple image for ${person1Id} + ${person2Id}...`);

    const result = await getCoupleImage(
      userId,
      person1Id,
      person2Id,
      claymation1Url,
      claymation2Url,
      forceRegenerate || false
    );

    return c.json(result);

  } catch (error: any) {
    console.error('❌ [Couples] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default router;
