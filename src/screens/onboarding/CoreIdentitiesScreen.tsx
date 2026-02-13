import { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View, Text, Animated, SafeAreaView, Easing, Vibration, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useHookReadings } from '@/hooks/useHookReadings';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { audioApi } from '@/services/api';
import { AmbientMusic } from '@/services/ambientMusic';
import { AUDIO_CONFIG } from '@/config/readingConfig';
import { useAudio } from '@/contexts/AudioContext';

// --- ARTS: Animated Reasoning Typography System ---
const ARTS_CONFIG = {
    typeSpeed: 35, // ms per char (faster for better flow)
    pauseAfterSentence: 600,
    fadeInDuration: 800,
    signRevealDuration: 1200,
};

// Map signs to colors
const SIGN_COLORS: Record<string, string[]> = {
    Aries: ['#FF4D4D', '#FF8E53'],
    Taurus: ['#4DAF7C', '#2E8B57'],
    Gemini: ['#FFD700', '#FFA500'],
    Cancer: ['#C0C0C0', '#A9A9A9'],
    Leo: ['#FFD700', '#FF4500'],
    Virgo: ['#9ACD32', '#6B8E23'],
    Libra: ['#FF69B4', '#FFB6C1'],
    Scorpio: ['#8B0000', '#483D8B'],
    Sagittarius: ['#800080', '#9370DB'],
    Capricorn: ['#8B4513', '#A0522D'],
    Aquarius: ['#00BFFF', '#1E90FF'],
    Pisces: ['#20B2AA', '#4682B4'],
    // Default fallback
    Default: [colors.primary, colors.secondary], // Use theme colors
};

const getSignColors = (sign: string) => {
    return SIGN_COLORS[sign] || SIGN_COLORS.Default;
};

// ... (Other helper components like PulsingOrb can be inline or separate, will inline for simplicity as in legacy)

