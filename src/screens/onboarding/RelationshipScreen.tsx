import { SimpleSlider } from '@/components/SimpleSlider';
import * as Haptics from 'expo-haptics';
import { useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { describeIntensity } from '@/utils/intensity';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { BackButton } from '@/components/BackButton';

export const RelationshipScreen = () => {
    const navigation = useNavigation<any>();
    const relationshipIntensity = useOnboardingStore((state: any) => state.relationshipIntensity);
    const setIntensity = useOnboardingStore((state: any) => state.setRelationshipIntensity);
    const { signOut } = useAuthStore();
    const lastValue = useRef(relationshipIntensity);
    const descriptor = describeIntensity(relationshipIntensity);
    const { isPlaying } = useMusicStore();

    // 🎵 MUSIC CONTINUITY
    // Keep ambient music playing from IntroScreen
    useFocusEffect(
        useCallback(() => {
            if (isPlaying) {
                AmbientMusic.play();
            }
        }, [isPlaying])
    );

    const handleValueChange = (nextValue: number) => {
        const rounded = Math.round(nextValue);
        if (rounded !== lastValue.current) {
            Haptics.selectionAsync();
            lastValue.current = rounded;
        }
        setIntensity(rounded);
    };

    const handleBack = async () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            // User is at root (likely auto-logged in) -> Sign out to go back to Intro
            await signOut();
            // Reset nav not available on prop-less navigation, use simple reset or navigate
            navigation.reset({
                index: 0,
                routes: [{ name: 'Intro' }],
            });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Gif at bottom - loops automatically */}
            <View style={styles.videoWrapper}>
                <Image
                    source={require('../../../assets/videos/couple-laughing-small.gif')}
                    style={styles.bottomVideo}
                    resizeMode="cover"
                />
            </View>

            <BackButton onPress={handleBack} />

            {/* Content at top */}
            <View style={styles.content}>
                <Text style={styles.title}>What kind of relationship dynamic do you desire?</Text>

                <View style={styles.sliderCard}>
                    <View style={styles.legend}>
                        <Text style={styles.legendLabel}>Safe</Text>
                        <Text style={styles.legendLabel}>Spicy</Text>
                    </View>

                    {/* Custom SimpleSlider */}
                    <SimpleSlider
                        minimumValue={0}
                        maximumValue={10}
                        value={relationshipIntensity}
                        onValueChange={handleValueChange}
                    />

                    <Text style={styles.caption}>{descriptor.caption}</Text>

                    <Text style={styles.helper}>
                        This helps us calibrate which compatibility signals matter most to you. You can adjust this anytime in settings.
                    </Text>
                </View>

                {/* Button - positioned right after helper text */}
                <View style={styles.footer}>
                    <Button label="Continue" onPress={() => navigation.navigate('BirthInfo')} />
                </View>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Keep the root container transparent so the global leather texture shows through consistently.
        backgroundColor: 'transparent',
    },
    videoWrapper: {
        position: 'absolute',
        bottom: -70,
        left: 0,
        right: 0,
        height: '53.87%', // 10% smaller than 59.85% (59.85% * 0.9)
        zIndex: 0, // Background
        opacity: 1, // Back to full opacity
    },
    bottomVideo: {
        width: '100%',
        height: '100%',
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingTop: 80,
        zIndex: 1, // Content above video
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 26,
        lineHeight: 32,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    sliderCard: {
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.inputStroke, // Black stroke like buttons
        padding: spacing.lg,
        // Use broken-white card background (not pure white)
        backgroundColor: colors.buttonBg,
        marginBottom: spacing.xl,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    legendLabel: {
        fontFamily: typography.sansMedium,
        fontSize: 15,
        color: colors.text,
    },
    caption: {
        textAlign: 'center',
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        marginTop: spacing.sm,
    },
    helper: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: spacing.lg,
    },
    footer: {
        marginTop: -20, // Move button up slightly
        paddingHorizontal: spacing.page,
        zIndex: 10,
    },
});
