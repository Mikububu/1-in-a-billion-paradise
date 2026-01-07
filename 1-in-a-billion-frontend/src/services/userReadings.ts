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
    
    const { error } = await supabase
      .from('user_readings')
      .upsert(readingsToSave, {
        onConflict: 'user_id,type',
        ignoreDuplicates: false,
      });
    
    if (error) {
      console.error('Error saving hook readings:', error);
      return { success: false, error: error.message };
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


















