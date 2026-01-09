/**
 * RELATIONSHIP CONTEXT SCREEN
 * 
 * Allows users to optionally share feelings/context about the other person
 * before generating an overlay reading. This infuses the reading with subtle
 * emotional context without affecting astrological calculations.
 */

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'RelationshipContext'>;

const MAX_CHARS = 100;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH * 0.7, SCREEN_HEIGHT * 0.4);
const CIRCLE_SIZE_2 = CIRCLE_SIZE * 1.1; // Second circle - 10% larger
const CIRCLE_SIZE_3 = CIRCLE_SIZE * 1.25; // Third circle - 25% larger

export const RelationshipContextScreen = ({ navigation, route }: Props) => {
    const { partnerName, ...restParams } = route.params;
    const [context, setContext] = useState('');
    const pulseAnim1 = useRef(new Animated.Value(1)).current;
    const pulseAnim2 = useRef(new Animated.Value(1)).current;
    const pulseAnim3 = useRef(new Animated.Value(1)).current;
    const opacityAnim1 = useRef(new Animated.Value(0.8)).current;
    const opacityAnim2 = useRef(new Animated.Value(0.6)).current;
    const opacityAnim3 = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        // Create a harmonious wave effect - circles pulse outward in sequence
        // Each circle starts slightly after the previous one, creating a ripple effect
        const createPulseAnimation = (scaleAnim: Animated.Value, opacityAnim: Animated.Value, delay: number) => {
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
                            toValue: opacityAnim === opacityAnim1 ? 0.8 : opacityAnim === opacityAnim2 ? 0.6 : 0.4,
                            duration: 3000,
                            easing: Easing.in(Easing.ease),
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            );
        };
        
        // Stagger the animations to create a wave effect
        // Inner circle starts first, then middle, then outer
        // Inner circle: darker red, middle: medium pink-red, outer: lighter pink
        const pulseAnimation1 = createPulseAnimation(pulseAnim1, opacityAnim1, 0);
        const pulseAnimation2 = createPulseAnimation(pulseAnim2, opacityAnim2, 600);
        const pulseAnimation3 = createPulseAnimation(pulseAnim3, opacityAnim3, 1200);
        
        pulseAnimation1.start();
        pulseAnimation2.start();
        pulseAnimation3.start();
        
        return () => {
            pulseAnimation1.stop();
            pulseAnimation2.stop();
            pulseAnimation3.stop();
        };
    }, [pulseAnim1, pulseAnim2, pulseAnim3, opacityAnim1, opacityAnim2, opacityAnim3]);

    const handleSkip = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            preselectedSystem: route.params.preselectedSystem,
            relationshipContext: undefined,
        });
    };

    const handleContinue = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            preselectedSystem: route.params.preselectedSystem,
            relationshipContext: context.trim() || undefined,
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>
                            Would you like to tell us more about this soul connection?
                        </Text>
                        <Text style={styles.subheadline}>
                            {partnerName}, please feel free to share how you're related and how you feel toward them.
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
                                    borderColor: '#FF1744', // Deep red
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
                                    borderColor: '#FF6B9D', // Medium pink-red
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
                                    borderColor: '#FFB3D1', // Light pink
                                },
                            ]}
                        />
                        <View style={styles.circleContainer}>
                            <TextInput
                                style={styles.circleInput}
                                multiline
                                placeholder="I will speak the truth"
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
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        marginBottom: spacing.xl * 2,
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
        fontSize: 16,
        color: colors.mutedText,
        lineHeight: 22,
        textAlign: 'center',
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
        fontSize: 14,
        color: colors.text,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        textAlignVertical: 'center',
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
        backgroundColor: 'transparent',
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
