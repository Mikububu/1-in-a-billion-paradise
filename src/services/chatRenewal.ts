import { env } from '@/config/env';
import {
  extractRevenueCatAppUserId,
  getOfferings,
  getRevenueCatCustomerInfo,
  initializeRevenueCat,
  purchasePackage,
  verifyEntitlementWithBackend,
} from '@/services/payments';

export type RenewChatAccessResult = {
  success: boolean;
  cancelled?: boolean;
  active?: boolean;
  appUserId?: string;
  error?: string;
};

function getYearlyPackage(offerings: any): any | null {
  const packages = offerings?.current?.availablePackages ?? [];
  return (
    packages.find((p: any) => p?.identifier === 'yearly_subscription') ||
    packages.find((p: any) => p?.identifier === 'yearly_subscription_990') ||
    packages.find((p: any) => p?.packageType === 'ANNUAL') ||
    null
  );
}

export async function renewChatAccess(appUserId?: string | null): Promise<RenewChatAccessResult> {
  const normalizedUserId = String(appUserId || '').trim() || undefined;

  const ready = await initializeRevenueCat(normalizedUserId || null);
  if (!ready) {
    return { success: false, error: 'Payment unavailable in this build.' };
  }

  const offerings = await getOfferings();
  const yearly = getYearlyPackage(offerings);
  if (!yearly) {
    return { success: false, error: 'Could not find the yearly subscription package.' };
  }

  const purchaseResult = await purchasePackage(yearly);
  if (!purchaseResult.success) {
    if (purchaseResult.error === 'cancelled') {
      return { success: false, cancelled: true };
    }
    return { success: false, error: purchaseResult.error || 'Purchase failed.' };
  }

  const customerInfo = purchaseResult.customerInfo || (await getRevenueCatCustomerInfo());
  const resolvedAppUserId = extractRevenueCatAppUserId(customerInfo) || normalizedUserId;

  if (!resolvedAppUserId) {
    if (env.ALLOW_PAYMENT_BYPASS) {
      return { success: true, active: true };
    }
    return { success: false, error: 'Could not identify purchase account.' };
  }

  const verification = await verifyEntitlementWithBackend({ appUserId: resolvedAppUserId });
  if (verification.success && verification.active) {
    return {
      success: true,
      active: true,
      appUserId: verification.appUserId || resolvedAppUserId,
    };
  }

  if (env.ALLOW_PAYMENT_BYPASS) {
    return {
      success: true,
      active: true,
      appUserId: resolvedAppUserId,
    };
  }

  return {
    success: false,
    active: false,
    appUserId: resolvedAppUserId,
    error: verification.error || 'Subscription is not active yet. Please try again in a few seconds.',
  };
}
