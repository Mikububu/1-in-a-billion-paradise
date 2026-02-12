import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { env } from '@/config/env';
import { colors, spacing, typography } from '@/theme/tokens';
import { useAuthStore } from '@/store/authStore';
import {
  extractRevenueCatAppUserId,
  getOfferings,
  getRevenueCatCustomerInfo,
  initializeRevenueCat,
  purchasePackage,
  verifyEntitlementWithBackend,
} from '@/services/payments';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostHookOffer'>;

const { width: PAGE_W } = Dimensions.get('window');

type OfferPage = {
  title: string;
  body: string;
};

export const PostHookOfferScreen = ({ navigation }: Props) => {
  const userId = useAuthStore((s: any) => s.user?.id || null);
  const paymentBypassEnabled = env.ALLOW_PAYMENT_BYPASS;

  const pages = useMemo<OfferPage[]>(
    () => [
      {
        title: 'You are now in the top one percent',
        body: 'Your core identity and partner compatibility baseline are prepared.',
      },
      {
        title: 'We keep searching while you live',
        body: 'Your dashboard will keep evolving as your chart and matches update.',
      },
      {
        title: 'Enter Secret Lives',
        body: 'You can always swipe back through your hook path, and continue from Home.',
      },
    ],
    []
  );

  const [page, setPage] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [yearlyPrice, setYearlyPrice] = useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    const loadPrice = async () => {
      const ready = await initializeRevenueCat(userId);
      if (!ready || !alive) return;

      const offerings = await getOfferings();
      const packages = offerings?.current?.availablePackages ?? [];
      const yearly = packages.find(
        (p: any) =>
          p?.identifier === 'yearly_subscription' ||
          p?.packageType === 'ANNUAL' ||
          p?.identifier === 'yearly_subscription_990'
      );
      const price =
        yearly?.product?.priceString ||
        yearly?.storeProduct?.priceString ||
        null;

      if (alive && price) setYearlyPrice(price);
    };

    loadPrice();
    return () => {
      alive = false;
    };
  }, [userId]);

  const handleRevenueCatPurchase = async () => {
    if (isPaying) return;
    setIsPaying(true);

    try {
      const ready = await initializeRevenueCat(userId);
      if (!ready) {
        Alert.alert('Payment unavailable', 'RevenueCat is not available in this build.');
        return;
      }

      const offerings = await getOfferings();
      const packages = offerings?.current?.availablePackages ?? [];
      const yearly = packages.find(
        (p: any) =>
          p?.identifier === 'yearly_subscription' ||
          p?.packageType === 'ANNUAL' ||
          p?.identifier === 'yearly_subscription_990'
      );

      if (!yearly) {
        Alert.alert('Subscription unavailable', 'Could not find the yearly subscription package.');
        return;
      }

      const result = await purchasePackage(yearly);
      if (result.success) {
        const info = result.customerInfo || (await getRevenueCatCustomerInfo());
        const appUserId = extractRevenueCatAppUserId(info);

        if (!appUserId) {
          if (paymentBypassEnabled) {
            Alert.alert('Bypass active', 'Proceeding without entitlement verification (dev bypass).');
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
          Alert.alert('Bypass active', 'Proceeding without server entitlement verification (dev bypass).');
          navigation.navigate('Account', {
            fromPayment: true,
            revenueCatAppUserId: appUserId,
          });
          return;
        }

        Alert.alert(
          'Payment not verified yet',
          verification.error || 'Your subscription is not active yet. Please try again in a few seconds.'
        );
        return;
      }

      if (result.error && result.error !== 'cancelled') {
        Alert.alert('Payment failed', result.error);
      }
    } finally {
      setIsPaying(false);
    }
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
    setPage(index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, idx) => `${item.title}-${idx}`}
        onScrollBeginDrag={(e) => {
          swipeStartX.current = e.nativeEvent.contentOffset.x;
        }}
        onScrollEndDrag={(e) => {
          const start = swipeStartX.current;
          if (start == null) return;
          const end = e.nativeEvent.contentOffset.x;
          const delta = end - start;
          if (page === 0 && delta < -40) {
            navigation.goBack();
          }
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item }) => (
          <View style={[styles.page, { width: PAGE_W }]}> 
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === page && styles.dotActive]} />
          ))}
        </View>

        <Button
          label={
            isPaying
              ? 'Opening RevenueCat...'
              : yearlyPrice
                ? `Pay ${yearlyPrice}/yr`
                : 'Pay Yearly Subscription'
          }
          onPress={handleRevenueCatPurchase}
          style={styles.cta}
        />

        {isPaying ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing.page,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 36,
    lineHeight: 42,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: typography.sansRegular,
    fontSize: 18,
    lineHeight: 28,
    color: colors.mutedText,
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.primary,
  },
  cta: {
    width: '100%',
  },
});
