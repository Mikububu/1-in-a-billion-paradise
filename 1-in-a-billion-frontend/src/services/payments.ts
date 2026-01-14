/**
 * PAYMENTS SERVICE - Stripe Integration
 * 
 * Handles payment processing for premium readings.
 * 
 * IMPORTANT: All sales are final. No refunds.
 * Technical issues → manual fix, not refund.
 * 
 * Support: contact@1-in-a-billion.app
 */

import { env } from '@/config/env';

const API_URL = env.CORE_API_URL;

// Product IDs matching backend
export const PRODUCT_IDS = {
  single_system: 'single_system',
  complete_reading: 'complete_reading',
  compatibility_overlay: 'compatibility_overlay',
  nuclear_package: 'nuclear_package',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

interface PaymentConfig {
  publishableKey: string;
  products: Record<string, number>;
}

interface PaymentIntentResult {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

interface SubscriptionIntentResult {
  success: boolean;
  customerId?: string;
  ephemeralKeySecret?: string;
  subscriptionId?: string;
  paymentIntentClientSecret?: string;
  priceId?: string;
  error?: string;
}

interface PaymentStatus {
  success: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
  error?: string;
}

/**
 * Get Stripe configuration (publishable key + products)
 */
export async function getPaymentConfig(): Promise<PaymentConfig | null> {
  try {
    const response = await fetch(`${API_URL}/api/payments/config`);
    const data = await response.json();
    
    if (data.success) {
      return {
        publishableKey: data.publishableKey,
        products: data.products,
      };
    }
    
    console.error('Failed to get payment config:', data.error);
    return null;
  } catch (error) {
    console.error('Payment config error:', error);
    return null;
  }
}

/**
 * Create PaymentIntent for a product purchase
 */
export async function createPaymentIntent(params: {
  userId: string;
  productId: ProductId;
  systemId?: string;
  personId?: string;
  partnerId?: string;
  readingType?: 'individual' | 'overlay';
  userEmail?: string;
}): Promise<PaymentIntentResult> {
  try {
    const response = await fetch(`${API_URL}/api/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': params.userId,
      },
      body: JSON.stringify({
        productId: params.productId,
        systemId: params.systemId,
        personId: params.personId,
        partnerId: params.partnerId,
        readingType: params.readingType,
        userEmail: params.userEmail,
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to create payment',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Create a yearly subscription (Stripe price id configured on backend).
 * This returns the pieces needed for Stripe PaymentSheet with a customer:
 * - customerId
 * - customerEphemeralKeySecret
 * - paymentIntentClientSecret (from latest_invoice)
 */
export async function createYearlySubscriptionIntent(params: {
  userId: string; // can be 'anonymous' pre-signup
  userEmail?: string;
}): Promise<SubscriptionIntentResult> {
  try {
    const response = await fetch(`${API_URL}/api/payments/create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': params.userId,
      },
      body: JSON.stringify({
        userEmail: params.userEmail || '',
      }),
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        customerId: data.customerId,
        ephemeralKeySecret: data.ephemeralKeySecret,
        subscriptionId: data.subscriptionId,
        paymentIntentClientSecret: data.paymentIntentClientSecret,
        priceId: data.priceId,
      };
    }

    return { success: false, error: data.error || 'Failed to create subscription' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Check payment status
 */
export async function getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
  try {
    const response = await fetch(`${API_URL}/api/payments/status/${paymentIntentId}`);
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        metadata: data.metadata,
      };
    }
    
    return {
      success: false,
      error: data.error,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Map frontend product selection to backend product ID
 */
export function mapToProductId(frontendId: string): ProductId {
  // User readings
  if (frontendId.startsWith('user_') && frontendId !== 'user_all_five') {
    return 'single_system';
  }
  if (frontendId === 'user_all_five') {
    return 'complete_reading';
  }
  
  // Partner readings
  if (frontendId.startsWith('partner_') && frontendId !== 'partner_all_five') {
    return 'single_system';
  }
  if (frontendId === 'partner_all_five') {
    return 'complete_reading';
  }
  
  // Overlays
  if (frontendId.startsWith('overlay_')) {
    return 'compatibility_overlay';
  }
  
  // Nuclear
  if (frontendId === 'nuclear_package') {
    return 'nuclear_package';
  }
  
  // Default fallback
  return 'single_system';
}

/**
 * Extract system name from product ID
 */
export function extractSystemFromProductId(productId: string): string | null {
  const systems = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
  
  for (const system of systems) {
    if (productId.includes(system)) {
      return system;
    }
  }
  
  return null;
}
