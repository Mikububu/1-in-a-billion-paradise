/**
 * TEXT WORKER - LLM Text Generation
 *
 * Processes text_generation tasks for the Supabase Queue (Job Queue V2).
 * Intended to run as a stateless RunPod Serverless worker.
 */
import { BaseWorker, TaskResult } from './baseWorker';
import { JobTask } from '../services/supabaseClient';
export declare class TextWorker extends BaseWorker {
    constructor();
    protected processTask(task: JobTask): Promise<TaskResult>;
}
//# sourceMappingURL=textWorker.d.ts.map