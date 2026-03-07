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
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { TIER_MONTHLY_READINGS } from '@/config/readingConfig';
import { useAuthStore } from '@/store/authStore';
import { useMusicStore } from '@/store/musicStore';
import { AmbientMusic } from '@/services/ambientMusic';
import { PricingMusic } from '@/services/pricingMusic'; // NEW
import { env } from '@/config/env';
import { t } from '@/i18n';
import {
  findBillionairePackage,
  findYearlySubscriptionPackage,
  getAvailableRevenueCatPackages,
  getPackagePriceString,
} from '@/config/revenuecatCatalog';
import {
  extractRevenueCatAppUserId,
  getOfferings,
  getRevenueCatCustomerInfo,
  initializeRevenueCat,
  purchasePackage,
  redeemCouponCode,
  restorePurchases,
  validateCouponCode,
  verifyEntitlementWithBackend,
} from '@/services/payments';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

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
    label: 'Dreamer',
    priceLabel: '$20',
    period: '/month',
    bullets: [
      `${TIER_MONTHLY_READINGS.basic} extended reading per month`,
      'Daily compatibility matching',
      'Narrated readings with audio & PDF',
    ],
  },
  {
    id: 'yearly',
    label: 'Expansion',
    priceLabel: '$40',
    period: '/month',
    bullets: [
      `${TIER_MONTHLY_READINGS.yearly} extended readings per month`,
      'Daily compatibility matching',
      'Narrated readings with audio & PDF',
      '1 synastry reading = 3 reading slots',
    ],
  },
  {
    id: 'billionaire',
    label: 'Soul Billionaire',
    priceLabel: '$1,000',
    period: '/month',
    bullets: [
      `${TIER_MONTHLY_READINGS.billionaire} extended readings per month`,
      'Daily compatibility matching',
      'Narrated readings with audio & PDF',
      '1 synastry reading = 3 reading slots',
    ],
  },
];

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
  const [iapRange, setIapRange] = useState<string>('$20 - $1,000');

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'redeeming'>('idle');
  const [couponMessage, setCouponMessage] = useState('');

  const isMusicLoaded = useMusicStore((s) => s.isMusicLoaded);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Music: fade out ambient, load & play pricing music ── */
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      // 1. Fade out the main ambient track so it's not layered
      if (isMusicLoaded) {
        AmbientMusic.fadeOut(2000);
      }

      // 2. Load and start the special pricing track
      (async () => {
        await PricingMusic.load();
        if (!isActive) return;

        PricingMusic.restart(0);
        // After 2 seconds, fade in over 2 seconds
        fadeTimerRef.current = setTimeout(() => {
          if (isActive) PricingMusic.fadeIn(2000);
        }, 2000);
      })();

      return () => {
        isActive = false;
        // Leaving screen: cancel pending fade-in and fade out the pricing music
        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        PricingMusic.fadeOut(2000);

        // NOTE: We don't automatically resume AmbientMusic here. 
        // Whichever screen we return to (like Intro) will handle resuming AmbientMusic via its own useFocusEffect.
      };
    }, [isMusicLoaded])
  );

  /* ── Load RevenueCat prices ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      const ready = await initializeRevenueCat(userId);
      if (!ready || !alive) return;

      const off = await getOfferings();
      if (!alive) return;
      setOfferings(off);

      const packages = getAvailableRevenueCatPackages(off);

      // Try to populate live prices
      const yearly = findYearlySubscriptionPackage(off);
      const yearlyPrice = getPackagePriceString(yearly);
      if (yearlyPrice) {
        setLivePrices((prev) => ({ ...prev, yearly: yearlyPrice }));
      }

      // Try basic (by product ID since all tiers are now monthly)
      const basic = packages.find((p: any) => {
        const prodId = p?.product?.identifier || p?.storeProduct?.identifier || '';
        return String(prodId) === 'basic_monthly';
      }) || packages.find((p: any) => String(p?.identifier || '') === 'basic_monthly');
      const monthlyPrice = getPackagePriceString(basic);
      if (monthlyPrice) {
        setLivePrices((prev) => ({ ...prev, basic: monthlyPrice }));
      }

      // Try billionaire (multi-strategy: identifier → product ID → most expensive)
      const billionaire = findBillionairePackage(off);
      const billionairePrice = getPackagePriceString(billionaire);
      if (billionairePrice) {
        setLivePrices((prev) => ({ ...prev, billionaire: billionairePrice }));
      }

      // Calculate min/max range for in-app purchases note
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      let minString = '';
      let maxString = '';

      for (const p of packages) {
        const priceNum = p?.product?.price ?? p?.storeProduct?.price;
        const pString = getPackagePriceString(p);
        if (typeof priceNum === 'number' && pString) {
          if (priceNum < minPrice) { minPrice = priceNum; minString = pString; }
          if (priceNum > maxPrice) { maxPrice = priceNum; maxString = pString; }
        }
      }

      if (minString && maxString) {
        setIapRange(minString === maxString ? minString : `${minString} - ${maxString}`);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  /* ── Coupon handlers ── */
  const handleCouponValidate = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) return;

    // Hidden ILOVEYOU bypass
    if (code === 'ILOVEYOU') {
      setCouponStatus('valid');
      setCouponMessage('ILOVEYOU bypass activated!');
      setTimeout(() => {
        navigation.navigate('Account', { fromPayment: true });
      }, 1000);
      return;
    }

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
  }, [couponCode, navigation]);

  /* ── Restore purchases handler ── */
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (!result.success) {
        Alert.alert('Restore Failed', result.error || 'Could not restore purchases.');
        return;
      }
      const info = result.customerInfo;
      const appUserId = extractRevenueCatAppUserId(info);
      if (!appUserId) {
        Alert.alert('No Purchases Found', 'No previous subscriptions were found for this account.');
        return;
      }
      const verification = await verifyEntitlementWithBackend({ appUserId });
      if (verification.success && verification.active) {
        navigation.navigate('Account', {
          fromPayment: true,
          revenueCatAppUserId: verification.appUserId || appUserId,
        });
      } else {
        Alert.alert('No Active Subscription', 'No active subscription was found. If you believe this is an error, please contact support.');
      }
    } catch (e: any) {
      Alert.alert('Restore Failed', e?.message || 'Something went wrong.');
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring, navigation]);

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
        pkg = packages.find((p) => {
          const prodId = p?.product?.identifier || p?.storeProduct?.identifier || '';
          return String(prodId) === 'basic_monthly';
        }) || packages.find((p) => String(p?.identifier || '') === 'basic_monthly') || null;
      } else if (tierId === 'billionaire') {
        pkg = findBillionairePackage(off);
      }

      if (!pkg) {
        const pkgs = getAvailableRevenueCatPackages(off);
        const ids = pkgs.map((p: any) => {
          const pid = p?.product?.identifier || p?.storeProduct?.identifier || p?.identifier || '?';
          return pid;
        }).join(', ');
        Alert.alert(
          'Subscription unavailable',
          `Could not match tier "${tierId}".\n\nAvailable packages (${pkgs.length}): ${ids || 'NONE'}\n\nOffering: ${off?.current?.identifier || 'null'}`,
        );
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
      <BackButton onPress={() => navigation.goBack()} />
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
            {t('pricing.iapNote')} {iapRange}
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

          {/* ── Restore purchases (Apple requires visibility) ── */}
          <TouchableOpacity
            onPress={handleRestore}
            disabled={isRestoring}
            style={styles.restoreBtn}
            accessibilityRole="button"
            accessibilityLabel="Restore Purchases"
          >
            {isRestoring ? (
              <ActivityIndicator color={colors.textDim} size="small" />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
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
    paddingTop: 80,
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

  /* ── Restore purchases ── */
  restoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  restoreText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textDim,
    textDecorationLine: 'underline',
  },
});
