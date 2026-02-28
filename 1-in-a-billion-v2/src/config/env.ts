// Environment configuration for mobile app

const coreApiUrl = process.env.EXPO_PUBLIC_CORE_API_URL || 'https://1-in-a-billion-backend.fly.dev';

// Warn if HTTPS is not enforced in production
if (__DEV__ === false && !coreApiUrl.startsWith('https://')) {
  console.warn(
    'WARNING: CORE_API_URL does not use HTTPS in production. ' +
    'This is a security risk. Please use an HTTPS URL in production builds.'
  );
}

export const env = {
    // Use machine IP for iOS Simulator (localhost doesn't work)
    // Backend runs on Fly.io (not local laptop per Michael's preference)
    // Override via EXPO_PUBLIC_CORE_API_URL when needed (e.g. local backend testing).
    CORE_API_URL: coreApiUrl,
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_FUNCTION_URL: process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL || '',

    // Expo push notifications
    EXPO_PROJECT_ID: process.env.EXPO_PUBLIC_PROJECT_ID || '',

    // Feature flags
    ENABLE_APPLE_SIGNIN: process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGNIN === 'true',
    ENABLE_SUPABASE_LIBRARY_SYNC: process.env.EXPO_PUBLIC_ENABLE_SUPABASE_LIBRARY_SYNC === 'true',

    // RevenueCat
    REVENUECAT_API_KEY_IOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '',
    REVENUECAT_API_KEY_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '',
    ALLOW_PAYMENT_BYPASS: process.env.EXPO_PUBLIC_ALLOW_PAYMENT_BYPASS === 'true',
};
