/**
 * NUCLEAR READINGS SERVICE
 * 
 * Clean architecture: All job/artifact data flows through the backend API.
 * The backend uses service role (bypasses RLS) and handles signed URLs.
 * 
 * Frontend NEVER directly queries job_artifacts table.
 */

import { env } from '@/config/env';
import { supabase, isSupabaseConfigured } from './supabase';
import axios, { AxiosError } from 'axios';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type JobStatus = 'pending' | 'processing' | 'complete' | 'error';

export type JobArtifact = {
  id: string;
  job_id: string;
  task_id: string;
  artifact_type: 'text' | 'audio' | 'pdf' | 'audio_mp3' | 'audio_m4a' | 'audio_song';
  storage_path: string;
  public_url?: string; // Signed URL from backend
  metadata?: {
    title?: string;
    docNum?: number;
    system?: string;
    docType?: string;
    wordCount?: number;
    lyrics?: string;
    duration?: number;
    style?: string;
  };
  created_at: string;
};

export type NuclearJob = {
  id: string;
  user_id: string;
  type: 'nuclear_v2';
  status: JobStatus;
  params?: {
    person1?: { name: string };
    person2?: { name: string };
    systems?: string[];
  };
  progress?: {
    percent?: number;
    phase?: string;
    message?: string;
    tasksComplete?: number;
    tasksTotal?: number;
  };
  results?: {
    documents?: Array<{
      id: string;
      title: string;
      system: string;
      docType: string;
      docNum: number;
      audioUrl?: string;
      pdfUrl?: string;
      songUrl?: string;
    }>;
  };
  artifacts?: JobArtifact[];
  created_at: string;
  updated_at?: string;
  completed_at?: string;
};

export type SoulJourneyChapter = {
  docNum: number;
  title: string;
  system?: string;
  docType?: string;
  textArtifact?: JobArtifact;
  audioArtifact?: JobArtifact;
  pdfArtifact?: JobArtifact;
  songArtifact?: JobArtifact;
};

// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const getBackendUrl = (): string => {
  return env.CORE_API_URL || process.env.EXPO_PUBLIC_CORE_API_URL || '';
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // Silent - auth is optional for some endpoints
    }
  }
  
  return headers;
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Simple in-memory cache to avoid repeated API calls
const jobCache = new Map<string, { job: NuclearJob; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Fetch a job with all artifacts from the backend API.
 * Uses in-memory cache to avoid repeated requests.
 */
export const fetchJob = async (jobId: string, bypassCache = false): Promise<NuclearJob | null> => {
  // Check cache first
  if (!bypassCache) {
    const cached = jobCache.get(jobId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.job;
    }
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    console.error('❌ Backend URL not configured');
    return null;
  }

  try {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${backendUrl}/api/jobs/v2/${jobId}`, { 
      headers,
      timeout: 60000, // Increased timeout
    });

    if (response.data?.success && response.data?.job) {
      const job = response.data.job as NuclearJob;
      // Cache the result
      jobCache.set(jobId, { job, timestamp: Date.now() });
      return job;
    }

    console.warn('⚠️ Unexpected API response:', response.data);
    return null;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      console.warn(`⚠️ Job ${jobId.substring(0, 8)} not found`);
    } else {
      console.error('❌ Failed to fetch job:', axiosError.message);
    }
    return null;
  }
};

/** Clear cache for a specific job or all jobs */
export const clearJobCache = (jobId?: string) => {
  if (jobId) {
    jobCache.delete(jobId);
  } else {
    jobCache.clear();
  }
};

/**
 * Fetch artifacts for a job, optionally filtered by type.
 * Uses the backend API which returns artifacts with signed URLs.
 */
export const fetchJobArtifacts = async (
  jobId: string,
  artifactTypes?: Array<JobArtifact['artifact_type']>
): Promise<JobArtifact[]> => {
  const job = await fetchJob(jobId);
  
  if (!job?.artifacts || !Array.isArray(job.artifacts)) {
    return [];
  }

  let artifacts = job.artifacts;

  // Filter by type if specified
  if (Array.isArray(artifactTypes) && artifactTypes.length > 0) {
    artifacts = artifacts.filter(a => artifactTypes.includes(a.artifact_type));
  }

  if (__DEV__) {
    console.log(`✅ Fetched ${artifacts.length} artifacts for job ${jobId.substring(0, 8)}`);
  }

  return artifacts;
};

/**
 * Fetch all nuclear_v2 jobs for the current user.
 */
export const fetchNuclearJobs = async (): Promise<NuclearJob[]> => {
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase not configured');
    return [];
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('⚠️ No authenticated user');
      return [];
    }

    // Jobs table has RLS that allows users to see their own jobs
    const { data, error } = await supabase
      .from('jobs')
      .select('id, user_id, type, status, params, progress, created_at, updated_at, completed_at')
      .eq('user_id', user.id)
      .eq('type', 'nuclear_v2')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching jobs:', error.message);
      return [];
    }

    return (data || []) as NuclearJob[];
  } catch (err: any) {
    console.error('❌ Exception in fetchNuclearJobs:', err.message);
    return [];
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a signed URL for a storage path.
 * Note: Backend API already provides signed URLs in artifact.public_url
 */
export const createArtifactSignedUrl = async (
  storagePath: string, 
  expiresInSeconds: number = 3600
): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.storage
      .from('job-artifacts')
      .createSignedUrl(storagePath, expiresInSeconds);
    
    if (error) {
      console.error('❌ Failed to create signed URL:', error.message);
      return null;
    }
    
    return data?.signedUrl || null;
  } catch (err: any) {
    console.error('❌ Exception creating signed URL:', err.message);
    return null;
  }
};

/**
 * Download text content from storage.
 */
export const downloadTextContent = async (storagePath: string): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.storage
      .from('job-artifacts')
      .download(storagePath);

    if (error) {
      console.error('❌ Error downloading text:', error.message);
      return null;
    }

    if (!data) {
      console.error('❌ No data returned from download');
      return null;
    }

    // Convert Blob to text
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read text'));
        }
      };
      reader.onerror = reject;
      reader.readAsText(data);
    });
  } catch (err: any) {
    console.error('❌ Exception in downloadTextContent:', err.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER BUILDING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build structured chapters from artifacts.
 * Groups by docNum and includes all artifact types.
 */
export const buildSoulJourneyChapters = (artifacts: JobArtifact[]): SoulJourneyChapter[] => {
  const byDoc = new Map<number, SoulJourneyChapter>();

  const isAudioType = (type: string) => type === 'audio' || type.startsWith('audio_');

  for (const artifact of artifacts) {
    const docNum = artifact.metadata?.docNum;
    if (typeof docNum !== 'number') continue;

    const existing = byDoc.get(docNum) || {
      docNum,
      title: artifact.metadata?.title || `Chapter ${docNum}`,
      system: artifact.metadata?.system,
      docType: artifact.metadata?.docType,
    };

    // Update chapter with this artifact
    const chapter: SoulJourneyChapter = { ...existing };
    
    if (artifact.artifact_type === 'text') {
      chapter.textArtifact = artifact;
    } else if (artifact.artifact_type === 'pdf') {
      chapter.pdfArtifact = artifact;
    } else if (artifact.artifact_type === 'audio_song') {
      chapter.songArtifact = artifact;
    } else if (isAudioType(artifact.artifact_type)) {
      chapter.audioArtifact = artifact;
    }

    // Update title/system if provided
    if (artifact.metadata?.title) chapter.title = artifact.metadata.title;
    if (artifact.metadata?.system) chapter.system = artifact.metadata.system;
    if (artifact.metadata?.docType) chapter.docType = artifact.metadata.docType;

    byDoc.set(docNum, chapter);
  }

  // Sort by docNum
  return [...byDoc.values()].sort((a, b) => a.docNum - b.docNum);
};

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get summary of all nuclear readings for library list.
 */
export const getNuclearReadingsSummary = async () => {
  const jobs = await fetchNuclearJobs();
  
  return jobs.map(job => ({
    id: job.id,
    person1Name: job.params?.person1?.name || 'Person 1',
    person2Name: job.params?.person2?.name || 'Person 2',
    status: job.status,
    progress: job.progress,
    createdAt: job.created_at,
    isComplete: job.status === 'complete',
  }));
};

/**
 * Fetch complete nuclear reading with all data.
 */
export const fetchNuclearReading = async (jobId: string) => {
  const job = await fetchJob(jobId);
  if (!job) return null;

  return {
    job,
    artifacts: job.artifacts || [],
    chapters: buildSoulJourneyChapters(job.artifacts || []),
  };
};
