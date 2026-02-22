import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useHookReadings } from '@/hooks/useHookReadings';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CoreIdentitiesIntro'>;

export const CoreIdentitiesIntroScreen = ({ navigation }: Props) => {
    const { sun, moon, rising, isLoading } = useHookReadings();
    const [isAdvancing, setIsAdvancing] = useState(false);
    const hasForwardedRef = useRef(false);

    // Animation values
    const yourAnim = useRef(new Animated.Value(0)).current;
    const numberAnim = useRef(new Animated.Value(0)).current;
    const coreAnim = useRef(new Animated.Value(0)).current;
    const identitiesAnim = useRef(new Animated.Value(0)).current;
    const inLoveAnim = useRef(new Animated.Value(0)).current;
    const advanceAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Staggered text reveal animation
    useEffect(() => {
        Animated.stagger(300, [
            Animated.timing(yourAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(numberAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(coreAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(identitiesAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(inLoveAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]).start();
    }, []);

    // Pulse animation while loading
    useEffect(() => {
        if (isLoading) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isLoading]);

    // Auto-forward as soon as all 3 readings are ready (no manual action)
    useEffect(() => {
        if (sun && moon && rising && !hasForwardedRef.current) {
            hasForwardedRef.current = true;
            setIsAdvancing(true);
            Animated.timing(advanceAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
                navigation.replace('CoreIdentities');
            });
        }
    }, [sun, moon, rising, advanceAnim, navigation]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Animated.Text style={[styles.yourText, {
                    opacity: yourAnim,
                    transform: [{ translateY: yourAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
                }]}>
                    Your
                </Animated.Text>

                <Animated.Text style={[styles.bigNumber, {
                    opacity: numberAnim,
                    transform: [
                        { scale: numberAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                        { scale: isLoading ? pulseAnim : 1 }
                    ]
                }]}>
                    3
                </Animated.Text>

                <Animated.Text style={[styles.coreText, {
                    opacity: coreAnim,
                    transform: [{ translateX: coreAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }]
                }]}>
                    Core
                </Animated.Text>

                <Animated.Text style={[styles.identitiesText, {
                    opacity: identitiesAnim,
                    transform: [{ translateX: identitiesAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }]
                }]}>
                    Identities
                </Animated.Text>

                <Animated.Text style={[styles.inLoveText, {
                    opacity: inLoveAnim,
                    transform: [{ translateY: inLoveAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                }]}>
                    in Love
                </Animated.Text>

                {isLoading && (
                    <Animated.Text style={[styles.loadingText, { opacity: pulseAnim }]}>
                        Analyzing your cosmic blueprint...
                    </Animated.Text>
                )}
            </View>

            <View style={styles.footer}>
                {isAdvancing ? (
                    <Animated.Text style={[styles.loadingText, { opacity: advanceAnim }]}>
                        Opening your core identities...
                    </Animated.Text>
                ) : (
                    <View style={styles.dotsContainer}>
                        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
                        <Animated.View style={[styles.dot, { opacity: pulseAnim.interpolate({ inputRange: [0.6, 1], outputRange: [1, 0.6] }) }]} />
                        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
                    </View>
                )}
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.page,
    },
    yourText: {
        fontFamily: typography.serifBold,
        fontSize: 48,
        color: colors.text,
    },
    bigNumber: {
        fontFamily: typography.serifBold,
        fontSize: 160,
        color: colors.text,
        lineHeight: 170,
        marginTop: -20,
    },
    coreText: {
        fontFamily: typography.serifBold,
        fontSize: 56,
        color: colors.text,
        marginTop: -30,
    },
    identitiesText: {
        fontFamily: typography.serifBold,
        fontSize: 56,
        color: colors.text,
        marginTop: -10,
    },
    inLoveText: {
        fontFamily: typography.serifBold,
        fontSize: 56,
        color: colors.text,
        marginTop: -10,
    },
    loadingText: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        marginTop: spacing.xl,
    },
    footer: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.xl,
        alignItems: 'center',
        minHeight: 80,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.mutedText,
    },
});
