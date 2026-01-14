import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Alert, FlatList, NativeScrollEvent, NativeSyntheticEvent, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { createYearlySubscriptionIntent, getPaymentConfig } from '@/services/payments';
import { useAuthStore } from '@/store/authStore';
import { Video, ResizeMode, Audio } from 'expo-av';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostHookOffer'>;

const { width: PAGE_W } = Dimensions.get('window');
const VIDEO_BAND_H = 200;
const DOTS_H = 24;
const CTA_AREA_H = 80;
const BOTTOM_PADDING = 20; // consistent bottom padding for all pages

// Pre-generated offer screen audio files (David's voice)
const OFFER_AUDIO_URLS = [
    // Uploaded to Supabase Storage bucket: voices / offer-audio/
    'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/offer-audio/page_1.mp3', // Page 1
    'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/offer-audio/page_2.mp3', // Page 2
    'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/offer-audio/page_3.mp3', // Page 3
];

export const PostHookOfferScreen = ({ navigation }: Props) => {
    const listRef = useRef<FlatList<any>>(null);
    const [page, setPage] = useState(0);
    const [isPaying, setIsPaying] = useState(false);
    const swipeStartX = useRef<number | null>(null);
    const userId = useAuthStore((s) => s.user?.id || 'anonymous');
    const userEmail = useAuthStore((s) => s.user?.email || '');
    
    // Audio (preloaded + kept in RAM while on this screen)
    const soundRefs = useRef<(Audio.Sound | null)[]>([null, null, null]);
    const currentPageRef = useRef(0);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [activeWordIndex, setActiveWordIndex] = useState(0);

    // (dev logs removed)

    // Set audio mode on mount
    useEffect(() => {
        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
        }).catch(() => {});
    }, []);

    // If user ever comes back to this screen, re-enable buttons
    useFocusEffect(
        useCallback(() => {
            setPage(0);
            listRef.current?.scrollToOffset({ offset: 0, animated: false });
            currentPageRef.current = 0;
            setActiveWordIndex(0);
            
            // Cleanup: stop audio when screen loses focus
            return () => {
                setIsAudioPlaying(false);
                setActiveWordIndex(0);
                // Stop immediately, but keep loaded in RAM.
                soundRefs.current.forEach((s) => s?.stopAsync().catch(() => {}));
            };
        }, [])
    );

    const pages = useMemo(
        () => [
            {
                eyebrow: 'A quiet promise',
                title: 'We search for you!\nEvery Week!',
                bgVideo: require('@/../assets/videos/we_search_for_you.mp4'),
                body:
                    `Dear soul of the sun, welcome to a quiet promise we make to you and keep every single week. ` +
                    `With a yearly subscription of $9.90, you enter a living system where our background algorithms work continuously, comparing you with others through rare and guarded sources of Vedic astrology, seeking resonance, harmony, and that elusive closeness to a billion. ` +
                    `This work happens gently and silently, and whenever someone appears whose alignment comes close, you receive a weekly update as a sign that the search is alive and unfolding.`,
            },
            {
                eyebrow: 'Your first year includes a gift',
                title: 'One complete\npersonal reading.',
                body:
                    `As part of your subscription, you receive one complete personal reading created only for you, drawn from one of our five systems Vedic astrology, Western astrology, Kabbalah, Human Design, or Gene Keys. This is a deep individual reading focused solely on your own structure, timing, and inner design, delivered as an intimate audio experience of approximately 15 to 20 minutes. This reading becomes your energetic anchor within our database, allowing future comparisons to be more precise, more meaningful, and more true to who you are.`,
            },
            {
                eyebrow: '',
                title: 'Become part of\na movement of Souls',
                bgVideo: require('@/../assets/videos/lets_connet.mp4'),
                body:
                    `Join the movement of conscious connections. Let us use technology to deeply dive into the beautiful depth of human connections. With a quiet and ongoing process working in the background, discovery continues week by week, guided by precision rather than noise. This is a living search for meaningful connection, unfolding over time as your path unfolds.`,
            },
        ],
        []
    );

    // Karaoke mapping (simple heuristic; we don't have true word timestamps from TTS)
    const karaoke = useMemo(() => {
        const tokenize = (text: string) => text.split(/\s+/).filter(Boolean);
        const weightFor = (w: string) => {
            const last = w[w.length - 1] || '';
            if (/[.!?]/.test(last)) return 2.2;
            if (/[:,;]/.test(last)) return 1.6;
            return 1.0;
        };

        const wordsByPage = pages.map((p) => tokenize(p.body));
        const cumWeightsByPage = wordsByPage.map((words) => {
            const cum: number[] = [];
            let sum = 0;
            for (const w of words) {
                sum += weightFor(w);
                cum.push(sum);
            }
            return cum;
        });
        const totalWeights = cumWeightsByPage.map((cum) => cum[cum.length - 1] || 1);

        const findIndex = (cum: number[], target: number) => {
            if (cum.length === 0) return 0;
            let lo = 0;
            let hi = cum.length - 1;
            while (lo < hi) {
                const mid = Math.floor((lo + hi) / 2);
                if (cum[mid]! >= target) hi = mid;
                else lo = mid + 1;
            }
            return Math.max(0, Math.min(cum.length - 1, lo));
        };

        return { wordsByPage, cumWeightsByPage, totalWeights, findIndex };
    }, [pages]);

    // Preload all 3 audios and keep them in RAM
    useEffect(() => {
        let cancelled = false;

        const preload = async () => {
            try {
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: false,
                });

                for (let i = 0; i < 3; i++) {
                    if (cancelled) return;
                    if (soundRefs.current[i]) continue;

                    const url = OFFER_AUDIO_URLS[i]!;
                    const { sound } = await Audio.Sound.createAsync(
                        { uri: url },
                        { shouldPlay: false, progressUpdateIntervalMillis: 120 },
                        (st) => {
                            if (!st.isLoaded) return;
                            if (i !== currentPageRef.current) return;

                            setIsAudioPlaying(st.isPlaying);
                            const dur = st.durationMillis || 1;
                            const pos = st.positionMillis || 0;
                            const progress = Math.max(0, Math.min(1, pos / dur));
                            const total = karaoke.totalWeights[i] || 1;
                            const target = progress * total;
                            const idx = karaoke.findIndex(karaoke.cumWeightsByPage[i] || [], target);
                            setActiveWordIndex(idx);
                        }
                    );
                    soundRefs.current[i] = sound;
                }
            } catch {
                // Keep UI usable even if audio fails on device.
            }
        };

        preload();

        return () => {
            cancelled = true;
            soundRefs.current.forEach((s, idx) => {
                if (!s) return;
                s.stopAsync().catch(() => {});
                s.unloadAsync().catch(() => {});
                soundRefs.current[idx] = null;
            });
        };
    }, [karaoke]);

    // Auto-play current page; cut audio on page change
    useEffect(() => {
        currentPageRef.current = page;
        setActiveWordIndex(0);

        const stopAll = async () => {
            await Promise.all(soundRefs.current.map((s) => s?.stopAsync().catch(() => {})));
        };

        const play = async () => {
            await stopAll();
            const s = soundRefs.current[page];
            if (!s) return;
            await s.setPositionAsync(0).catch(() => {});
            await s.playAsync().catch(() => {});
        };

        play();
    }, [page]);

    const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
        setPage(Math.max(0, Math.min(pages.length - 1, idx)));
    };

    const handleBuy = async () => {
        if (isPaying) return;
        setIsPaying(true);

        try {
            let stripeModule: any;
            try {
                stripeModule = require('@stripe/stripe-react-native');
            } catch {
            Alert.alert(
                    'Payments Not Available',
                    'Apple Pay / Google Pay requires a full app build (TestFlight / production).',
                [{ text: 'OK' }]
            );
                setIsPaying(false);
                return;
            }

            const cfg = await getPaymentConfig();
            const publishableKey = cfg?.publishableKey?.trim();
            if (!publishableKey) {
                Alert.alert('Payments Not Configured', 'Stripe publishable key is missing on backend.', [{ text: 'OK' }]);
                setIsPaying(false);
                return;
            }

            if (typeof stripeModule.initStripe === 'function') {
                await stripeModule.initStripe({
                    publishableKey,
                    merchantIdentifier: 'merchant.com.oneinabillion.app',
                    urlScheme: 'oneinabillion',
                });
            }

            const sub = await createYearlySubscriptionIntent({
                userId,
                userEmail: userEmail || undefined,
            });
            if (!sub.success || !sub.paymentIntentClientSecret || !sub.customerId || !sub.ephemeralKeySecret) {
                throw new Error(sub.error || 'Failed to start subscription payment');
            }

            const initPaymentSheet = stripeModule.initPaymentSheet;
            const presentPaymentSheet = stripeModule.presentPaymentSheet;
            if (typeof initPaymentSheet !== 'function' || typeof presentPaymentSheet !== 'function') {
                throw new Error('Stripe PaymentSheet API not available. Rebuild the app with Stripe native modules.');
            }

            const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: sub.paymentIntentClientSecret,
                customerId: sub.customerId,
                customerEphemeralKeySecret: sub.ephemeralKeySecret,
                merchantDisplayName: '1 in a Billion',
                applePay: { merchantCountryCode: 'US' },
                googlePay: { merchantCountryCode: 'US', testEnv: __DEV__ },
                returnURL: 'oneinabillion://stripe-redirect',
            });
            if (initError) throw new Error(initError.message);

            const { error: presentError } = await presentPaymentSheet();
            if (presentError) {
                if (presentError.code === 'Canceled') {
                    setIsPaying(false);
                    return;
                }
                throw new Error(presentError.message);
            }

            // Payment successful → now create the account (Supabase) and then land in My Library.
            navigation.navigate('Account', { postPurchase: true });
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
                        // Stop audio immediately when swiping
                        soundRefs.current.forEach((s) => s?.stopAsync().catch(() => {}));
                        setIsAudioPlaying(false);
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
                        
                        // Calculate bottom reserve height to prevent text overlap:
                        // Page 1: video bottom (60) + video height (200) + gap (20) = 280
                        // Page 2: dots (24) + padding (20) = 44
                        // Page 3: video bottom (80) + video height (200) + gap (20) = 300
                        let bottomReserveHeight;
                        if (hasVideo) {
                            if (isLastOfferPage) {
                                // Page 3: video at 80px from bottom, height 200px
                                bottomReserveHeight = 80 + VIDEO_BAND_H + 20;
                            } else {
                                // Page 1: video at 60px from bottom, height 200px
                                bottomReserveHeight = 60 + VIDEO_BAND_H + 20;
                            }
                        } else {
                            // Page 2: just dots
                            bottomReserveHeight = DOTS_H + BOTTOM_PADDING;
                        }
                        
                        return (
                        <View style={[styles.page, { width: PAGE_W }]}>
                            <View style={[
                                styles.textBlock,
                                isAudioPlaying && index === page && styles.textBlockPlaying
                            ]}>
                                <Text style={styles.title} selectable>{item.title}</Text>
                                {index === page ? (
                                    <View style={styles.karaokeWrap}>
                                        {karaoke.wordsByPage[index]?.map((w, wi) => {
                                            const isActive = isAudioPlaying && wi === activeWordIndex;
                                            const isPast = wi < activeWordIndex;
                                            return (
                                                <View
                                                    key={`w-${index}-${wi}`}
                                                    style={[styles.wordWrap, isActive && styles.wordActive]}
                                                >
                                                    <Text
                                                        style={[styles.wordText, (isActive || isPast) && styles.wordTextActive]}
                                                        selectable
                                                    >
                                                        {w}{' '}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={styles.body} selectable>{item.body}</Text>
                                )}
                            </View>
                            <View style={[styles.bottomReserve, { height: bottomReserveHeight }]} />
                            {hasVideo && (
                                <View
                                    style={[
                                        styles.pageVideoWrap,
                                        { 
                                            // Page 1: video sits above dots with gap
                                            // Page 3: video sits closer to bottom, above CTA
                                            bottom: isLastOfferPage 
                                                ? CTA_AREA_H + BOTTOM_PADDING - 20  // Move page 3 video down (away from text)
                                                : BOTTOM_PADDING + DOTS_H + 16      // Move page 1 video up (away from dots)
                                        },
                                    ]}
                                    pointerEvents="none"
                                >
                                    <Video
                                        source={(item as any).bgVideo}
                                        style={styles.pageVideo}
                                        resizeMode={ResizeMode.COVER}
                                        shouldPlay
                                        isLooping
                                        isMuted
                                        rate={isLastOfferPage ? 0.5 : 0.9}
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
    textBlock: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: spacing.xxl,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.lg,
        borderRadius: 16,
    },
    textBlockPlaying: {
        backgroundColor: colors.highlightYellow,
    },
    bottomReserve: {
        // Dynamic per-page height is set inline.
        height: 0,
        width: '100%',
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
        marginBottom: spacing.sm,
    },
    body: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 340,
    },
    karaokeWrap: {
        width: '100%',
        maxWidth: 340,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
    },
    wordWrap: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: 'transparent',
        marginHorizontal: 0,
        marginVertical: 0,
    },
    wordActive: {
        backgroundColor: colors.highlightYellow,
    },
    wordText: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        lineHeight: 24,
        color: colors.mutedText,
        textAlign: 'center',
    },
    wordTextActive: {
        color: colors.text,
        fontFamily: typography.sansMedium,
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
});
