/**
 * PURCHASE SCREEN - Contextual Product Offers
 * 
 * Shows different products based on WHERE user came from (mode param).
 * Never shows everything at once - always contextual.
 * 
 * PAYMENT: RevenueCat (Apple Pay, Google Pay, Stripe, etc.)
 * REFUND POLICY: All sales final. Manual fixes for technical issues only.
 * Support: contact@1-in-a-billion.app
 */

import { useState, useMemo, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { WhyDifferentCard } from '@/components/WhyDifferentCard';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore, selectPartners } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { PRODUCTS, formatAudioDuration } from '@/config/products';
import { BackButton } from '@/components/BackButton';
import {
  initializeRevenueCat,
  purchaseProduct,
  mapToProductId,
  extractSystemFromProductId,
  getLiveProductPrices,
  hasStorePrice,
  getStrictStoreDisplayPrice,
  type LiveProductPrice,
  type ProductId as PaymentProductId,
} from '@/services/payments';

// Developer bypass emails (for testing without payment)
const DEV_BYPASS_EMAILS = [
  'michael@1-in-a-billion.app',
  'dev@1-in-a-billion.app',
  'test@1-in-a-billion.app',
];

type Props = NativeStackScreenProps<MainStackParamList, 'Purchase'>;

// Purchase modes - determines what to show
export type PurchaseMode =
  | 'user_readings'      // Upgrade user's own readings
  | 'partner_readings'   // Upgrade partner's readings
  | 'overlays'           // Compatibility overlays
  | 'nuclear'            // The ultimate package
  | 'subscription'       // $9.90/year subscription (post-hook offer)
  | 'all';               // Full catalog (fallback)

type Product = {
  id: string;
  name: string;
  price: number;
  priceLabel?: string;
  meta: string;
  isBundle?: boolean;
  savingsLabel?: string;
};

const SYSTEMS = ['Western', 'Vedic', 'Human Design', 'Gene Keys', 'Kabbalah'] as const;

