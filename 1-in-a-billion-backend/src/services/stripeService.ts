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
      stripe_receipt_url: (paymentIntent as any).charges?.data?.[0]?.receipt_url || null,
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
export function getPublishableKey(): string {
  // Publishable key can be exposed to frontend
  // This should be set in environment or fetched from config
  return process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_51SeWkJL0c4u8ytKNxWjOTqJtPfRQCg3lM8VLMlq3KJC7dQhVdQV3MqLHVcPqKRfvBZ2Z2KQJC8OZqJjKqJjKqJj';
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
