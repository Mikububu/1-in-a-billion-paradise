/**
 * PAYMENT ROUTES
 * 
 * Stripe payment processing for 1 in a Billion app.
 * 
 * Endpoints:
 * - POST /api/payments/create-intent - Create PaymentIntent
 * - POST /api/payments/webhook - Stripe webhook handler
 * - GET /api/payments/config - Get Stripe publishable key
 * - GET /api/payments/status/:id - Check payment status
 * 
 * REFUND POLICY: No refunds. Manual fixes offered for technical issues.
 * Contact: contact@1-in-a-billion.app
 */

import { Hono } from 'hono';
import {
  createPaymentIntent,
  verifyWebhookSignature,
  handlePaymentSuccess,
  getPublishableKey,
  getPaymentIntentStatus,
  PRODUCT_PRICES,
} from '../services/stripeService';
import { getApiKey } from '../services/apiKeys';

const payments = new Hono();

/**
 * GET /api/payments/config
 * Returns Stripe publishable key for frontend initialization
 */
payments.get('/config', async (c) => {
  try {
    const publishableKey = await getPublishableKey();
    
    return c.json({
      success: true,
      publishableKey,
      products: PRODUCT_PRICES,
    });
  } catch (error: any) {
    console.error('❌ Error getting payment config:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/payments/create-intent
 * Creates a PaymentIntent for a product purchase
 * 
 * Body: {
 *   productId: string (single_system, complete_reading, etc.)
 *   systemId?: string (for single system purchases)
 *   personId?: string
 *   partnerId?: string
 *   readingType?: 'individual' | 'overlay'
 *   userEmail?: string (for receipt)
 * }
 */
payments.post('/create-intent', async (c) => {
  try {
    const userId = c.req.header('X-User-Id');
    if (!userId) {
      return c.json({ success: false, error: 'User ID required' }, 401);
    }
    
    const body = await c.req.json();
    const { productId, systemId, personId, partnerId, readingType, userEmail } = body;
    
    if (!productId) {
      return c.json({ success: false, error: 'Product ID required' }, 400);
    }
    
    if (!PRODUCT_PRICES[productId]) {
      return c.json({ success: false, error: `Invalid product: ${productId}` }, 400);
    }
    
    const result = await createPaymentIntent({
      productId,
      userId,
      systemId,
      personId,
      partnerId,
      readingType,
      metadata: {
        userEmail: userEmail || '',
      },
    });
    
    console.log(`💳 PaymentIntent created for user ${userId}: ${result.paymentIntentId}`);
    
    return c.json({
      success: true,
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      amount: result.amount,
      currency: 'usd',
    });
  } catch (error: any) {
    console.error('❌ Error creating PaymentIntent:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook handler for payment events
 * 
 * Important: This endpoint receives raw body for signature verification
 */
payments.post('/webhook', async (c) => {
  try {
    const signature = c.req.header('stripe-signature');
    if (!signature) {
      return c.json({ success: false, error: 'Missing signature' }, 400);
    }
    
    // Get webhook secret from environment or Supabase
    const webhookSecret = await getApiKey('stripe_webhook_secret') || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ Stripe webhook secret not configured');
      return c.json({ success: false, error: 'Webhook not configured' }, 500);
    }
    
    // Get raw body for signature verification
    const rawBody = await c.req.text();
    
    // Verify webhook signature
    const event = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    
    console.log(`📨 Stripe webhook received: ${event.type}`);
    
    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await handlePaymentSuccess(paymentIntent);
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log(`❌ Payment failed: ${paymentIntent.id} - ${paymentIntent.last_payment_error?.message}`);
        break;
      }
      
      case 'charge.dispute.created': {
        // Log dispute for manual handling
        const dispute = event.data.object;
        console.log(`⚠️ DISPUTE CREATED: ${dispute.id} - Amount: ${dispute.amount}`);
        console.log('📧 Manual response required - check Stripe dashboard');
        console.log('📋 Policy: No refunds. Offer manual fix for technical issues.');
        break;
      }
      
      default:
        console.log(`ℹ️ Unhandled webhook event: ${event.type}`);
    }
    
    return c.json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return c.json({ success: false, error: error.message }, 400);
  }
});

/**
 * GET /api/payments/status/:paymentIntentId
 * Check status of a payment
 */
payments.get('/status/:paymentIntentId', async (c) => {
  try {
    const paymentIntentId = c.req.param('paymentIntentId');
    
    const status = await getPaymentIntentStatus(paymentIntentId);
    
    return c.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error('❌ Error getting payment status:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/payments/products
 * List available products and prices
 */
payments.get('/products', (c) => {
  const products = Object.entries(PRODUCT_PRICES).map(([id, priceInCents]) => ({
    id,
    price: priceInCents / 100,
    currency: 'USD',
  }));
  
  return c.json({
    success: true,
    products,
    refundPolicy: 'All sales final. Manual fixes offered for technical issues.',
    support: 'contact@1-in-a-billion.app',
  });
});

export default payments;
