/**
 * RevenueCat catalog + display copy used across purchase screens/services.
 * Keep product/package identifiers centralized to avoid per-screen drift.
 */

export const RC_PRODUCT_IDS = {
  singleSystem: 'single_system',
  completeReading: 'complete_reading',
  compatibilityOverlay: 'compatibility_overlay',
  bundle16Readings: 'nuclear_package',
  yearlySubscription: 'yearly_subscription',
} as const;

export const RC_PACKAGE_IDENTIFIERS = {
  singleSystem: RC_PRODUCT_IDS.singleSystem,
  completeReading: RC_PRODUCT_IDS.completeReading,
  compatibilityOverlay: RC_PRODUCT_IDS.compatibilityOverlay,
  bundle16Readings: RC_PRODUCT_IDS.bundle16Readings,
  yearlySubscription: RC_PRODUCT_IDS.yearlySubscription,
  yearlySubscriptionAlt: 'yearly_subscription_990',
} as const;

export const RC_TIER_PACKAGE_IDENTIFIER = {
  basic: RC_PACKAGE_IDENTIFIERS.singleSystem,
  pro: RC_PACKAGE_IDENTIFIERS.completeReading,
  cosmic: RC_PACKAGE_IDENTIFIERS.bundle16Readings,
} as const;

const YEARLY_PACKAGE_IDENTIFIER_SET = new Set<string>([
  RC_PACKAGE_IDENTIFIERS.yearlySubscription,
  RC_PACKAGE_IDENTIFIERS.yearlySubscriptionAlt,
]);

export const PRICE_DISPLAY = {
  yearlySuffix: '/yr',
  monthlySuffix: '/month',
  yearlySavingsNote: 'Save 2 months with yearly billing',
  liveStorePricingNote: 'Live App Store pricing via RevenueCat',
  checkoutPriceFallbackLabel: 'See App Store',
} as const;

type AnyRecord = Record<string, any>;

export function getAvailableRevenueCatPackages(offerings: AnyRecord | null | undefined): AnyRecord[] {
  const list = offerings?.current?.availablePackages;
  return Array.isArray(list) ? list : [];
}

export function findYearlySubscriptionPackage(offerings: AnyRecord | null | undefined): AnyRecord | null {
  const packages = getAvailableRevenueCatPackages(offerings);

  const byIdentifier =
    packages.find((pkg) => YEARLY_PACKAGE_IDENTIFIER_SET.has(String(pkg?.identifier || ''))) || null;
  if (byIdentifier) return byIdentifier;

  const byType = packages.find((pkg) => String(pkg?.packageType || '').toUpperCase() === 'ANNUAL') || null;
  return byType;
}

export function getPackagePriceString(pkg: AnyRecord | null | undefined): string | null {
  const direct = pkg?.product?.priceString;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const fallback = pkg?.storeProduct?.priceString;
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();

  return null;
}

export function getPackageByIdentifier(
  offerings: AnyRecord | null | undefined,
  packageIdentifier: string
): AnyRecord | null {
  const packages = getAvailableRevenueCatPackages(offerings);
  return packages.find((pkg) => String(pkg?.identifier || '') === packageIdentifier) || null;
}
