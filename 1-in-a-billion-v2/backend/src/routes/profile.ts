/**
 * PROFILE ROUTES
 *
 * Handles user profile operations including AI portrait generation.
 */

import { Hono } from 'hono';
import { generateAIPortrait, getAIPortrait } from '../services/aiPortraitService';
import { logCost } from '../services/costTracking';
import { requireAuth, getAuthUserId } from '../middleware/requireAuth';
import { checkUserSubscription } from '../services/subscriptionService';
import { createSupabaseServiceClient } from '../services/supabaseClient';
import type { AppEnv } from '../types/hono';

// Portrait generation limits per tier (free = blocked entirely)
const PORTRAIT_LIMITS: Record<string, number> = {
  basic: 3,
  yearly: 3,
  billionaire: 10,
};

const router = new Hono<AppEnv>();

// All profile routes require authentication
router.use('*', requireAuth);

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

    // ── Subscription gate ────────────────────────────────────────────────────
    // Free users: blocked entirely.
    // basic/yearly: max 3 generations. billionaire: max 10.
    const sub = await checkUserSubscription(userId);
    if (!sub) {
      return c.json({
        success: false,
        error: 'Portrait generation requires a paid subscription.',
        upgradeRequired: true,
      }, 403);
    }

    const limit = PORTRAIT_LIMITS[sub.subscription_tier] ?? 3;

    // ── Check current count ──────────────────────────────────────────────────
    const supabase = createSupabaseServiceClient();
    let currentCount = 0;

    if (supabase) {
      const countQuery = supabase
        .from('library_people')
        .select('portrait_generation_count')
        .eq('user_id', userId);

      const { data: countData } = personId
        ? await countQuery.eq('client_person_id', personId)
        : await countQuery.eq('is_user', true);

      currentCount = (countData?.[0] as any)?.portrait_generation_count ?? 0;

      if (currentCount >= limit) {
        return c.json({
          success: false,
          error: `Portrait limit reached (${currentCount}/${limit}). Upgrade your plan for more.`,
          limitReached: true,
          used: currentCount,
          limit,
        }, 403);
      }
    }

    console.log(`🎨 [Profile] Generating AI portrait for user ${userId} (tier: ${sub.subscription_tier}, ${currentCount}/${limit} used)...`);

    const result = await generateAIPortrait(photoBase64, userId, personId);

    if (result.success) {
      // ── Increment counter ──────────────────────────────────────────────────
      if (supabase) {
        const incrQuery = supabase
          .from('library_people')
          .update({ portrait_generation_count: currentCount + 1 })
          .eq('user_id', userId);

        personId
          ? await incrQuery.eq('client_person_id', personId)
          : await incrQuery.eq('is_user', true);
      }

      if (result.cost) {
        await logCost({
          jobId: personId || `profile-${userId}`,
          provider: 'openai',
          model: 'gpt-4o + dall-e-3',
          costUsd: result.cost,
          label: 'ai_portrait',
        });
      }
    }

    return c.json(result);

  } catch (error: any) {
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
    const imageUrl = await getAIPortrait(userId, personId);
    
    if (imageUrl) {
      return c.json({ success: true, imageUrl });
    } else {
      return c.json({ success: false, error: 'No AI portrait found' }, 404);
    }
  } catch (error: any) {
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
    const imageUrl = await getAIPortrait(userId);
    
    if (imageUrl) {
      return c.json({ success: true, imageUrl });
    } else {
      return c.json({ success: false, error: 'No AI portrait found' }, 404);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default router;
