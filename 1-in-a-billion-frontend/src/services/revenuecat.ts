/**
 * REVENUECAT PAYMENTS SERVICE
 *
 * Handles in-app purchases and subscriptions via RevenueCat.
 * Uses Apple App Store / Google Play native IAP under the hood.
 *
 * IMPORTANT: All sales are final. No refunds.
 * Technical issues → manual fix via Apple/Google support.
 *
 * Support: contact@1-in-a-billion.app
 */

import { Platform } from 'react-native';
import { env } from '@/config/env';

// Lazy-load react-native-purchases to avoid NativeEventEmitter crash
// when native module isn't available (e.g. Expo Go / dev builds without native modules)
let Purchases: any = null;
let PURCHASES_ERROR_CODE: any = {};
try {
  const mod = require('react-native-purchases');
  Purchases = mod.default;
  PURCHASES_ERROR_CODE = mod.PURCHASES_ERROR_CODE;
} catch (e) {
  console.warn('⚠️ react-native-purchases not available — RevenueCat disabled');
}

type PurchasesPackage = any;
type CustomerInfo = any;
type PurchasesOfferings = any;

// RevenueCat API Keys — set in .env, never hardcode secrets
const REVENUECAT_API_KEY_IOS = env.REVENUECAT_API_KEY_IOS || '';
const REVENUECAT_API_KEY_ANDROID = env.REVENUECAT_API_KEY_ANDROID || '';

// Entitlement IDs (configured in RevenueCat dashboard)
export const ENTITLEMENTS = {
  PREMIUM: 'premium', // Yearly subscription
  SINGLE_READING: 'single_reading', // One-time purchase
  COMPLETE_READING: 'complete_reading', // One-time purchase
  NUCLEAR_PACKAGE: 'nuclear_package', // One-time purchase
} as const;

export type EntitlementId = typeof ENTITLEMENTS[keyof typeof ENTITLEMENTS];

// Product IDs (configured in App Store Connect / Google Play Console)
export const PRODUCT_IDS = {
  // Subscription
  yearly_subscription: 'yearly_subscription_990',

  // One-time purchases
  single_system: 'single_system_1400',
  complete_reading: 'complete_reading_3400',
  compatibility_overlay: 'compatibility_overlay_4100',
  nuclear_package: 'nuclear_package_10800',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

let isConfigured = false;

/** Check if RevenueCat native module is available */
export function isRevenueCatAvailable(): boolean {
  return Purchases !== null;
}

/**
 * Initialize RevenueCat SDK
 * Call this once at app startup (in App.tsx or navigation bootstrap)
 */
export async function initRevenueCat(userId?: string): Promise<void> {
  if (isConfigured) {
    console.log('RevenueCat already configured');
    return;
  }

  if (!Purchases) {
    console.warn('⚠️ RevenueCat SDK not available — skipping init');
    return;
  }

  try {
    const apiKey = Platform.select({
      ios: REVENUECAT_API_KEY_IOS,
      android: REVENUECAT_API_KEY_ANDROID,
      default: REVENUECAT_API_KEY_IOS,
    });

    if (!apiKey) {
      console.error('RevenueCat API key not configured');
      return;
    }

    await Purchases.configure({
      apiKey,
      appUserID: userId || null, // null = anonymous user, will be aliased on login
    });

    isConfigured = true;
    console.log('✅ RevenueCat initialized');
  } catch (error) {
    console.error('❌ Failed to initialize RevenueCat:', error);
  }
}

/**
 * Login user to RevenueCat (call after Firebase auth)
 * This syncs purchases across devices
 */
export async function loginUser(userId: string): Promise<CustomerInfo | null> {
  if (!Purchases) {
    console.warn('⚠️ RevenueCat not available — skipping login');
    return null;
  }
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    console.log('✅ RevenueCat user logged in:', userId);
    return customerInfo;
  } catch (error: any) {
    if (error.code === PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR) {
      // Restore purchases for this user
      return await restorePurchases();
    }
    console.error('❌ RevenueCat login failed:', error);
    return null;
  }
}

/**
 * Logout user from RevenueCat
 */
export async function logoutUser(): Promise<void> {
  if (!Purchases) return;
  try {
    await Purchases.logOut();
    console.log('✅ RevenueCat user logged out');
  } catch (error) {
    console.error('❌ RevenueCat logout failed:', error);
  }
}

