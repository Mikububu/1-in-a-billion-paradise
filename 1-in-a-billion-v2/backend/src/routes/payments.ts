/**
 * PAYMENT ROUTES
 *
 * RevenueCat (Test V2) – in-app subscriptions via Apple/Google.
 * Frontend uses RevenueCat SDK; backend only receives webhooks to sync user_subscriptions.
 *
 * Endpoints:
 * - POST /api/payments/webhook – RevenueCat webhook (Authorization: Bearer <REVENUECAT_SECRET_KEY>)
 * - GET /api/payments/config – Returns provider and environment (no secrets)
 *
 * REFUND POLICY: No refunds. Manual fixes offered for technical issues.
 * Contact: contact@1-in-a-billion.app
 */

import { Hono } from 'hono';
import {
  verifyRevenueCatWebhookAuth,
  handleRevenueCatEvent,
  type RevenueCatWebhookBody,
} from '../services/revenuecatService';

const payments = new Hono();

/**
 * GET /api/payments/config
 * Returns payment provider and environment for frontend (no secrets).
 */
payments.get('/config', async (c) => {
  return c.json({
    success: true,
    provider: 'revenuecat',
    environment: 'test',
    note: 'Subscriptions are managed via RevenueCat (Apple/Google).',
  });
});

/**
 * POST /api/payments/webhook
 * RevenueCat webhook: verify Bearer token, parse body, handle events.
 */
payments.post('/webhook', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const valid = await verifyRevenueCatWebhookAuth(authHeader);
    if (!valid) {
      console.warn('⚠️ RevenueCat webhook: invalid or missing Authorization');
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const body = (await c.req.json()) as RevenueCatWebhookBody;
    const event = body?.event;
    if (!event || !body.api_version) {
      return c.json({ success: false, error: 'Invalid payload' }, 400);
    }

    console.log(`📨 RevenueCat webhook: ${event.type} (${event.id})`);
    await handleRevenueCatEvent(event);

    return c.json({ received: true });
  } catch (error: any) {
    console.error('❌ RevenueCat webhook error:', error);
    return c.json({ success: false, error: error?.message ?? 'Webhook failed' }, 400);
  }
});

export default payments;
