/**
 * PAYMENTS SERVICE - RevenueCat Integration
 * 
 * Handles payment processing for premium readings via RevenueCat.
 * RevenueCat manages all payment providers (Apple, Google, Stripe, etc.)
 * 
 * IMPORTANT: All sales are final. No refunds.
 * Technical issues → manual fix, not refund.
 * 
 * Support: contact@1-in-a-billion.app
 */

import { env } from '@/config/env';
import { Platform } from 'react-native';

// Lazy-load react-native-purchases to avoid NativeEventEmitter crash
// when native module isn't available (e.g. Expo Go / dev builds without native modules)
let Purchases: any = null;
try {
    Purchases = require('react-native-purchases').default;
} catch (e) {
    console.warn('⚠️ react-native-purchases not available — payments disabled');
}

type PurchasesOfferings = any;
type PurchasesPackage = any;
type CustomerInfo = any;
type PurchasesStoreProduct = any;

const API_URL = env.CORE_API_URL;

function isPaymentsAvailable(): boolean {
    return Purchases !== null;
}

let isRevenueCatConfigured = false;

function normalizeRevenueCatSdkKey(
    raw: unknown,
    opts: {
        platform: 'ios' | 'android' | 'other';
        allowTestKey: boolean;
    }
): string | null {
    if (typeof raw !== 'string') return null;
    const key = raw.trim();
    if (!key) return null;

    // RevenueCat server API keys are secret. Mobile must use public SDK keys.
    // We *only* allow platform-appropriate public keys (and optional test_* keys in dev).
    if (key.startsWith('sk_')) {
        console.error(
            '❌ RevenueCat SDK key misconfigured: got secret sk_* key. Use the public SDK key (appl_* for iOS / goog_* for Android).'
        );
        return null;
    }

    const { platform, allowTestKey } = opts;

    if (allowTestKey && key.startsWith('test_')) {
        return key;
    }

    if (platform === 'ios') {
        if (key.startsWith('appl_')) return key;
        console.error('❌ RevenueCat SDK key misconfigured for iOS. Expected appl_* public SDK key.');
        return null;
    }

    if (platform === 'android') {
        if (key.startsWith('goog_')) return key;
        console.error('❌ RevenueCat SDK key misconfigured for Android. Expected goog_* public SDK key.');
        return null;
    }

    // Fallback for unknown platforms (e.g. web): accept known public prefixes.
    if (key.startsWith('appl_') || key.startsWith('goog_')) return key;
    console.error('❌ RevenueCat SDK key misconfigured. Expected public SDK key.');
    return null;
}

function normalizeRevenueCatAppUserId(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const userId = raw.trim();
    if (!userId) return null;
    if (userId === 'anonymous') return null;
    return userId;
}

// Product IDs matching backend and RevenueCat dashboard
export const PRODUCT_IDS = {
    single_system: 'single_system',
    complete_reading: 'complete_reading',
    compatibility_overlay: 'compatibility_overlay',
    nuclear_package: 'nuclear_package',
    yearly_subscription: 'yearly_subscription',
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

interface PaymentConfig {
    revenueCatPublicKey: string;
    products: Record<string, number>;
}

interface SubscriptionStatus {
    success: boolean;
    isActive?: boolean;
    expiresAt?: string | null;
    productId?: string | null;
    error?: string;
}

export interface LiveProductPrice {
    productId: ProductId;
    amount: number;
    priceString: string;
    currencyCode: string;
    source: 'store' | 'fallback';
}

const PRODUCT_ID_LIST = Object.values(PRODUCT_IDS) as ProductId[];

const DEFAULT_PRODUCT_PRICES: Record<ProductId, number> = {
    single_system: 14,
    complete_reading: 34,
    compatibility_overlay: 41,
    nuclear_package: 108,
    yearly_subscription: 9.9,
};

const LEGACY_PRODUCT_ID_ALIASES: Record<ProductId, string[]> = {
    single_system: ['single_system_1400'],
    complete_reading: ['complete_reading_3400'],
    compatibility_overlay: ['compatibility_overlay_4100'],
    nuclear_package: ['nuclear_package_10800'],
    yearly_subscription: ['yearly_subscription_990'],
};

function normalizeProductId(rawProductId: string): ProductId | null {
    if (!rawProductId) return null;

    if (rawProductId.startsWith('single_system')) return 'single_system';
    if (rawProductId.startsWith('complete_reading')) return 'complete_reading';
    if (rawProductId.startsWith('compatibility_overlay')) return 'compatibility_overlay';
    if (rawProductId.startsWith('nuclear_package')) return 'nuclear_package';
    if (rawProductId.startsWith('yearly_subscription')) return 'yearly_subscription';

    return null;
}

export function formatCurrencyAmount(amount: number, currencyCode: string = 'USD'): string {
    if (!Number.isFinite(amount)) return '$0.00';

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
    }
}

