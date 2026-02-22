/**
 * STRIPE PAYMENT SERVICE
 * 
 * Handles payment processing for 1 in a Billion app.
 * 
 * IMPORTANT: No refunds policy - all sales final.
 * If technical issues occur, manual fix is offered (not refund).
 * 
 * Support: contact@1-in-a-billion.app
 */

import Stripe from 'stripe';
import { getApiKey } from './apiKeys';
import { createSupabaseServiceClient } from './supabaseClient';

// Product prices in cents (USD)
export const PRODUCT_PRICES: Record<string, number> = {
  single_system: 1299,        // $12.99
  complete_reading: 4999,     // $49.99
  compatibility_overlay: 1999, // $19.99
  nuclear_package: 9999,      // $99.99
};

// Subscription product (yearly) is managed in Stripe dashboard and referenced by price id.
// We do NOT hardcode amount here; Stripe is source-of-truth.

// Stripe instance (lazy initialized)
let stripeInstance: Stripe | null = null;

/**
 * Get or create Stripe instance
 */
async function getStripe(): Promise<Stripe> {
  if (stripeInstance) return stripeInstance;
  
  const secretKey = await getApiKey('stripe');
  if (!secretKey) {
    throw new Error('Stripe API key not configured');
  }
  
  stripeInstance = new Stripe(secretKey, {
    // @ts-ignore - Using latest stable API version
    apiVersion: '2025-12-15.clover',
    typescript: true,
  });
  
  return stripeInstance;
}

/**
 * Create a PaymentIntent for a product purchase
 */
export async function createPaymentIntent(params: {
  productId: string;
  userId: string;
  systemId?: string; // For single system purchases
  personId?: string;
  partnerId?: string;
  readingType?: 'individual' | 'overlay';
  metadata?: Record<string, string>;
}): Promise<{
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
}> {
  const stripe = await getStripe();
  
  const { productId, userId, systemId, personId, partnerId, readingType, metadata = {} } = params;
  
  // Get price for product
  const amount = PRODUCT_PRICES[productId];
  if (!amount) {
    throw new Error(`Invalid product ID: ${productId}`);
  }
  
  // Create PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true, // Enables Apple Pay, Google Pay, Cards
    },
    metadata: {
      userId,
      productId,
      systemId: systemId || '',
      personId: personId || '',
      partnerId: partnerId || '',
      readingType: readingType || '',
      app: '1-in-a-billion',
      ...metadata,
    },
    // Statement descriptor shown on card statements
    statement_descriptor_suffix: '1INABILLION',
    // Receipt email - will be sent by Stripe
    receipt_email: metadata.userEmail || undefined,
  });
  
  console.log(`💳 Created PaymentIntent ${paymentIntent.id} for ${productId} - $${amount / 100}`);
  
  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    amount,
  };
}

/**
 * Verify webhook signature from Stripe
 */
export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Promise<Stripe.Event> {
  const stripe = await getStripe();
  
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Handle successful payment - record purchase and trigger job
 */
export async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const { userId, productId, systemId, personId, partnerId, readingType } = paymentIntent.metadata;
  
  console.log(`✅ Payment successful: ${paymentIntent.id} for user ${userId}, product ${productId}`);
  
  // Record purchase in database
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.error('❌ Supabase not configured - cannot record purchase');
    return;
  }
  
  // Insert purchase record
  const { error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      payment_intent_id: paymentIntent.id,
      product_id: productId,
      system_id: systemId || null,
      person_id: personId || null,
      partner_id: partnerId || null,
      reading_type: readingType || null,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'completed',
      // Stripe API versions may not include expanded charges array; prefer latest_charge if present.
      stripe_receipt_url: (paymentIntent as any).latest_charge ? String((paymentIntent as any).latest_charge) : null,
    });
  
  if (purchaseError) {
    console.error('❌ Failed to record purchase:', purchaseError);
    // Don't throw - payment succeeded, we just failed to record it
    // This can be reconciled later from Stripe dashboard
  } else {
    console.log(`✅ Purchase recorded for user ${userId}`);
  }
}

