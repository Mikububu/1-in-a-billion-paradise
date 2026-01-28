/**
 * SUPABASE LIBRARY SYNC (CLIENT)
 *
 * Goal: keep Library items available across devices/re-installs.
 * We sync *metadata* (title/system/url/etc). Audio binaries remain remote (RunPod) or local cache.
 *
 * Table (recommended): public.library_audio_items
 * - user_id (uuid)   -- auth.users.id
 * - client_id (text) -- stable ID from app (SavedAudio.id)
 * - reading_id (text)
 * - system (text)
 * - title (text)
 * - file_path (text) -- can be remote URL or local URI
 * - duration_seconds (int)
 * - file_size_mb (float)
 * - created_at (timestamptz)
 */

import { supabase, isSupabaseConfigured } from '@/services/supabase';
import type { SavedAudio } from '@/store/profileStore';

const TABLE_AUDIO = 'library_audio_items';

export type LibraryAudioRow = {
  user_id: string;
  client_id: string;
  reading_id: string;
  system: string;
  title: string;
  file_path: string;
  duration_seconds: number;
  file_size_mb: number;
  created_at: string;
};

function toRow(userId: string, a: SavedAudio): LibraryAudioRow {
  return {
    user_id: userId,
    client_id: a.id,
    reading_id: a.readingId,
    system: a.system,
    title: a.title,
    file_path: a.filePath,
    duration_seconds: a.durationSeconds || 0,
    file_size_mb: a.fileSizeMB || 0,
    created_at: a.createdAt || new Date().toISOString(),
  };
}

function fromRow(r: LibraryAudioRow): SavedAudio {
  return {
    id: r.client_id,
    readingId: r.reading_id,
    system: r.system as any,
    fileName: `${r.client_id}.mp3`,
    filePath: r.file_path,
    durationSeconds: r.duration_seconds || 0,
    fileSizeMB: r.file_size_mb || 0,
    createdAt: r.created_at,
    title: r.title,
  };
}

export async function syncSavedAudiosToSupabase(userId: string, audios: SavedAudio[]) {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' as const };
  if (!userId) return { success: false, error: 'Missing userId' as const };

  const rows = audios.map((a) => toRow(userId, a));

  const { error } = await supabase
    .from(TABLE_AUDIO)
    .upsert(rows, { onConflict: 'user_id,client_id' });

  if (error) return { success: false, error: error.message };
  return { success: true as const };
}

export async function fetchSavedAudiosFromSupabase(userId: string) {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' as const, audios: [] as SavedAudio[] };
  if (!userId) return { success: false, error: 'Missing userId' as const, audios: [] as SavedAudio[] };

  const { data, error } = await supabase
    .from(TABLE_AUDIO)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message, audios: [] as SavedAudio[] };
  const audios = (data as any[]).map((r) => fromRow(r as LibraryAudioRow));
  return { success: true as const, audios };
}


