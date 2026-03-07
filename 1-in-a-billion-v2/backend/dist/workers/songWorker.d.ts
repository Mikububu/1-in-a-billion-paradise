/**
 * SONG WORKER
 *
 * Processes song generation tasks for nuclear_v2 jobs.
 * Extends BaseWorker to handle song_generation tasks.
 */
import { BaseWorker, TaskResult } from './baseWorker';
export declare class SongWorker extends BaseWorker {
    constructor();
    /**
     * Process a song generation task
     */
    protected processTask(task: any): Promise<TaskResult>;
}
//# sourceMappingURL=songWorker.d.ts.map