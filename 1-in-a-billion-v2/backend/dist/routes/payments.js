"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const revenuecatService_1 = require("../services/revenuecatService");
const subscriptionService_1 = require("../services/subscriptionService");
const supabaseClient_1 = require("../services/supabaseClient");
const env_1 = require("../config/env");
const requireAuth_1 = require("../middleware/requireAuth");
const payments = new hono_1.Hono();
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
        const valid = await (0, revenuecatService_1.verifyRevenueCatWebhookAuth)(authHeader);
        if (!valid) {
            console.warn('⚠️ RevenueCat webhook: invalid or missing Authorization');
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const body = (await c.req.json());
        const event = body?.event;
        if (!event || !body.api_version) {
            return c.json({ success: false, error: 'Invalid payload' }, 400);
        }
        console.log(`📨 RevenueCat webhook: ${event.type} (${event.id})`);
        await (0, revenuecatService_1.handleRevenueCatEvent)(event);
        return c.json({ received: true });
    }
    catch (error) {
        console.error('❌ RevenueCat webhook error:', error);
        return c.json({ success: false, error: error?.message ?? 'Webhook failed' }, 400);
    }
});
// ─────────────────────────────────────────────────────────────────
// Helper: extract verified userId from Bearer <supabase access token>
// ─────────────────────────────────────────────────────────────────
async function getAuthUserId(c) {
    const auth = c.req.header('Authorization') || c.req.header('authorization');
    if (!auth)
        return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m)
        return null;
    const userClient = (0, supabaseClient_1.createSupabaseUserClientFromAccessToken)(m[1]);
    if (!userClient)
        return null;
    const { data: { user }, error } = await userClient.auth.getUser(m[1]);
    if (error || !user)
        return null;
    return user.id;
}
/**
 * GET /api/payments/included-reading-status
 * Check if authenticated user can claim their free included reading.
 * Requires Authorization: Bearer <supabase access token>
 */
payments.get('/included-reading-status', async (c) => {
    try {
        const userId = await getAuthUserId(c);
        if (!userId) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const quota = await (0, subscriptionService_1.getMonthlyQuotaStatus)(userId);
        if (!quota) {
            return c.json({ success: true, eligible: false, quota: null });
        }
        return c.json({
            success: true,
            eligible: quota.canStartReading,
            quota: {
                tier: quota.tier,
                monthlyLimit: quota.monthlyLimit,
                used: quota.used,
                remaining: quota.remaining,
                canStartReading: quota.canStartReading,
                canStartSynastry: quota.canStartSynastry,
                periodStart: quota.periodStart,
                periodEnd: quota.periodEnd,
            },
        });
    }
    catch (error) {
        console.error('❌ included-reading-status error:', error);
        return c.json({ success: false, error: error?.message ?? 'Check failed' }, 500);
    }
});
/**
 * POST /api/payments/verify-entitlement
 * Verify that a RevenueCat app_user_id has an active subscription.
 * Body: { appUserId: string }
 */
payments.post('/verify-entitlement', requireAuth_1.requireAuth, async (c) => {
    try {
        const { appUserId } = (await c.req.json());
        if (!appUserId) {
            return c.json({ success: false, error: 'Missing appUserId' }, 400);
        }
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
            return c.json({ success: false, error: 'Supabase not configured' }, 500);
        }
        const serviceClient = createClient(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_SERVICE_ROLE_KEY);
        // Look up active subscription by Supabase user_id (appUserId IS the Supabase UUID).
        const { data, error } = await serviceClient
            .from('user_subscriptions')
            .select('id, status, current_period_end')
            .eq('user_id', appUserId)
            .eq('status', 'active')
            .limit(1);
        if (error) {
            console.error('verify-entitlement DB error:', error);
        }
        const sub = data?.[0];
        let active = false;
        if (sub) {
            if (sub.current_period_end) {
                const expiresAt = new Date(sub.current_period_end).getTime();
                active = expiresAt > Date.now();
            }
            else {
                active = true;
            }
        }
        return c.json({ success: true, active, entitled: active, appUserId });
    }
    catch (error) {
        console.error('❌ verify-entitlement error:', error);
        return c.json({ success: false, error: error?.message ?? 'Verification failed' }, 500);
    }
});
/**
 * POST /api/payments/link-app-user
 * Link a RevenueCat anonymous app_user_id to the authenticated Supabase user.
 * Requires Authorization: Bearer <supabase access token>
 * Body: { previousAppUserId: string }
 */
