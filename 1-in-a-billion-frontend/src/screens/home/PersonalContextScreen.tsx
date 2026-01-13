/**
 * PERSONAL CONTEXT SCREEN
 * 
 * Allows users to optionally share personal context or questions
 * before generating their reading. This infuses the reading with
 * specific focus areas without affecting astrological calculations.
 */

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { TexturedBackground } from '@/components/TexturedBackground';
import { BackButton } from '@/components/BackButton';
import { savePersonalContext } from '@/services/peopleService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonalContext'>;

const MAX_CHARS_DEFAULT = 100;
const MAX_CHARS_KABBALAH = 600;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH * 0.7, SCREEN_HEIGHT * 0.4);
const CIRCLE_SIZE_2 = CIRCLE_SIZE * 1.1;
const CIRCLE_SIZE_3 = CIRCLE_SIZE * 1.25;

export const PersonalContextScreen = ({ navigation, route }: Props) => {
    const { personName, isSelf, productType, systems, partnerName, ...restParams } = route.params as any;
    const isKabbalahActive = Array.isArray(systems) && systems.includes('kabbalah');
    const MAX_CHARS = isKabbalahActive ? MAX_CHARS_KABBALAH : MAX_CHARS_DEFAULT;

    const [context, setContext] = useState('');

    const pulseAnim1 = useRef(new Animated.Value(1)).current;
    const pulseAnim2 = useRef(new Animated.Value(1)).current;
    const pulseAnim3 = useRef(new Animated.Value(1)).current;
    const opacityAnim1 = useRef(new Animated.Value(0)).current; // Start at 0 for fade-in
    const opacityAnim2 = useRef(new Animated.Value(0)).current; // Start at 0 for fade-in
    const opacityAnim3 = useRef(new Animated.Value(0)).current; // Start at 0 for fade-in

    useEffect(() => {
        // FADE IN: First, fade in all circles gracefully
        Animated.parallel([
            Animated.timing(opacityAnim1, {
                toValue: 0.8,
                duration: 1000,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim2, {
                toValue: 0.6,
                duration: 1200,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim3, {
                toValue: 0.4,
                duration: 1400,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
        ]).start(() => {
            // After fade-in completes, start the pulse animations
            const createPulseAnimation = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, baseOpacity: number, delay: number) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.parallel([
                            Animated.timing(scaleAnim, {
                                toValue: 1.12,
                                duration: 3000,
                                easing: Easing.out(Easing.ease),
                                useNativeDriver: true,
                            }),
                            Animated.timing(opacityAnim, {
                                toValue: 0.3,
                                duration: 3000,
                                easing: Easing.out(Easing.ease),
                                useNativeDriver: true,
                            }),
                        ]),
                        Animated.parallel([
                            Animated.timing(scaleAnim, {
                                toValue: 1,
                                duration: 3000,
                                easing: Easing.in(Easing.ease),
                                useNativeDriver: true,
                            }),
                            Animated.timing(opacityAnim, {
                                toValue: baseOpacity,
                                duration: 3000,
                                easing: Easing.in(Easing.ease),
                                useNativeDriver: true,
                            }),
                        ]),
                    ])
                );
            };
            
            // Stagger the pulse animations to create a wave effect
            const pulseAnimation1 = createPulseAnimation(pulseAnim1, opacityAnim1, 0.8, 0);
            const pulseAnimation2 = createPulseAnimation(pulseAnim2, opacityAnim2, 0.6, 600);
            const pulseAnimation3 = createPulseAnimation(pulseAnim3, opacityAnim3, 0.4, 1200);
            
            pulseAnimation1.start();
            pulseAnimation2.start();
            pulseAnimation3.start();
        });
        
        return () => {
            // Cleanup: stop all animations
            opacityAnim1.stopAnimation();
            opacityAnim2.stopAnimation();
            opacityAnim3.stopAnimation();
            pulseAnim1.stopAnimation();
            pulseAnim2.stopAnimation();
            pulseAnim3.stopAnimation();
        };
    }, [pulseAnim1, pulseAnim2, pulseAnim3, opacityAnim1, opacityAnim2, opacityAnim3]);

    const handleSkip = () => {
        // If productType and systems are passed, go directly to VoiceSelection
        if (productType && systems && systems.length > 0) {
            navigation.navigate('VoiceSelection', {
                ...restParams,
                personalContext: undefined,
                productType,
                systems,
                readingType: 'individual',
            } as any);
        } else {
            // Normal flow → SystemSelection (where user picks system or bundle)
            navigation.navigate('SystemSelection', {
                ...restParams,
                personalContext: undefined,
            });
        }
    };

    const handleContinue = async () => {
        const personalContext = context.trim() || undefined;
        
        // Save personal context to Supabase if we have a person name and context
        if (personalContext && personName && isSupabaseConfigured) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const userId = session?.user?.id;
                if (userId) {
                    await savePersonalContext(userId, personName, personalContext);
                }
            } catch (err) {
                console.warn('⚠️ Failed to save personal context to Supabase:', err);
                // Continue anyway - don't block navigation
            }
        }
        
        // If productType and systems are passed, go directly to VoiceSelection (skip SystemSelection)
        if (productType && systems && systems.length > 0) {
            navigation.navigate('VoiceSelection', {
                ...restParams,
                personalContext,
                productType,
                systems,
                readingType: 'individual',
            } as any);
        } else {
            // Normal flow → SystemSelection (where user picks system or bundle)
            navigation.navigate('SystemSelection', {
                ...restParams,
                personalContext,
            });
        }
    };

    return (
        <TexturedBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <BackButton onPress={() => navigation.goBack()} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>
                            {isKabbalahActive
                                ? <>Tell us about your life</>
                                : (isSelf 
                                    ? <>Would you like{'\n'}to focus on something{'\n'}specific in your reading?</>
                                    : <>{personName}, would you like{'\n'}to focus on something{'\n'}specific in your reading?</>)
                            }
                        </Text>
                        <Text style={[styles.subheadline, isKabbalahActive && styles.subheadlineKabbalah]}>
                            {isKabbalahActive ? (
                                <>Please include your real <Text style={styles.boldText}>first name and surname</Text>. The more you can tell us about the most beautiful or most difficult events in your life, including moments of great happiness, love, loss, or death, the richer and more accurate your reading will be. Exact dates and locations are very important.</>
                            ) : (
                                "Please feel free to share any questions, feelings, or areas of life you'd like the reading to address."
                            )}
                        </Text>
                    </View>

                    {/* Circular Text Input - Centered */}
                    <View style={styles.circleWrapper}>
                        <Animated.View
                            style={[
                                styles.animatedCircle,
                                styles.animatedCircle1,
                                {
                                    transform: [{ scale: pulseAnim1 }],
                                    opacity: opacityAnim1,
                                    borderColor: '#FF1744',
                                },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.animatedCircle,
                                styles.animatedCircle2,
                                {
                                    transform: [{ scale: pulseAnim2 }],
                                    opacity: opacityAnim2,
                                    borderColor: '#FF6B9D',
                                },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.animatedCircle,
                                styles.animatedCircle3,
                                {
                                    transform: [{ scale: pulseAnim3 }],
                                    opacity: opacityAnim3,
                                    borderColor: '#FFB3D1',
                                },
                            ]}
                        />
                        <View style={styles.circleContainer}>
                            <TextInput
                                style={[
                                    styles.circleInput,
                                    isKabbalahActive && { fontSize: 12 }
                                ]}
                                multiline
                                placeholder={isKabbalahActive ? "Lets start with the full name(s)..." : "I will speak the truth"}
                                placeholderTextColor={colors.mutedText}
                                value={context}
                                onChangeText={setContext}
                                maxLength={MAX_CHARS}
                                autoFocus
                                textAlignVertical="center"
                                textAlign="center"
                            />
                        </View>
                    </View>
                </View>

                {/* Bottom Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.skipButton]}
                        onPress={handleSkip}
                    >
                        <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.continueButton]}
                        onPress={handleContinue}
                    >
                        <Text style={styles.continueButtonText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
        </TexturedBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: spacing.page,
        alignItems: 'center',
        paddingTop: spacing.xl * 2,
    },
    header: {
        width: '100%',
        marginBottom: spacing.lg,
    },
    headline: {
        fontFamily: typography.headline,
        fontSize: 24,
        color: colors.text,
        marginBottom: spacing.md,
        lineHeight: 30,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    subheadline: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        lineHeight: 20,
        textAlign: 'left',
        marginTop: spacing.sm,
    },
    subheadlineKabbalah: {
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: spacing.md,
        lineHeight: 20,
    },
    boldText: {
        fontFamily: typography.sansSemiBold,
        fontWeight: '600',
    },
    circleWrapper: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.xl,
        position: 'relative',
    },
    animatedCircle: {
        position: 'absolute',
        borderWidth: 2,
        backgroundColor: 'transparent',
    },
    animatedCircle1: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
    },
    animatedCircle2: {
        width: CIRCLE_SIZE_2,
        height: CIRCLE_SIZE_2,
        borderRadius: CIRCLE_SIZE_2 / 2,
    },
    animatedCircle3: {
        width: CIRCLE_SIZE_3,
        height: CIRCLE_SIZE_3,
        borderRadius: CIRCLE_SIZE_3 / 2,
    },
    circleContainer: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circleInput: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.text,
        backgroundColor: 'transparent',
        paddingHorizontal: spacing.xl,
        paddingTop: CIRCLE_SIZE / 2 - 20,
        textAlignVertical: 'top',
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.page,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radii.button,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButton: {
        backgroundColor: colors.buttonBg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    skipButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    continueButton: {
        backgroundColor: colors.primary,
    },
    continueButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.background,
    },
});