function buildFallbackProductPrices(
    configProducts?: Record<string, number>
): Record<ProductId, LiveProductPrice> {
    const prices = {} as Record<ProductId, LiveProductPrice>;

    for (const productId of PRODUCT_ID_LIST) {
        const configuredCents = configProducts?.[productId];
        const amount =
            typeof configuredCents === 'number' && Number.isFinite(configuredCents)
                ? configuredCents / 100
                : DEFAULT_PRODUCT_PRICES[productId];

        prices[productId] = {
            productId,
            amount,
            priceString: formatCurrencyAmount(amount, 'USD'),
            currencyCode: 'USD',
            source: 'fallback',
        };
    }

    return prices;
}

export async function getLiveProductPrices(): Promise<Record<ProductId, LiveProductPrice>> {
    const config = await getPaymentConfig();
    const prices = buildFallbackProductPrices(config?.products);

    if (!isPaymentsAvailable()) {
        return prices;
    }

    try {
        const requestedProductIds = new Set<string>();
        for (const productId of PRODUCT_ID_LIST) {
            requestedProductIds.add(productId);
            for (const aliasId of LEGACY_PRODUCT_ID_ALIASES[productId]) {
                requestedProductIds.add(aliasId);
            }
        }

        const storeProducts: PurchasesStoreProduct[] = await Purchases.getProducts(Array.from(requestedProductIds));

        for (const storeProduct of storeProducts || []) {
            const rawId = String(storeProduct?.identifier ?? storeProduct?.productIdentifier ?? '');
            const normalizedId = normalizeProductId(rawId);
            if (!normalizedId) continue;

            const amount =
                typeof storeProduct?.price === 'number' && Number.isFinite(storeProduct.price)
                    ? storeProduct.price
                    : prices[normalizedId].amount;
            const currencyCode =
                typeof storeProduct?.currencyCode === 'string' && storeProduct.currencyCode.length > 0
                    ? storeProduct.currencyCode
                    : prices[normalizedId].currencyCode;
            const priceString =
                typeof storeProduct?.priceString === 'string' && storeProduct.priceString.length > 0
                    ? storeProduct.priceString
                    : formatCurrencyAmount(amount, currencyCode);

            prices[normalizedId] = {
                productId: normalizedId,
                amount,
                priceString,
                currencyCode,
                source: 'store',
            };
        }

        if (Object.values(prices).every((entry) => entry.source !== 'store')) {
            const offerings = await getOfferings();
            const packages = offerings?.current?.availablePackages ?? [];

            for (const pkg of packages) {
                const pkgProduct = pkg?.product;
                const rawId = String(pkgProduct?.identifier ?? pkgProduct?.productIdentifier ?? pkg?.identifier ?? '');
                const normalizedId = normalizeProductId(rawId);
                if (!normalizedId) continue;

                const amount =
                    typeof pkgProduct?.price === 'number' && Number.isFinite(pkgProduct.price)
                        ? pkgProduct.price
                        : prices[normalizedId].amount;
                const currencyCode =
                    typeof pkgProduct?.currencyCode === 'string' && pkgProduct.currencyCode.length > 0
                        ? pkgProduct.currencyCode
                        : prices[normalizedId].currencyCode;
                const priceString =
                    typeof pkgProduct?.priceString === 'string' && pkgProduct.priceString.length > 0
                        ? pkgProduct.priceString
                        : formatCurrencyAmount(amount, currencyCode);

                prices[normalizedId] = {
                    productId: normalizedId,
                    amount,
                    priceString,
                    currencyCode,
                    source: 'store',
                };
            }
        }
    } catch (error) {
        console.warn('⚠️ Failed to fetch store pricing, using fallback pricing:', error);
    }

    return prices;
}

export function getNumericPrice(
    prices: Record<ProductId, LiveProductPrice>,
    productId: ProductId
): number {
    return prices[productId]?.amount ?? DEFAULT_PRODUCT_PRICES[productId];
}

export function getDisplayPrice(
    prices: Record<ProductId, LiveProductPrice>,
    productId: ProductId
): string {
    return prices[productId]?.priceString ?? formatCurrencyAmount(DEFAULT_PRODUCT_PRICES[productId], 'USD');
}