export const PurchaseScreen = ({ navigation, route }: Props) => {
  const params = (route.params ?? {}) as any;
  const {
    preselectedProduct,
    onPurchaseComplete,
    mode = 'all',
    partnerName: routePartnerName,
    afterPurchaseParams,
  } = params as {
    preselectedProduct?: string;
    onPurchaseComplete?: () => void;
    mode?: PurchaseMode;
    partnerName?: string;
    afterPurchaseParams?: { screen: string; params?: Record<string, any> };
  };
  const [selectedProduct, setSelectedProduct] = useState<string | null>(preselectedProduct || null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRevenueCatReady, setIsRevenueCatReady] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<PaymentProductId, LiveProductPrice>>({} as Record<PaymentProductId, LiveProductPrice>);

  // Auth store for user ID and email
  const authUser = useAuthStore(state => state.user);
  const userId = authUser?.id || 'anonymous';
  const userEmail = authUser?.email || '';

  // Developer bypass check
  const isDeveloperAccount = DEV_BYPASS_EMAILS.includes(userEmail.toLowerCase());

  const user = useProfileStore(state => state.people.find(p => p.isUser));
  const userName = user?.name || 'You';

  const partners = useProfileStore(selectPartners);
  const partnerName = routePartnerName || partners[0]?.name || 'Partner';

  // Initialize RevenueCat on mount
  useEffect(() => {
    const init = async () => {
      try {
        const success = await initializeRevenueCat(userId);
        setIsRevenueCatReady(success);
        if (!success) {
          console.error('Failed to initialize RevenueCat');
        }
        const resolvedPrices = await getLiveProductPrices();
        setLivePrices(resolvedPrices);
      } catch (error) {
        console.error('RevenueCat initialization error:', error);
      }
    };
    init();
  }, [userId]);

  // Build products based on mode
  const { title, subtitle, products } = useMemo(() => {
    const strictPriceLabel = (productId: PaymentProductId) =>
      getStrictStoreDisplayPrice(livePrices, productId) ?? 'Price unavailable';

    const getPriceAmount = (productId: PaymentProductId) =>
      livePrices[productId]?.amount ?? 0;

    const currencyCode = livePrices['single_system']?.currencyCode || 'USD';

    const formatSavings = (amount: number) => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${currencyCode} ${amount.toFixed(2)}`;
      }
    };

    const singleSystemAmount = getPriceAmount('single_system');

    const singleSystemPrice = {
      amount: singleSystemAmount,
      label: strictPriceLabel('single_system'),
    };
    const completeReadingPrice = {
      amount: getPriceAmount('complete_reading'),
      label: strictPriceLabel('complete_reading'),
    };
    const compatibilityOverlayPrice = {
      amount: getPriceAmount('compatibility_overlay'),
      label: strictPriceLabel('compatibility_overlay'),
    };
    const nuclearPackagePrice = {
      amount: getPriceAmount('nuclear_package'),
      label: strictPriceLabel('nuclear_package'),
    };
    const yearlySubscriptionPrice = {
      amount: getPriceAmount('yearly_subscription'),
      label: strictPriceLabel('yearly_subscription'),
    };

    // Calculate savings
    const completeSavings = Math.max(0, (singleSystemAmount * 5) - completeReadingPrice.amount);
    const nuclearSavings = Math.max(0, (singleSystemAmount * 16) - nuclearPackagePrice.amount); // 16 calls equivalent

    const completeSavingsLabel = completeSavings > 0 ? `Save ${formatSavings(completeSavings)}` : undefined;
    const nuclearSavingsLabel = nuclearSavings > 0 ? `Save ${formatSavings(nuclearSavings)}` : undefined;

    switch (mode) {
      case 'subscription':
        return {
          title: 'Yearly Subscription',
          subtitle: yearlySubscriptionPrice.label === 'Price unavailable'
            ? 'Price unavailable'
            : `${yearlySubscriptionPrice.label} / year`,
          products: [
            {
              id: 'yearly_subscription',
              name: '1-Year Subscription',
              price: yearlySubscriptionPrice.amount,
              priceLabel: yearlySubscriptionPrice.label,
              meta: 'Weekly matching + 1 personal reading',
              isBundle: true,
            },
          ],
        };
      case 'user_readings':
        return {
          title: `Upgrade ${userName}'s Readings`,
          subtitle: 'Unlock premium audio readings',
          products: [
            ...SYSTEMS.map((system) => ({
              id: `user_${system.toLowerCase().replace(' ', '_')}`,
              name: `${system} Reading`,
              price: singleSystemPrice.amount,
              priceLabel: singleSystemPrice.label,
              meta: `${formatAudioDuration(PRODUCTS.single_system.audioMinutes)} audio · ${PRODUCTS.single_system.pagesMin} pages`,
            })),
            {
              id: 'user_all_five',
              name: 'All 5 Systems',
              price: completeReadingPrice.amount,
              priceLabel: completeReadingPrice.label,
              meta: `${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · ${PRODUCTS.complete_reading.pagesMin} pages`,
              isBundle: true,
              savingsLabel: completeSavingsLabel,
            },
          ],
        };
      case 'partner_readings':
        return {
          title: `Upgrade ${partnerName}'s Readings`,
          subtitle: 'Unlock premium audio readings',
          products: [
            ...SYSTEMS.map((system) => ({
              id: `partner_${system.toLowerCase().replace(' ', '_')}`,
              name: `${system} Reading`,
              price: singleSystemPrice.amount,
              priceLabel: singleSystemPrice.label,
              meta: `${formatAudioDuration(PRODUCTS.single_system.audioMinutes)} audio · ${PRODUCTS.single_system.pagesMin} pages`,
            })),
            {
              id: 'partner_all_five',
              name: 'All 5 Systems',
              price: completeReadingPrice.amount,
              priceLabel: completeReadingPrice.label,
              meta: `${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · ${PRODUCTS.complete_reading.pagesMin} pages`,
              isBundle: true,
              savingsLabel: completeSavingsLabel,
            },
          ],
        };
      case 'overlays':
        return {
          title: 'Compatibility Overlays',
          subtitle: `${userName} + ${partnerName}`,
          products: [
            ...SYSTEMS.map((system) => ({
              id: `overlay_${system.toLowerCase().replace(' ', '_')}`,
              name: `${system} Overlay`,
              price: compatibilityOverlayPrice.amount,
              priceLabel: compatibilityOverlayPrice.label,
              meta: `${formatAudioDuration(PRODUCTS.compatibility_overlay.audioMinutes)} audio · ${PRODUCTS.compatibility_overlay.pagesMin} pages`,
            })),
            {
              id: 'overlay_all_five',
              name: 'All 5 Overlays + Verdict',
              price: completeReadingPrice.amount,
              priceLabel: completeReadingPrice.label,
              meta: `${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · ${PRODUCTS.complete_reading.pagesMin} pages`,
              isBundle: true,
              savingsLabel: completeSavingsLabel,
            },
          ],
        };
      case 'nuclear':
        return {
          title: 'The Nuclear Package',
          subtitle: 'Everything. Analyzed.',
          products: [
            {
              id: 'nuclear_package',
              name: 'Complete Analysis',
              price: nuclearPackagePrice.amount,
              priceLabel: nuclearPackagePrice.label,
              meta: `${formatAudioDuration(PRODUCTS.nuclear_package.audioMinutes)} audio · ${PRODUCTS.nuclear_package.pagesMin} pages`,
              isBundle: true,
              savingsLabel: nuclearSavingsLabel,
            },
          ],
        };
      default:
        // Full catalog with navigation
        return {
          title: 'Premium Readings',
          subtitle: 'Choose what to upgrade',
          products: [
            {
              id: 'nav_user_readings',
              name: `${userName}'s Readings`,
              price: 0,
              meta: 'Upgrade your personal readings',
            },
            {
              id: 'nav_partner_readings',
              name: `${partnerName}'s Readings`,
              price: 0,
              meta: 'Upgrade partner readings',
            },
            {
              id: 'nav_overlays',
              name: 'Compatibility Overlays',
              price: 0,
              meta: 'Analyze your relationship',
            },
            {
              id: 'nav_nuclear',
              name: 'The Nuclear Package',
              price: nuclearPackagePrice.amount,
              priceLabel: nuclearPackagePrice.label,
              meta: 'Everything. Analyzed.',
              isBundle: true,
              savingsLabel: nuclearSavingsLabel,
            },
          ],
        };
    }
  }, [mode, userName, partnerName, livePrices]);

  const selectedProductInfo = products.find(p => p.id === selectedProduct);
  const selectedBackendProductId = selectedProductInfo ? mapToProductId(selectedProductInfo.id) : null;
  const selectedHasStorePrice = selectedBackendProductId ? hasStorePrice(livePrices, selectedBackendProductId) : false;
  const selectedStorePriceLabel = selectedBackendProductId
    ? getStrictStoreDisplayPrice(livePrices, selectedBackendProductId)
    : null;

  const handleSelectProduct = (product: Product) => {
    // Handle navigation items
    if (product.id.startsWith('nav_')) {
      const targetMode = product.id.replace('nav_', '') as PurchaseMode;
      navigation.replace('Purchase', { mode: targetMode as any, partnerName });
      return;
    }

    setSelectedProduct(product.id);
    setPaymentError(null);
  };

  const handlePurchaseSuccess = () => {
    Alert.alert(
      '🎉 Purchase Successful!',
      'Your premium content is being generated. You\'ll receive a notification when it\'s ready.',
      [
        {
          text: 'OK',
          onPress: () => {
            if (onPurchaseComplete) {
              onPurchaseComplete();
            }
            if (afterPurchaseParams) {
              navigation.navigate(afterPurchaseParams.screen as any, afterPurchaseParams.params);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handlePurchase = async () => {
    if (!selectedProduct || !selectedProductInfo) {
      Alert.alert('Error', 'Please select a product');
      return;
    }

    if (!selectedHasStorePrice) {
      Alert.alert(
        'Price Unavailable',
        'This product does not have a live store price yet. Check App Store Connect / RevenueCat mapping first.'
      );
      return;
    }

    setIsPurchasing(true);
    setPaymentError(null);

    try {
      // Developer bypass
      if (isDeveloperAccount) {
        console.log('🔧 DEV MODE: Bypassing payment');
        setTimeout(() => {
          setIsPurchasing(false);
          handlePurchaseSuccess();
        }, 1000);
        return;
      }

      // Check if RevenueCat is ready
      if (!isRevenueCatReady) {
        throw new Error('Payment system not ready. Please try again.');
      }

      // Map frontend product to backend product ID
      const backendProductId = mapToProductId(selectedProduct);
      const systemId = extractSystemFromProductId(selectedProduct);

      // Determine person/partner IDs
      const isOverlay = selectedProduct.startsWith('overlay_') || selectedProduct === 'nuclear_package';
      const isPartner = selectedProduct.startsWith('partner_');

      console.log('💳 Purchasing product:', backendProductId);

      // Make the purchase via RevenueCat
      const result = await purchaseProduct(backendProductId, {
        systemId: systemId || undefined,
        personId: isPartner ? partners[0]?.id : user?.id,
        partnerId: isOverlay ? partners[0]?.id : undefined,
        readingType: isOverlay ? 'overlay' : 'individual',
      });

      if (!result.success) {
        if (result.error === 'Purchase cancelled') {
          console.log('💳 User cancelled purchase');
          setIsPurchasing(false);
          return;
        }
        throw new Error(result.error || 'Purchase failed');
      }

      // Purchase successful!
      console.log('✅ Purchase successful!');
      setIsPurchasing(false);
      handlePurchaseSuccess();

    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      setPaymentError(error.message || 'Purchase failed');
      setIsPurchasing(false);

      Alert.alert(
        'Purchase Failed',
        `${error.message || 'An error occurred during purchase.'}\n\nNeed help? Contact contact@1-in-a-billion.app`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title} selectable>{title}</Text>
        <Text style={styles.subtitle} selectable>{subtitle}</Text>

        {/* Nuclear Package - special layout */}
        {mode === 'nuclear' && (
          <>
            <View style={styles.nuclearInfo}>
              <Text style={styles.nuclearHeadline}>Everything. Analyzed.</Text>
              <View style={styles.nuclearItem}>
                <Text style={styles.nuclearLabel}>{userName}'s Full Reading</Text>
                <Text style={styles.nuclearMeta}>5 systems · {PRODUCTS.complete_reading.pagesMin} pages</Text>
              </View>
              <View style={styles.nuclearItem}>
                <Text style={styles.nuclearLabel}>{partnerName}'s Full Reading</Text>
                <Text style={styles.nuclearMeta}>5 systems · {PRODUCTS.complete_reading.pagesMin} pages</Text>
              </View>
              <View style={styles.nuclearItem}>
                <Text style={styles.nuclearLabel}>Combined Overlays + Verdict</Text>
                <Text style={styles.nuclearMeta}>6 documents · {PRODUCTS.nuclear_package.pagesMin - (PRODUCTS.complete_reading.pagesMin * 2)} pages</Text>
              </View>
              <View style={styles.nuclearTotal}>
                <Text style={styles.nuclearTotalText}>{PRODUCTS.nuclear_package.pagesMin} pages · {formatAudioDuration(PRODUCTS.nuclear_package.audioMinutes)} audio</Text>
              </View>
            </View>
            <View style={styles.whyDifferentSection}>
              <WhyDifferentCard variant="compact" />
            </View>
          </>
        )}

        {/* Product list */}
        <View style={styles.productList}>
          {products.map((product) => {
            const isSelected = selectedProduct === product.id;
            const isNavItem = product.id.startsWith('nav_');

            return (
              <Pressable
                key={product.id}
                style={[
                  styles.productCard,
                  isSelected && styles.productCardSelected,
                  'isBundle' in product && product.isBundle && styles.productCardBundle,
                  isNavItem && styles.productCardNav,
                ]}
                onPress={() => handleSelectProduct(product)}
              >
                <View style={styles.productHeader}>
                  <Text style={styles.productName} selectable>{product.name}</Text>
                  {!isNavItem && <Text style={styles.productPrice}>{product.priceLabel}</Text>}
                  {isNavItem && <Text style={styles.navArrow}>→</Text>}
                </View>
                <Text style={styles.productMeta}>{product.meta}</Text>
                {'isBundle' in product && product.isBundle && !isNavItem && (
                  <View style={styles.bundleBadge}>
                    <Text style={styles.bundleBadgeText}>
                      {product.savingsLabel ? `${product.savingsLabel} · Best Value` : 'Best Value'}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer - only show if not in navigation mode */}
      {mode !== 'all' && (
        <View style={styles.footer}>
          {selectedProduct && selectedProductInfo ? (
            <>
              {isDeveloperAccount && (
                <View style={styles.devBadge}>
                  <Text style={styles.devBadgeText}>🔧 DEV MODE - Payment Bypassed</Text>
                </View>
              )}
              <Button
                label={
                  isPurchasing
                    ? 'Processing...'
                    : selectedStorePriceLabel
                      ? `Purchase - ${selectedStorePriceLabel}`
                      : 'Price unavailable'
                }
                onPress={handlePurchase}
                loading={isPurchasing}
                disabled={isPurchasing || !isRevenueCatReady || !selectedHasStorePrice}
              />
              {!isRevenueCatReady && (
                <Text style={styles.loadingText}>Initializing payment system...</Text>
              )}
              {!selectedHasStorePrice && (
                <Text style={styles.loadingText}>Product not mapped to a live store price yet.</Text>
              )}
              <Text style={styles.footerNote}>
                All sales final. No refunds. Manual fixes for technical issues.
              </Text>
            </>
          ) : (
            <Text style={styles.footerNote}>Select a product to continue</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedText,
    marginBottom: spacing.xl,
  },
  nuclearInfo: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  nuclearHeadline: {
    ...typography.h2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  nuclearItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nuclearLabel: {
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  nuclearMeta: {
    ...typography.caption,
    color: colors.mutedText,
  },
  nuclearTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  nuclearTotalText: {
    ...typography.bodyBold,
    textAlign: 'center',
    color: colors.primary,
  },
  whyDifferentSection: {
    marginBottom: spacing.lg,
  },
  productList: {
    gap: spacing.md,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  productCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  productCardBundle: {
    borderColor: colors.primary,
  },
  productCardNav: {
    borderColor: colors.border,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  productName: {
    ...typography.bodyBold,
    flex: 1,
  },
  productPrice: {
    ...typography.h3,
    color: colors.primary,
  },
  navArrow: {
    ...typography.h3,
    color: colors.mutedText,
  },
  productMeta: {
    ...typography.caption,
    color: colors.mutedText,
  },
  bundleBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
  },
  bundleBadgeText: {
    ...typography.captionBold,
    color: '#FFFFFF',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  devBadge: {
    backgroundColor: colors.warning,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  devBadgeText: {
    ...typography.captionBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  footerNote: {
    ...typography.caption,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
