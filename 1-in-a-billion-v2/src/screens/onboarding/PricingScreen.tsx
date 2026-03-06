import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { TIER_MONTHLY_READINGS } from '@/config/readingConfig';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';
import { t } from '@/i18n';
import {
  findYearlySubscriptionPackage,
  getAvailableRevenueCatPackages,
  getPackageByIdentifier,
  getPackagePriceString,
} from '@/config/revenuecatCatalog';
import {
  extractRevenueCatAppUserId,
  getOfferings,
  getRevenueCatCustomerInfo,
  initializeRevenueCat,
  purchasePackage,
  redeemCouponCode,
  validateCouponCode,
  verifyEntitlementWithBackend,
} from '@/services/payments';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Pricing'>;

/* ── Tier definitions ─────────────────────────────────────────────── */

type TierDef = {
  id: string;
  label: string;
  priceLabel: string; // display fallback; overridden by RevenueCat if available
  period: string;
  bullets: string[];
};

const TIERS: TierDef[] = [
  {
    id: 'basic',
    label: 'Basic',
    priceLabel: '$21',
    period: '/month',
    bullets: [
      `${TIER_MONTHLY_READINGS.basic} extended reading per month`,
      'Daily compatibility matching',
      'Ongoing background resonance updates',
    ],
  },
  {
    id: 'yearly',
    label: 'Yogi',
    priceLabel: '$108',
    period: '/year',
    bullets: [
      `${TIER_MONTHLY_READINGS.yearly} extended readings per month`,
      'Daily compatibility matching',
      'Narrated readings with audio & PDF',
      '1 synastry reading = 3 reading slots',
    ],
  },
  {
    id: 'billionaire',
    label: 'Billionaire',
    priceLabel: '$834',
    period: '/month',
    bullets: [
      `${TIER_MONTHLY_READINGS.billionaire} extended readings per month`,
      'Daily compatibility matching',
      'Narrated readings with audio & PDF',
      '1 synastry reading = 3 reading slots',
    ],
  },
];

const IAP_RANGE = '$14 - $108';

/* ── Component ────────────────────────────────────────────────────── */

