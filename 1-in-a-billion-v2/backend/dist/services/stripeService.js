"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_PRICES = void 0;
exports.createPaymentIntent = createPaymentIntent;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.handlePaymentSuccess = handlePaymentSuccess;
exports.getPublishableKey = getPublishableKey;
exports.getPaymentIntentStatus = getPaymentIntentStatus;
exports.createYearlySubscription = createYearlySubscription;
exports.upsertStripeSubscriptionToSupabase = upsertStripeSubscriptionToSupabase;
const stripe_1 = __importDefault(require("stripe"));
const apiKeys_1 = require("./apiKeys");
const supabaseClient_1 = require("./supabaseClient");
// Product prices in cents (USD)
exports.PRODUCT_PRICES = {
    single_system: 1299, // $12.99
    complete_reading: 4999, // $49.99
    compatibility_overlay: 1999, // $19.99
    nuclear_package: 9999, // $99.99
};
// Subscription product (yearly) is managed in Stripe dashboard and referenced by price id.
// We do NOT hardcode amount here; Stripe is source-of-truth.
// Stripe instance (lazy initialized)
let stripeInstance = null;
/**
 * Get or create Stripe instance
 */
async function getStripe() {
    if (stripeInstance)
        return stripeInstance;
    const secretKey = await (0, apiKeys_1.getApiKey)('stripe');
    if (!secretKey) {
        throw new Error('Stripe API key not configured');
    }
    stripeInstance = new stripe_1.default(secretKey, {
        // @ts-ignore - Using latest stable API version
        apiVersion: '2025-12-15.clover',
        typescript: true,
    });
    return stripeInstance;
}
/**
 * Create a PaymentIntent for a product purchase
 */
async function createPaymentIntent(params) {
    const stripe = await getStripe();
    const { productId, userId, systemId, personId, partnerId, readingType, metadata = {} } = params;
    // Get price for product
    const amount = exports.PRODUCT_PRICES[productId];
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
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
    };
}
/**
 * Verify webhook signature from Stripe
 */
async function verifyWebhookSignature(payload, signature, webhookSecret) {
    const stripe = await getStripe();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
/**
 * Handle successful payment - record purchase and trigger job
 */
async function handlePaymentSuccess(paymentIntent) {
    const { userId, productId, systemId, personId, partnerId, readingType } = paymentIntent.metadata;
    console.log(`✅ Payment successful: ${paymentIntent.id} for user ${userId}, product ${productId}`);
    // Record purchase in database
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
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
        stripe_receipt_url: paymentIntent.latest_charge ? String(paymentIntent.latest_charge) : null,
    });
    if (purchaseError) {
        console.error('❌ Failed to record purchase:', purchaseError);
        // Don't throw - payment succeeded, we just failed to record it
        // This can be reconciled later from Stripe dashboard
    }
    else {
        console.log(`✅ Purchase recorded for user ${userId}`);
    }
}
/**
 * Get Stripe publishable key for frontend
 */
async function getPublishableKey() {
    // Publishable key is safe to expose to frontend, but must match the secret key mode (test vs live).
    // Prefer Supabase api_keys table for consistency across deployments.
    const fromSupabase = await (0, apiKeys_1.getApiKey)('stripe_publishable');
    const fromEnv = process.env.STRIPE_PUBLISHABLE_KEY;
    const key = (fromSupabase || fromEnv || '').trim();
    if (!key)
        throw new Error('Stripe publishable key not configured');
    return key;
}
/**
 * Retrieve payment intent status
 */
async function getPaymentIntentStatus(paymentIntentId) {
    const stripe = await getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return {
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
    };
}
/**
 * Create a yearly subscription (default: $9.90/year price configured in Stripe).
 * Returns:
 * - PaymentIntent client_secret from latest_invoice to be used with PaymentSheet
 * - customerId + ephemeralKeySecret for PaymentSheet customer context
 */
async function createYearlySubscription(params) {
    const stripe = await getStripe();
    const priceId = (await (0, apiKeys_1.getApiKey)('stripe_subscription_price_id')) ||
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
    const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customer.id }, 
    // Keep in sync with Stripe API version in getStripe()
    // @ts-ignore
    { apiVersion: '2025-12-15.clover' });
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
    const latestInvoice = subscription.latest_invoice;
    const paymentIntentRaw = latestInvoice?.payment_intent;
    const pi = (typeof paymentIntentRaw === 'string' ? null : paymentIntentRaw) || null;
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
async function upsertStripeSubscriptionToSupabase(params) {
    const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
    if (!supabase)
        return;
    const toTs = (s) => typeof s === 'number' ? new Date(s * 1000).toISOString() : null;
    const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
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
    }, { onConflict: 'stripe_subscription_id' });
    if (error) {
        console.error('❌ Failed to upsert user_subscriptions:', error);
    }
}
//# sourceMappingURL=stripeService.js.map