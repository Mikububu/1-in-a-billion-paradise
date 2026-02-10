import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Alert, FlatList, NativeScrollEvent, NativeSyntheticEvent, Dimensions, Animated, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { Audio } from 'expo-av';
import { AppVideo } from '@/components/AppVideo';
import {
    initializeRevenueCat,
    getOfferings,
    purchasePackage,
} from '@/services/payments';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostHookOffer'>;

const { width: PAGE_W } = Dimensions.get('window');
const DOTS_H = 24;
const BOTTOM_PADDING = 20; // consistent bottom padding for all pages
const VIDEO_BAND_H = 200;
const CTA_AREA_H = 80;

// Woman speaking videos for each page (with audio)
const WOMAN_VIDEOS = [
    require('@/../assets/videos/offer_page1.mp4'),  // Page 1 - woman speaking
    require('@/../assets/videos/offer_page2.mp4'),  // Page 2 - woman speaking
    require('@/../assets/videos/offer_page3.mp4'),  // Page 3 - woman speaking
];

// The 5 cosmic systems (for animated carousel on page 2)
const FIVE_SYSTEMS = [
    { icon: require('@/../assets/images/systems/western.png'), name: 'Western Astrology', tagline: 'The Psychology of Your Soul' },
    { icon: require('@/../assets/images/systems/vedic.png'), name: 'Jyotish (Vedic)', tagline: 'The Light of Karma' },
    { icon: require('@/../assets/images/systems/human-design.png'), name: 'Human Design', tagline: 'Your Bodygraph Blueprint' },
    { icon: require('@/../assets/images/systems/gene-keys.png'), name: 'Gene Keys', tagline: 'Shadow → Gift → Siddhi' },
    { icon: require('@/../assets/images/systems/Kabbalah.png'), name: 'Kabbalah', tagline: 'The Tree of Life' },
];