payments.post('/link-app-user', async (c) => {
    try {
        const userId = await getAuthUserId(c);
        if (!userId) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const { previousAppUserId } = (await c.req.json());
        if (!previousAppUserId) {
            return c.json({ success: false, error: 'Missing previousAppUserId' }, 400);
        }
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
            return c.json({ success: false, error: 'Supabase not configured' }, 500);
        }
        const serviceClient = createClient(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_SERVICE_ROLE_KEY);
        const rcCustomerId = `rc_${previousAppUserId}`;
        // Idempotency guard: check if already linked to a different user
        const { data: existing } = await serviceClient
            .from('user_subscriptions')
            .select('id, user_id')
            .eq('stripe_customer_id', rcCustomerId)
            .limit(1);
        const row = existing?.[0];
        if (row?.user_id && row.user_id !== userId) {
            console.warn(`⚠️ link-app-user: subscription already linked to ${row.user_id}, rejecting link to ${userId}`);
            return c.json({ success: false, error: 'Subscription already linked to another account' }, 409);
        }
        const { error } = await serviceClient
            .from('user_subscriptions')
            .update({
            user_id: userId,
            updated_at: new Date().toISOString(),
        })
            .eq('stripe_customer_id', rcCustomerId);
        if (error) {
            console.error('link-app-user DB error:', error);
            return c.json({ success: false, error: 'Failed to link user' }, 500);
        }
        console.log(`✅ Linked RevenueCat app_user ${previousAppUserId} → Supabase user ${userId}`);
        return c.json({ success: true, linked: true });
    }
    catch (error) {
        console.error('❌ link-app-user error:', error);
        return c.json({ success: false, error: error?.message ?? 'Linking failed' }, 500);
    }
});
/**
 * GET /api/payments/subscription-tier
 * Returns the user's subscription tier and whether they have unlimited readings.
 * Requires Authorization: Bearer <supabase access token>
 */
payments.get('/subscription-tier', async (c) => {
    try {
        const userId = await getAuthUserId(c);
        if (!userId) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const tier = await (0, subscriptionService_1.getUserSubscriptionTier)(userId);
        const unlimited = await (0, subscriptionService_1.hasUnlimitedReadings)(userId);
        const quota = await (0, subscriptionService_1.getMonthlyQuotaStatus)(userId);
        return c.json({
            success: true,
            tier, // 'basic' | 'yearly' | 'billionaire' | null
            unlimitedReadings: unlimited,
            includedReadingEligible: quota?.canStartReading ?? false,
            quota: quota ? {
                monthlyLimit: quota.monthlyLimit,
                used: quota.used,
                remaining: quota.remaining,
                canStartReading: quota.canStartReading,
                canStartSynastry: quota.canStartSynastry,
            } : null,
        });
    }
    catch (error) {
        console.error('❌ subscription-tier error:', error);
        return c.json({ success: false, error: error?.message ?? 'Check failed' }, 500);
    }
});
/**
 * POST /api/payments/activate-bypass
 * Creates a subscription record for ILOVEYOU bypass users.
 * This ensures bypass users have a real user_subscriptions row so all
 * downstream entitlement checks (RootNavigator, VoiceSelection, etc.) pass.
 * Requires Authorization: Bearer <supabase access token>
 * Idempotent: if an active subscription already exists, returns success without creating a duplicate.
 */
payments.post('/activate-bypass', async (c) => {
    try {
        const userId = await getAuthUserId(c);
        if (!userId) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        if (!env_1.env.SUPABASE_URL || !env_1.env.SUPABASE_SERVICE_ROLE_KEY) {
            return c.json({ success: false, error: 'Supabase not configured' }, 500);
        }
        const serviceClient = createClient(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_SERVICE_ROLE_KEY);
        // Idempotency: check if user already has an active subscription
        const { data: existing } = await serviceClient
            .from('user_subscriptions')
            .select('id, status')
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1);
        if (existing && existing.length > 0) {
            console.log(`✅ activate-bypass: user ${userId} already has active subscription, skipping`);
            return c.json({ success: true, alreadyActive: true });
        }
        // Create a bypass subscription record — billionaire tier, 1 year expiry
        const now = new Date();
        const oneYearLater = new Date(now);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        const { error: insertError } = await serviceClient
            .from('user_subscriptions')
            .insert({
            user_id: userId,
            stripe_customer_id: `bypass_${userId}`,
            stripe_subscription_id: `bypass_sub_${userId}_${Date.now()}`,
            status: 'active',
            plan_id: 'billionaire',
            current_period_start: now.toISOString(),
            current_period_end: oneYearLater.toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });
        if (insertError) {
            console.error('❌ activate-bypass insert error:', insertError);
            return c.json({ success: false, error: 'Failed to create bypass subscription' }, 500);
        }
        console.log(`✅ activate-bypass: created billionaire subscription for user ${userId}`);
        return c.json({ success: true, tier: 'billionaire' });
    }
    catch (error) {
        console.error('❌ activate-bypass error:', error);
        return c.json({ success: false, error: error?.message ?? 'Bypass activation failed' }, 500);
    }
});
exports.default = payments;
//# sourceMappingURL=payments.js.map