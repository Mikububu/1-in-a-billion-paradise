import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'PostHookOffer'>;

export const PostHookOfferScreen = ({ navigation }: Props) => {
    const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
    const setRedirectAfterOnboarding = useOnboardingStore((s: any) => s.setRedirectAfterOnboarding);

    const {
        name,
        birthDate,
        birthTime,
        birthCity,
        hookReadings,
        relationshipMode,
        relationshipIntensity
    } = useOnboardingStore();
    const sessionId = useAuthStore(s => s.session?.user?.id);
    const email = useAuthStore(s => s.session?.user?.email);

    // Loading state for dashboard transition
    const [isTransitioning, setIsTransitioning] = useState(false);

    // If user ever comes back to this screen, re-enable buttons.
    useFocusEffect(
        useCallback(() => {
            setIsTransitioning(false);
        }, [])
    );

    const buildBirthDataObject = () => {
        return (birthDate && birthTime && birthCity) ? {
            birthDate,
            birthTime,
            birthCity: birthCity.name,
            timezone: birthCity.timezone,
            latitude: birthCity.latitude,
            longitude: birthCity.longitude
        } : undefined;
    };

    const buildPlacements = () => {
        return hookReadings ? {
            sunSign: hookReadings.sun?.sign || '',
            moonSign: hookReadings.moon?.sign || '',
            risingSign: hookReadings.rising?.sign || '',
        } : undefined;
    };

    const saveLocal = (birthDataObject: any, placements: any) => {
        if (!name || !birthDataObject) return;
        console.log('💾 Saving user locally to ProfileStore...');
        useProfileStore.getState().addPerson({
            name,
            isUser: true,
            birthData: birthDataObject,
            placements,
            hookReadings: hookReadings as any
        });
    };

    const syncCloud = async (birthDataObject: any, placements: any) => {
        // Save to CLOUD (Supabase)
        if (!sessionId) {
            console.error('❌ CRITICAL: User must be authenticated to complete onboarding');
            Alert.alert(
                'Authentication Required',
                'You must be signed in to save your readings. Please sign in and try again.',
                [{ text: 'OK' }]
            );
            throw new Error('User must be authenticated to complete onboarding');
        }

        console.log('☁️  Syncing user to Supabase...');
        try {
            // Import dynamically to avoid cycles if any
            const { upsertSelfProfileToSupabase } = await import('@/services/profileUpsert');

            await upsertSelfProfileToSupabase({
                userId: sessionId,
                email: email || '',
                displayName: name || 'User',
                relationshipMode,
                relationshipIntensity,
                birthData: birthDataObject,
                placements,  // ← Now saving star signs to database
                hookReadings: hookReadings as any
            });
        } catch (e) {
            console.error('❌ Error saving profile to cloud:', e);
            Alert.alert(
                'Save Error',
                'Failed to save your profile. Please try again.',
                [{ text: 'OK' }]
            );
            throw e;
        }
    };

    const complete = (nextScreen?: string) => {
        if (nextScreen && setRedirectAfterOnboarding) {
            setRedirectAfterOnboarding(nextScreen);
        }
        completeOnboarding();
    };

    const handleYes = async () => {
        // IMPORTANT: This path should feel instant.
        // Navigate immediately; sync in background.
        const birthDataObject = buildBirthDataObject();
        const placements = buildPlacements();
        saveLocal(birthDataObject, placements);

        try {
            complete('PartnerInfo');
            // Fire-and-forget cloud sync. Don't block navigation UX.
            syncCloud(birthDataObject, placements).catch((error) => {
                console.error('⚠️ Background profile sync failed (non-blocking):', error);
            });
        } catch (error) {
            console.error('❌ Transition (YES) failed:', error);
        }
    };

    const handleNo = async () => {
        // User says "No" → save everything and complete onboarding → Dashboard
        setIsTransitioning(true);
        console.log('🔄 Starting dashboard transition...');
        try {
            const birthDataObject = buildBirthDataObject();
            const placements = buildPlacements();
            saveLocal(birthDataObject, placements);
            await syncCloud(birthDataObject, placements);
            complete();
        } catch (error) {
            console.error('❌ Transition failed:', error);
            setIsTransitioning(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title} selectable>
                    Would you like to do a reading for another person?
                </Text>
                <Text style={styles.subtitle} selectable>
                    Add a third person to unlock a free reading and a two person compatibility analysis.
                </Text>

                <View style={styles.spacer} />

                {isTransitioning ? (
                    <View style={[styles.button, styles.transitioningButton]}>
                        <ActivityIndicator size="small" color={colors.text} style={{ marginRight: 12 }} />
                        <Text style={styles.transitioningText}>TRANSFERRING YOU...</Text>
                    </View>
                ) : (
                    <>
                        <Button
                            label="YES, ADD A PERSON"
                            onPress={handleYes}
                            variant="primary"
                            style={styles.button}
                        />

                        <Button
                            label="NO, CONTINUE TO DASHBOARD"
                            onPress={handleNo}
                            variant="secondary"
                            style={styles.button}
                        />
                    </>
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
        padding: spacing.page,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.mutedText,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    spacer: {
        flex: 0.2, // Visual space
    },
    button: {
        width: '100%',
        marginBottom: spacing.md,
    },
    transitioningButton: {
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.buttonBg,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    transitioningText: {
        fontFamily: typography.headline,
        fontSize: 16,
        color: colors.text,
        letterSpacing: 1,
    },
});