export const PostHookOfferScreen = ({ navigation }: Props) => {
    const listRef = useRef<FlatList<any>>(null);
    const [page, setPage] = useState(0);
    const [isPaying, setIsPaying] = useState(false);
    const swipeStartX = useRef<number | null>(null);
    const userId = useAuthStore((s) => s.user?.id || 'anonymous');
    const userEmail = useAuthStore((s) => s.user?.email || '');

    // Systems carousel (page 2 only)
    const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
    const systemFadeAnim = useRef(new Animated.Value(1)).current;
    const systemScaleAnim = useRef(new Animated.Value(1)).current;

    // Woman video play/pause state (match Kalaa baseline)
    const [videoPaused, setVideoPaused] = useState<boolean[]>([false, false, false]);
    const [videoReady, setVideoReady] = useState<boolean[]>([false, false, false]);

    // Delay video playback by 500ms after it's ready to prevent jarring start
    const handleVideoReady = useCallback((index: number) => {
        setTimeout(() => {
            setVideoReady(prev => {
                const next = [...prev];
                next[index] = true;
                return next;
            });
        }, 500);
    }, []);

    // (dev logs removed)

    // Set audio mode on mount
    useEffect(() => {
        Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            interruptionModeIOS: 0, // InterruptionModeIOS.MixWithOthers
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            interruptionModeAndroid: 2, // InterruptionModeAndroid.DuckOthers
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
        }).catch(() => { });
    }, []);

    // If user ever comes back to this screen, reset to page 0
    useFocusEffect(
        useCallback(() => {
            setPage(0);
            listRef.current?.scrollToOffset({ offset: 0, animated: false });

            return () => {
                // no-op: AppVideo players are tied to component lifecycle
            };
        }, [])
    );

    const pages = useMemo(
        () => [
            {
                eyebrow: 'A quiet promise',
                title: 'We search for you!\nEvery Week!',
                bgVideo: require('@/../assets/videos/we_search_for_you.mp4'),
            },
            {
                eyebrow: 'Your first year includes a gift',
                title: 'One complete\npersonal reading.',
            },
            {
                eyebrow: '',
                title: 'Become part of\na movement of Souls',
                bgVideo: require('@/../assets/videos/lets_connet.mp4'),
            },
        ],
        []
    );

    // No karaoke or David's voice audio — offer videos have their own audio.

    // Systems carousel animation (page 2 only) — cycle through 5 systems every 3.5s with MUCH slower zoom on icon only
    useEffect(() => {
        if (page !== 1) return; // Only run on page 2 (index 1)

        const interval = setInterval(() => {
            // Fade out text only (icon stays visible)
            Animated.timing(systemFadeAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }).start(() => {
                // Change system while text is faded out
                setCurrentSystemIndex((prev) => (prev + 1) % FIVE_SYSTEMS.length);
                // Fade text back in
                Animated.timing(systemFadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }).start();
            });
        }, 3500);

        return () => clearInterval(interval);
    }, [page, systemFadeAnim]);

    // Continuous slow zoom animation for icon (always running on page 2)
    useEffect(() => {
        if (page !== 1) return;

        const zoomLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(systemScaleAnim, {
                    toValue: 0.85,
                    duration: 1500, // MUCH slower
                    useNativeDriver: true,
                }),
                Animated.timing(systemScaleAnim, {
                    toValue: 1,
                    duration: 1500, // MUCH slower
                    useNativeDriver: true,
                }),
            ])
        );
        zoomLoop.start();

        return () => zoomLoop.stop();
    }, [page, systemScaleAnim]);

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
        setPage(Math.max(0, Math.min(pages.length - 1, idx)));
    };

    const handleBuy = async () => {
        if (isPaying) return;
        setIsPaying(true);

        // Developer bypass (same as PurchaseScreen)
        const DEV_BYPASS_EMAILS = ['michael@1-in-a-billion.app', 'dev@1-in-a-billion.app', 'test@1-in-a-billion.app'];
        const isDeveloperAccount = DEV_BYPASS_EMAILS.includes(userEmail.toLowerCase());

        if (isDeveloperAccount || __DEV__) {
            console.log('🔧 DEV BYPASS: Skipping payment for developer account');
            setIsPaying(false);
            // Payment successful → navigate to Account screen (name input is now built-in)
            navigation.navigate('Account', { postPurchase: true });
            return;
        }

        try {
            // Initialize RevenueCat using backend-provided SDK key
            const rcReady = await initializeRevenueCat(userId !== 'anonymous' ? userId : null);
            if (!rcReady) {
                setIsPaying(false);
                Alert.alert(
                    'Payments Not Available',
                    'RevenueCat is not configured yet (missing public SDK key). Please try again later.',
                    [
                        { text: 'Continue without subscribing', onPress: () => navigation.navigate('Account', { postPurchase: false }) },
                    ]
                );
                return;
            }

            // Get RevenueCat offerings
            const offerings = await getOfferings();
            const availablePackages = offerings?.current?.availablePackages ?? [];
            if (!availablePackages.length) {
                setIsPaying(false);
                Alert.alert(
                    'Products Not Available',
                    'Unable to load subscription options. Please try again later.',
                    [
                        { text: 'Retry', onPress: () => handleBuy() },
                        { text: 'Continue without subscribing', onPress: () => navigation.navigate('Account', { postPurchase: false }) },
                    ]
                );
                return;
            }

            // Find the yearly subscription package
            const yearlyPackage = availablePackages.find(
                (p: any) => p.identifier === 'yearly_subscription' || p.packageType === 'ANNUAL'
            );

            if (!yearlyPackage) {
                setIsPaying(false);
                Alert.alert(
                    'Subscription Not Available',
                    'The yearly subscription is not currently available. Please try again later.',
                    [
                        { text: 'Retry', onPress: () => handleBuy() },
                        { text: 'Continue without subscribing', onPress: () => navigation.navigate('Account', { postPurchase: false }) },
                    ]
                );
                return;
            }

            // Attempt purchase via RevenueCat
            console.log('💳 Starting RevenueCat subscription purchase');
            const purchaseResult = await purchasePackage(yearlyPackage);

            if (purchaseResult.success) {
                // Payment successful → navigate to Account screen (name input is now built-in)
                console.log('✅ Subscription purchase successful!');
                navigation.navigate('Account', { postPurchase: true });
            } else if (purchaseResult.error !== 'cancelled' && purchaseResult.error !== 'Purchase cancelled') {
                Alert.alert('Payment Failed', purchaseResult.error || 'Payment failed.', [{ text: 'OK' }]);
            } else {
                // User cancelled
                console.log('ℹ️ Subscription cancelled by user');
            }
        } catch (err: any) {
            Alert.alert('Payment Failed', err?.message || 'Payment failed.', [{ text: 'OK' }]);
        } finally {
            setIsPaying(false);
        }
    };

    // No secondary CTA; user can swipe freely.

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
                        // If user swipes left past the first offer page, send them back to Sun hook reading.
                        if (page === 0 && delta < -40) {
                            // @ts-ignore
                            navigation.navigate('HookSequence', { initialReading: 'sun' });
                        }
                    }}
                    onMomentumScrollEnd={onScrollEnd}
                    renderItem={({ item, index }) => {
                        const isLastOfferPage = index === pages.length - 1;
                        const hasVideo = !!(item as any).bgVideo;
                        return (
                            <View style={[styles.page, { width: PAGE_W }]}>
                                {/* Headline at top */}
                                <View style={styles.headlineContainer}>
                                    <Text style={styles.title} selectable>{item.title}</Text>
                                </View>

                                {/* Woman speaking video (1:1 aspect ratio, with audio) - tap to pause/play */}
                                <TouchableOpacity
                                    style={styles.womanVideoContainer}
                                    activeOpacity={0.9}
                                    onPress={() => {
                                        const isPaused = videoPaused[index];
                                        setVideoPaused(prev => {
                                            const next = [...prev];
                                            next[index] = !isPaused;
                                            return next;
                                        });
                                    }}
                                >
                                    <AppVideo
                                        source={WOMAN_VIDEOS[index]}
                                        style={styles.womanVideo}
                                        contentFit="cover"
                                        // IMPORTANT: Don't gate playback on `onFirstFrame` callbacks.
                                        // With expo-video, `onFirstFrame` won't fire until playback starts,
                                        // so gating on `videoReady` creates a deadlock where video never plays.
                                        shouldPlay={page === index && !videoPaused[index]}
                                        loop
                                        muted={false}
                                        nativeControls={false}
                                        onFirstFrame={() => handleVideoReady(index)}
                                    />
                                </TouchableOpacity>

                                {/* Page 2 only: Systems carousel */}
                                {index === 1 && (
                                    <View style={styles.systemsCarousel} pointerEvents="none">
                                        <Animated.Image
                                            source={FIVE_SYSTEMS[currentSystemIndex].icon}
                                            style={[
                                                styles.systemIcon,
                                                { transform: [{ scale: systemScaleAnim }] }
                                            ]}
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
                                )}

                                {/* Bottom muted looping video band (original behavior) */}
                                {hasVideo && (
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
                                        <AppVideo
                                            source={(item as any).bgVideo}
                                            style={styles.pageVideo}
                                            contentFit="cover"
                                            shouldPlay
                                            loop
                                            muted
                                            playbackRate={isLastOfferPage ? 0.5 : 0.9}
                                            nativeControls={false}
                                        />
                                    </View>
                                )}

                            </View>
                        );
                    }}
                />

                {page === pages.length - 1 ? (
                    <View style={styles.ctaContainer}>
                        <Button
                            label={isPaying ? 'One moment…' : 'Yes let me in'}
                            onPress={handleBuy}
                            variant="primary"
                            style={[styles.button, styles.buttonPrimary]}
                        />
                    </View>
                ) : null}

                {/* Swipe dots (bring back, but tiny + no extra layout cost). Hidden on last page (CTA). */}
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
    womanVideoContainer: {
        width: PAGE_W * 0.85,
        aspectRatio: 1, // 1:1 square for woman speaking videos (960x960)
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
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
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
    button: {
        marginHorizontal: spacing.page,
    },
    ctaContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: BOTTOM_PADDING,
    },
    buttonPrimary: {
        marginBottom: 0,
    },
    // Systems carousel (page 2)
    systemsCarousel: {
        position: 'absolute',
        bottom: BOTTOM_PADDING + DOTS_H - 30, // Moved much further down
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
        marginBottom: spacing.xs, // Less space between icon and text (moved text higher)
    },
    systemName: {
        fontFamily: typography.headline,
        fontSize: 22,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    systemTagline: {
        fontFamily: typography.sansBold, // BOLD
        fontSize: 16, // Bigger
        color: colors.primary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