export function getProductCurrencyCode(
    prices: Record<ProductId, LiveProductPrice>,
    productId: ProductId
): string {
    return prices[productId]?.currencyCode || 'USD';
}

export function hasStorePrice(
    prices: Record<ProductId, LiveProductPrice>,
    productId: ProductId
): boolean {
    return prices[productId]?.source === 'store';
}

export function getStrictStoreDisplayPrice(
    prices: Record<ProductId, LiveProductPrice>,
    productId: ProductId
): string | null {
    return hasStorePrice(prices, productId) ? prices[productId].priceString : null;
}

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts
 */
export async function initializeRevenueCat(userId?: string | null): Promise<boolean> {
    if (!isPaymentsAvailable()) {
        console.error('RevenueCat SDK is not available in this build');
        return false;
    }
    try {
        const appUserID = normalizeRevenueCatAppUserId(userId) || null;
        const allowTestKey = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
        const platform: 'ios' | 'android' | 'other' =
            Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'other';

        const platformEnvKey = Platform.select({
            ios: env.REVENUECAT_API_KEY_IOS,
            android: env.REVENUECAT_API_KEY_ANDROID,
            default: env.REVENUECAT_API_KEY_IOS,
        });

        // In production builds, always prefer backend config to avoid EAS/env misconfiguration.
        // In dev builds, allow env keys (still validated by prefix) for faster iteration.
        let sdkKey: string | null = null;
        if (allowTestKey) {
            sdkKey = normalizeRevenueCatSdkKey(platformEnvKey, { platform, allowTestKey });
        }
        if (!sdkKey) {
            const config = await getPaymentConfig();
            sdkKey = normalizeRevenueCatSdkKey(config?.revenueCatPublicKey, { platform, allowTestKey });
        }

        if (!sdkKey) {
            console.error('RevenueCat SDK key not configured');
            isRevenueCatConfigured = false;
            return false;
        }

        await Purchases.configure({
            apiKey: sdkKey,
            appUserID, // null = anonymous (RevenueCat will alias on login)
        });

        console.log('✅ RevenueCat initialized');
        isRevenueCatConfigured = true;
        return true;
    } catch (error) {
        console.error('❌ RevenueCat initialization error:', error);
        isRevenueCatConfigured = false;
        return false;
    }
}

/**
 * Update user ID when user logs in/out
 */
export async function updateRevenueCatUserId(userId: string): Promise<void> {
    if (!isPaymentsAvailable()) return;
    const normalizedUserId = normalizeRevenueCatAppUserId(userId);
    if (!normalizedUserId) return;
    try {
        await Purchases.logIn(normalizedUserId);
        console.log('✅ RevenueCat user ID updated:', normalizedUserId);
    } catch (error) {
        console.error('❌ Error updating RevenueCat user ID:', error);
    }
}

/**
 * Log out user (for anonymous mode)
 */
export async function logoutRevenueCat(): Promise<void> {
    if (!isPaymentsAvailable()) return;
    try {
        await Purchases.logOut();
        console.log('✅ RevenueCat user logged out');
        // Note: logOut does not de-configure the SDK, but this prevents accidental
        // offering fetches when we're in an unknown state.
        isRevenueCatConfigured = false;
    } catch (error) {
        console.error('❌ Error logging out RevenueCat user:', error);
    }
}

/**
 * Get payment configuration from backend
 */
export async function getPaymentConfig(): Promise<PaymentConfig | null> {
    try {
        const response = await fetch(`${API_URL}/api/payments/config`);
        const data = await response.json();

        if (data.success) {
            return {
                revenueCatPublicKey: data.revenueCatPublicKey,
                products: data.products,
            };
        }

        console.warn('Payment config unavailable:', data.error);
        return null;
    } catch (error) {
        console.warn('Payment config error:', error);
        return null;
    }
}

/**
 * Get available offerings from RevenueCat
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
    if (!isPaymentsAvailable()) return null;
    if (!isRevenueCatConfigured) return null;
    try {
        const offerings = await Purchases.getOfferings();
        return offerings;
    } catch (error) {
        console.warn('Error fetching offerings:', error);
        return null;
    }
}

/**
 * Get current offering packages
 */
export async function getCurrentOfferingPackages(): Promise<PurchasesPackage[] | null> {
    try {
        const offerings = await getOfferings();
        if (!offerings?.current) {
            console.error('No current offering available');
            return null;
        }

        return offerings.current.availablePackages;
    } catch (error) {
        console.error('Error fetching packages:', error);
        return null;
    }
}