/**
 * Get Stripe publishable key for frontend
 */
export async function getPublishableKey(): Promise<string> {
  // Publishable key is safe to expose to frontend, but must match the secret key mode (test vs live).
  // Prefer Supabase api_keys table for consistency across deployments.
  const fromSupabase = await getApiKey('stripe_publishable');
  const fromEnv = process.env.STRIPE_PUBLISHABLE_KEY;
  const key = (fromSupabase || fromEnv || '').trim();
  if (!key) throw new Error('Stripe publishable key not configured');
  return key;
}

/**
 * Retrieve payment intent status
 */
export async function getPaymentIntentStatus(paymentIntentId: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
}> {
  const stripe = await getStripe();
  
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  return {
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    metadata: paymentIntent.metadata as Record<string, string>,
  };
}

/**
 * Create a yearly subscription (default: $9.90/year price configured in Stripe).
 * Returns:
 * - PaymentIntent client_secret from latest_invoice to be used with PaymentSheet
 * - customerId + ephemeralKeySecret for PaymentSheet customer context
 */
export async function createYearlySubscription(params: {
  userId: string; // may be 'anonymous' pre-signup
  userEmail?: string;
  metadata?: Record<string, string>;
}): Promise<{
  customerId: string;
  ephemeralKeySecret: string;
  subscriptionId: string;
  paymentIntentClientSecret: string;
  priceId: string;
}> {
  const stripe = await getStripe();
  const priceId =
    (await getApiKey('stripe_subscription_price_id')) ||
    process.env.STRIPE_SUBSCRIPTION_PRICE_ID ||
    '';

  if (!priceId) {
    throw new Error('Stripe subscription price id not configured (STRIPE_SUBSCRIPTION_PRICE_ID)');
  }

  const customer = await stripe.customers.create({
    email: params.userEmail || undefined,
    metadata: {
      userId: params.userId,
      app: '1-in-a-billion',
      ...params.metadata,
    },
  });

  // Ephemeral key for PaymentSheet (must use same API version as stripe SDK)
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    // Keep in sync with Stripe API version in getStripe()
    // @ts-ignore
    { apiVersion: '2025-12-15.clover' }
  );

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      userId: params.userId,
      app: '1-in-a-billion',
      kind: 'yearly_subscription',
      ...params.metadata,
    },
  });

  const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
  const paymentIntentRaw = (latestInvoice as any)?.payment_intent;
  const pi = (typeof paymentIntentRaw === 'string' ? null : (paymentIntentRaw as Stripe.PaymentIntent | null)) || null;
  const clientSecret = pi?.client_secret || null;
  if (!clientSecret) {
    throw new Error('Subscription created but payment_intent client_secret missing');
  }

  return {
    customerId: customer.id,
    ephemeralKeySecret: ephemeralKey.secret || '',
    subscriptionId: subscription.id,
    paymentIntentClientSecret: clientSecret,
    priceId,
  };
}

/**
 * Upsert Stripe subscription state into Supabase.
 */
export async function upsertStripeSubscriptionToSupabase(params: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId?: string | null;
  status: string;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodStart?: number | null; // unix seconds
  currentPeriodEnd?: number | null;   // unix seconds
  userId?: string | null;
  email?: string | null;
  metadata?: Record<string, any> | null;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

  const toTs = (s: number | null | undefined) =>
    typeof s === 'number' ? new Date(s * 1000).toISOString() : null;

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: params.userId || null,
        email: params.email || null,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        stripe_price_id: params.stripePriceId || null,
        status: params.status,
        cancel_at_period_end: params.cancelAtPeriodEnd ?? null,
        current_period_start: toTs(params.currentPeriodStart),
        current_period_end: toTs(params.currentPeriodEnd),
        metadata: params.metadata || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    );

  if (error) {
    console.error('❌ Failed to upsert user_subscriptions:', error);
  }
}
