import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

let currentTaskId: string | null = null;
let currentJobId: string | null = null;

export function registerTaskContext(taskId: string, jobId: string) {
    currentTaskId = taskId;
    currentJobId = jobId;
}

async function markJobCrashed(reason: string) {
    if (!currentJobId) return;

    console.error(`💥 CRASH GUARD TRIGGERED: ${reason}`);

    try {
        await supabase
            .from('jobs')
            .update({
                // job_status enum: queued | processing | complete | error | cancelled
                status: 'error',
                error: `Worker crashed: ${reason}`,
                progress: {
                    phase: 'error',
                    message: 'Worker crashed during processing',
                    percent: 0
                }
            })
            .eq('id', currentJobId);

        // Also fail the task if we have one
        if (currentTaskId) {
            await supabase
                .from('job_tasks')
                .update({
                    status: 'failed',
                    error: `Worker process crashed: ${reason}`
                })
                .eq('id', currentTaskId);
        }
    } catch (err) {
        console.error('Failed to report crash to Supabase:', err);
    }
}

process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    await markJobCrashed(err.message);
    process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
    console.error('Unhandled Rejection:', reason);
    await markJobCrashed(String(reason));
    process.exit(1);
});
