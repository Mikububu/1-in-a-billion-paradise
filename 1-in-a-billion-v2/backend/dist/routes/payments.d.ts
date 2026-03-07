/**
 * PAYMENT ROUTES
 *
 * RevenueCat (Test V2) - in-app subscriptions via Apple/Google.
 * Frontend uses RevenueCat SDK; backend only receives webhooks to sync user_subscriptions.
 *
 * Endpoints:
 * - POST /api/payments/webhook - RevenueCat webhook (Authorization: Bearer <REVENUECAT_SECRET_KEY>)
 * - GET  /api/payments/config - Returns provider and environment (no secrets)
 * - GET  /api/payments/included-reading-status - Check if user can claim free included reading
 * - POST /api/payments/verify-entitlement - Verify subscription entitlement for a RevenueCat app user
 * - POST /api/payments/link-app-user - Link anonymous RevenueCat app_user_id to Supabase user_id
 *
 * REFUND POLICY: No refunds. Manual fixes offered for technical issues.
 * Contact: contact@1-in-a-billion.app
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono';
declare const payments: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default payments;
//# sourceMappingURL=payments.d.ts.map