import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Audio, ResizeMode, Video } from 'expo-av';
import { Button } from '@/components/Button';
import { env } from '@/config/env';
import { findYearlySubscriptionPackage, getPackagePriceString, PRICE_DISPLAY } from '@/config/revenuecatCatalog';
import { formatMarketingLengthPromise } from '@/config/readingOutputContracts';
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

type OfferPage = {
  title: string;
  bgVideo?: any;
};

const { width: PAGE_W } = Dimensions.get('window');
const DOTS_H = 24;
const BOTTOM_PADDING = 20;
const VIDEO_BAND_H = 200;
const CTA_AREA_H = 84;

const WOMAN_VIDEOS = [
  require('../../../assets/videos/offer_page1.mp4'),
  require('../../../assets/videos/offer_page2.mp4'),
  require('../../../assets/videos/offer_page3.mp4'),
] as const;

const FIVE_SYSTEMS = [
  { icon: require('../../../assets/images/systems/western.png'), name: 'Western Astrology', tagline: 'The Psychology of Your Soul' },
  { icon: require('../../../assets/images/systems/vedic.png'), name: 'Jyotish (Vedic)', tagline: 'The Light of Karma' },
  { icon: require('../../../assets/images/systems/human-design.png'), name: 'Human Design', tagline: 'Your Bodygraph Blueprint' },
  { icon: require('../../../assets/images/systems/gene-keys.png'), name: 'Gene Keys', tagline: 'Shadow -> Gift -> Siddhi' },
  { icon: require('../../../assets/images/systems/Kabbalah.png'), name: 'Kabbalah', tagline: 'The Tree of Life' },
] as const;

