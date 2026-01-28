/**
 * ASYNC AUDIO SERVICE
 * 
 * Handles long-running audio generation independently of job completion.
 * Jobs complete immediately after text generation, then audio is generated
 * asynchronously in the background via the job queue system.
 * 
 * This allows the system to tolerate RunPod cold starts (30+ minutes) without
 * timing out or marking jobs as failed.
 */

import { supabase } from './supabaseClient';
import { env } from '../config/env';

export interface AudioDocument {
    id: string;
    title: string;
    text: string;
    jobId: string;
    sequence: number;
}

/**
 * Trigger asynchronous audio generation for a completed job.
 * Creates audio_generation tasks in the Supabase queue for workers to process.
 * 
 * @param jobId - The job ID that owns these audio artifacts
 * @param documents - Array of documents to generate audio for
 */
export async function triggerAsyncAudioGeneration(
    jobId: string,
    documents: AudioDocument[]
): Promise<void> {
    if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
        console.log(`⏭️ RunPod not configured, skipping audio generation for job ${jobId}`);
        return;
    }

    if (!supabase) {
        console.warn(`⚠️ Supabase not configured, cannot queue audio tasks for job ${jobId}`);
        return;
    }

    console.log(`🎙️ Triggering async audio generation for job ${jobId} (${documents.length} documents)`);

    try {
        // Create audio_generation tasks for each document
        // These will be claimed and processed by AudioWorker instances
        for (const doc of documents) {
            const { error } = await supabase
                .from('job_tasks')
                .insert({
                    job_id: jobId,
                    task_type: 'audio_generation',
                    sequence: doc.sequence,
                    status: 'pending',
                    input: {
                        text: doc.text,
                        title: doc.title,
                        documentId: doc.id,
                    },
                });

            if (error) {
                console.error(`❌ Failed to create audio task for ${doc.title}:`, error.message);
            } else {
                console.log(`✅ Queued audio task for ${doc.title} (sequence ${doc.sequence})`);
            }
        }

        console.log(`🎉 Successfully queued ${documents.length} audio tasks for job ${jobId}`);
    } catch (error: any) {
        console.error(`❌ Failed to trigger async audio generation for job ${jobId}:`, error.message);
        // Don't throw - audio generation failure shouldn't crash the job
    }
}

/**
 * Get audio generation status for a job.
 * Returns the number of completed audio tasks vs total tasks.
 */
export async function getAudioStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'complete' | 'failed';
    completed: number;
    total: number;
    failed: number;
}> {
    if (!supabase) {
        return { status: 'failed', completed: 0, total: 0, failed: 0 };
    }

    try {
        const { data: tasks, error } = await supabase
            .from('job_tasks')
            .select('status')
            .eq('job_id', jobId)
            .eq('task_type', 'audio_generation');

        if (error || !tasks) {
            return { status: 'failed', completed: 0, total: 0, failed: 0 };
        }

        const total = tasks.length;
        const completed = tasks.filter((t: { status: string }) => t.status === 'completed').length;
        const failed = tasks.filter((t: { status: string }) => t.status === 'failed').length;
        const processing = tasks.filter((t: { status: string }) => t.status === 'processing').length;

        let status: 'pending' | 'processing' | 'complete' | 'failed';
        if (completed === total) {
            status = 'complete';
        } else if (failed === total) {
            status = 'failed';
        } else if (processing > 0 || completed > 0) {
            status = 'processing';
        } else {
            status = 'pending';
        }

        return { status, completed, total, failed };
    } catch (error: any) {
        console.error(`Failed to get audio status for job ${jobId}:`, error.message);
        return { status: 'failed', completed: 0, total: 0, failed: 0 };
    }
}
