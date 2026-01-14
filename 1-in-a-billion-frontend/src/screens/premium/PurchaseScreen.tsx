/**
 * PURCHASE SCREEN - Contextual Product Offers
 * 
 * Shows different products based on WHERE user came from (mode param).
 * Never shows everything at once - always contextual.
 * 
 * PAYMENT: Stripe (Apple Pay, Google Pay, Cards)
 * REFUND POLICY: All sales final. Manual fixes for technical issues only.
 * Support: contact@1-in-a-billion.app
 * 
 * NOTE: Stripe native modules require a development build (not Expo Go).
 * Developer bypass works regardless of Stripe availability.
 */

import { useState, useMemo } from 'react';
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
  createPaymentIntent,
  createYearlySubscriptionIntent,
  mapToProductId,
  extractSystemFromProductId,
  getPaymentConfig,
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
  meta: string;
  isBundle?: boolean;
};

const SYSTEMS = ['Western', 'Vedic', 'Human Design', 'Gene Keys', 'Kabbalah'] as const;

export const PurchaseScreen = ({ navigation, route }: Props) => {
  const { preselectedProduct, onPurchaseComplete, mode = 'all', partnerName: routePartnerName, afterPurchaseParams } = route.params || {} as any;
  const [selectedProduct, setSelectedProduct] = useState<string | null>(preselectedProduct || null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
            })),
            {
              id: 'user_all_five',
              name: 'All 5 Systems',
              price: PRODUCTS.complete_reading.priceUSD,
              meta: `${PRODUCTS.complete_reading.pagesMin} pages · ${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · Save $${PRODUCTS.complete_reading.savingsUSD}`,
              isBundle: true,
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
            })),
            {
              id: 'partner_all_five',
              name: 'All 5 Systems',
              price: PRODUCTS.complete_reading.priceUSD,
              meta: `${PRODUCTS.complete_reading.pagesMin} pages · ${formatAudioDuration(PRODUCTS.complete_reading.audioMinutes)} audio · Save $${PRODUCTS.complete_reading.savingsUSD}`,
              isBundle: true,
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
            })),
            {
              id: 'nuclear_package',
              name: 'Nuclear Package (All 5)',
              price: PRODUCTS.nuclear_package.priceUSD,
              meta: `${PRODUCTS.nuclear_package.pagesMin} pages · ${formatAudioDuration(PRODUCTS.nuclear_package.audioMinutes)} audio`,
              isBundle: true,
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
  }, [mode, userName, partnerName, partners.length]);

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
      if (isDeveloperAccount) {
        console.log('🔧 DEV BYPASS: Skipping payment for developer account');
        Alert.alert(
          'Developer Mode',
          'Payment bypassed for testing. Proceeding without charge.',
          [{ text: 'Continue', onPress: handlePurchaseSuccess }]
        );
        setIsPurchasing(false);
        return;
      }

      // Try to load Stripe dynamically
      let stripeModule: any;
      try {
        stripeModule = require('@stripe/stripe-react-native');
      } catch (e) {
        // Stripe not available - show message
        Alert.alert(
          'Payments Not Available',
          'Payment processing requires a full app build. Please use TestFlight or the production app to make purchases.\n\nNeed help? Contact contact@1-in-a-billion.app',
          [{ text: 'OK' }]
        );
        setIsPurchasing(false);
        return;
      }

      // Fetch publishable key (must match secret mode: test vs live)
      const cfg = await getPaymentConfig();
      const publishableKey = cfg?.publishableKey?.trim();
      if (!publishableKey) {
        Alert.alert(
          'Payments Not Configured',
          'Stripe publishable key is missing. This must be configured on the backend (test key for sandbox).\n\nContact contact@1-in-a-billion.app if you need help.',
          [{ text: 'OK' }]
        );
        setIsPurchasing(false);
        return;
      }

      // Initialize Stripe native SDK (required for PaymentSheet)
      // NOTE: This requires a dev build / TestFlight build (Expo Go will not have native modules).
      if (typeof stripeModule.initStripe === 'function') {
        await stripeModule.initStripe({
          publishableKey,
          merchantIdentifier: 'merchant.com.oneinabillion.app',
          // Must match app.json scheme for 3DS redirects
          urlScheme: 'oneinabillion',
        });
      }

      const isSubscription = mode === 'subscription' || selectedProduct === 'yearly_subscription';

      // Determine person/partner IDs
      const isOverlay = selectedProduct.startsWith('overlay_') || selectedProduct === 'nuclear_package';
      const isPartner = selectedProduct.startsWith('partner_');
      
      let paymentIntentClientSecret: string;
      let customerId: string | undefined;
      let customerEphemeralKeySecret: string | undefined;

      if (isSubscription) {
        console.log('💳 Creating yearly subscription...');
        const sub = await createYearlySubscriptionIntent({
          userId: userId || 'anonymous',
          userEmail: userEmail || undefined,
        });
        if (!sub.success || !sub.paymentIntentClientSecret || !sub.customerId || !sub.ephemeralKeySecret) {
          throw new Error(sub.error || 'Failed to create subscription');
        }
        paymentIntentClientSecret = sub.paymentIntentClientSecret;
        customerId = sub.customerId;
        customerEphemeralKeySecret = sub.ephemeralKeySecret;
      } else {
        // Map frontend product to backend product ID
        const backendProductId = mapToProductId(selectedProduct);
        const systemId = extractSystemFromProductId(selectedProduct);

        // 1. Create PaymentIntent on backend
        console.log('💳 Creating PaymentIntent for:', backendProductId);
        const intentResult = await createPaymentIntent({
          userId,
          productId: backendProductId,
          systemId: systemId || undefined,
          personId: isPartner ? partners[0]?.id : user?.id,
          partnerId: isOverlay ? partners[0]?.id : undefined,
          readingType: isOverlay ? 'overlay' : 'individual',
          userEmail,
        });

        if (!intentResult.success || !intentResult.clientSecret) {
          throw new Error(intentResult.error || 'Failed to create payment');
        }

        paymentIntentClientSecret = intentResult.clientSecret;
        console.log('💳 PaymentIntent created:', intentResult.paymentIntentId);
      }
      
      // 2. Initialize Payment Sheet using imperative API
      const initPaymentSheet = stripeModule.initPaymentSheet;
      const presentPaymentSheet = stripeModule.presentPaymentSheet;
      if (typeof initPaymentSheet !== 'function' || typeof presentPaymentSheet !== 'function') {
        throw new Error('Stripe PaymentSheet API not available. Rebuild the app with Stripe native modules.');
      }
      
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntentClientSecret,
        ...(customerId && customerEphemeralKeySecret
          ? { customerId, customerEphemeralKeySecret }
          : {}),
        merchantDisplayName: '1 in a Billion',
        // Apple Pay configuration
        applePay: {
          merchantCountryCode: 'US',
        },
        // Google Pay configuration
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: __DEV__, // Use test environment in development
        },
        // Appearance customization to match app theme
        appearance: {
          colors: {
            primary: colors.primary,
            background: colors.background,
            componentBackground: colors.surface,
            componentBorder: colors.border,
            componentDivider: colors.border,
            primaryText: colors.text,
            secondaryText: colors.mutedText,
            placeholderText: colors.mutedText,
          },
        },
        // Return URL for 3DS/redirects
        returnURL: 'oneinabillion://stripe-redirect',
      });
      
      if (initError) {
        throw new Error(initError.message);
      }
      
      // 3. Present Payment Sheet
      console.log('💳 Presenting Payment Sheet...');
      const { error: presentError } = await presentPaymentSheet();
      
      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User cancelled - not an error
          console.log('💳 User cancelled payment');
          setIsPurchasing(false);
          return;
        }
        throw new Error(presentError.message);
      }
      
      // 4. Payment successful!
      console.log('✅ Payment successful!');
      setIsPurchasing(false);
      handlePurchaseSuccess();
      
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
});
