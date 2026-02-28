import { isSupabaseConfigured, supabase } from '@/services/supabase';

export type JobArtifact = {
    id: string;
    job_id: string;
    task_id?: string;
    artifact_type: 'text' | 'audio' | 'pdf' | 'audio_mp3' | 'audio_m4a' | 'audio_song' | string;
    storage_path: string;
    metadata?: {
        title?: string;
        docNum?: number;
        system?: string;
        wordCount?: number;
    };
    created_at: string;
    doc_num?: number;
};

export async function fetchJobArtifacts(jobId: string): Promise<JobArtifact[]> {
    if (!isSupabaseConfigured || !jobId) return [];

    try {
        const { data, error } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });

        if (error) return [];
        return (data || []) as JobArtifact[];
    } catch {
        return [];
    }
}

export async function createArtifactSignedUrl(storagePath: string, expiresInSeconds: number = 60 * 60): Promise<string | null> {
    if (!isSupabaseConfigured || !storagePath) return null;
    // Skip error sentinel paths
    if (storagePath.startsWith('error/')) return null;

    try {
        const { data, error } = await supabase.storage
            .from('job-artifacts')
            .createSignedUrl(storagePath, expiresInSeconds);

        if (!error && data?.signedUrl) return data.signedUrl;
    } catch {
        // Fall through to public URL fallback
    }

    // Fallback: bucket is public, so use the public URL directly
    try {
        const { data } = supabase.storage
            .from('job-artifacts')
            .getPublicUrl(storagePath);

        return data?.publicUrl || null;
    } catch {
        return null;
    }
}

function blobToText(blob: Blob): Promise<string> {
    if (typeof (blob as any).text === 'function') {
        return (blob as any).text();
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('Failed to read blob text'));
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read blob text'));
        reader.readAsText(blob);
    });
}

export async function downloadTextContent(storagePath: string): Promise<string | null> {
    if (!isSupabaseConfigured || !storagePath) return null;

    try {
        const { data, error } = await supabase.storage
            .from('job-artifacts')
            .download(storagePath);

        if (error || !data) return null;
        return await blobToText(data as Blob);
    } catch {
        return null;
    }
}