export const CoreIdentitiesScreen = () => {
    const navigation = useNavigation<any>();
    const { sun, moon, rising, isLoading } = useHookReadings();
    const authUser = useAuthStore((state) => state.user);
    const hookAudio = useOnboardingStore((state) => state.hookAudio);
    const setHookAudio = useOnboardingStore((state) => state.setHookAudio);
    const { toggleAudio, primeAudio, stopAudio } = useAudio();

    // Use OnboardingStore for person management instead of ProfileStore
    const updatePerson = useOnboardingStore((state) => state.updatePerson);
    const getCurrentPersonId = useOnboardingStore((state) => () => state.people.find(p => p.isMainUser)?.id);

    // Constants
    const STEP_SUN = 0;
    const STEP_MOON = 1;
    const STEP_RISING = 2;
    const STEP_Transition = 3;

    const [step, setStep] = useState(STEP_SUN);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showSign, setShowSign] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Connecting to the stars...');

    // Audio refs
    const audioSourceRef = useRef<Partial<Record<'sun' | 'moon' | 'rising', string>>>({});

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const bgAnim = useRef(new Animated.Value(0)).current;

    // Track if we have started the sequence
    const hasStartedRef = useRef(false);

    // Prevent back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => backHandler.remove();
    }, []);

    // Ambient music
    useEffect(() => {
        AmbientMusic.play();
        return () => {
            // Don't stop music here, let next screen handle it or continue
        };
    }, []);

    // Floating animation loop
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
                Animated.timing(floatAnim, { toValue: 0, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            ])
        ).start();
    }, []);

    // --- AUDIO GENERATION & PRELOADING ---
    // We generate audio immediately but play it in sync with the visual steps
    const sunAudioPromiseRef = useRef<Promise<void> | null>(null);
    const moonAudioPromiseRef = useRef<Promise<void> | null>(null);
    const risingAudioPromiseRef = useRef<Promise<void> | null>(null);

    // Helper to generate audio
    const getCoreAudioKey = (type: 'sun' | 'moon' | 'rising') => `core-identities:${type}`;

    const generateAndCacheAudio = async (text: string, type: 'sun' | 'moon' | 'rising') => {
        if (!text) return;

        try {
            const existing = hookAudio[type];
            if (existing) {
                audioSourceRef.current[type] = existing;
                await primeAudio(getCoreAudioKey(type), existing);
                return;
            }

            console.log(`🔊 Generating audio for ${type}...`);
            // Preferred path: generate + persist hook audio (storage path/url), no base64 state writes.
            const hookResult = await audioApi.generateHookAudio({
                text,
                userId: authUser?.id,
                type,
                exaggeration: AUDIO_CONFIG.exaggeration,
            });

            let source = hookResult.storagePath || hookResult.audioUrl || null;

            // Fallback: direct TTS URL only (avoid persisting base64 blobs in onboarding store).
            if (!source) {
                const tts = await audioApi.generateTTS(text, {
                    exaggeration: AUDIO_CONFIG.exaggeration,
                    audioUrl: undefined,
                });
                source = tts.success ? (tts.audioUrl || null) : null;
            }

            if (source) {
                setHookAudio(type, source);
                audioSourceRef.current[type] = source;
                await primeAudio(getCoreAudioKey(type), source);
                console.log(`✅ Audio ready for ${type}`);
            }
        } catch (err) {
            console.warn(`❌ Audio generation failed for ${type}`, err);
        }
    };

    // Trigger audio generation once readings are loaded
    useEffect(() => {
        if (isLoading || hasStartedRef.current) return;

        if (sun && moon && rising) {
            hasStartedRef.current = true;

            // Update Person in Store with Placements
            const personId = getCurrentPersonId();
            if (personId) {
                updatePerson(personId, {
                    placements: {
                        sunSign: sun.sign,
                        moonSign: moon.sign,
                        risingSign: rising.sign,
                    }
                } as any);
            }

            // Start Audio Generation Promises
            sunAudioPromiseRef.current = generateAndCacheAudio(sun.intro, 'sun');
            moonAudioPromiseRef.current = generateAndCacheAudio(moon.intro, 'moon');
            risingAudioPromiseRef.current = generateAndCacheAudio(rising.intro, 'rising');

            // Start Visual Sequence
            runSequence();
        }
    }, [sun, moon, rising, isLoading, updatePerson, getCurrentPersonId, setHookAudio, hookAudio, primeAudio, authUser?.id]);

    // --- SEQUENCER ---
    const runSequence = async () => {
        // 1. SUN
        setStep(STEP_SUN);
        await animateStep('sun', sun?.sign || '', sun?.intro || '', sunAudioPromiseRef.current);

        // 2. MOON
        setStep(STEP_MOON);
        await animateStep('moon', moon?.sign || '', moon?.intro || '', moonAudioPromiseRef.current);

        // 3. RISING
        setStep(STEP_RISING);
        await animateStep('rising', rising?.sign || '', rising?.intro || '', risingAudioPromiseRef.current);

        // 4. TRANSITION
        setStep(STEP_Transition);

        // Final wait logic
        finish();
    };

    const animateStep = async (
        type: 'sun' | 'moon' | 'rising',
        sign: string,
        text: string,
        audioPromise: Promise<void> | null
    ) => {
        // Reset state
        setDisplayedText('');
        setShowSign(false);
        fadeAnim.setValue(0);
        scaleAnim.setValue(0.9);

        // Reveal Background/Theme for Sign
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]).start();

        // Small delay
        await new Promise(r => setTimeout(r, 500));

        // Reveal Sign Name
        setShowSign(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Wait for Audio
        if (audioPromise) {
            setStatusText('Voicing your chart...');
            await audioPromise;
        }

        // Play Audio & Type Text
        const source = audioSourceRef.current[type] || hookAudio[type];
        if (source) {
            await toggleAudio({ key: getCoreAudioKey(type), source });
        }

        // Simulate typing effect (ARTS)
        const chars = text.split('');
        let current = '';

        // Calculate typing speed based on audio duration if possible, else fixed
        // For now, fixed speed or slightly faster to match audio roughly
        const speed = 30;

        return new Promise<void>(resolve => {
            let i = 0;
            const interval = setInterval(() => {
                current += chars[i];
                setDisplayedText(current);
                i++;
                if (i >= chars.length) {
                    clearInterval(interval);
                    // Wait a bit after text finishes
                    setTimeout(resolve, 1500);
                }
            }, speed);
        });
    };

    const finish = async () => {
        // ========== WAIT FOR ALL AUDIO BEFORE NAVIGATING =========
        // ALL audio (sun, moon, rising) must be ready before user sees HookSequence
        // This is a hard requirement - no pre-rendering in HookSequenceScreen
        setProgress(85);
        setStatusText('Giving your reading a voice…');

        const waitForAudio = async (
            type: 'sun' | 'moon' | 'rising',
            promise: Promise<void> | null,
            reading: any
        ): Promise<boolean> => {
            if (!promise) return true; // No promise means no audio needed/started
            try {
                await promise;
                return true;
            } catch (e) {
                console.warn(`Wait failed for ${type}`, e);
                return false;
            }
        };

        // Wait for ALL audio in parallel
        console.log('🎵 Waiting for all audio to complete...');
        await Promise.all([
            waitForAudio('sun', sunAudioPromiseRef.current, sun),
            waitForAudio('moon', moonAudioPromiseRef.current, moon),
            waitForAudio('rising', risingAudioPromiseRef.current, rising),
        ]);

        await stopAudio().catch(() => { });

        // Navigate to Hook Sequence
        navigation.reset({
            index: 0,
            routes: [{ name: 'HookSequence' }],
        });
    };

    const currentSign = step === STEP_SUN ? sun?.sign : step === STEP_MOON ? moon?.sign : step === STEP_RISING ? rising?.sign : '';
    const currentLabel = step === STEP_SUN ? 'Your Core' : step === STEP_MOON ? 'Your Heart' : 'Your Mask';
    const currentColors = getSignColors(currentSign || 'Default');

    useEffect(() => {
        return () => {
            stopAudio().catch(() => { });
        };
    }, [stopAudio]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Dynamic Gradient Background */}
            <LinearGradient
                colors={[currentColors[0], '#1a1a1a', '#000000']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <View style={styles.content}>
                <Animated.View style={{
                    opacity: fadeAnim,
                    transform: [
                        { scale: scaleAnim },
                        { translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }
                    ],
                    alignItems: 'center',
                    width: '100%',
                }}>
                    <Text style={styles.label}>{currentLabel}</Text>
                    {showSign && (
                        <Text style={[styles.signTitle, { color: currentColors[1] }]}>
                            {currentSign}
                        </Text>
                    )}

                    <View style={styles.textContainer}>
                        <Text style={styles.readingText}>
                            {displayedText}
                        </Text>
                    </View>
                </Animated.View>

                {step === STEP_Transition && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>{statusText}</Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.page,
    },
    label: {
        fontFamily: typography.serif,
        fontSize: 24,
        color: colors.primary, // Gold
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    signTitle: {
        fontFamily: typography.display,
        fontSize: 54,
        marginBottom: spacing.xl,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    textContainer: {
        minHeight: 200,
        justifyContent: 'center',
    },
    readingText: {
        fontFamily: typography.serif,
        fontSize: 22,
        lineHeight: 32,
        color: colors.text,
        textAlign: 'center',
    },
    loadingContainer: {
        marginTop: 20,
    },
    loadingText: {
        color: colors.mutedText,
        fontFamily: typography.mono,
    }
});