/**
 * Get specific product by ID
 */
export async function getProduct(productId: ProductId): Promise<PurchasesStoreProduct | null> {
    if (!isPaymentsAvailable()) return null;
    try {
        const products = await Purchases.getProducts([productId]);
        return products[0] || null;
    } catch (error) {
        console.error(`Error fetching product ${productId}:`, error);
        return null;
    }
}

/**
 * Purchase a product
 */
export async function purchaseProduct(
    productId: ProductId,
    metadata?: {
        systemId?: string;
        personId?: string;
        partnerId?: string;
        readingType?: 'individual' | 'overlay';
    }
): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
}> {
    if (!isPaymentsAvailable()) {
        return {
            success: false,
            error: 'Payment system not available in this build',
        };
    }
    try {
        // Get the product
        const product = await getProduct(productId);
        if (!product) {
            return {
                success: false,
                error: 'Product not found',
            };
        }

        // Set custom attributes for tracking
        if (metadata) {
            if (metadata.systemId) {
                await Purchases.setAttributes({ systemId: metadata.systemId });
            }
            if (metadata.personId) {
                await Purchases.setAttributes({ personId: metadata.personId });
            }
            if (metadata.partnerId) {
                await Purchases.setAttributes({ partnerId: metadata.partnerId });
            }
            if (metadata.readingType) {
                await Purchases.setAttributes({ readingType: metadata.readingType });
            }
        }

        // Make the purchase
        const { customerInfo } = await Purchases.purchaseStoreProduct(product);

        console.log('✅ Purchase successful:', productId);

        return {
            success: true,
            customerInfo,
        };
    } catch (error: any) {
        console.error('❌ Purchase error:', error);

        // Handle user cancellation gracefully
        if (error.userCancelled) {
            return {
                success: false,
                error: 'Purchase cancelled',
            };
        }

        return {
            success: false,
            error: error.message || 'Purchase failed',
        };
    }
}

/**
 * Purchase a package (for subscriptions)
 */
export async function purchasePackage(
    pkg: PurchasesPackage
): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
}> {
    if (!isPaymentsAvailable()) {
        return {
            success: false,
            error: 'Payment system not available in this build',
        };
    }
    try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);

        console.log('✅ Package purchase successful');

        return {
            success: true,
            customerInfo,
        };
    } catch (error: any) {
        console.error('❌ Package purchase error:', error);

        if (error.userCancelled) {
            return {
                success: false,
                error: 'Purchase cancelled',
            };
        }

        return {
            success: false,
            error: error.message || 'Purchase failed',
        };
    }
}

/**
 * Restore purchases (for users who reinstalled the app)
 */
export async function restorePurchases(): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
}> {
    if (!isPaymentsAvailable()) {
        return {
            success: false,
            error: 'Payment system not available in this build',
        };
    }
    try {
        const customerInfo = await Purchases.restorePurchases();

        console.log('✅ Purchases restored');

        return {
            success: true,
            customerInfo,
        };
    } catch (error: any) {
        console.error('❌ Restore purchases error:', error);
        return {
            success: false,
            error: error.message || 'Failed to restore purchases',
        };
    }
}

/**
 * Get customer info (current subscription/purchase status)
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!isPaymentsAvailable()) return null;
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        return customerInfo;
    } catch (error) {
        console.error('Error fetching customer info:', error);
        return null;
    }
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
    try {
        const customerInfo = await getCustomerInfo();
        if (!customerInfo) return false;

        // Check if user has any active entitlements
        const activeEntitlements = Object.keys(customerInfo.entitlements.active);
        return activeEntitlements.length > 0;
    } catch (error) {
        console.error('Error checking subscription:', error);
        return false;
    }
}

/**
 * Check if user has purchased a specific product
 */
export async function hasPurchasedProduct(productId: ProductId): Promise<boolean> {
    try {
        const customerInfo = await getCustomerInfo();
        if (!customerInfo) return false;

        // Check non-subscription purchases
        const allPurchasedProductIds = customerInfo.nonSubscriptionTransactions.map(
            (transaction: any) => transaction.productIdentifier
        );

        return allPurchasedProductIds.includes(productId);
    } catch (error) {
        console.error('Error checking product purchase:', error);
        return false;
    }
}

/**
 * Check subscription status via backend API
 */
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
        const response = await fetch(`${API_URL}/api/payments/subscription/${userId}`);
        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                isActive: data.isActive,
                expiresAt: data.expiresAt,
                productId: data.productId,
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

    if (frontendId === 'yearly_subscription') {
        return 'yearly_subscription';
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
