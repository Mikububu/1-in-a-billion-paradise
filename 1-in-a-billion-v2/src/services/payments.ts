import { Platform } from 'react-native';
import { env } from '@/config/env';

type AnyObj = Record<string, any>;
type EntitlementVerifyResponse = {
  success: boolean;
  active: boolean;
  appUserId?: string;
  entitlementId?: string | null;
  entitlements?: string[];
  source?: 'revenuecat' | 'supabase_fallback';
  error?: string;
};

let PurchasesSDK: AnyObj | null = null;
let isConfigured = false;

function loadPurchasesSdk(): AnyObj | null {
  if (PurchasesSDK) return PurchasesSDK;

  try {
    // Avoid static require so app can still run in environments without native RevenueCat module.
    const req = (0, eval)('require');
    const mod = req('react-native-purchases');
    PurchasesSDK = mod?.default || mod;
    return PurchasesSDK;
  } catch {
    return null;
  }
}

function getSdkKey(): string {
  if (Platform.OS === 'ios') return env.REVENUECAT_API_KEY_IOS || '';
  if (Platform.OS === 'android') return env.REVENUECAT_API_KEY_ANDROID || '';
  return '';
}

export async function initializeRevenueCat(userId?: string | null): Promise<boolean> {
  const sdk = loadPurchasesSdk();
  if (!sdk) {
    console.warn('⚠️ RevenueCat SDK unavailable in this build');
    return false;
  }

  if (isConfigured) {
    try {
      if (userId && userId !== 'anonymous') {
        await sdk.logIn?.(String(userId));
      }
    } catch {
      // non-fatal
    }
    return true;
  }

  const apiKey = getSdkKey();
  if (!apiKey) {
    console.warn('⚠️ RevenueCat API key missing');
    return false;
  }

  try {
    await sdk.configure({
      apiKey,
      appUserID: userId && userId !== 'anonymous' ? String(userId) : undefined,
    });
    isConfigured = true;
    return true;
  } catch (e) {
    console.error('❌ RevenueCat configure failed', e);
    return false;
  }
}

export async function getOfferings(): Promise<any | null> {
  const sdk = loadPurchasesSdk();
  if (!sdk) return null;
  try {
    return await sdk.getOfferings();
  } catch (e) {
    console.error('❌ RevenueCat getOfferings failed', e);
    return null;
  }
}

export async function purchasePackage(pkg: any): Promise<{ success: boolean; error?: string; customerInfo?: any }> {
  const sdk = loadPurchasesSdk();
  if (!sdk) return { success: false, error: 'RevenueCat not available in this build' };

  try {
    const result = await sdk.purchasePackage(pkg);
    return {
      success: true,
      customerInfo: result?.customerInfo,
    };
  } catch (e: any) {
    const cancelled = Boolean(e?.userCancelled || e?.code === 'PURCHASE_CANCELLED_ERROR' || e?.message?.toLowerCase?.().includes('cancel'));
    if (cancelled) {
      return { success: false, error: 'cancelled' };
    }
    return { success: false, error: e?.message || 'Purchase failed' };
  }
}

export function extractRevenueCatAppUserId(customerInfo: any): string | null {
  const candidates = [
    customerInfo?.originalAppUserId,
    customerInfo?.originalAppUserID,
    customerInfo?.appUserId,
    customerInfo?.appUserID,
    customerInfo?.original_app_user_id,
    customerInfo?.app_user_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export async function getRevenueCatCustomerInfo(): Promise<any | null> {
  const sdk = loadPurchasesSdk();
  if (!sdk) return null;
  try {
    return await sdk.getCustomerInfo?.();
  } catch (e) {
    console.warn('⚠️ RevenueCat getCustomerInfo failed', e);
    return null;
  }
}

export async function logInRevenueCat(appUserId: string): Promise<boolean> {
  const sdk = loadPurchasesSdk();
  if (!sdk) return false;

  const normalized = String(appUserId || '').trim();
  if (!normalized) return false;

  try {
    await initializeRevenueCat();
    await sdk.logIn?.(normalized);
    return true;
  } catch (e) {
    console.warn('⚠️ RevenueCat logIn failed', e);
    return false;
  }
}

export async function verifyEntitlementWithBackend(params: {
  appUserId: string;
  entitlementId?: string;
}): Promise<EntitlementVerifyResponse> {
  const appUserId = String(params.appUserId || '').trim();
  if (!appUserId) return { success: false, active: false, error: 'Missing appUserId' };

  try {
    const response = await fetch(`${env.CORE_API_URL}/api/payments/verify-entitlement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appUserId,
        entitlementId: params.entitlementId,
      }),
    });

    const json = (await response.json().catch(() => ({}))) as EntitlementVerifyResponse;
    if (!response.ok) {
      return {
        success: false,
        active: false,
        error: json?.error || `Verification failed (${response.status})`,
      };
    }
    return {
      success: Boolean(json?.success),
      active: Boolean(json?.active),
      appUserId: json?.appUserId || appUserId,
      entitlementId: json?.entitlementId ?? null,
      entitlements: json?.entitlements || [],
      source: json?.source,
      error: json?.error,
    };
  } catch (e: any) {
    return { success: false, active: false, error: e?.message || 'Verification request failed' };
  }
}

export async function linkRevenueCatAppUser(params: {
  accessToken: string;
  previousAppUserId: string;
}): Promise<{ success: boolean; updated?: number; error?: string }> {
  const accessToken = String(params.accessToken || '').trim();
  const previousAppUserId = String(params.previousAppUserId || '').trim();

  if (!accessToken || !previousAppUserId) {
    return { success: false, error: 'Missing access token or previous app user ID' };
  }

  try {
    const response = await fetch(`${env.CORE_API_URL}/api/payments/link-app-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ previousAppUserId }),
    });

    const json = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      updated?: number;
      error?: string;
    };
    if (!response.ok) {
      return { success: false, error: json?.error || `Link failed (${response.status})` };
    }
    return { success: Boolean(json?.success), updated: json?.updated ?? 0, error: json?.error };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Link request failed' };
  }
}
