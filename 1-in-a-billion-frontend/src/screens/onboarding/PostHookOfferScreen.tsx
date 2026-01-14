import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Alert, FlatList, NativeScrollEvent, NativeSyntheticEvent, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { createYearlySubscriptionIntent, getPaymentConfig } from '@/services/payments';
import { useAuthStore } from '@/store/authStore';
import { Video, ResizeMode } from 'expo-av';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostHookOffer'>;

const { width: PAGE_W } = Dimensions.get('window');
const VIDEO_BAND_H = 220;

export const PostHookOfferScreen = ({ navigation }: Props) => {
    const listRef = useRef<FlatList<any>>(null);
    const [page, setPage] = useState(0);
    const [isPaying, setIsPaying] = useState(false);
    const swipeStartX = useRef<number | null>(null);
    const userId = useAuthStore((s) => s.user?.id || 'anonymous');
    const userEmail = useAuthStore((s) => s.user?.email || '');

    // DEBUG TAG: helps confirm which JS bundle is running on device.
    // (No UI; only logs.)
    if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('🧾 PostHookOfferScreen BUILD_TAG:', 'offer_no_dots_f832d30');
    }

    // If user ever comes back to this screen, re-enable buttons.
    useFocusEffect(
        useCallback(() => {
            setPage(0);
            listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }, [])
    );

    const pages = useMemo(
        () => [
            {
                eyebrow: 'A quiet promise',
                title: 'We search for you!\nEvery Week!',
                bgVideo: require('@/../assets/videos/we_search_for_you.mp4'),
                body:
                    `Dear soul of the sun, welcome to a quiet promise we make to you and keep every single week.\n\n` +
                    `With a yearly subscription of $9.90, you enter a living system where our background algorithms work continuously, comparing you with others through rare and guarded sources of Vedic astrology, seeking resonance, harmony, and that elusive closeness to a billion.\n\n` +
                    `This work happens gently and silently, and whenever someone appears whose alignment comes close, you receive a weekly update as a sign that the search is alive and unfolding.`,
            },
            {
                eyebrow: 'Your first year includes a gift',
                title: 'One complete\npersonal reading.',
                body:
                    `Your first year includes something personal and intentional.\n\n` +
                    `As part of your subscription, you receive one complete personal reading created only for you, drawn from one of our five systems Vedic astrology, Western astrology, Kabbalah, Human Design, or Gene Keys.\n\n` +
                    `This is a deep individual reading focused solely on your own structure, timing, and inner design, delivered as an intimate audio experience of approximately 15 to 20 minutes.\n\n` +
                    `This reading becomes your energetic anchor within our database, allowing future comparisons to be more precise, more meaningful, and more true to who you are.`,
            },
            {
                eyebrow: '',
                title: 'Become part of\na movement of Souls',
                body:
                    `This is not a transaction but an initiation.\n\n` +
                    `For $9.90, you receive ongoing discovery, quiet precision, and a personal reading offered as a gift, not an upsell.\n\n` +
                    `Enter gently, stay curious, and allow the system to work for you in the background, week after week, as your path unfolds.`,
            },
        ],
        []
    );

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
                    renderItem={({ item }) => (
                        <View style={[styles.page, { width: PAGE_W }]}>
                            {!!(item as any).bgVideo && (
                                <View style={styles.pageVideoWrap} pointerEvents="none">
                                    <Video
                                        source={(item as any).bgVideo}
                                        style={styles.pageVideo}
                                        resizeMode={ResizeMode.COVER}
                                        shouldPlay
                                        isLooping
                                        isMuted
                                        rate={0.9}
                                    />
                                    <View style={styles.pageVideoFade} />
                                </View>
                            )}
                            {/* Remove “chapter” label for more space + cleaner composition */}
                            <View style={styles.textBlock}>
                                <Text style={styles.title} selectable>{item.title}</Text>
                                <Text style={styles.body} selectable>{item.body}</Text>
                            </View>
                            {/* Reserve space so text/dots never overlay the video band */}
                            <View style={styles.bottomReserve} />
                        </View>
                    )}
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
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Keep root transparent so leather texture always shows through.
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
        justifyContent: 'center',
        paddingTop: spacing.lg, // protects from notch while keeping centered composition
    },
    bottomReserve: {
        // Reserve space so text never overlays the video band (no swipe dots).
        height: VIDEO_BAND_H,
        width: '100%',
    },
    pageVideoWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: VIDEO_BAND_H, // smaller, still edge-to-edge
        overflow: 'hidden',
        opacity: 0.85, // more visible (not "transparent")
    },
    pageVideo: {
        width: '100%',
        height: '100%',
    },
    pageVideoFade: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    body: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 340,
    },
    button: {
        marginHorizontal: spacing.page,
    },
    ctaContainer: {
        marginBottom: spacing.md,
    },
    buttonPrimary: {
        marginBottom: spacing.md,
    },
});
