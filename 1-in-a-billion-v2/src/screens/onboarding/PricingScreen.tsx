import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';
import {
  findYearlySubscriptionPackage,
  getAvailableRevenueCatPackages,
  getPackageByIdentifier,
  getPackagePriceString,
  RC_PACKAGE_IDENTIFIERS,
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
  highlight?: boolean; // visually emphasise
};

const TIERS: TierDef[] = [
  {
    id: 'basic',
    label: 'Basic',
    priceLabel: '$21',
    period: '/month',
    bullets: [
      'Daily compatibility matching',
      'Ongoing background resonance updates',
    ],
  },
  {
    id: 'yearly',
    label: 'Yearly',
    priceLabel: '$108',
    period: '/year',
    bullets: [
      'Daily compatibility matching',
      '1 in-depth personal astrology reading',
      '~40 minutes of narrated insight',
    ],
    highlight: true,
  },
  {
    id: 'billionaire',
    label: 'Billionaire',
    priceLabel: '$10,008',
    period: '/year',
    bullets: [
      'Daily compatibility matching',
      'Unlimited long-form in-app compatibility readings between any two profiles',
      'Fair use applies',
    ],
  },
];

const IAP_ITEMS = [
  'Compare yourself with anyone',
  'Compare any two people',
  'Deep narrative compatibility overlays',
];
const IAP_RANGE = '$14 – $108';

/* ── Component ────────────────────────────────────────────────────── */

export const PricingScreen = ({ navigation }: Props) => {
  const userId = useAuthStore((s: any) => s.user?.id || null);
  const paymentBypassEnabled = env.ALLOW_PAYMENT_BYPASS;

  const [isPaying, setIsPaying] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  // Live prices from RevenueCat
  const [livePrices, setLivePrices] = useState<Record<string, string>>({});
  const [offerings, setOfferings] = useState<any>(null);

  // Coupon
  const [showCoupon, setShowCoupon] = useState(false);
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

  /* ── Purchase handler ── */
  const handlePurchase = useCallback(async (tierId: string) => {
    if (isPaying) return;
    setIsPaying(true);
    setSelectedTier(tierId);

    try {
      if (paymentBypassEnabled) {
        navigation.navigate('Account', { fromPayment: true });
        return;
      }

      const ready = await initializeRevenueCat(userId);
      if (!ready) {
        Alert.alert('Payment unavailable', 'RevenueCat is not available in this build.');
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
              getPackageByIdentifier(off, 'billionaire_yearly');
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
        Alert.alert('Subscription unavailable', 'Could not find this subscription package. Please try a different tier.');
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
          Alert.alert('Verification failed', 'Could not identify purchase account. Please try again.');
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
          'Payment not verified yet',
          verification.error || 'Your subscription is not active yet. Please try again in a few seconds.',
        );
        return;
      }

      if (result.error && result.error !== 'cancelled') {
        Alert.alert('Payment failed', result.error);
      }
    } finally {
      setIsPaying(false);
      setSelectedTier(null);
    }
  }, [isPaying, paymentBypassEnabled, userId, offerings, navigation]);

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Choose Your Path</Text>
        <Text style={styles.subheading}>
          Unlock the stars. Pick the tier that resonates with you.
        </Text>

        {/* ── Subscription tiers ── */}
        {TIERS.map((tier) => {
          const price = livePrices[tier.id] || tier.priceLabel;
          const isBuying = isPaying && selectedTier === tier.id;

          return (
            <TouchableOpacity
              key={tier.id}
              style={[styles.card, tier.highlight && styles.cardHighlight]}
              activeOpacity={0.85}
              onPress={() => handlePurchase(tier.id)}
              disabled={isPaying}
              accessibilityRole="button"
              accessibilityLabel={`Subscribe to ${tier.label} for ${price}${tier.period}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.tierLabel}>{tier.label}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceText}>{price}</Text>
                  <Text style={styles.periodText}>{tier.period}</Text>
                </View>
              </View>

              <View style={styles.bulletList}>
                {tier.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {'  \u2022  '}{b}
                  </Text>
                ))}
              </View>

              {isBuying && (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.cardLoader}
                />
              )}
            </TouchableOpacity>
          );
        })}

        {/* ── In-App Purchases section ── */}
        <View style={styles.iapSection}>
          <Text style={styles.iapTitle}>In-App Purchases</Text>
          {IAP_ITEMS.map((item, i) => (
            <Text key={i} style={styles.bullet}>
              {'  \u2022  '}{item}
            </Text>
          ))}
          <Text style={styles.iapRange}>from {IAP_RANGE}</Text>
        </View>

        {/* ── Coupon code ── */}
        {!showCoupon ? (
          <TouchableOpacity
            onPress={() => setShowCoupon(true)}
            style={styles.couponToggle}
          >
            <Text style={styles.couponToggleText}>Have a coupon code?</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.couponContainer}>
            <View style={styles.couponInputRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter code"
                placeholderTextColor="#999"
                value={couponCode}
                onChangeText={(t) => {
                  setCouponCode(t.toUpperCase());
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
                    {couponStatus === 'valid' ? 'Redeem' : 'Apply'}
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
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  heading: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subheading: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },

  /* ── Tier cards ── */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  tierLabel: {
    fontFamily: typography.serifBold,
    fontSize: 22,
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.text,
  },
  periodText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textDim,
    marginLeft: 2,
  },
  bulletList: {
    marginTop: spacing.xs,
  },
  bullet: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textDim,
    lineHeight: 22,
  },
  cardLoader: {
    marginTop: spacing.sm,
  },

  /* ── IAP section ── */
  iapSection: {
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  iapTitle: {
    fontFamily: typography.serifBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  iapRange: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.text,
    marginTop: spacing.sm,
  },

  /* ── Coupon ── */
  couponToggle: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 6,
  },
  couponToggleText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textDim,
    textDecorationLine: 'underline',
  },
  couponContainer: {
    marginTop: spacing.sm,
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.inputBg,
    letterSpacing: 2,
  },
  couponApplyBtn: {
    height: 44,
    paddingHorizontal: 20,
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
    marginTop: 6,
    textAlign: 'center',
  },
  couponMessageValid: {
    color: colors.success,
  },
  couponMessageInvalid: {
    color: colors.error,
  },
});