export const PricingScreen = ({ navigation }: Props) => {
  const userId = useAuthStore((s: any) => s.user?.id || null);
  const paymentBypassEnabled = env.ALLOW_PAYMENT_BYPASS;

  const [isPaying, setIsPaying] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const borderAnim = useRef(new Animated.Value(0)).current;

  // Live prices from RevenueCat
  const [livePrices, setLivePrices] = useState<Record<string, string>>({});
  const [offerings, setOfferings] = useState<any>(null);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'redeeming'>('idle');
  const [couponMessage, setCouponMessage] = useState('');

  /* ── Load RevenueCat prices ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      const ready = await initializeRevenueCat(userId);
      if (!ready || !alive) return;

      const off = await getOfferings();
      if (!alive) return;
      setOfferings(off);

      // Try to populate live prices
      const yearly = findYearlySubscriptionPackage(off);
      const yearlyPrice = getPackagePriceString(yearly);
      if (yearlyPrice) {
        setLivePrices((prev) => ({ ...prev, yearly: yearlyPrice }));
      }

      // Try basic (monthly)
      const packages = getAvailableRevenueCatPackages(off);
      const monthly = packages.find(
        (p) => String(p?.packageType || '').toUpperCase() === 'MONTHLY',
      );
      const monthlyPrice = getPackagePriceString(monthly);
      if (monthlyPrice) {
        setLivePrices((prev) => ({ ...prev, basic: monthlyPrice }));
      }

      // Try billionaire
      const billionaire =
        getPackageByIdentifier(off, 'billionaire') ||
        getPackageByIdentifier(off, 'billionaire_monthly');
      const billionairePrice = getPackagePriceString(billionaire);
      if (billionairePrice) {
        setLivePrices((prev) => ({ ...prev, billionaire: billionairePrice }));
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  /* ── Coupon handlers ── */
  const handleCouponValidate = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponStatus('validating');
    setCouponMessage('');
    const result = await validateCouponCode(code);
    if (result.valid) {
      setCouponStatus('valid');
      setCouponMessage(result.message || 'Valid code!');
    } else {
      setCouponStatus('invalid');
      setCouponMessage(result.message || result.error || 'Invalid code');
    }
  }, [couponCode]);

  const handleCouponRedeem = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponStatus('redeeming');
    const result = await redeemCouponCode(code);

    if (result.success && result.subscription_active) {
      navigation.navigate('Account', {
        fromPayment: true,
        couponRedemptionId: result.redemption_id,
        couponCustomerId: result.coupon_customer_id,
      });
      setCouponStatus('idle');
      return;
    }
    if (!result.success) {
      setCouponStatus('invalid');
      setCouponMessage(result.error || 'Could not redeem code');
      return;
    }
    setCouponStatus('valid');
    setCouponMessage(`${result.discount_percent}% discount applied! Proceed with payment.`);
  }, [couponCode, navigation]);

  /* ── Tap handler: first tap selects, second tap purchases ── */
  const handleCardTap = useCallback((tierId: string) => {
    if (isPaying) return;
    if (selectedTier === tierId) {
      // Second tap — purchase
      handlePurchase(tierId);
    } else {
      // First tap — select with animation
      setSelectedTier(tierId);
      borderAnim.setValue(0);
      Animated.timing(borderAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, [isPaying, selectedTier, borderAnim]);

  /* ── Purchase handler ── */
  const handlePurchase = useCallback(async (tierId: string) => {
    if (isPaying) return;
    setIsPaying(true);

    try {
      if (paymentBypassEnabled) {
        navigation.navigate('Account', { fromPayment: true });
        return;
      }

      const ready = await initializeRevenueCat(userId);
      if (!ready) {
        Alert.alert(t('pricing.paymentUnavailable.title'), t('pricing.paymentUnavailable.message'));
        return;
      }

      const off = offerings || (await getOfferings());

      // Resolve the right package
      let pkg: any = null;
      if (tierId === 'yearly') {
        pkg = findYearlySubscriptionPackage(off);
      } else if (tierId === 'basic') {
        const packages = getAvailableRevenueCatPackages(off);
        pkg = packages.find((p) => String(p?.packageType || '').toUpperCase() === 'MONTHLY') || null;
      } else if (tierId === 'billionaire') {
        // Look for billionaire package by identifier
        pkg = getPackageByIdentifier(off, 'billionaire') ||
              getPackageByIdentifier(off, 'billionaire_monthly');
        if (!pkg) {
          // Fallback: find the most expensive package
          const packages = getAvailableRevenueCatPackages(off);
          const sorted = [...packages].sort((a, b) => {
            const pa = a?.product?.price ?? a?.storeProduct?.price ?? 0;
            const pb = b?.product?.price ?? b?.storeProduct?.price ?? 0;
            return pb - pa;
          });
          pkg = sorted[0] || null;
        }
      }

      if (!pkg) {
        Alert.alert(t('pricing.subscriptionUnavailable.title'), t('pricing.subscriptionUnavailable.message'));
        return;
      }

      const result = await purchasePackage(pkg);
      if (result.success) {
        const info = result.customerInfo || (await getRevenueCatCustomerInfo());
        const appUserId = extractRevenueCatAppUserId(info);

        if (!appUserId) {
          if (paymentBypassEnabled) {
            navigation.navigate('Account', { fromPayment: true });
            return;
          }
          Alert.alert(t('pricing.verificationFailed.title'), t('pricing.verificationFailed.message'));
          return;
        }

        const verification = await verifyEntitlementWithBackend({ appUserId });
        if (verification.success && verification.active) {
          navigation.navigate('Account', {
            fromPayment: true,
            revenueCatAppUserId: verification.appUserId || appUserId,
          });
          return;
        }

        if (paymentBypassEnabled) {
          navigation.navigate('Account', {
            fromPayment: true,
            revenueCatAppUserId: appUserId,
          });
          return;
        }

        Alert.alert(
          t('pricing.paymentNotVerified.title'),
          verification.error || t('pricing.paymentNotVerified.message'),
        );
        return;
      }

      if (result.error && result.error !== 'cancelled') {
        Alert.alert(t('pricing.paymentFailed.title'), result.error);
      }
    } finally {
      setIsPaying(false);
      setSelectedTier(null);
    }
  }, [isPaying, paymentBypassEnabled, userId, offerings, navigation]);

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.heading}>{t('pricing.title')}</Text>
        <Text style={styles.subheading}>
          {t('pricing.subtitle')}
        </Text>

        {/* ── Subscription tiers ── */}
        {TIERS.map((tier) => {
          const price = livePrices[tier.id] || tier.priceLabel;
          const isBuying = isPaying && selectedTier === tier.id;
          const isSelected = selectedTier === tier.id;

          const animatedBorderColor = isSelected
            ? borderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, colors.primary],
              })
            : colors.border;
          const animatedBorderWidth = isSelected
            ? borderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 2],
              })
            : 1;

          return (
            <TouchableOpacity
              key={tier.id}
              activeOpacity={0.85}
              onPress={() => handleCardTap(tier.id)}
              disabled={isPaying}
              accessibilityRole="button"
              accessibilityLabel={`Subscribe to ${tier.label} for ${price}${tier.period}`}
            >
              <Animated.View
                style={[
                  styles.card,
                  { borderColor: animatedBorderColor, borderWidth: animatedBorderWidth },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.tierLabel}>{tier.label}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>{price}</Text>
                    <Text style={styles.periodText}> {tier.period}</Text>
                  </View>
                </View>

                <View style={styles.bulletList}>
                  {tier.bullets.map((b, i) => (
                    <Text key={i} style={styles.bullet}>
                      {'  \u2022  '}{b}
                    </Text>
                  ))}
                </View>

                {isSelected && !isBuying && (
                  <Text style={styles.tapHint}>{t('pricing.tapAgain') || 'Tap again to subscribe'}</Text>
                )}

                {isBuying && (
                  <ActivityIndicator
                    color={colors.primary}
                    style={styles.cardLoader}
                  />
                )}
              </Animated.View>
            </TouchableOpacity>
          );
        })}

        {/* ── In-App Purchases note ── */}
        <Text style={styles.iapNote}>
          {t('pricing.iapNote')} {IAP_RANGE}
        </Text>

        {/* ── Coupon code - always visible ── */}
        <View style={styles.couponContainer}>
          <View style={styles.couponInputRow}>
            <TextInput
              style={styles.couponInput}
              placeholder={t('pricing.couponPlaceholder')}
              placeholderTextColor="#999"
              value={couponCode}
              onChangeText={(text) => {
                setCouponCode(text.toUpperCase());
                setCouponStatus('idle');
                setCouponMessage('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleCouponValidate}
            />
            <TouchableOpacity
              style={[
                styles.couponApplyBtn,
                couponStatus === 'valid' && styles.couponRedeemBtn,
              ]}
              onPress={couponStatus === 'valid' ? handleCouponRedeem : handleCouponValidate}
              disabled={
                couponStatus === 'validating' ||
                couponStatus === 'redeeming' ||
                !couponCode.trim()
              }
            >
              {couponStatus === 'validating' || couponStatus === 'redeeming' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.couponApplyText}>
                  {couponStatus === 'valid' ? t('pricing.couponRedeem') : t('pricing.couponApply')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {couponMessage ? (
            <Text
              style={[
                styles.couponMessage,
                couponStatus === 'valid' && styles.couponMessageValid,
                couponStatus === 'invalid' && styles.couponMessageInvalid,
              ]}
            >
              {couponMessage}
            </Text>
          ) : null}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    justifyContent: 'center',
  },
  heading: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  subheading: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },

  /* ── Tier cards ── */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  tierLabel: {
    fontFamily: typography.serifBold,
    fontSize: 19,
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.text,
  },
  periodText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textDim,
    marginLeft: 2,
  },
  bulletList: {
    marginTop: 0,
  },
  bullet: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 19,
  },
  tapHint: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 6,
  },
  cardLoader: {
    marginTop: 4,
  },

  /* ── IAP note - single line ── */
  iapNote: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  /* ── Coupon - always visible ── */
  couponContainer: {
    marginTop: 0,
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.inputBg,
    letterSpacing: 2,
  },
  couponApplyBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponRedeemBtn: {
    backgroundColor: colors.success,
  },
  couponApplyText: {
    fontFamily: typography.sansBold,
    fontSize: 15,
    color: '#fff',
  },
  couponMessage: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  couponMessageValid: {
    color: colors.success,
  },
  couponMessageInvalid: {
    color: colors.error,
  },
});
