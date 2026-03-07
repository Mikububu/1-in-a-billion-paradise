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
export declare class PeopleScalingWorker extends BaseWorker {
    constructor();
    protected processTask(task: JobTask): Promise<TaskResult>;
}
//# sourceMappingURL=peopleScalingWorker.d.ts.map