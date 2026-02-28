/**
 * REVENUECAT SERVICE (Test V2)
 *
 * Handles RevenueCat webhooks and syncs subscription state to user_subscriptions.
 * Uses same table as legacy Stripe; RevenueCat rows use stripe_subscription_id = 'rc_' + transaction_id.
 *
 * Env: REVENUECAT_SECRET_KEY (test secret key from RevenueCat dashboard – used to verify webhook Authorization header).
 */

import { createSupabaseServiceClient } from './supabaseClient';
import { getApiKey } from './apiKeys';
import { timingSafeEqual } from 'crypto';

export type RevenueCatEventType =
  | 'TEST'
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TEMPORARY_ENTITLEMENT_GRANT'
  | string;

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
export async function getRevenueCatSecretKey(): Promise<string | null> {
  const fromApiKeys = await getApiKey('revenuecat_secret');
  const fromEnv = process.env.REVENUECAT_SECRET_KEY;
  return fromApiKeys || fromEnv || null;
}

/**
 * Verify webhook request: RevenueCat sends Authorization: Bearer <secret_key>.
 */
export async function verifyRevenueCatWebhookAuth(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const secret = await getRevenueCatSecretKey();
  if (!secret || !token) return false;
  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (tokenBuf.length !== secretBuf.length) return false;
    return timingSafeEqual(tokenBuf, secretBuf);
  } catch {
    return false;
  }
}

/**
 * Upsert subscription from RevenueCat event into user_subscriptions.
 * Uses stripe_subscription_id = 'rc_' + transaction_id for uniqueness.
 */
export async function upsertRevenueCatSubscriptionToSupabase(params: {
  appUserId: string;
  transactionId: string;
  productId?: string | null;
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodEndMs?: number | null;
  purchasedAtMs?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

  const toTs = (ms: number | null | undefined) =>
    typeof ms === 'number' ? new Date(ms).toISOString() : null;

  const rcSubscriptionId = 'rc_' + params.transactionId;
  const rcCustomerId = 'rc_' + params.appUserId;

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: params.appUserId || null,
        email: null,
        stripe_customer_id: rcCustomerId,
        stripe_subscription_id: rcSubscriptionId,
        stripe_price_id: params.productId || null,
        status: params.status,
        cancel_at_period_end: false,
        current_period_start: toTs(params.purchasedAtMs ?? null),
        current_period_end: toTs(params.currentPeriodEndMs ?? null),
        metadata: params.metadata || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    );

  if (error) {
    console.error('❌ Failed to upsert user_subscriptions (RevenueCat):', error);
  } else {
    console.log(`✅ RevenueCat subscription upserted: ${params.appUserId} -> ${params.status}`);
  }
}

/**
 * Handle a single RevenueCat webhook event (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc.).
 */
export async function handleRevenueCatEvent(event: RevenueCatWebhookEvent): Promise<void> {
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
    case 'EXPIRATION':
      await upsertRevenueCatSubscriptionToSupabase({
        appUserId,
        transactionId,
        productId,
        status: type === 'EXPIRATION' ? 'expired' : 'cancelled',
        currentPeriodEndMs: expirationAtMs,
        purchasedAtMs,
        metadata: { ...metadata, cancel_reason: event.cancel_reason, expiration_reason: event.expiration_reason },
      });
      return;

    case 'NON_RENEWING_PURCHASE':
      // One-time purchase – still grant active for entitlement period
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