export const PostHookOfferScreen = ({ navigation }: Props) => {
  const listRef = useRef<FlatList<OfferPage>>(null);
  const isFocused = useIsFocused();
  const userId = useAuthStore((s: any) => s.user?.id || null);
  const paymentBypassEnabled = env.ALLOW_PAYMENT_BYPASS;

  const [page, setPage] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [yearlyPrice, setYearlyPrice] = useState<string | null>(null);
  const [videoPaused, setVideoPaused] = useState<boolean[]>([false, false, false]);

  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const systemFadeAnim = useRef(new Animated.Value(1)).current;
  const systemScaleAnim = useRef(new Animated.Value(1)).current;

  const completeReadingLengthPromise = useMemo(
    () => formatMarketingLengthPromise('bundle_5_readings') || 'Long-form audio & multi-page PDF',
    []
  );

  const pages = useMemo<OfferPage[]>(
    () => [
      {
        title: 'We search for you!\nEvery Week!',
        bgVideo: require('../../../assets/videos/we_search_for_you.mp4'),
      },
      {
        title: `One complete\npersonal reading.\n(${completeReadingLengthPromise})`,
      },
      {
        title: 'Become part of\na movement of Souls',
        bgVideo: require('../../../assets/videos/lets_connet.mp4'),
      },
    ],
    [completeReadingLengthPromise]
  );

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: 0,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeAndroid: 2,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPage(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    if (page !== 1 || !isFocused) return;

    const interval = setInterval(() => {
      Animated.timing(systemFadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSystemIndex((prev) => (prev + 1) % FIVE_SYSTEMS.length);
        Animated.timing(systemFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isFocused, page, systemFadeAnim]);

  useEffect(() => {
    if (page !== 1 || !isFocused) return;

    const zoomLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(systemScaleAnim, {
          toValue: 0.85,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(systemScaleAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    zoomLoop.start();
    return () => zoomLoop.stop();
  }, [isFocused, page, systemScaleAnim]);

  useEffect(() => {
    let alive = true;

    const loadPrice = async () => {
      const ready = await initializeRevenueCat(userId);
      if (!ready || !alive) return;

      const offerings = await getOfferings();
      const yearly = findYearlySubscriptionPackage(offerings);
      const price = getPackagePriceString(yearly);

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
      const yearly = findYearlySubscriptionPackage(offerings);

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

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
    setPage(Math.max(0, Math.min(pages.length - 1, idx)));
  };

  const buttonLabel = useMemo(() => {
    if (isPaying) return 'Opening RevenueCat...';
    if (yearlyPrice) return `Yes let me in (${yearlyPrice}${PRICE_DISPLAY.yearlySuffix})`;
    return 'Yes let me in';
  }, [isPaying, yearlyPrice]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <FlatList
          ref={listRef}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          keyExtractor={(_, idx) => `offer-${idx}`}
          onScrollBeginDrag={(e) => {
            swipeStartX.current = e.nativeEvent.contentOffset.x;
          }}
          onScrollEndDrag={(e) => {
            const start = swipeStartX.current;
            if (start == null) return;
            const end = e.nativeEvent.contentOffset.x;
            const delta = end - start;
            if (page === 0 && delta < -40) {
              navigation.navigate('HookSequence' as any, { initialReading: 'sun' } as any);
            }
          }}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }) => {
            const isLastOfferPage = index === pages.length - 1;
            const hasVideo = !!item.bgVideo;

            return (
              <View style={[styles.page, { width: PAGE_W }]}> 
                <View style={styles.headlineContainer}>
                  <Text style={styles.title} selectable>
                    {item.title}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.womanVideoContainer}
                  activeOpacity={0.9}
                  onPress={() => {
                    setVideoPaused((prev) => {
                      const next = [...prev];
                      next[index] = !next[index];
                      return next;
                    });
                  }}
                >
                  <Video
                    source={WOMAN_VIDEOS[index]}
                    style={styles.womanVideo}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={isFocused && page === index && !videoPaused[index]}
                    isLooping
                    isMuted={false}
                    useNativeControls={false}
                  />
                </TouchableOpacity>

                {index === 1 ? (
                  <View style={styles.systemsCarousel} pointerEvents="none">
                    <Animated.Image
                      source={FIVE_SYSTEMS[currentSystemIndex].icon}
                      style={[styles.systemIcon, { transform: [{ scale: systemScaleAnim }] }]}
                      resizeMode="contain"
                    />
                    <Animated.View style={{ opacity: systemFadeAnim }}>
                      <Text style={styles.systemName} selectable>
                        {FIVE_SYSTEMS[currentSystemIndex].name}
                      </Text>
                      <Text style={styles.systemTagline} selectable>
                        {FIVE_SYSTEMS[currentSystemIndex].tagline}
                      </Text>
                    </Animated.View>
                  </View>
                ) : null}

                {hasVideo ? (
                  <View
                    style={[
                      styles.pageVideoWrap,
                      {
                        bottom: isLastOfferPage
                          ? CTA_AREA_H + BOTTOM_PADDING - 20
                          : BOTTOM_PADDING + DOTS_H - 10,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Video
                      source={item.bgVideo}
                      style={styles.pageVideo}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={isFocused && page === index}
                      isLooping
                      isMuted
                      useNativeControls={false}
                    />
                  </View>
                ) : null}
              </View>
            );
          }}
        />

        {page === pages.length - 1 ? (
          <View style={styles.ctaContainer}>
            <Button label={buttonLabel} onPress={handleRevenueCatPurchase} variant="primary" style={[styles.button, styles.buttonPrimary]} />
            {isPaying ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
          </View>
        ) : null}

        {page < pages.length - 1 ? (
          <View style={styles.dotsOverlay} pointerEvents="none">
            <View style={styles.dots}>
              {pages.map((_, idx) => (
                <View key={`dot-${idx}`} style={[styles.dot, idx === page && styles.dotActive]} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingVertical: spacing.lg,
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing.page,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  headlineContainer: {
    width: '100%',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
  },
  womanVideoContainer: {
    width: PAGE_W * 0.85,
    aspectRatio: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderRadius: 32,
    backgroundColor: '#000',
  },
  womanVideo: {
    width: '100%',
    height: '100%',
  },
  pageVideoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: VIDEO_BAND_H,
    overflow: 'hidden',
    opacity: 1,
  },
  pageVideo: {
    width: '100%',
    height: '100%',
  },
  dotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: DOTS_H,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    opacity: 0.6,
  },
  dotActive: {
    backgroundColor: colors.primary,
    opacity: 1,
  },
  ctaContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_PADDING,
  },
  button: {
    marginHorizontal: spacing.page,
  },
  buttonPrimary: {
    marginBottom: 0,
  },
  loader: {
    marginTop: spacing.sm,
  },
  systemsCarousel: {
    position: 'absolute',
    bottom: BOTTOM_PADDING + DOTS_H - 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.page,
  },
  systemIcon: {
    width: 150,
    height: 150,
    marginBottom: spacing.xs,
  },
  systemName: {
    fontFamily: typography.headline,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  systemTagline: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
