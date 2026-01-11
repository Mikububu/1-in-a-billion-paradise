/**
 * SUPABASE PROFILE UPSERT
 *
 * Ensures every authenticated user has exactly ONE self profile in Supabase.
 * Called immediately after successful Google login and after onboarding completes.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { BirthData, Placements } from '@/store/profileStore';
import type { HookReading } from '@/types/forms';

const TABLE_PEOPLE = 'library_people';
const TABLE_COMMERCIAL = 'user_commercial_state';

export type UpsertSelfProfileParams = {
    userId: string;
    email: string;
    displayName: string;
    // Onboarding data (optional - may not be available at first login)
    primaryLanguage?: string;
    secondaryLanguage?: string;
    relationshipMode?: 'family' | 'sensual';
    relationshipIntensity?: number;
    birthData?: BirthData;
    birthLocation?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    placements?: Placements;
    hookReadings?: HookReading[];
};

/**
 * Upserts self profile to Supabase with complete onboarding data.
 * 
 * - Creates profile if it doesn't exist
 * - Updates profile if it already exists
 * - Uses (user_id, is_user=true) as unique constraint
 * - Non-blocking: errors are logged but don't prevent auth
 */
export async function upsertSelfProfileToSupabase(params: UpsertSelfProfileParams): Promise<{
    success: boolean;
    error?: string;
}> {
    const {
        userId,
        email,
        displayName,
        primaryLanguage,
        secondaryLanguage,
        relationshipMode,
        relationshipIntensity,
        birthData,
        birthLocation,
        latitude,
        longitude,
        timezone,
        placements,
        hookReadings,
    } = params;

    if (!isSupabaseConfigured) {
        console.log('⚠️ Supabase not configured, skipping profile upsert');
        return { success: false, error: 'Supabase not configured' };
    }

    if (!userId) {
        console.error('❌ Cannot upsert profile: missing userId');
        return { success: false, error: 'Missing userId' };
    }

    try {
        console.log('🔄 Upserting complete self profile to Supabase...', {
            userId,
            email,
            displayName,
            hasLanguages: !!(primaryLanguage || secondaryLanguage),
            hasRelationshipPrefs: !!(relationshipMode || relationshipIntensity),
            hasBirthData: !!birthData,
            hasPlacements: !!placements,
            hasHookReadings: !!hookReadings,
        });

        // Generate a stable client_person_id for the self profile
        const clientPersonId = `self-${userId}`;
        const now = new Date().toISOString();

        const profileRow = {
            user_id: userId,
            client_person_id: clientPersonId,
            name: displayName || email?.split('@')[0] || 'You',
            email: email || null, // Sync email for admin convenience
            is_user: true,
            created_at: now,
            updated_at: now,
            // Conditionally add other fields only if they have values
            ...(relationshipIntensity ? { relationship_intensity: relationshipIntensity } : {}),

            ...(birthData ? {
                birth_data: birthData,
            } : {}),

            ...(placements ? { placements } : {}),
            ...(hookReadings ? { hook_readings: hookReadings } : {}),
        };

        // Check if profile already exists
        const { data: existing } = await supabase
            .from(TABLE_PEOPLE)
            .select('user_id')
            .eq('user_id', userId)
            .eq('is_user', true)
            .maybeSingle();

        if (existing) {
            // Update existing profile
            const { error } = await supabase
                .from(TABLE_PEOPLE)
                .update({
                    name: profileRow.name,
                    email: profileRow.email, // Sync email on every update
                    updated_at: profileRow.updated_at,
                    ...(profileRow.relationship_intensity ? { relationship_intensity: profileRow.relationship_intensity } : {}),
                    ...(profileRow.birth_data ? { birth_data: profileRow.birth_data } : {}),
                    ...(profileRow.placements ? { placements: profileRow.placements } : {}),
                    ...(profileRow.hook_readings ? { hook_readings: profileRow.hook_readings } : {}),
                })
                .eq('user_id', userId)
                .eq('is_user', true);

            if (error) {
                console.error('❌ Failed to update self profile:', error.message);
                return { success: false, error: error.message };
            }
        } else {
            // Insert new profile
            const { error } = await supabase
                .from(TABLE_PEOPLE)
                .insert(profileRow);

            if (error) {
                console.error('❌ Failed to insert self profile:', error.message);
                return { success: false, error: error.message };
            }
        }

        console.log('✅ Complete self profile saved to Supabase successfully');
        return { success: true };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Exception during profile upsert:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

/**
 * Initializes commercial state for a new user.
 * Called after successful Google auth to set default free tier access.
 */
export async function initializeCommercialState(userId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase not configured' };
    }

    if (!userId) {
        return { success: false, error: 'Missing userId' };
    }

    try {
        console.log('🔄 Initializing commercial state for user...');

        const { error } = await supabase
            .from(TABLE_COMMERCIAL)
            .upsert({
                user_id: userId,
                has_purchased: false,
                access_level: 'free',
                subscription_status: null,
                entitlements: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            });

        if (error) {
            console.warn('⚠️ Commercial state table not configured (skipping):', error.message);
            return { success: true }; // Return success to not block flow
        }

        console.log('✅ Commercial state initialized (free tier)');
        return { success: true };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('⚠️ Commercial state not available (skipping):', errorMessage);
        return { success: true }; // Return success to not block flow
    }
}

/**
 * Checks if a user profile exists in Supabase.
 * Used to validate that a user has completed onboarding before allowing sign-in.
 * 
 * @returns true if profile exists, false otherwise
 */
export async function checkProfileExists(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
        console.log('⚠️ Supabase not configured, cannot check profile existence');
        return false;
    }

    if (!userId) {
        console.error('❌ Cannot check profile: missing userId');
        return false;
    }

    try {
        console.log('🔍 Checking if profile exists for user:', userId);

        const { data, error } = await supabase
            .from(TABLE_PEOPLE)
            .select('user_id')
            .eq('user_id', userId)
            .eq('is_user', true)
            .maybeSingle();

        if (error) {
            console.error('❌ Error checking profile existence:', error.message);
            return false;
        }

        const exists = !!data;
        console.log(exists ? '✅ Profile exists' : '❌ No profile found');
        return exists;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Exception checking profile existence:', errorMessage);
        return false;
    }
}

/**
 * Updates self profile birth data in Supabase.
 * Called after onboarding completes or birth data is edited.
 */
export async function updateSelfProfileBirthData(userId: string, birthData: BirthData): Promise<{
    success: boolean;
    error?: string;
}> {
    if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase not configured' };
    }

    if (!userId) {
        return { success: false, error: 'Missing userId' };
    }

    try {
        console.log('🔄 Updating self profile birth data in Supabase...');

        const { error } = await supabase
            .from(TABLE_PEOPLE)
            .update({
                birth_data: birthData,
                birth_location: birthData?.birthCity || null,
                latitude: birthData?.latitude ?? null,
                longitude: birthData?.longitude ?? null,
                timezone: birthData?.timezone || null,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('is_user', true);

        if (error) {
            console.error('❌ Failed to update birth data:', error.message);
            return { success: false, error: error.message };
        }

        console.log('✅ Self profile birth data updated in Supabase');
        return { success: true };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Exception during birth data update:', errorMessage);
        return { success: false, error: errorMessage };
    }
}
