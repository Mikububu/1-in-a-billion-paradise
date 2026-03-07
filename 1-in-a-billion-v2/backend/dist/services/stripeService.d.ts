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
export declare const PRODUCT_PRICES: Record<string, number>;
/**
 * Create a PaymentIntent for a product purchase
 */
export declare function createPaymentIntent(params: {
    productId: string;
    userId: string;
    systemId?: string;
    personId?: string;
    partnerId?: string;
    readingType?: 'individual' | 'overlay';
    metadata?: Record<string, string>;
}): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
}>;
/**
 * Verify webhook signature from Stripe
 */
export declare function verifyWebhookSignature(payload: string | Buffer, signature: string, webhookSecret: string): Promise<Stripe.Event>;
/**
 * Handle successful payment - record purchase and trigger job
 */
export declare function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void>;
/**
 * Get Stripe publishable key for frontend
 */
export declare function getPublishableKey(): Promise<string>;
/**
 * Retrieve payment intent status
 */
export declare function getPaymentIntentStatus(paymentIntentId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
    metadata: Record<string, string>;
}>;
/**
 * Create a yearly subscription (default: $9.90/year price configured in Stripe).
 * Returns:
 * - PaymentIntent client_secret from latest_invoice to be used with PaymentSheet
 * - customerId + ephemeralKeySecret for PaymentSheet customer context
 */
export declare function createYearlySubscription(params: {
    userId: string;
    userEmail?: string;
    metadata?: Record<string, string>;
}): Promise<{
    customerId: string;
    ephemeralKeySecret: string;
    subscriptionId: string;
    paymentIntentClientSecret: string;
    priceId: string;
}>;
/**
 * Upsert Stripe subscription state into Supabase.
 */
export declare function upsertStripeSubscriptionToSupabase(params: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId?: string | null;
    status: string;
    cancelAtPeriodEnd?: boolean | null;
    currentPeriodStart?: number | null;
    currentPeriodEnd?: number | null;
    userId?: string | null;
    email?: string | null;
    metadata?: Record<string, any> | null;
}): Promise<void>;
//# sourceMappingURL=stripeService.d.ts.map