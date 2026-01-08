import React from 'react';
import { StyleSheet, Text, View, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useNavigation } from '@react-navigation/native';
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



    const safeSaveAndComplete = async (nextScreen?: string) => {
        // 1. Construct immutable birth data
        const birthDataObject = (birthDate && birthTime && birthCity) ? {
            birthDate,
            birthTime,
            birthCity: birthCity.name,
            timezone: birthCity.timezone,
            latitude: birthCity.latitude,
            longitude: birthCity.longitude
        } : undefined;

        // 2. Save LOCALLY (Critical for immediate UI access)
        if (name && birthDataObject) {
            console.log('💾 Saving user locally to ProfileStore...');
            const placements = hookReadings ? {
                sunSign: hookReadings.sun?.sign || '',
                moonSign: hookReadings.moon?.sign || '',
                risingSign: hookReadings.rising?.sign || '',
            } : undefined;
            useProfileStore.getState().addPerson({
                name,
                isUser: true,
                birthData: birthDataObject,
                placements,
                hookReadings: hookReadings as any
            });
        }

        // 3. Save to CLOUD (Supabase) - REQUIRED
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

            // Extract placements from hookReadings (calculated during onboarding)
            const placements = hookReadings ? {
                sunSign: hookReadings.sun?.sign || '',
                moonSign: hookReadings.moon?.sign || '',
                risingSign: hookReadings.rising?.sign || '',
            } : undefined;

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
            throw e; // Re-throw to prevent completion
        }

        if (nextScreen && setRedirectAfterOnboarding) {
            setRedirectAfterOnboarding(nextScreen);
        }
        completeOnboarding();
    };

    const handleYes = () => {
        // Save user data, set redirect to PartnerInfo, then complete onboarding
        // RootNavigator will route to MainStack and navigate to PartnerInfo
        safeSaveAndComplete('PartnerInfo');
    };

    const handleNo = () => {
        // User says "No" → save everything and complete onboarding → Dashboard
        safeSaveAndComplete();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title} selectable>
                    Would you like to do a reading for another person?
                </Text>
                <Text style={styles.subtitle} selectable>
                    Unlock the powerful Compatibility Slider by adding a second person to your dashboard.
                </Text>

                <View style={styles.spacer} />

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
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
});
