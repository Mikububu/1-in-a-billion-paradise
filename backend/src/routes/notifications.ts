/**
 * NOTIFICATIONS API ROUTES
 * 
 * Handles push notification subscriptions and manual notification triggers.
 */

import { Hono } from 'hono';
import { subscribeToNotifications, notifyJobComplete } from '../services/notificationService';

const app = new Hono();

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
