import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import {
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { colors, spacing, typography } from '@/theme/tokens';
import { CityOption, HookReading } from '@/types/forms';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { audioApi } from '@/services/api';
import { AUDIO_CONFIG } from '@/config/readingConfig';
import { Ionicons } from '@expo/vector-icons';
import { useAudio } from '@/contexts/AudioContext';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HookSequence'>;

const { width: PAGE_WIDTH } = Dimensions.get('window');

const NEXT_LABELS: Record<string, string> = {
    sun: 'Discover Your Moon',
    moon: 'Discover Your Rising',
    rising: 'Continue',
    gateway: 'Continue',
};

// Swipe-only flow: 3 hook pages + 4th "handoff" page (no signup)
type PageItem = HookReading | { type: 'gateway'; sign: ''; intro: ''; main: '' };

export const HookSequenceScreen = ({ navigation, route }: Props) => {
    // Use readings from store (already loaded by CoreIdentitiesScreen)
    const hookReadings = useOnboardingStore((state) => state.hookReadings);
    const hookAudio = useOnboardingStore((state) => state.hookAudio); // Pre-loaded audio
    const setHookAudio = useOnboardingStore((state) => state.setHookAudio);
    const sun = hookReadings.sun;
    const moon = hookReadings.moon;
    const rising = hookReadings.rising;

    // Determine initial page based on route params
    const initialReading = route?.params?.initialReading;
    const customReadingsFromRoute = route?.params?.customReadings as HookReading[] | undefined;
    const customReadings = customReadingsFromRoute || null;

    const getInitialPage = () => {
        if (!initialReading) return 0;
        const readingsToUse = customReadings || [sun, moon, rising].filter(Boolean);

        if (initialReading === 'sun') {
            const sunIndex = readingsToUse.findIndex(r => r?.type === 'sun');
            return sunIndex >= 0 ? sunIndex : 0;
        }
        if (initialReading === 'moon') {
            const moonIndex = readingsToUse.findIndex(r => r?.type === 'moon');
            return moonIndex >= 0 ? moonIndex : 0;
        }
        if (initialReading === 'rising') {
            const risingIndex = readingsToUse.findIndex(r => r?.type === 'rising');
            return risingIndex >= 0 ? risingIndex : 0;
        }
        return 0;
    };

    const [page, setPage] = useState(getInitialPage());
    const listRef = useRef<FlatList<PageItem>>(null);
    const handoffTriggeredRef = useRef(false);

    // Audio state
    const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
    const [audioPlaying, setAudioPlaying] = useState<Record<string, boolean>>({});
    const { toggleAudio, stopAudio, primeAudio } = useAudio();

    // Animation refs
    const risingAnim = useRef(new Animated.Value(0)).current;

    // READINGS ARRAY
    const readings = useMemo((): PageItem[] => {
        let baseReadings: HookReading[];
        if (customReadings && customReadings.length === 3) {
            baseReadings = customReadings;
        } else {
            const apiReadings: HookReading[] = [];
            if (sun) apiReadings.push(sun);
            if (moon) apiReadings.push(moon);
            if (rising) apiReadings.push(rising);
            baseReadings = apiReadings;
        }

        // Always add Gateway as the last slide
        if (baseReadings.length === 3) {
            return [...baseReadings, { type: 'gateway', sign: '', intro: '', main: '' }];
        }
        return baseReadings;
    }, [sun, moon, rising, customReadings]);

    useEffect(() => {
        (['sun', 'moon', 'rising'] as const).forEach((type) => {
            const source = hookAudio[type];
            if (!source) return;
            primeAudio(`hook-sequence:${type}`, source).catch(() => { });
        });
    }, [hookAudio.moon, hookAudio.rising, hookAudio.sun, primeAudio]);

    // Animations
    useEffect(() => {
        const rising = Animated.loop(
            Animated.sequence([
                Animated.timing(risingAnim, { toValue: -20, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(risingAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            ])
        );
        rising.start();
        return () => rising.stop();
    }, [risingAnim]);

    // AUDIO CLEANUP
    useFocusEffect(
        useCallback(() => {
            // Screen focused
            return () => {
                // Screen blur
                stopAudio().catch(() => { });
                setAudioPlaying({});
            };
        }, [stopAudio])
    );

    useEffect(() => {
        stopAudio().catch(() => { });
        setAudioPlaying({});
    }, [page, stopAudio]); // Stop on page change

    // AUDIO GENERATION / PLAYBACK
    const startHookAudioGeneration = useCallback(
        async (type: HookReading['type'], reading: HookReading) => {
            if (hookAudio[type]) return hookAudio[type];

            const textToSpeak = `${reading.intro}\n\n${reading.main}`;
            try {
                const result = await audioApi.generateTTS(textToSpeak, { exaggeration: AUDIO_CONFIG.exaggeration });
                if (result.success && result.audioBase64) {
                    setHookAudio(type, result.audioBase64);
                    primeAudio(`hook-sequence:${type}`, result.audioBase64).catch(() => { });
                    return result.audioBase64;
                }
            } catch (e) {
                console.error('Audio generation failed', e);
            }
            return null;
        },
        [hookAudio, primeAudio, setHookAudio]
    );

    const handlePlayAudio = useCallback(async (reading: HookReading) => {
        const type = reading.type;
        if (audioLoading[type]) return;

        setAudioLoading(prev => ({ ...prev, [type]: true }));

        let source: string | undefined = hookAudio[type];
        if (!source) {
            const generated = await startHookAudioGeneration(type, reading);
            if (generated) source = generated;
        }

        setAudioLoading(prev => ({ ...prev, [type]: false }));

        if (!source) return;

        try {
            const result = await toggleAudio({
                key: `hook-sequence:${type}`,
                source,
                onFinish: () => {
                    setAudioPlaying(prev => ({ ...prev, [type]: false }));
                },
            });

            if (result === 'playing') {
                setAudioPlaying(prev => {
                    const next: Record<string, boolean> = {};
                    Object.keys(prev).forEach((k) => { next[k] = false; });
                    next[type] = true;
                    return next;
                });
                return;
            }

            setAudioPlaying(prev => ({ ...prev, [type]: false }));
        } catch (e) {
            console.error('Playback error', e);
        }
    }, [audioLoading, hookAudio, startHookAudioGeneration, toggleAudio]);

    const renderPage = ({ item }: { item: PageItem; index: number }) => {
        if (item.type === 'gateway') {
            return (
                <View style={[styles.pageContainer, { width: PAGE_WIDTH }]}>
                    <Text style={styles.gatewayTitle}>Preparing Next Step</Text>
                    <Text style={styles.gatewaySubtitle}>
                        Continue to decide whether you want to add one more person.
                    </Text>
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                </View>
            );
        }

        // Standard reading page
        const isPlaying = audioPlaying[item.type];
        const isLoading = audioLoading[item.type];

        return (
            <ScrollView style={{ width: PAGE_WIDTH }} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.signTitle}>{item.sign} {item.type.toUpperCase()}</Text>

                <TouchableOpacity
                    style={[styles.playButton, isPlaying && styles.playButtonActive]}
                    onPress={() => handlePlayAudio(item as HookReading)}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.playButtonText}>{isPlaying ? 'Stop Audio' : 'Listen'}</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.readingText}>{item.main}</Text>

                <View style={styles.swipeHint}>
                    <Text style={styles.swipeText}>{NEXT_LABELS[item.type] || 'Swipe'}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.mutedText} />
                </View>
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                ref={listRef}
                data={readings}
                horizontal
                pagingEnabled
                renderItem={renderPage}
                keyExtractor={(item, index) => item.type + index}
                onMomentumScrollEnd={(ev) => {
                    const newIndex = Math.round(ev.nativeEvent.contentOffset.x / PAGE_WIDTH);
                    setPage(newIndex);

                    if (newIndex !== 3) {
                        handoffTriggeredRef.current = false;
                        return;
                    }

                    if (handoffTriggeredRef.current) return;
                    handoffTriggeredRef.current = true;

                    setTimeout(() => {
                        const allPeople = useProfileStore.getState().people || [];
                        const existingThirdPerson = allPeople.find(
                            (p: any) => !p.isUser && p.hookReadings && p.hookReadings.length === 3
                        );

                        if (existingThirdPerson && existingThirdPerson.birthData) {
                            const city: CityOption = {
                                id: `saved-${existingThirdPerson.id}`,
                                name: existingThirdPerson.birthData.birthCity || 'Unknown',
                                country: '',
                                region: '',
                                latitude: typeof existingThirdPerson.birthData.latitude === 'number' ? existingThirdPerson.birthData.latitude : 0,
                                longitude: typeof existingThirdPerson.birthData.longitude === 'number' ? existingThirdPerson.birthData.longitude : 0,
                                timezone: existingThirdPerson.birthData.timezone || 'UTC',
                            };

                            navigation.navigate('PartnerReadings' as any, {
                                partnerName: existingThirdPerson.name,
                                partnerBirthDate: existingThirdPerson.birthData.birthDate,
                                partnerBirthTime: existingThirdPerson.birthData.birthTime,
                                partnerBirthCity: city,
                                partnerId: existingThirdPerson.id,
                                mode: 'onboarding_hook',
                            });
                            return;
                        }

                        navigation.navigate('AddThirdPersonPrompt');
                    }, 250);
                }}
                showsHorizontalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    pageContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.page,
    },
    scrollContent: {
        padding: spacing.page,
        paddingBottom: 100,
        alignItems: 'center',
    },
    signTitle: {
        fontFamily: typography.display,
        fontSize: 32,
        color: colors.primary,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    readingText: {
        fontFamily: typography.serif,
        fontSize: 18,
        lineHeight: 28,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    playButton: {
        backgroundColor: colors.surface,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
    },
    playButtonActive: {
        borderColor: colors.primary,
        backgroundColor: colors.card,
    },
    playButtonText: {
        fontFamily: typography.sansBold,
        color: colors.text,
    },
    gatewayTitle: {
        fontFamily: typography.headline,
        fontSize: 28,
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    gatewaySubtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.mutedText,
        marginBottom: spacing.xxl,
        textAlign: 'center',
    },
    swipeHint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xl,
        opacity: 0.7,
    },
    swipeText: {
        fontFamily: typography.sansMedium,
        color: colors.mutedText,
        marginRight: 4,
    },
});
