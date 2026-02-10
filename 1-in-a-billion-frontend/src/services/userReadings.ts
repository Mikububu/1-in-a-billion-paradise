/**
 * User Readings Service
 * 
 * Saves the free hook readings (Sun, Moon, Rising) to Supabase
 * so users can access them anytime after creating an account.
 */

import { supabase } from '@/services/supabase';
import { HookReading } from '@/types/forms';

export interface SavedReading {
  id: string;
  user_id: string;
  type: 'sun' | 'moon' | 'rising';
  sign: string;
  intro: string;
  main: string;
  audio_base64?: string;
  created_at: string;
}

/**
 * Save all hook readings (Sun, Moon, Rising) for a user
 * Called after account creation to persist the free readings
 * 
 * ARCHITECTURE NOTE (INVARIANT 9): Hook readings must be saved to BOTH:
 * 1. user_readings table (per-reading rows, used by getUserReadings)
 * 2. library_people.hook_readings column (JSON, used by bootstrap to detect onboarding complete)
 */
export async function saveHookReadings(
  userId: string,
  readings: Partial<Record<HookReading['type'], HookReading>>,
  audioData?: Partial<Record<HookReading['type'], string>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const readingsToSave: Omit<SavedReading, 'id' | 'created_at'>[] = [];
    
    for (const type of ['sun', 'moon', 'rising'] as const) {
      const reading = readings[type];
      if (reading) {
        readingsToSave.push({
          user_id: userId,
          type,
          sign: reading.sign,
          intro: reading.intro,
          main: reading.main,
          audio_base64: audioData?.[type],
        });
      }
    }
    
    if (readingsToSave.length === 0) {
      return { success: false, error: 'No readings to save' };
    }
    
    // 1. Save to user_readings table (per-reading rows)
    const { error } = await supabase
      .from('user_readings')
      .upsert(readingsToSave, {
        onConflict: 'user_id,type',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error('Error saving hook readings to user_readings:', error);
      return { success: false, error: error.message };
    }
    
    // 2. ALSO save to library_people.hook_readings column (INVARIANT 9)
    // This is critical for bootstrap to detect onboarding completion
    const hookReadingsObject: Record<string, HookReading> = {};
    for (const type of ['sun', 'moon', 'rising'] as const) {
      if (readings[type]) {
        hookReadingsObject[type] = readings[type]!;
      }
    }
    
    if (Object.keys(hookReadingsObject).length > 0) {
      const { error: libraryError } = await supabase
        .from('library_people')
        .update({ 
          hook_readings: hookReadingsObject,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_user', true);
      
      if (libraryError) {
        // Log but don't fail - user_readings write succeeded
        console.warn('⚠️ Failed to save hook_readings to library_people:', libraryError.message);
      } else {
        console.log('✅ Also saved hook_readings to library_people.hook_readings');
      }
    }
    
    console.log(`✅ Saved ${readingsToSave.length} readings for user ${userId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error in saveHookReadings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch saved readings for a user
 */
export async function getUserReadings(userId: string): Promise<SavedReading[]> {
  try {
    const { data, error } = await supabase
      .from('user_readings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching user readings:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getUserReadings:', error);
    return [];
  }
}

/**
 * Check if user already has saved readings
 */
export async function hasExistingReadings(userId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('user_readings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error checking existing readings:', error);
      return false;
    }
    
    return (count || 0) > 0;
  } catch (error) {
    console.error('Error in hasExistingReadings:', error);
    return false;
  }
}


















