/**
 * NOTIFICATIONS API ROUTES
 *
 * Handles push notification subscriptions and manual notification triggers.
 */

import { Hono } from 'hono';
import {
  subscribeToNotifications,
  notifyJobComplete,
  getMatchNotificationPreference,
  upsertMatchNotificationPreference,
  DEFAULT_MATCH_NOTIFICATION_PREFERENCE,
  upsertUserPushToken,
} from '../services/notificationService';

const app = new Hono();

function getUserIdFromHeader(c: any): string | null {
  const fromHeader = c.req.header('X-User-Id') || c.req.header('x-user-id');
  return fromHeader ? fromHeader.trim() : null;
}

/**
 * GET /api/notifications/preferences/match
 * Returns current match alert preference for the current user.
 */
app.get('/preferences/match', async (c) => {
  try {
    const userId = getUserIdFromHeader(c);
    if (!userId) {
      return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
    }

    const preference = await getMatchNotificationPreference(userId);

    return c.json({
      success: true,
      preferences: preference || {
        userId,
        ...DEFAULT_MATCH_NOTIFICATION_PREFERENCE,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in GET /notifications/preferences/match:', error);
    return c.json({ success: false, error: error?.message || 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/notifications/preferences/match
 * Updates combined match alert consent/preferences for the current user.
 */
app.put('/preferences/match', async (c) => {
  try {
    const userId = getUserIdFromHeader(c);
    if (!userId) {
      return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
    }

    const body = await c.req.json();
    const {
      enabled,
      source,
      emailEnabled,
      pushEnabled,
      pushToken,
      tokenType,
      platform,
    } = body || {};

    if (typeof enabled !== 'boolean') {
      return c.json({ success: false, error: 'Missing or invalid `enabled` (boolean)' }, 400);
    }

    const preference = await upsertMatchNotificationPreference({
      userId,
      enabled,
      source: typeof source === 'string' ? source : null,
      emailEnabled: typeof emailEnabled === 'boolean' ? emailEnabled : undefined,
      pushEnabled: typeof pushEnabled === 'boolean' ? pushEnabled : undefined,
      markAsked: true,
      pushToken: typeof pushToken === 'string' ? pushToken : undefined,
      tokenType: tokenType === 'apns' || tokenType === 'fcm' ? tokenType : 'expo',
      platform: platform === 'android' || platform === 'web' ? platform : 'ios',
    });

    if (!preference) {
      return c.json({ success: false, error: 'Failed to save preferences' }, 500);
    }

    return c.json({ success: true, preferences: preference });
  } catch (error: any) {
    console.error('❌ Error in PUT /notifications/preferences/match:', error);
    return c.json({ success: false, error: error?.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /api/notifications/push-token
 * Store/update push token for current user.
 */
app.post('/push-token', async (c) => {
  try {
    const userId = getUserIdFromHeader(c);
    if (!userId) {
      return c.json({ success: false, error: 'Missing X-User-Id header' }, 401);
    }

    const body = await c.req.json();
    const { pushToken, tokenType, platform } = body || {};

    if (!pushToken || typeof pushToken !== 'string') {
      return c.json({ success: false, error: 'Missing pushToken' }, 400);
    }

    const success = await upsertUserPushToken({
      userId,
      pushToken,
      tokenType: tokenType === 'apns' || tokenType === 'fcm' ? tokenType : 'expo',
      platform: platform === 'android' || platform === 'web' ? platform : 'ios',
    });

    return c.json({ success });
  } catch (error: any) {
    console.error('❌ Error in POST /notifications/push-token:', error);
    return c.json({ success: false, error: error?.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /api/notifications/subscribe
 * Subscribe to notifications for a job
 */
app.post('/subscribe', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, jobId, pushToken, email, pushEnabled, emailEnabled } = body;

    if (!userId || !jobId) {
      return c.json({ success: false, error: 'Missing userId or jobId' }, 400);
    }

    const success = await subscribeToNotifications(userId, jobId, {
      pushToken,
      email,
      pushEnabled: pushEnabled !== false,
      emailEnabled: emailEnabled !== false,
    });

    return c.json({ success });
  } catch (error: any) {
    console.error('❌ Error in /notifications/subscribe:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/notifications/send
 * Manually trigger notifications for a job (admin/testing)
 */
app.post('/send', async (c) => {
  try {
    const body = await c.req.json();
    const { jobId, personName, systemName, type } = body;

    if (!jobId) {
      return c.json({ success: false, error: 'Missing jobId' }, 400);
    }

    const result = await notifyJobComplete(jobId, { personName, systemName, type });

    return c.json({
      success: true,
      pushCount: result.pushCount,
      emailCount: result.emailCount,
    });
  } catch (error: any) {
    console.error('❌ Error in /notifications/send:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
