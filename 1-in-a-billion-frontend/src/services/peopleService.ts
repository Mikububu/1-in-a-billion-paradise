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
 * Delete a person from Supabase with CASCADE:
 * 1. Find all jobs where this person is person1 or person2
 * 2. Delete storage files (PDFs, audio) from those jobs
 * 3. Delete the jobs (cascades to job_tasks and job_artifacts via FK)
 * 4. Delete the person from library_people
 */
export async function deletePersonFromSupabase(
  userId: string,
  clientPersonId: string
): Promise<{ success: boolean; error?: string; deletedJobs?: number; deletedFiles?: number }> {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured - skipping delete');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    console.log(`🗑️ CASCADE DELETE starting for person "${clientPersonId}"...`);

    // Step 1: Get person's name from library_people (needed to find jobs)
    const { data: personData } = await supabase
      .from('library_people')
      .select('name')
      .eq('user_id', userId)
      .eq('client_person_id', clientPersonId)
      .single();

    const personName = personData?.name;
    let deletedJobsCount = 0;
    let deletedFilesCount = 0;

    if (personName) {
      // Step 2: Find all jobs where this person is involved
      // Jobs store person names in params->person1->name or params->person2->name
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, params')
        .eq('user_id', userId);

      const jobsToDelete = jobs?.filter((job: any) => {
        const params = job.params || {};
        const p1Name = params.person1?.name;
        const p2Name = params.person2?.name;
        return p1Name === personName || p2Name === personName;
      }) || [];

      console.log(`📋 Found ${jobsToDelete.length} jobs involving "${personName}"`);

      if (jobsToDelete.length > 0) {
        const jobIds = jobsToDelete.map((j: any) => j.id);

        // Step 3: Get all artifacts from these jobs (to delete storage files)
        const { data: artifacts } = await supabase
          .from('job_artifacts')
          .select('id, storage_path, artifact_type')
          .in('job_id', jobIds);

        // Step 4: Delete storage files
        if (artifacts && artifacts.length > 0) {
          const storagePaths = artifacts
            .map((a: any) => a.storage_path)
            .filter((path: string) => path && path.length > 0);

          if (storagePaths.length > 0) {
            console.log(`🗂️ Deleting ${storagePaths.length} storage files...`);
            
            // Group by bucket (assume format: bucket/path/file.ext or just path/file.ext)
            // Most artifacts are in 'readings' bucket
            const { error: storageError } = await supabase.storage
              .from('readings')
              .remove(storagePaths);

            if (storageError) {
              console.warn(`⚠️ Storage delete warning: ${storageError.message}`);
            } else {
              deletedFilesCount = storagePaths.length;
              console.log(`✅ Deleted ${deletedFilesCount} storage files`);
            }
          }
        }

        // Step 5: Delete jobs (cascades to job_tasks and job_artifacts via FK)
        const { error: jobsError } = await supabase
          .from('jobs')
          .delete()
          .in('id', jobIds);

        if (jobsError) {
          console.error('❌ Jobs delete error:', jobsError);
          // Continue anyway - try to delete the person
        } else {
          deletedJobsCount = jobIds.length;
          console.log(`✅ Deleted ${deletedJobsCount} jobs (cascaded to tasks & artifacts)`);
        }
      }
    }

    // Step 6: Delete the person from library_people
    const { error } = await supabase
      .from('library_people')
      .delete()
      .eq('user_id', userId)
      .eq('client_person_id', clientPersonId);

    if (error) {
      console.error('❌ Supabase person delete error:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ CASCADE DELETE complete for "${personName || clientPersonId}": ${deletedJobsCount} jobs, ${deletedFilesCount} files`);
    return { success: true, deletedJobs: deletedJobsCount, deletedFiles: deletedFilesCount };
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
