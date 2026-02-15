import { isSupabaseConfigured, supabase } from '@/services/supabase';
import type { CompatibilityReading } from '@/store/profileStore';

const TABLE_COMPATIBILITY = 'library_compatibility_readings';

type CompatibilityCloudRow = {
  user_id: string;
  client_reading_id: string;
  person1_id: string;
  person2_id: string;
  system: CompatibilityReading['system'];
  content: string;
  spicy_score: number;
  safe_stable_score: number;
  conclusion: string;
  source: CompatibilityReading['source'];
  generated_at: string;
  created_at: string;
  updated_at: string;
};

type SyncCompatibilityResult = {
  success: boolean;
  skipped?: boolean;
  error?: string;
  readings?: CompatibilityReading[];
};

const isMissingTableOrColumn = (error: any) => {
  const code = typeof error?.code === 'string' ? error.code : '';
  return code === '42P01' || code === '42703';
};

const toRow = (userId: string, reading: CompatibilityReading): CompatibilityCloudRow => ({
  user_id: userId,
  client_reading_id: reading.id,
  person1_id: reading.person1Id,
  person2_id: reading.person2Id,
  system: reading.system,
  content: reading.content || '',
  spicy_score: reading.spicyScore,
  safe_stable_score: reading.safeStableScore,
  conclusion: reading.conclusion || '',
  source: reading.source,
  generated_at: reading.generatedAt,
  created_at: reading.generatedAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const fromRow = (row: CompatibilityCloudRow): CompatibilityReading => ({
  id: row.client_reading_id,
  person1Id: row.person1_id,
  person2Id: row.person2_id,
  system: row.system,
  content: row.content || '',
  spicyScore: Number(row.spicy_score),
  safeStableScore: Number(row.safe_stable_score),
  conclusion: row.conclusion || '',
  generatedAt: row.generated_at || row.updated_at || new Date().toISOString(),
  source: row.source || 'gpt',
});

export async function fetchCompatibilityReadingsFromSupabase(userId: string): Promise<SyncCompatibilityResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured', readings: [] };
  if (!userId) return { success: false, error: 'Missing userId', readings: [] };

  const { data, error } = await supabase
    .from(TABLE_COMPATIBILITY)
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: true });

  if (error) {
    if (isMissingTableOrColumn(error)) {
      return { success: true, skipped: true, readings: [] };
    }
    return { success: false, error: error.message, readings: [] };
  }

  return {
    success: true,
    readings: (data || []).map((row: any) => fromRow(row as CompatibilityCloudRow)),
  };
}

export async function syncCompatibilityReadingsToSupabase(
  userId: string,
  readings: CompatibilityReading[]
): Promise<SyncCompatibilityResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured', readings: [] };
  if (!userId) return { success: false, error: 'Missing userId', readings: [] };

  const rows = (readings || [])
    .filter((reading) => Boolean(reading?.id && reading.person1Id && reading.person2Id))
    .map((reading) => toRow(userId, reading));

  if (rows.length > 0) {
    const { error } = await supabase
      .from(TABLE_COMPATIBILITY)
      .upsert(rows, {
        onConflict: 'user_id,client_reading_id',
      });

    if (error) {
      if (isMissingTableOrColumn(error)) {
        return { success: true, skipped: true, readings };
      }
      return { success: false, error: error.message, readings: [] };
    }
  }

  return await fetchCompatibilityReadingsFromSupabase(userId);
}
