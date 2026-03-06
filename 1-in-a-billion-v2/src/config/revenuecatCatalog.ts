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
  basicMonthly: 'basic_monthly',
  billionaireMonthly: 'billionaire_monthly',
  billionaireYearly: 'billionaire_yearly',
} as const;

/** Map reading product type → RevenueCat product ID for IAP purchases */
export const PRODUCT_TYPE_TO_RC_ID: Record<string, string> = {
  single_system: RC_PRODUCT_IDS.singleSystem,
  complete_reading: RC_PRODUCT_IDS.completeReading,
  compatibility_overlay: RC_PRODUCT_IDS.compatibilityOverlay,
  nuclear_package: RC_PRODUCT_IDS.bundle16Readings,
};

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
  // 1. Try the "current" offering (most common)
  const currentList = offerings?.current?.availablePackages;
  if (Array.isArray(currentList) && currentList.length > 0) return currentList;

  // 2. Fallback: try ALL offerings (in case "current" isn't set)
  const all = offerings?.all;
  if (all && typeof all === 'object') {
    for (const key of Object.keys(all)) {
      const pkgs = all[key]?.availablePackages;
      if (Array.isArray(pkgs) && pkgs.length > 0) {
        console.log(`🔎 [RevenueCat] Using packages from offering "${key}" (current was empty)`);
        return pkgs;
      }
    }
  }

  return [];
}

export function findYearlySubscriptionPackage(offerings: AnyRecord | null | undefined): AnyRecord | null {
  const packages = getAvailableRevenueCatPackages(offerings);

  // Debug: log all available packages so we can see what RevenueCat returns
  console.log('🔎 [RevenueCat] Available packages:', packages.map((p) => ({
    id: p?.identifier,
    type: p?.packageType,
    productId: p?.product?.identifier || p?.storeProduct?.identifier,
    price: p?.product?.price ?? p?.storeProduct?.price,
  })));

  // 1. Try by package identifier (yearly_subscription or yearly_subscription_990)
  const byIdentifier =
    packages.find((pkg) => YEARLY_PACKAGE_IDENTIFIER_SET.has(String(pkg?.identifier || ''))) || null;
  if (byIdentifier) { console.log('🔎 [RevenueCat] Found expansion by identifier'); return byIdentifier; }

  // 2. Try by App Store product ID (product ID is still 'yearly_subscription' even though it's now monthly)
  const byProductId = packages.find((pkg) => {
    const prodId = pkg?.product?.identifier || pkg?.storeProduct?.identifier || '';
    return String(prodId) === RC_PRODUCT_IDS.yearlySubscription;
  }) || null;
  if (byProductId) { console.log('🔎 [RevenueCat] Found expansion by product ID'); return byProductId; }

  // 3. Try ANNUAL package type (legacy)
  const byType = packages.find((pkg) => String(pkg?.packageType || '').toUpperCase() === 'ANNUAL') || null;
  if (byType) { console.log('🔎 [RevenueCat] Found expansion by ANNUAL type'); return byType; }

  // 4. Fallback: find the "middle" package (not cheapest, not most expensive)
  // Since all tiers are monthly, sort by price and pick the middle one
  const sorted = [...packages].sort((a, b) => {
    const pa = a?.product?.price ?? a?.storeProduct?.price ?? 0;
    const pb = b?.product?.price ?? b?.storeProduct?.price ?? 0;
    return pa - pb;
  });
  if (sorted.length >= 3) {
    console.log('🔎 [RevenueCat] Fallback: using middle-priced package for expansion');
    return sorted[1]; // middle = expansion
  }
  if (sorted.length === 2) {
    return sorted[0]; // cheaper of two
  }

  console.warn('⚠️ [RevenueCat] Could not find expansion/yearly package');
  return null;
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

/** Find the Billionaire subscription package (multi-strategy fallback) */
export function findBillionairePackage(offerings: AnyRecord | null | undefined): AnyRecord | null {
  // 1. Try exact package identifier
  const byId =
    getPackageByIdentifier(offerings, 'billionaire') ||
    getPackageByIdentifier(offerings, 'billionaire_monthly') ||
    getPackageByIdentifier(offerings, 'billionaire_yearly');
  if (byId) return byId;

  // 2. Try App Store product ID (check both legacy and current IDs)
  const packages = getAvailableRevenueCatPackages(offerings);
  const byProductId = packages.find((pkg) => {
    const prodId = pkg?.product?.identifier || pkg?.storeProduct?.identifier || '';
    return String(prodId) === RC_PRODUCT_IDS.billionaireYearly ||
           String(prodId) === RC_PRODUCT_IDS.billionaireMonthly;
  }) || null;
  if (byProductId) return byProductId;

  // 3. Fallback: most expensive package (excluding yearly which may cost more total)
  const monthlyOrCustom = packages.filter((p) =>
    String(p?.packageType || '').toUpperCase() !== 'ANNUAL'
  );
  const sorted = [...(monthlyOrCustom.length ? monthlyOrCustom : packages)].sort((a, b) => {
    const pa = a?.product?.price ?? a?.storeProduct?.price ?? 0;
    const pb = b?.product?.price ?? b?.storeProduct?.price ?? 0;
    return pb - pa;
  });
  return sorted[0] || null;
}

/** Find a package by its App Store product ID (for one-time IAP purchases) */
export function findIAPPackageByProductId(
  offerings: AnyRecord | null | undefined,
  productId: string
): AnyRecord | null {
  const packages = getAvailableRevenueCatPackages(offerings);
  // Search by product identifier (App Store product ID)
  return packages.find((pkg) => {
    const id = pkg?.product?.identifier || pkg?.storeProduct?.identifier || pkg?.identifier || '';
    return String(id) === productId;
  }) || null;
}
