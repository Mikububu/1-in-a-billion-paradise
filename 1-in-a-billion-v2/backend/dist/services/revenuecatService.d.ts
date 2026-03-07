/**
 * REVENUECAT SERVICE (Test V2)
 *
 * Handles RevenueCat webhooks and syncs subscription state to user_subscriptions.
 * Uses same table as legacy Stripe; RevenueCat rows use stripe_subscription_id = 'rc_' + transaction_id.
 *
 * Env: REVENUECAT_SECRET_KEY (test secret key from RevenueCat dashboard - used to verify webhook Authorization header).
 */
export type RevenueCatEventType = 'TEST' | 'INITIAL_PURCHASE' | 'RENEWAL' | 'CANCELLATION' | 'EXPIRATION' | 'UNCANCELLATION' | 'NON_RENEWING_PURCHASE' | 'SUBSCRIPTION_PAUSED' | 'BILLING_ISSUE' | 'PRODUCT_CHANGE' | 'SUBSCRIPTION_EXTENDED' | 'TEMPORARY_ENTITLEMENT_GRANT' | string;
export interface RevenueCatWebhookEvent {
    type: RevenueCatEventType;
    id: string;
    app_user_id?: string;
    original_app_user_id?: string;
    product_id?: string;
    entitlement_ids?: string[] | null;
    purchased_at_ms?: number;
    expiration_at_ms?: number | null;
    event_timestamp_ms?: number;
    store?: string;
    environment?: string;
    cancel_reason?: string;
    expiration_reason?: string;
    transaction_id?: string;
    original_transaction_id?: string;
    [key: string]: unknown;
}
export interface RevenueCatWebhookBody {
    api_version: string;
    event: RevenueCatWebhookEvent;
}
/**
 * Get RevenueCat secret key (for webhook Authorization: Bearer <key>).
 * Test V2: use test secret key from RevenueCat dashboard.
 */
export declare function getRevenueCatSecretKey(): Promise<string | null>;
/**
 * Verify webhook request: RevenueCat sends Authorization: Bearer <secret_key>.
 */
export declare function verifyRevenueCatWebhookAuth(authHeader: string | undefined): Promise<boolean>;
/**
 * Subscription tier - derived from RevenueCat product_id.
 * basic  = monthly plan
 * yearly = yearly plan (default)
 * billionaire = billionaire plan (unlimited readings, no IAP)
 */
export type SubscriptionTier = 'basic' | 'yearly' | 'billionaire';
/**
 * Map a RevenueCat product_id to a subscription tier.
 * Add new product IDs here as they are created in RevenueCat / App Store Connect.
 */
export declare function resolveSubscriptionTier(productId: string | null | undefined): SubscriptionTier;
/**
 * Upsert subscription from RevenueCat event into user_subscriptions.
 * Uses stripe_subscription_id = 'rc_' + transaction_id for uniqueness.
 */
export declare function upsertRevenueCatSubscriptionToSupabase(params: {
    appUserId: string;
    transactionId: string;
    productId?: string | null;
    status: 'active' | 'cancelled' | 'expired';
    cancelAtPeriodEnd?: boolean;
    currentPeriodEndMs?: number | null;
    purchasedAtMs?: number | null;
    metadata?: Record<string, unknown>;
}): Promise<void>;
/**
 * Handle a single RevenueCat webhook event (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc.).
 */
export declare function handleRevenueCatEvent(event: RevenueCatWebhookEvent): Promise<void>;
//# sourceMappingURL=revenuecatService.d.ts.map