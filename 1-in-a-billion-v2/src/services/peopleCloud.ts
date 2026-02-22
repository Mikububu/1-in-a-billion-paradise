/**
 * SUPABASE PEOPLE SYNC (CLIENT)
 *
 * Purpose: keep "My People" (including 3rd-persons) available across devices/re-installs.
 * We sync person metadata: name + birthData + placements + hookReadings.
 */

import { supabase, isSupabaseConfigured } from '@/services/supabase';
import type { Person } from '@/store/profileStore';
import { normalizePlacements } from './placementsCalculator';

const TABLE_PEOPLE = 'library_people';

export type LibraryPersonRow = {
    user_id: string;
    client_person_id: string;
    name: string;
    email: string | null;
    is_user: boolean;
    // Preferences
    primary_language: string | null;
    secondary_language: string | null;
    relationship_mode: string | null;
    relationship_intensity: number | null;
    // Birth data
    birth_data: any;
    birth_location: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    // Calculated data
    placements: any | null;
    hook_readings: any | null;
    hook_audio_paths: any | null;
    // Photo/portrait data
    original_photo_url: string | null;
    portrait_url: string | null;
    created_at: string;
    updated_at: string;
};

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
}

function toRow(userId: string, p: Person, selfEmail?: string | null): Partial<LibraryPersonRow> {
    const personAny = p as any;
    const directEmail = normalizeEmail(personAny?.email);
    const resolvedEmail = p.isUser ? normalizeEmail(selfEmail) || directEmail : directEmail;

    // Only include columns that exist in the Supabase table
    const row: Partial<LibraryPersonRow> = {
        user_id: userId,
        client_person_id: p.id,
        name: p.name,
        email: resolvedEmail,
        is_user: Boolean(p.isUser),
        // Birth data (stored as JSON)
        birth_data: p.birthData || {},
        // Calculated data
        placements: p.placements || null,
        hook_readings: p.hookReadings || null,
        updated_at: new Date().toISOString(),
    };

    // IMPORTANT: Only include portrait URLs if they have actual values.
    if (p.portraitUrl) {
        row.portrait_url = p.portraitUrl;
    }
    if (p.originalPhotoUrl) {
        row.original_photo_url = p.originalPhotoUrl;
    }

    return row;
}

function fromRow(r: LibraryPersonRow): Person {
    const now = new Date().toISOString();

    // Normalize placements to ensure consistent format
    const normalizedPlacements = normalizePlacements(r.placements) || r.placements;

    return {
        id: r.client_person_id,
        name: r.name,
        // email: r.email, // Not in v2 Person type yet
        isUser: Boolean(r.is_user),
        // preferences... (if added to v2 Person type)
        birthData: (r.birth_data || {}) as any,
        placements: normalizedPlacements,
        hookReadings: (r.hook_readings || undefined) as any,
        hookAudioPaths: (r.hook_audio_paths || undefined) as any,
        originalPhotoUrl: r.original_photo_url || undefined,
        portraitUrl: r.portrait_url || undefined,
        readings: [],
        createdAt: r.created_at || now,
        updatedAt: r.updated_at || now,
    } as any;
}

/**
 * PUSH-PULL SYNC:
 * 1. Push local changes to Supabase (Upsert)
 * 2. Pull all data from Supabase (Select)
 * 3. Return fresh data to update local store
 */
export async function syncPeopleToSupabase(userId: string, people: Person[]) {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' as const };
    if (!userId) return { success: false, error: 'Missing userId' as const };

    let selfEmail: string | null = null;
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user?.id === userId) {
            selfEmail = normalizeEmail(user.email);
        }
    } catch {
        // Non-fatal: keep syncing even if auth lookup fails.
    }

    const rows = (people || [])
        .filter((p) => Boolean(p?.id))
        .map((p) => toRow(userId, p, selfEmail));

    if (rows.length === 0) {
        return await fetchPeopleFromSupabase(userId);
    }

    const selfProfiles = rows.filter(r => r.is_user === true);
    const partnerProfiles = rows.filter(r => r.is_user !== true);

    console.log(`📤 syncPeopleToSupabase: Pushing ${selfProfiles.length} self, ${partnerProfiles.length} partners`);

    if (selfProfiles.length > 0) {
        const bestSelf = selfProfiles.sort((a, b) =>
            (new Date(b.updated_at || 0).getTime()) - (new Date(a.updated_at || 0).getTime())
        )[0];

        const { error } = await supabase
            .from(TABLE_PEOPLE)
            .upsert(bestSelf, {
                onConflict: 'user_id',
                ignoreDuplicates: false,
            });

        if (error) {
            console.error(`❌ Self profile upsert failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    if (partnerProfiles.length > 0) {
        const { error } = await supabase
            .from(TABLE_PEOPLE)
            .upsert(partnerProfiles, {
                onConflict: 'user_id,client_person_id',
            });

        if (error) {
            console.error(`❌ Partner profiles sync failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    return await fetchPeopleFromSupabase(userId);
}

export async function fetchPeopleFromSupabase(userId: string) {
    if (!isSupabaseConfigured)
        return { success: false, error: 'Supabase not configured' as const, people: [] as Person[] };
    if (!userId) return { success: false, error: 'Missing userId' as const, people: [] as Person[] };

    const { data, error } = await supabase
        .from(TABLE_PEOPLE)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) return { success: false, error: error.message, people: [] as Person[] };
    const people = (data as any[]).map((r) => fromRow(r as LibraryPersonRow));

    return { success: true as const, people };
}

export async function deletePersonFromSupabase(userId: string, personId: string) {
    if (!isSupabaseConfigured) {
        return { success: false as const, error: 'Supabase not configured' };
    }
    if (!userId) return { success: false as const, error: 'Missing userId' };
    if (!personId) return { success: false as const, error: 'Missing personId' };

    const { error } = await supabase
        .from(TABLE_PEOPLE)
        .delete()
        .eq('user_id', userId)
        .eq('client_person_id', personId)
        .eq('is_user', false);

    if (error) {
        return { success: false as const, error: error.message };
    }
    return { success: true as const };
}
