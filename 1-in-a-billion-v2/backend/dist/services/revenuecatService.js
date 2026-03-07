"use strict";
/**
 * REVENUECAT SERVICE (Test V2)
 *
 * Handles RevenueCat webhooks and syncs subscription state to user_subscriptions.
 * Uses same table as legacy Stripe; RevenueCat rows use stripe_subscription_id = 'rc_' + transaction_id.
 *
 * Env: REVENUECAT_SECRET_KEY (test secret key from RevenueCat dashboard - used to verify webhook Authorization header).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRevenueCatSecretKey = getRevenueCatSecretKey;
exports.verifyRevenueCatWebhookAuth = verifyRevenueCatWebhookAuth;
exports.resolveSubscriptionTier = resolveSubscriptionTier;
exports.upsertRevenueCatSubscriptionToSupabase = upsertRevenueCatSubscriptionToSupabase;
exports.handleRevenueCatEvent = handleRevenueCatEvent;
const supabaseClient_1 = require("./supabaseClient");
const apiKeys_1 = require("./apiKeys");
const crypto_1 = require("crypto");
/**
 * Get RevenueCat secret key (for webhook Authorization: Bearer <key>).
 * Test V2: use test secret key from RevenueCat dashboard.
 */
async function getRevenueCatSecretKey() {
    const fromApiKeys = await (0, apiKeys_1.getApiKey)('revenuecat_secret');
    const fromEnv = process.env.REVENUECAT_SECRET_KEY;
    return fromApiKeys || fromEnv || null;
}
/**
 * Verify webhook request: RevenueCat sends Authorization: Bearer <secret_key>.
 */
async function verifyRevenueCatWebhookAuth(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return false;
    const token = authHeader.slice(7).trim();
    const secret = await getRevenueCatSecretKey();
    if (!secret || !token)
        return false;
    try {
        const tokenBuf = Buffer.from(token);
        const secretBuf = Buffer.from(secret);
        if (tokenBuf.length !== secretBuf.length)
            return false;
        return (0, crypto_1.timingSafeEqual)(tokenBuf, secretBuf);
    }
    catch {
        return false;
    }
}
/**
 * Map a RevenueCat product_id to a subscription tier.
 * Add new product IDs here as they are created in RevenueCat / App Store Connect.
 */
function resolveSubscriptionTier(productId) {
    // NOTE: "yearly_subscription" is a MONTHLY $40 subscription (Expansion tier).
    // The product ID is locked in App Store Connect and cannot be renamed.
    if (!productId)
        return 'basic'; // safest default — lowest tier
    const pid = productId.toLowerCase();
    // Billionaire tier identifiers (match generously)
    if (pid.includes('billionaire') || pid.includes('10008') || pid.includes('whale')) {
        return 'billionaire';
    }
    // Expansion tier — product ID says "yearly" but it's actually monthly $40
    if (pid.includes('yearly') || pid.includes('year') || pid.includes('expansion')) {
        return 'yearly';
    }
    // Everything else defaults to basic (cheapest tier)
    return 'basic';
}
/**
 * Upsert subscription from RevenueCat event into user_subscriptions.
 * Uses stripe_subscription_id = 'rc_' + transaction_id for uniqueness.
 */
async function upsertRevenueCatSubscriptionToSupabase(params) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return;
    const toTs = (ms) => typeof ms === 'number' ? new Date(ms).toISOString() : null;
    const rcSubscriptionId = 'rc_' + params.transactionId;
    const rcCustomerId = 'rc_' + params.appUserId;
    const tier = resolveSubscriptionTier(params.productId);
    const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
        user_id: params.appUserId || null,
        email: null,
        stripe_customer_id: rcCustomerId,
        stripe_subscription_id: rcSubscriptionId,
        stripe_price_id: params.productId || null,
        status: params.status,
        subscription_tier: tier,
        cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
        current_period_start: toTs(params.purchasedAtMs ?? null),
        current_period_end: toTs(params.currentPeriodEndMs ?? null),
        metadata: params.metadata || {},
        updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' });
    if (error) {
        console.error('❌ Failed to upsert user_subscriptions (RevenueCat):', error);
    }
    else {
        console.log(`✅ RevenueCat subscription upserted: ${params.appUserId} -> ${params.status} (tier: ${tier})`);
    }
}
/**
 * Handle a single RevenueCat webhook event (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc.).
 */
async function handleRevenueCatEvent(event) {
    const type = event.type;
    const appUserId = event.app_user_id ?? event.original_app_user_id;
    const transactionId = event.transaction_id ?? event.id;
    if (!appUserId || !transactionId) {
        console.warn('⚠️ RevenueCat webhook missing app_user_id or transaction_id', { type, id: event.id });
        return;
    }
    const productId = event.product_id ?? null;
    const purchasedAtMs = event.purchased_at_ms ?? null;
    const expirationAtMs = event.expiration_at_ms ?? null;
    const metadata = {
        store: event.store,
        environment: event.environment,
        type,
        event_id: event.id,
    };
    switch (type) {
        case 'TEST':
            console.log('✅ RevenueCat TEST webhook received');
            return;
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
        case 'TEMPORARY_ENTITLEMENT_GRANT':
        case 'UNCANCELLATION':
        case 'SUBSCRIPTION_EXTENDED':
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'active',
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata,
            });
            return;
        case 'CANCELLATION':
            // User cancelled but retains access until period ends
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'active',
                cancelAtPeriodEnd: true,
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata: { ...metadata, cancel_reason: event.cancel_reason },
            });
            return;
        case 'EXPIRATION':
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'expired',
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata: { ...metadata, expiration_reason: event.expiration_reason },
            });
            return;
        case 'BILLING_ISSUE':
            // Keep active during grace period but flag the issue
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'active',
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata: { ...metadata, billing_issue: true },
            });
            return;
        case 'SUBSCRIPTION_PAUSED':
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'expired',
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata,
            });
            return;
        case 'PRODUCT_CHANGE':
            // Update product ID so tier resolves correctly
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'active',
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata,
            });
            return;
        case 'NON_RENEWING_PURCHASE':
            await upsertRevenueCatSubscriptionToSupabase({
                appUserId,
                transactionId,
                productId,
                status: 'active',
                currentPeriodEndMs: expirationAtMs,
                purchasedAtMs,
                metadata,
            });
            return;
        default:
            console.log(`ℹ️ RevenueCat unhandled event type: ${type}`);
    }
}
//# sourceMappingURL=revenuecatService.js.map