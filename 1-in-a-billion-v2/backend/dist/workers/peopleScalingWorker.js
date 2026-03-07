"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeopleScalingWorker = void 0;
const baseWorker_1 = require("./baseWorker");
const supabaseClient_1 = require("../services/supabaseClient");
const ephemerisIsolation_1 = require("../services/ephemerisIsolation");
function nowIso() {
    return new Date().toISOString();
}
class PeopleScalingWorker extends baseWorker_1.BaseWorker {
    constructor() {
        super({
            taskTypes: ['people_scaling'],
            maxConcurrentTasks: 1, // Keep it simple/safe initially
            pollingIntervalMs: 8000,
            maxPollingIntervalMs: 60000,
        });
    }
    async processTask(task) {
        const supabase = (0, supabaseClient_1.createSupabaseServiceClient)();
        if (!supabase)
            return { success: false, error: 'Supabase not configured' };
        const input = (task.input || {});
        const peopleKeys = Array.isArray(input.people) ? input.people : [];
        const dryRun = !!input.dryRun;
        if (peopleKeys.length === 0) {
            return { success: true, output: { message: 'No people in batch (noop)' } };
        }
        // Best-effort: update job progress message
        try {
            const batchLabel = typeof input.batchNum === 'number' && typeof input.totalBatches === 'number'
                ? `Batch ${input.batchNum}/${input.totalBatches}`
                : `Batch (${peopleKeys.length} people)`;
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
        }
        catch {
            // ignore
        }
        // Load people.
        // IMPORTANT: client_person_id is only unique *per user*, so we must match (user_id, client_person_id) pairs.
        const ors = peopleKeys
            .filter((p) => p?.user_id && p?.client_person_id)
            .map((p) => `and(user_id.eq.${p.user_id},client_person_id.eq.${p.client_person_id})`);
        const { data: people, error } = await supabase
            .from('library_people')
            .select('user_id, client_person_id, name, birth_data, placements')
            .or(ors.join(','));
        if (error) {
            return { success: false, error: `Failed to load people: ${error.message}` };
        }
        let updated = 0;
        let skipped = 0;
        const failures = [];
        for (const p of people || []) {
            try {
                const birth = p.birth_data || {};
                const existingPlacements = p.placements || null;
                // If we have placements already, use them; otherwise compute from birth_data.
                const placements = existingPlacements ||
                    (birth?.birthDate && birth?.birthTime && birth?.timezone && birth?.latitude != null && birth?.longitude != null
                        ? await ephemerisIsolation_1.ephemerisIsolation.computePlacements({
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
                        user_id: p.user_id,
                        client_person_id: p.client_person_id,
                        name: p.name,
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
                    })
                        .eq('user_id', p.user_id)
                        .eq('client_person_id', p.client_person_id);
                    if (updateErr)
                        throw updateErr;
                }
                updated += 1;
            }
            catch (e) {
                failures.push({ client_person_id: p.client_person_id, error: e?.message || String(e) });
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
        }
        catch {
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
exports.PeopleScalingWorker = PeopleScalingWorker;
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
//# sourceMappingURL=peopleScalingWorker.js.map