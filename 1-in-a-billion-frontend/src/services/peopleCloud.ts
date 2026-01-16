/**
 * SUPABASE PEOPLE SYNC (CLIENT)
 *
 * Purpose: keep "My People" (including 3rd-persons) available across devices/re-installs.
 * We sync person metadata: name + birthData + placements + hookReadings.
 *
 * Table (recommended): public.library_people
 * - user_id (uuid)              -- auth.users.id
 * - client_person_id (text)     -- stable ID from app (Person.id)
 * - name (text)
 * - is_user (bool)
 * - birth_data (jsonb)
 * - placements (jsonb)
 * - hook_readings (jsonb)
 * - created_at (timestamptz)
 * - updated_at (timestamptz)
 */

import { supabase, isSupabaseConfigured } from '@/services/supabase';
import type { Person } from '@/store/profileStore';
import { normalizePlacements } from './placementsCalculator';

const TABLE_PEOPLE = 'library_people';

export type LibraryPersonRow = {
  user_id: string;
  client_person_id: string;
  name: string;
  email: string;
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
  created_at: string;
  updated_at: string;
};

function toRow(userId: string, p: Person): LibraryPersonRow {
  return {
    user_id: userId,
    client_person_id: p.id,
    name: p.name,
    email: (p as any).email || '',
    is_user: Boolean(p.isUser),
    // Preferences
    primary_language: (p as any).primaryLanguage || null,
    secondary_language: (p as any).secondaryLanguage || null,
    relationship_mode: (p as any).relationshipMode || null,
    relationship_intensity: (p as any).relationshipIntensity || null,
    // Birth data
    birth_data: p.birthData || {},
    birth_location: p.birthData?.birthCity || null,
    latitude: p.birthData?.latitude ?? null,
    longitude: p.birthData?.longitude ?? null,
    timezone: p.birthData?.timezone || null,
    // Calculated data
    placements: p.placements || null,
    hook_readings: p.hookReadings || null,
    hook_audio_paths: (p as any).hookAudioPaths || null,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: p.updatedAt || new Date().toISOString(),
  };
}

function fromRow(r: LibraryPersonRow): Person {
  const now = new Date().toISOString();
  
  // Normalize placements to ensure consistent format (sunSign, moonSign, risingSign)
  const normalizedPlacements = normalizePlacements(r.placements) || r.placements;
  
  return {
    id: r.client_person_id,
    name: r.name,
    email: r.email,
    isUser: Boolean(r.is_user),
    // Preferences (stored as extended properties)
    primaryLanguage: r.primary_language,
    secondaryLanguage: r.secondary_language,
    relationshipMode: r.relationship_mode,
    relationshipIntensity: r.relationship_intensity,
    // Birth data
    birthData: (r.birth_data || {}) as any,
    // Calculated data
    placements: normalizedPlacements,
    hookReadings: (r.hook_readings || undefined) as any,
    hookAudioPaths: (r.hook_audio_paths || undefined) as any,
    readings: [],
    createdAt: r.created_at || now,
    updatedAt: r.updated_at || now,
  } as any; // Cast to any since new fields are not in Person type yet
}

export async function syncPeopleToSupabase(userId: string, people: Person[]) {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' as const };
  if (!userId) return { success: false, error: 'Missing userId' as const };

  const rows = (people || [])
    .filter((p) => Boolean(p?.id))
    .map((p) => toRow(userId, p));

  if (rows.length === 0) return { success: true as const };

  // Split self profiles and partner profiles
  const selfProfiles = rows.filter(r => r.is_user === true);
  const partnerProfiles = rows.filter(r => r.is_user !== true);

  // Upsert self profiles with user_id-only conflict (matches DB constraint)
  if (selfProfiles.length > 0) {
    const { error: selfError } = await supabase
      .from(TABLE_PEOPLE)
      .upsert(selfProfiles, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      });
    if (selfError) return { success: false, error: selfError.message };
  }

  // Upsert partner profiles with (user_id, client_person_id) conflict
  if (partnerProfiles.length > 0) {
    const { error: partnerError } = await supabase
      .from(TABLE_PEOPLE)
      .upsert(partnerProfiles, {
        onConflict: 'user_id,client_person_id',
      });
    if (partnerError) return { success: false, error: partnerError.message };
  }

  return { success: true as const };
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


