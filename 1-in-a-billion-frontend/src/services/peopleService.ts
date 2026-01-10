/**
 * PEOPLE SERVICE - Supabase CRUD for library_people table
 * 
 * Manages people (user + partners/friends) with Swiss Eph placements
 * stored in Supabase for cross-device sync.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { Person, BirthData, Placements } from '@/store/profileStore';
import { calculatePlacements } from './placementsCalculator';

export type LibraryPerson = {
  id?: string;
  user_id: string;
  client_person_id: string; // Frontend-generated ID
  name: string;
  is_user: boolean;
  gender?: 'male' | 'female';
  birth_data: BirthData;
  placements?: Placements;
  relationship_intensity?: number;
  has_paid_reading?: boolean; // True if involved in at least one paid job
  created_at?: string;
  updated_at?: string;
};

/**
 * Fetch all people for the current user from Supabase
 */
export async function fetchPeopleFromSupabase(userId: string): Promise<Person[]> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping people fetch');
    return [];
  }

  try {
    console.log(`📥 Fetching people from Supabase for user ${userId}...`);
    
    const { data, error } = await supabase
      .from('library_people')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('📭 No people found in Supabase');
      return [];
    }

    console.log(`✅ Fetched ${data.length} people from Supabase`);

    // Convert Supabase format to frontend Person format
    const people: Person[] = data.map((row: any) => ({
      id: row.client_person_id,
      name: row.name,
      isUser: row.is_user || false,
      isVerified: row.is_user || false,
      gender: row.gender,
      birthData: row.birth_data,
      placements: row.placements,
      readings: [], // Readings loaded separately
      jobIds: [], // Job IDs loaded separately
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return people;
  } catch (err: any) {
    console.error('❌ fetchPeopleFromSupabase error:', err.message);
    return [];
  }
}

/**
 * Insert a new person into Supabase
 */
export async function insertPersonToSupabase(
  userId: string,
  person: Person
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping insert');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`📤 Inserting person "${person.name}" to Supabase...`);

    const libraryPerson: Omit<LibraryPerson, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      client_person_id: person.id,
      name: person.name,
      is_user: person.isUser || false,
      gender: person.gender,
      birth_data: person.birthData,
      placements: person.placements,
      relationship_intensity: 5, // Default
    };

    const { error } = await supabase
      .from('library_people')
      .insert(libraryPerson);

    if (error) {
      console.error('❌ Supabase insert error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Person "${person.name}" inserted to Supabase`);
    return { success: true };
  } catch (err: any) {
    console.error('❌ insertPersonToSupabase error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing person in Supabase
 */
export async function updatePersonInSupabase(
  userId: string,
  clientPersonId: string,
  updates: Partial<Person>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping update');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`📤 Updating person "${clientPersonId}" in Supabase...`);

    const supabaseUpdates: Partial<LibraryPerson> = {};

    if (updates.name) supabaseUpdates.name = updates.name;
    if (updates.gender) supabaseUpdates.gender = updates.gender;
    if (updates.birthData) supabaseUpdates.birth_data = updates.birthData;
    if (updates.placements) supabaseUpdates.placements = updates.placements;

    const { error } = await supabase
      .from('library_people')
      .update({ ...supabaseUpdates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('client_person_id', clientPersonId);

    if (error) {
      console.error('❌ Supabase update error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Person "${clientPersonId}" updated in Supabase`);
    return { success: true };
  } catch (err: any) {
    console.error('❌ updatePersonInSupabase error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a person from Supabase
 */
export async function deletePersonFromSupabase(
  userId: string,
  clientPersonId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping delete');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`📤 Deleting person "${clientPersonId}" from Supabase...`);

    const { error } = await supabase
      .from('library_people')
      .delete()
      .eq('user_id', userId)
      .eq('client_person_id', clientPersonId);

    if (error) {
      console.error('❌ Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Person "${clientPersonId}" deleted from Supabase`);
    return { success: true };
  } catch (err: any) {
    console.error('❌ deletePersonFromSupabase error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Mark a person as having a paid reading
 * Called when a job is created with this person
 */
export async function markPersonAsPaidReading(
  userId: string,
  personName: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping markPersonAsPaidReading');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`💰 Marking "${personName}" as having paid reading...`);

    const { error } = await supabase
      .from('library_people')
      .update({ has_paid_reading: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('name', personName);

    if (error) {
      console.error('❌ Supabase markPersonAsPaidReading error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ "${personName}" marked as having paid reading`);
    return { success: true };
  } catch (err: any) {
    console.error('❌ markPersonAsPaidReading error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch only people with paid readings from Supabase
 * Used for My Souls Library (Screen 14)
 */
export async function fetchPeopleWithPaidReadings(userId: string): Promise<Person[]> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping fetch');
    return [];
  }

  try {
    console.log(`📥 Fetching people with paid readings for user ${userId}...`);
    
    const { data, error } = await supabase
      .from('library_people')
      .select('*')
      .eq('user_id', userId)
      .eq('has_paid_reading', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('📭 No people with paid readings found');
      return [];
    }

    console.log(`✅ Fetched ${data.length} people with paid readings`);

    // Convert Supabase format to frontend Person format
    const people: Person[] = data.map((row: any) => ({
      id: row.client_person_id,
      name: row.name,
      isUser: row.is_user || false,
      isVerified: row.is_user || false,
      gender: row.gender,
      birthData: row.birth_data,
      placements: row.placements,
      hasPaidReading: row.has_paid_reading,
      readings: [],
      jobIds: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return people;
  } catch (err: any) {
    console.error('❌ fetchPeopleWithPaidReadings error:', err.message);
    return [];
  }
}

/**
 * Calculate placements and update person in Supabase
 */
export async function recalculateAndUpdatePlacements(
  userId: string,
  person: Person
): Promise<{ success: boolean; placements?: Placements; error?: string }> {
  try {
    console.log(`🔮 Recalculating placements for "${person.name}"...`);

    // Calculate placements using Swiss Ephemeris
    const placements = await calculatePlacements(person.birthData);

    if (!placements) {
      return { success: false, error: 'Placements calculation failed' };
    }

    console.log(`✅ Placements: ☉${placements.sunSign} ☽${placements.moonSign} ↑${placements.risingSign}`);

    // Update in Supabase
    const result = await updatePersonInSupabase(userId, person.id, { placements });

    return { success: result.success, placements, error: result.error };
  } catch (err: any) {
    console.error('❌ recalculateAndUpdatePlacements error:', err.message);
    return { success: false, error: err.message };
  }
}
