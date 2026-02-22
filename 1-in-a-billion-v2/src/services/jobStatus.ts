import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

export type JobSnapshot = {
  status: string;
  percent: number;
  message: string;
  type: string;
  updatedAt?: string;
};

/**
 * Fetch a compact job snapshot for list/status UIs.
 * Returns null if the job cannot be fetched.
 */
export async function fetchJobSnapshot(jobId: string): Promise<JobSnapshot | null> {
  try {
    const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}`;
    let accessToken: string | undefined;

    if (isSupabaseConfigured) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        accessToken = session?.access_token;
      } catch {
        // Ignore and retry unauthenticated.
      }
    }

    let response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    if (response.status === 401 || response.status === 403) {
      response = await fetch(url);
    }

    if (!response.ok) return null;

    const data = await response.json();
    const job = data?.job;
    if (!job) return null;

    const total = job.progress?.totalTasks;
    const done = job.progress?.completedTasks;
    const pctRaw =
      typeof job.progress?.percent === 'number'
        ? job.progress.percent
        : typeof total === 'number' && total > 0
          ? (Number(done || 0) / total) * 100
          : 0;

    return {
      status: String(job.status || 'unknown'),
      percent: Math.max(0, Math.min(100, Math.round(pctRaw || 0))),
      message: String(job.progress?.message || ''),
      type: String(job.type || ''),
      updatedAt: String(job.updatedAt || job.updated_at || ''),
    };
  } catch {
    return null;
  }
}
