/**
 * PURCHASE SCREEN - Contextual Product Offers
 * 
 * Shows different products based on WHERE user came from (mode param).
 * Never shows everything at once - always contextual.
 * 
 * PAYMENT: RevenueCat (Apple Pay, Google Pay via native stores)
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
  getOfferings, 
  purchasePackage, 
  hasPremiumAccess,
  restorePurchases,
} from '@/services/revenuecat';

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
  meta: string;
  isBundle?: boolean;
  rcPackage?: any; // RevenueCat package if available
};

const SYSTEMS = ['Western', 'Vedic', 'Human Design', 'Gene Keys', 'Kabbalah'] as const;

export const PurchaseScreen = ({ navigation, route }: Props) => {
  const { preselectedProduct, onPurchaseComplete, mode = 'all', partnerName: routePartnerName, afterPurchaseParams } = route.params || {} as any;
  const [selectedProduct, setSelectedProduct] = useState<string | null>(preselectedProduct || null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [rcPackages, setRcPackages] = useState<any[]>([]);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);

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

  // Load RevenueCat offerings on mount
  useEffect(() => {
    const loadOfferings = async () => {
      try {
        const offering = await getOfferings();
        if (offering?.availablePackages) {
          setRcPackages(offering.availablePackages);
          console.log('📦 RevenueCat packages loaded:', offering.availablePackages.length);
        }
      } catch (error) {
        console.error('Failed to load offerings:', error);
      } finally {
        setIsLoadingOfferings(false);
      }
    };
    loadOfferings();
  }, []);

  // Build products based on mode
  const { title, subtitle, products } = useMemo(() => {
    switch (mode) {
      case 'subscription':
        return {
          title: 'Yearly Subscription',
          subtitle: '$9.90 / year',
          products: [
            {
              id: 'yearly_subscription',
              name: '1-Year Subscription',
              price: 9.9,
              meta: 'Weekly matching + 1 personal reading',
              isBundle: true,
              rcPackage: rcPackages.find(p => p.identifier === 'yearly_subscription'),
            },
          ],
        };
      case 'user_readings':
        return {
          title: 'Your Deep Readings',
          subtitle: `Unlock the full analysis of your chart`,
          products: [
            ...SYSTEMS.map(sys => ({
              id: `user_${sys.toLowerCase().replace(' ', '_')}`,
              name: `${sys} Deep Dive`,
              price: PRODUCTS.single_system.priceUSD,
              meta: `${PRODUCTS.single_system.pagesMin} page PDF · ${PRODUCTS.single_system.audioMinutes} min audio`,
              rcPackage: rcPackages.find(p => p.identifier === 'single_system'),
            })),
            {
              id: 'user_all_five',
              name: 'All 5 Systems',
              price: PRODUCTS.complete_reading.priceUSD,
              meta: `${PRODUCTS.complete_reading.pagesMin} pages · ${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · Save $${PRODUCTS.complete_reading.savingsUSD}`,
              isBundle: true,
              rcPackage: rcPackages.find(p => p.identifier === 'complete_reading'),
            },
          ],
        };

      case 'partner_readings':
        return {
          title: `${partnerName}'s Deep Readings`,
          subtitle: `Unlock the full analysis of ${partnerName}'s chart`,
          products: [
            ...SYSTEMS.map(sys => ({
              id: `partner_${sys.toLowerCase().replace(' ', '_')}`,
              name: `${sys} Deep Dive`,
              price: PRODUCTS.single_system.priceUSD,
              meta: `${PRODUCTS.single_system.pagesMin} page PDF · ${PRODUCTS.single_system.audioMinutes} min audio`,
              rcPackage: rcPackages.find(p => p.identifier === 'single_system'),
            })),
            {
              id: 'partner_all_five',
              name: 'All 5 Systems',
              price: PRODUCTS.complete_reading.priceUSD,
              meta: `${PRODUCTS.complete_reading.pagesMin} pages · ${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · Save $${PRODUCTS.complete_reading.savingsUSD}`,
              isBundle: true,
              rcPackage: rcPackages.find(p => p.identifier === 'complete_reading'),
            },
          ],
        };

      case 'overlays':
        return {
          title: 'Compatibility Analysis',
          subtitle: `${userName} & ${partnerName}`,
          products: [
            ...SYSTEMS.map(sys => ({
              id: `overlay_${sys.toLowerCase().replace(' ', '_')}`,
              name: `${sys} Overlay`,
              price: PRODUCTS.compatibility_overlay.priceUSD,
              meta: `${PRODUCTS.compatibility_overlay.pagesMin} pages · ${PRODUCTS.compatibility_overlay.audioMinutes} min audio`,
              rcPackage: rcPackages.find(p => p.identifier === 'compatibility_overlay'),
            })),
            {
              id: 'nuclear_package',
              name: 'Nuclear Package (All 5)',
              price: PRODUCTS.nuclear_package.priceUSD,
              meta: `${PRODUCTS.nuclear_package.pagesMin} pages · ${formatAudioDuration(PRODUCTS.nuclear_package.audioMinutes)} audio`,
              isBundle: true,
              rcPackage: rcPackages.find(p => p.identifier === 'nuclear_package'),
            },
          ],
        };

      case 'nuclear':
        return {
          title: 'Nuclear Package',
          subtitle: 'The ultimate relationship analysis',
          products: [
            {
              id: 'nuclear_package',
              name: 'Complete Analysis',
              price: PRODUCTS.nuclear_package.priceUSD,
              meta: `${PRODUCTS.nuclear_package.pagesMin} pages · ${formatAudioDuration(PRODUCTS.nuclear_package.audioMinutes)} audio`,
              isBundle: true,
              rcPackage: rcPackages.find(p => p.identifier === 'nuclear_package'),
            },
          ],
        };

      default:
        // Simplified "all" view - just categories
        return {
          title: 'All Readings',
          subtitle: 'Choose what to explore',
          products: [
            { id: 'nav_user', name: userName === 'User' ? "Soul's Reading" : `${userName}'s Reading`, price: PRODUCTS.single_system.priceUSD, meta: `From $${PRODUCTS.single_system.priceUSD} per system` },
            ...(partners.length > 0 ? [
              { id: 'nav_partner', name: `${partnerName}'s Readings`, price: PRODUCTS.single_system.priceUSD, meta: `From $${PRODUCTS.single_system.priceUSD} per system` },
              { id: 'nav_overlays', name: 'Compatibility Overlays', price: PRODUCTS.compatibility_overlay.priceUSD, meta: `From $${PRODUCTS.compatibility_overlay.priceUSD} per system` },
              { id: 'nav_nuclear', name: 'Nuclear Package', price: PRODUCTS.nuclear_package.priceUSD, meta: `${PRODUCTS.nuclear_package.pagesMin} pages · ${formatAudioDuration(PRODUCTS.nuclear_package.audioMinutes)}`, isBundle: true },
            ] : []),
          ],
        };
    }
  }, [mode, userName, partnerName, partners.length, rcPackages]);

  const selectedProductInfo = products.find(p => p.id === selectedProduct);

  const handleSelectProduct = (product: Product) => {
    // Navigation items in "all" mode
    if (product.id === 'nav_user') {
      navigation.push('Purchase', { mode: 'user_readings' });
      return;
    }
    if (product.id === 'nav_partner') {
      navigation.push('Purchase', { mode: 'partner_readings', partnerName });
      return;
    }
    if (product.id === 'nav_overlays') {
      navigation.push('Purchase', { mode: 'overlays', partnerName });
      return;
    }
    if (product.id === 'nav_nuclear') {
      navigation.push('Purchase', { mode: 'nuclear', partnerName });
      return;
    }

    // Nuclear needs explanation
    if (product.id === 'nuclear_package') {
      const np = PRODUCTS.nuclear_package;
      Alert.alert(
        `Nuclear Relationship Package - $${np.priceUSD}`,
        `The deepest analysis possible:\n\n` +
        `16 documents across 5 systems\n` +
        `Total: ${np.pagesMin} pages · ${formatAudioDuration(np.audioMinutes)} audio\n\n` +
        `Generation takes 15-20 minutes`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Select', onPress: () => setSelectedProduct(product.id) },
        ]
      );
      return;
    }

    setSelectedProduct(product.id);
  };

  const handlePurchaseSuccess = () => {
    // If we have afterPurchaseParams, navigate to context injection screens
    if (afterPurchaseParams) {
      const { readingType, productType, systems, personName, userName, partnerName: pName, partnerBirthDate, partnerBirthTime, partnerBirthCity, person1Override, person2Override, personId, partnerId, forPartner } = afterPurchaseParams;
      
      const isOverlay = readingType === 'overlay';
      
      if (isOverlay && pName) {
        // Overlay reading → RelationshipContext
        navigation.replace('RelationshipContext', {
          readingType: 'overlay',
          forPartner: false,
          userName: userName || 'You',
          partnerName: pName,
          partnerBirthDate,
          partnerBirthTime,
          partnerBirthCity,
          preselectedSystem: systems?.length === 1 ? systems[0] : undefined,
          person1Override,
          person2Override,
          personId,
          partnerId,
          productType,
          systems,
        } as any);
      } else {
        // Individual reading → PersonalContext
        navigation.replace('PersonalContext', {
          personName: personName || 'You',
          readingType: forPartner ? 'other' : 'self',
          personBirthDate: forPartner ? partnerBirthDate : undefined,
          personBirthTime: forPartner ? partnerBirthTime : undefined,
          personBirthCity: forPartner ? partnerBirthCity : undefined,
          preselectedSystem: systems?.length === 1 ? systems[0] : undefined,
          person1Override,
          personId,
          productType,
          systems,
          forPartner,
        } as any);
      }
      return;
    }
    
    // Legacy behavior: show alert and go back
    Alert.alert('Purchase Successful', `You now have access to ${selectedProductInfo?.name}!`, [
      { text: 'Continue', onPress: () => { onPurchaseComplete?.(); navigation.goBack(); } },
    ]);
  };
  
  const handlePurchase = async () => {
    if (!selectedProduct || !selectedProductInfo) return;
    setIsPurchasing(true);
    setPaymentError(null);

    try {
      // DEVELOPER BYPASS: Skip payment for dev accounts
      if (isDeveloperAccount || __DEV__) {
        console.log('🔧 DEV BYPASS: Skipping payment for developer account');
        Alert.alert(
          'Developer Mode',
          'Payment bypassed for testing. Proceeding without charge.',
          [{ text: 'Continue', onPress: handlePurchaseSuccess }]
        );
        setIsPurchasing(false);
        return;
      }

      // Get the RevenueCat package for this product
      const rcPackage = (selectedProductInfo as Product).rcPackage;
      
      if (!rcPackage) {
        // No RevenueCat package configured - show message
        Alert.alert(
          'Product Not Available',
          'This product is not yet available for purchase. Please try again later or contact support.',
          [{ text: 'OK' }]
        );
        setIsPurchasing(false);
        return;
      }

      // Attempt purchase via RevenueCat
      console.log('💳 Starting RevenueCat purchase for:', rcPackage.identifier);
      const customerInfo = await purchasePackage(rcPackage);
      
      if (customerInfo) {
        // Purchase successful!
        console.log('✅ Purchase successful!');
        setIsPurchasing(false);
        handlePurchaseSuccess();
      } else {
        // User cancelled
        console.log('ℹ️ Purchase cancelled by user');
        setIsPurchasing(false);
      }
      
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setPaymentError(error.message || 'Payment failed');
      setIsPurchasing(false);
      
      Alert.alert(
        'Payment Failed',
        `${error.message || 'An error occurred during payment.'}\n\nNeed help? Contact contact@1-in-a-billion.app`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleRestorePurchases = async () => {
    setIsPurchasing(true);
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo) {
        const hasPremium = await hasPremiumAccess();
        if (hasPremium) {
          Alert.alert('Purchases Restored', 'Your previous purchases have been restored.', [{ text: 'OK' }]);
        } else {
          Alert.alert('No Purchases Found', 'No previous purchases were found for this account.', [{ text: 'OK' }]);
        }
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Failed to restore purchases.', [{ text: 'OK' }]);
    } finally {
      setIsPurchasing(false);
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
                  {!isNavItem && <Text style={styles.productPrice}>${product.price}</Text>}
                  {isNavItem && <Text style={styles.navArrow}>→</Text>}
                </View>
                <Text style={styles.productMeta}>{product.meta}</Text>
                {'isBundle' in product && product.isBundle && !isNavItem && (
                  <View style={styles.bundleBadge}>
                    <Text style={styles.bundleBadgeText}>Best Value</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Restore purchases link */}
        {mode !== 'all' && (
          <Pressable onPress={handleRestorePurchases} style={styles.restoreLink}>
            <Text style={styles.restoreLinkText}>Restore previous purchases</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Footer - only show if not in navigation mode */}
      {mode !== 'all' && (
        <View style={styles.footer}>
          {selectedProduct && selectedProductInfo ? (
            <>
              {(isDeveloperAccount || __DEV__) && (
                <View style={styles.devBadge}>
                  <Text style={styles.devBadgeText}>🔧 DEV MODE - Payment Bypassed</Text>
                </View>
              )}
              <Button
                label={isPurchasing ? 'Processing...' : `Purchase - $${selectedProductInfo.price}`}
                onPress={handlePurchase}
                loading={isPurchasing}
                disabled={isPurchasing}
              />
              <Text style={styles.refundPolicy}>
                All sales final. Questions? contact@1-in-a-billion.app
              </Text>
            </>
          ) : (
            <View style={styles.selectPrompt}>
              <Text style={styles.selectPromptText}>Select an option above</Text>
            </View>
          )}
          {paymentError && (
            <Text style={styles.errorText}>{paymentError}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
  title: { fontFamily: typography.headline, fontSize: 28, color: colors.text, fontStyle: 'italic' },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.xs, marginBottom: spacing.lg },

  // Nuclear special layout
  nuclearInfo: { marginBottom: spacing.lg, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radii.card },
  nuclearHeadline: { fontFamily: typography.headline, fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: spacing.md, fontStyle: 'italic' },
  nuclearItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  nuclearLabel: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.text },
  nuclearMeta: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, marginTop: 2 },
  nuclearTotal: { paddingTop: spacing.sm, alignItems: 'center' },
  nuclearTotalText: { fontFamily: typography.sansBold, fontSize: 14, color: colors.primary },
  whyDifferentSection: { marginBottom: spacing.lg },

  // Products
  productList: { gap: spacing.sm },
  productCard: { borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.background, position: 'relative' },
  productCardSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  productCardBundle: { borderColor: colors.primary },
  productCardNav: { borderStyle: 'dashed' },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.text, flex: 1, marginRight: spacing.sm },
  productPrice: { fontFamily: typography.sansBold, fontSize: 16, color: colors.primary },
  navArrow: { fontFamily: typography.sansBold, fontSize: 18, color: colors.primary },
  productMeta: { fontFamily: typography.sansRegular, color: colors.mutedText, fontSize: 13, marginTop: 4 },
  bundleBadge: { position: 'absolute', top: -8, right: 12, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  bundleBadgeText: { fontFamily: typography.sansSemiBold, color: '#FFFFFF', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Footer
  footer: { paddingHorizontal: spacing.page, paddingVertical: spacing.md },
  selectPrompt: { paddingVertical: spacing.sm, alignItems: 'center' },
  selectPromptText: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText },
  
  // No refunds policy text
  refundPolicy: { 
    fontFamily: typography.sansRegular, 
    fontSize: 11, 
    color: colors.mutedText, 
    textAlign: 'center', 
    marginTop: spacing.sm,
  },
  
  // Error text
  errorText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  
  // Developer badge
  devBadge: {
    backgroundColor: '#FFF3CD',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: spacing.sm,
    alignSelf: 'center',
  },
  devBadgeText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: '#856404',
  },

  // Restore purchases link
  restoreLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  restoreLinkText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