/**
 * Get available offerings (products configured in RevenueCat)
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!Purchases) {
    console.warn('⚠️ RevenueCat not available — no offerings');
    return null;
  }
  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current) {
      console.log('📦 Current offering:', offerings.current.identifier);
      console.log('📦 Available packages:', offerings.current.availablePackages.length);
    }

    return offerings;
  } catch (error) {
    console.error('❌ Failed to get offerings:', error);
    return null;
  }
}

/**
 * Get current customer info (entitlements, subscriptions)
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!Purchases) {
    console.warn('⚠️ RevenueCat not available — no customer info');
    return null;
  }
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('❌ Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has premium entitlement (active subscription)
 */
export async function hasPremiumAccess(): Promise<boolean> {
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
  } catch (error) {
    console.error('❌ Failed to check premium access:', error);
    return false;
  }
}

/**
 * Check if user has a specific entitlement
 */
export async function hasEntitlement(entitlementId: EntitlementId): Promise<boolean> {
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[entitlementId] !== undefined;
  } catch (error) {
    console.error(`❌ Failed to check entitlement ${entitlementId}:`, error);
    return false;
  }
}

/**
 * Purchase a package (subscription or one-time)
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!Purchases) {
    return { success: false, error: 'Payment system not available' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    console.log('✅ Purchase successful');
    return { success: true, customerInfo };
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('ℹ️ User cancelled purchase');
      return { success: false, error: 'cancelled' };
    }
    console.error('❌ Purchase failed:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

/**
 * Purchase yearly subscription
 * This is the main entry point for the PostHookOffer flow
 */
export async function purchaseYearlySubscription(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!Purchases) {
    return { success: false, error: 'Payment system not available' };
  }
  try {
    const offerings = await getOfferings();

    if (!offerings?.current) {
      return { success: false, error: 'No offerings available' };
    }

    // Find the yearly subscription package
    const yearlyPackage = offerings.current.availablePackages.find(
      pkg => pkg.packageType === 'ANNUAL' || pkg.identifier === 'yearly'
    );

    if (!yearlyPackage) {
      // Try the default package
      const defaultPackage = offerings.current.availablePackages[0];
      if (!defaultPackage) {
        return { success: false, error: 'No subscription package found' };
      }
      return await purchasePackage(defaultPackage);
    }

    return await purchasePackage(yearlyPackage);
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to purchase subscription' };
  }
}

/**
 * Restore previous purchases
 * Called when user logs in on a new device
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!Purchases) {
    console.warn('⚠️ RevenueCat not available — cannot restore');
    return null;
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('✅ Purchases restored');
    return customerInfo;
  } catch (error) {
    console.error('❌ Failed to restore purchases:', error);
    return null;
  }
}

/**
 * Get subscription management URL (for cancellation)
 */
export async function getManagementURL(): Promise<string | null> {
  if (!Purchases) return null;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.managementURL || null;
  } catch (error) {
    console.error('❌ Failed to get management URL:', error);
    return null;
  }
}

/**
 * Set user attributes for analytics
 */
export async function setUserAttributes(attributes: {
  email?: string;
  displayName?: string;
  phoneNumber?: string;
}): Promise<void> {
  if (!Purchases) return;
  try {
    if (attributes.email) {
      await Purchases.setEmail(attributes.email);
    }
    if (attributes.displayName) {
      await Purchases.setDisplayName(attributes.displayName);
    }
    if (attributes.phoneNumber) {
      await Purchases.setPhoneNumber(attributes.phoneNumber);
    }
  } catch (error) {
    console.error('❌ Failed to set user attributes:', error);
  }
}

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// These functions match the old Stripe API for easier migration
// ============================================================================

/**
 * Legacy: Get payment config (returns offerings instead)
 */
export async function getPaymentConfig(): Promise<{
  publishableKey: string;
  products: Record<string, number>;
} | null> {
  const offerings = await getOfferings();
  if (!offerings?.current) return null;

  const products: Record<string, number> = {};
  offerings.current.availablePackages.forEach(pkg => {
    products[pkg.identifier] = pkg.product.price;
  });

  return {
    publishableKey: 'revenuecat', // Placeholder for compatibility
    products,
  };
}

/**
 * Legacy: Create yearly subscription intent
 * Now directly purchases via RevenueCat
 */
export async function createYearlySubscriptionIntent(_params: {
  userId: string;
  userEmail?: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  // With RevenueCat, we don't create an "intent" - we just purchase directly
  // This is called from PostHookOfferScreen, but the actual purchase
  // should happen via purchaseYearlySubscription()
  console.log('⚠️ createYearlySubscriptionIntent is deprecated - use purchaseYearlySubscription()');
  return { success: true };
}
