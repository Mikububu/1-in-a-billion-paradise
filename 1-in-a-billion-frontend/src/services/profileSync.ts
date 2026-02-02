/**
 * PROFILE SYNC HELPERS
 *
 * Helper functions to sync complete profile data to Supabase
 * after onboarding completes or data changes.
 */

import { upsertSelfProfileToSupabase } from './profileUpsert';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';

/**
 * Syncs complete profile data to Supabase after onboarding completes.
 * Pulls data from onboardingStore and profileStore.
 */
export async function syncCompleteProfileAfterOnboarding(): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        // Get user ID from auth
        const user = useAuthStore.getState().user;
        if (!user) {
            console.error('❌ Cannot sync profile: no authenticated user');
            return { success: false, error: 'No authenticated user' };
        }

        // Get onboarding data
        const onboarding = useOnboardingStore.getState();
        const profile = useProfileStore.getState();
        const selfProfile = profile.getUser();

        console.log('🔄 Syncing complete profile after onboarding...', {
            userId: user.id,
            hasLanguages: !!(onboarding.primaryLanguage),
            hasRelationshipPrefs: !!(onboarding.relationshipMode),
            hasBirthData: !!(onboarding.birthDate && onboarding.birthTime && onboarding.birthCity),
            hasPlacements: !!selfProfile?.placements,
            hasHookReadings: !!(onboarding.hookReadings?.sun || onboarding.hookReadings?.moon || onboarding.hookReadings?.rising),
        });

        // Prepare hook readings array
        const hookReadings = [];
        if (onboarding.hookReadings.sun) hookReadings.push(onboarding.hookReadings.sun);
        if (onboarding.hookReadings.moon) hookReadings.push(onboarding.hookReadings.moon);
        if (onboarding.hookReadings.rising) hookReadings.push(onboarding.hookReadings.rising);

        // Upsert complete profile
        const result = await upsertSelfProfileToSupabase({
            userId: user.id,
            email: user.email || '',
            displayName: useAuthStore.getState().displayName || user.email?.split('@')[0] || 'You',
            primaryLanguage: onboarding.primaryLanguage?.code,
            secondaryLanguage: onboarding.secondaryLanguage?.code,
            relationshipMode: onboarding.relationshipMode,
            relationshipIntensity: onboarding.relationshipIntensity,
            birthData: onboarding.birthDate && onboarding.birthTime && onboarding.birthCity
                ? {
                    birthDate: onboarding.birthDate,
                    birthTime: onboarding.birthTime,
                    birthCity: onboarding.birthCity.name,
                    timezone: onboarding.birthCity.timezone,
                    latitude: onboarding.birthCity.latitude,
                    longitude: onboarding.birthCity.longitude,
                }
                : undefined,
            birthLocation: onboarding.birthCity?.name,
            latitude: onboarding.birthCity?.latitude,
            longitude: onboarding.birthCity?.longitude,
            timezone: onboarding.birthCity?.timezone,
            placements: selfProfile?.placements,
            hookReadings: hookReadings.length > 0 ? hookReadings : undefined,
        });

        if (result.success) {
            console.log('✅ Complete profile synced to Supabase after onboarding');
        } else {
            console.error('❌ Failed to sync complete profile:', result.error);
        }

        return result;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Exception during profile sync:', errorMessage);
        return { success: false, error: errorMessage };
    }
}
