/**
 * PEOPLE SCALING WORKER
 *
 * Builds/refreshes `match_profile` for batches of `library_people`.
 *
 * Design goals:
 * - Deterministic, resumable, idempotent
 * - Safe to rerun (overwrites match_profile)
 * - Uses existing Swiss Ephemeris computePlacements when needed
 */

import { BaseWorker, TaskResult } from './baseWorker';
import type { JobTask } from '../services/supabaseClient';
import { createSupabaseServiceClient } from '../services/supabaseClient';
import { ephemerisIsolation } from '../services/ephemerisIsolation';

type PeopleScalingTaskInput = {
  personIds: string[];
  dryRun?: boolean;
  batchNum?: number;
  totalBatches?: number;
  reason?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export class PeopleScalingWorker extends BaseWorker {
  constructor() {
    super({
      taskTypes: ['people_scaling'],
      maxConcurrentTasks: 1, // Keep it simple/safe initially
      pollingIntervalMs: 8000,
      maxPollingIntervalMs: 60000,
    });
  }

  protected async processTask(task: JobTask): Promise<TaskResult> {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return { success: false, error: 'Supabase not configured' };

    const input = (task.input || {}) as PeopleScalingTaskInput;
    const personIds = Array.isArray(input.personIds) ? input.personIds : [];
    const dryRun = !!input.dryRun;

    if (personIds.length === 0) {
      return { success: true, output: { message: 'No people in batch (noop)' } };
    }

    // Best-effort: update job progress message
    try {
      const batchLabel =
        typeof input.batchNum === 'number' && typeof input.totalBatches === 'number'
          ? `Batch ${input.batchNum}/${input.totalBatches}`
          : `Batch (${personIds.length} people)`;
      await supabase
        .from('jobs')
        .update({
          status: 'processing',
          progress: {
            percent: 5,
            phase: 'processing',
            message: `🧬 People scaling: ${batchLabel}`,
          },
          updated_at: nowIso(),
        })
        .eq('id', task.job_id);
    } catch {
      // ignore
    }

    // Load people
    const { data: people, error } = await supabase
      .from('library_people')
      .select('id, user_id, name, birth_data, placements')
      .in('id', personIds);

    if (error) {
      return { success: false, error: `Failed to load people: ${error.message}` };
    }

    let updated = 0;
    let skipped = 0;
    const failures: Array<{ id: string; error: string }> = [];

    for (const p of people || []) {
      try {
        const birth = (p as any).birth_data || {};
        const existingPlacements = (p as any).placements || null;

        // If we have placements already, use them; otherwise compute from birth_data.
        const placements =
          existingPlacements ||
          (birth?.birthDate && birth?.birthTime && birth?.timezone && birth?.latitude != null && birth?.longitude != null
            ? await ephemerisIsolation.computePlacements({
                birthDate: birth.birthDate,
                birthTime: birth.birthTime,
                timezone: birth.timezone,
                latitude: birth.latitude,
                longitude: birth.longitude,
                relationshipIntensity: 5,
                relationshipMode: 'sensual',
                primaryLanguage: 'en',
              })
            : null);

        if (!placements) {
          skipped += 1;
          continue;
        }

        const matchProfile = {
          version: 1,
          computed_at: nowIso(),
          person: {
            id: (p as any).id,
            user_id: (p as any).user_id,
            name: (p as any).name,
          },
          western: {
            sunSign: placements.sunSign,
            moonSign: placements.moonSign,
            risingSign: placements.risingSign,
            sunDegree: placements.sunDegree,
            moonDegree: placements.moonDegree,
            ascendantDegree: placements.ascendantDegree,
          },
          // Optional: include raw placements for future expansion; keeps us “based on everything”
          placements,
        };

        if (!dryRun) {
          const { error: updateErr } = await supabase
            .from('library_people')
            .update({
              match_profile: matchProfile,
              match_profile_updated_at: nowIso(),
            } as any)
            .eq('id', (p as any).id);

          if (updateErr) throw updateErr;
        }

        updated += 1;
      } catch (e: any) {
        failures.push({ id: (p as any).id, error: e?.message || String(e) });
      }
    }

    // Final progress update
    try {
      await supabase
        .from('jobs')
        .update({
          progress: {
            percent: 60,
            phase: 'processing',
            message: `🧬 People scaling batch complete: updated=${updated}, skipped=${skipped}, failed=${failures.length}`,
          },
          updated_at: nowIso(),
        })
        .eq('id', task.job_id);
    } catch {
      // ignore
    }

    return {
      success: failures.length === 0,
      output: {
        dryRun,
        updated,
        skipped,
        failed: failures.length,
        failures: failures.slice(0, 50),
      },
      error: failures.length ? `People scaling batch had ${failures.length} failure(s)` : undefined,
    };
  }
}

// Run if called directly (Fly process group: people-scaling-worker)
if (require.main === module) {
  const worker = new PeopleScalingWorker();
  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());

  worker.start().catch((error) => {
    console.error('Fatal people scaling worker error:', error);
    process.exit(1);
  });
}

