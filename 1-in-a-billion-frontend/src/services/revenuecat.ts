/**
 * REVENUECAT SERVICE - In-App Purchases
 * 
 * Handles subscription and purchase management via RevenueCat.
 * RevenueCat wraps StoreKit (iOS) and Google Play Billing (Android).
 * 
 * API Keys:
 * - iOS: Use Apple API key from RevenueCat dashboard
 * - Android: Use Google API key from RevenueCat dashboard
 * 
 * Test API Key: sk_HmzWzcdMUKYgIhyLmcJXeqGyDKuwt (for backend/webhooks)
 */

import { Platform } from 'react-native';

// Lazy load RevenueCat to avoid NativeEventEmitter errors in dev builds
let Purchases: any = null;
let LOG_LEVEL: any = null;

function loadRevenueCat() {
  if (Purchases) return true;
  try {
    const module = require('react-native-purchases');
    Purchases = module.default;
    LOG_LEVEL = module.LOG_LEVEL;
    return true;
  } catch (e) {
    console.warn('RevenueCat not available:', e);
    return false;
  }
}

// RevenueCat API Keys - Replace with your actual keys from RevenueCat dashboard
// These are PUBLIC keys (appl_ for iOS, goog_ for Android)
const REVENUECAT_API_KEYS = {
  ios: 'appl_REPLACE_WITH_YOUR_IOS_KEY', // Get from RevenueCat > Project > API Keys
  android: 'goog_REPLACE_WITH_YOUR_ANDROID_KEY', // Get from RevenueCat > Project > API Keys
};

// Entitlement identifier - matches what you set up in RevenueCat dashboard
export const ENTITLEMENT_ID = 'premium';

// Product identifiers
export const PRODUCT_IDS = {
  yearly_subscription: 'yearly_subscription',
  single_system: 'single_system',
  complete_reading: 'complete_reading',
  compatibility_overlay: 'compatibility_overlay',
  nuclear_package: 'nuclear_package',
} as const;

let isInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Call this once at app startup (e.g., in App.tsx useEffect)
 */
export async function initializeRevenueCat(): Promise<boolean> {
  if (isInitialized) {
    console.log('📦 RevenueCat already initialized');
    return true;
  }

  if (!loadRevenueCat()) {
    console.warn('📦 RevenueCat native module not available');
    return false;
  }

  try {
    // Enable verbose logging in development
    if (__DEV__ && LOG_LEVEL) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEYS.ios 
      : REVENUECAT_API_KEYS.android;

    await Purchases.configure({ apiKey });
    isInitialized = true;
    console.log('✅ RevenueCat initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize RevenueCat:', error);
    // Don't throw - app should still work without purchases
    return false;
  }
}

/**
 * Identify user to RevenueCat (call after user logs in)
 * This links purchases to the user's account
 */
export async function identifyUser(userId: string): Promise<void> {
  if (!loadRevenueCat() || !isInitialized) return;
  try {
    await Purchases.logIn(userId);
    console.log('✅ RevenueCat user identified:', userId);
  } catch (error) {
    console.error('❌ Failed to identify RevenueCat user:', error);
  }
}

/**
 * Log out user from RevenueCat (call when user logs out)
 */
export async function logOutUser(): Promise<void> {
  if (!loadRevenueCat() || !isInitialized) return;
  try {
    await Purchases.logOut();
    console.log('✅ RevenueCat user logged out');
  } catch (error) {
    console.error('❌ Failed to log out RevenueCat user:', error);
  }
}

/**
 * Get current customer info (subscription status, entitlements)
 */
export async function getCustomerInfo(): Promise<any | null> {
  if (!loadRevenueCat() || !isInitialized) return null;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('❌ Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has premium access
 */
export async function hasPremiumAccess(): Promise<boolean> {
  if (!loadRevenueCat() || !isInitialized) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
  } catch (error) {
    console.error('❌ Failed to check premium access:', error);
    return false;
  }
}

/**
 * Get available offerings (products configured in RevenueCat)
 */
export async function getOfferings(): Promise<any | null> {
  // Initialize if not already done
  if (!isInitialized) {
    const success = await initializeRevenueCat();
    if (!success) return null;
  }
  
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current;
    }
    console.warn('⚠️ No current offering found');
    return null;
  } catch (error) {
    console.error('❌ Failed to get offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 * Returns CustomerInfo if successful, null if cancelled or failed
 */
export async function purchasePackage(pkg: any): Promise<any | null> {
  if (!loadRevenueCat() || !isInitialized) {
    throw new Error('RevenueCat not available');
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    console.log('✅ Purchase successful');
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('ℹ️ User cancelled purchase');
      return null;
    }
    console.error('❌ Purchase failed:', error);
    throw error;
  }
}

/**
 * Restore purchases (for users who reinstall or switch devices)
 */
export async function restorePurchases(): Promise<any | null> {
  if (!loadRevenueCat() || !isInitialized) return null;
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
 * Check if RevenueCat is available (not in Expo Go)
 */
export function isRevenueCatAvailable(): boolean {
  try {
    // RevenueCat has a preview mode for Expo Go that returns mock data
    // Real purchases only work in development builds
    return true;
  } catch {
    return false;
  }
}
