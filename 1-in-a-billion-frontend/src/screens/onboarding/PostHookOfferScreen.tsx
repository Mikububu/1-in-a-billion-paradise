import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Alert, FlatList, NativeScrollEvent, NativeSyntheticEvent, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostHookOffer'>;

const { width: PAGE_W } = Dimensions.get('window');

export const PostHookOfferScreen = ({ navigation }: Props) => {
    const listRef = useRef<FlatList<any>>(null);
    const [page, setPage] = useState(0);

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
                title: 'We search for you\n— every week.',
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

    const handleBuy = () => {
        // NOTE: Purchase flow is the next step. We intentionally do NOT create a Supabase user here.
        // @ts-ignore
        navigation.navigate('Purchase', { mode: 'subscription', preselectedProduct: 'yearly_subscription' });
    };

    const handleNoMaybe = () => {
        // Intentionally do nothing. User can stay, swipe, or go back to listen again.
    };

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
                    onMomentumScrollEnd={onScrollEnd}
                    renderItem={({ item }) => (
                        <View style={[styles.page, { width: PAGE_W }]}>
                            {!!item.eyebrow && <Text style={styles.eyebrow}>{item.eyebrow}</Text>}
                            <Text style={styles.title} selectable>{item.title}</Text>
                            <Text style={styles.body} selectable>{item.body}</Text>
                        </View>
                    )}
                />

                {page === pages.length - 1 ? (
                    <View style={styles.ctaContainer}>
                        <Button
                            label="YES I want to buy"
                            onPress={handleBuy}
                            variant="primary"
                            style={[styles.button, styles.buttonPrimary]}
                        />
                        <Button
                            label="No maybe another time"
                            onPress={handleNoMaybe}
                            variant="secondary"
                            style={[styles.button, styles.buttonSecondary]}
                        />
                    </View>
                ) : null}

                {/* Swiper dots: keep them below the CTA buttons */}
                <View style={styles.dots}>
                    {pages.map((_, idx) => (
                        <View
                            key={`dot-${idx}`}
                            style={[styles.dot, idx === page && styles.dotActive]}
                        />
                    ))}
                </View>
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
        paddingHorizontal: spacing.page,
        justifyContent: 'center',
        alignItems: 'center',
    },
    eyebrow: {
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: colors.mutedText,
        marginBottom: spacing.sm,
        textAlign: 'center',
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
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.md,
        gap: 8,
    },
    dot: {
        width: 7,
        height: 7,
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
        marginBottom: spacing.md,
    },
    buttonPrimary: {
        marginBottom: spacing.md,
    },
    buttonSecondary: {
        marginTop: 0,
    },
});
