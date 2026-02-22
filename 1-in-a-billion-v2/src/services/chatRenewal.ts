import { env } from '@/config/env';
import { findYearlySubscriptionPackage } from '@/config/revenuecatCatalog';
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

export async function renewChatAccess(appUserId?: string | null): Promise<RenewChatAccessResult> {
  const normalizedUserId = String(appUserId || '').trim() || undefined;

  const ready = await initializeRevenueCat(normalizedUserId || null);
  if (!ready) {
    return { success: false, error: 'Payment unavailable in this build.' };
  }

  const offerings = await getOfferings();
  const yearly = findYearlySubscriptionPackage(offerings);
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
