/**
 * ARTIFACT CACHE SERVICE
 * 
 * Automatically downloads and caches job artifacts (audio, PDF, song) locally.
 * Maintains a 40-job buffer - oldest jobs are auto-deleted when limit exceeded.
 * 
 * This service ensures users don't have to wait for streaming - media is
 * downloaded in the background as soon as artifacts are available.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { supabase, isSupabaseConfigured } from './supabase';
import { fetchJobArtifacts, createArtifactSignedUrl, JobArtifact } from './nuclearReadingsService';
import { getJobReceipts, addJobToBuffer, JOB_BUFFER_MAX, JobReceipt } from './jobBuffer';
import { getDocumentDirectory, getCacheDirectory } from '@/utils/fileSystem';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for tracking which artifacts have been downloaded
const DOWNLOADED_ARTIFACTS_KEY = '@downloaded_artifacts';

// Types
type DownloadedArtifact = {
  jobId: string;
  docNum: number;
  artifactType: 'audio' | 'pdf' | 'song';
  localPath: string;
  downloadedAt: string;
};

type DownloadProgress = {
  jobId: string;
  docNum: number;
  type: 'audio' | 'pdf' | 'song';
  progress: number; // 0-1
};

// Callbacks for progress updates
type ProgressCallback = (progress: DownloadProgress) => void;
let progressCallbacks: ProgressCallback[] = [];

export const onDownloadProgress = (callback: ProgressCallback) => {
  progressCallbacks.push(callback);
  return () => {
    progressCallbacks = progressCallbacks.filter(cb => cb !== callback);
  };
};

const notifyProgress = (progress: DownloadProgress) => {
  progressCallbacks.forEach(cb => cb(progress));
};

// Get base directory for storing artifacts
const getArtifactBaseDir = () => {
  const baseDir = getDocumentDirectory() || getCacheDirectory();
  return baseDir ? `${baseDir}library-media/` : '';
};

// Sanitize string for use in file paths
const sanitize = (s: string): string => {
  return String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_');
};

// Get folder path for a specific job/doc
const getArtifactFolder = (jobId: string, docNum: number, personName?: string, system?: string): string => {
  const baseDir = getArtifactBaseDir();
  if (!baseDir) return '';
  
  const safePerson = sanitize(personName || 'unknown');
  const safeSystem = sanitize(system || 'reading');
  const timestamp = Date.now();
  
  return `${baseDir}${safePerson}/${safeSystem}/${timestamp}_${sanitize(jobId)}_${docNum}/`;
};

// Ensure directory exists
const ensureDir = async (dirPath: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    return true;
  } catch (e) {
    console.error('[ArtifactCache] Failed to create directory:', dirPath, e);
    return false;
  }
};

// Check if file exists and is non-empty
const fileExistsNonEmpty = async (path: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && (info as any).size > 0;
  } catch {
    return false;
  }
};

// Load downloaded artifacts registry
const getDownloadedArtifacts = async (): Promise<DownloadedArtifact[]> => {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADED_ARTIFACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Save downloaded artifacts registry
const saveDownloadedArtifacts = async (artifacts: DownloadedArtifact[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(DOWNLOADED_ARTIFACTS_KEY, JSON.stringify(artifacts));
  } catch (e) {
    console.error('[ArtifactCache] Failed to save artifacts registry:', e);
  }
};

// Add a downloaded artifact to registry
const registerDownloadedArtifact = async (artifact: DownloadedArtifact): Promise<void> => {
  const existing = await getDownloadedArtifacts();
  // Remove any existing entry for same job/doc/type
  const filtered = existing.filter(a => 
    !(a.jobId === artifact.jobId && a.docNum === artifact.docNum && a.artifactType === artifact.artifactType)
  );
  filtered.push(artifact);
  await saveDownloadedArtifacts(filtered);
};

// Check if artifact is already downloaded
const isArtifactDownloaded = async (jobId: string, docNum: number, type: 'audio' | 'pdf' | 'song'): Promise<string | null> => {
  const artifacts = await getDownloadedArtifacts();
  const found = artifacts.find(a => 
    a.jobId === jobId && a.docNum === docNum && a.artifactType === type
  );
  
  if (found && await fileExistsNonEmpty(found.localPath)) {
    return found.localPath;
  }
  return null;
};

// Download a single artifact
const downloadArtifact = async (
  artifact: JobArtifact,
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<string | null> => {
  try {
    // Get signed URL for the artifact
    const signedUrl = await createArtifactSignedUrl(artifact.storage_path, 60 * 60); // 1 hour
    if (!signedUrl) {
      // This is normal - artifacts may not be ready yet, so just log as info
      console.log('[ArtifactCache] Artifact not available yet:', artifact.storage_path);
      return null;
    }

    // Create download resumable
    const downloadResumable = FileSystem.createDownloadResumable(
      signedUrl,
      destPath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    if (!result?.uri) {
      console.error('[ArtifactCache] Download failed for:', artifact.storage_path);
      return null;
    }

    // Verify file exists and is non-empty
    if (!(await fileExistsNonEmpty(result.uri))) {
      console.error('[ArtifactCache] Downloaded file is empty:', result.uri);
      return null;
    }

    return result.uri;
  } catch (e) {
    console.error('[ArtifactCache] Download error:', e);
    return null;
  }
};

// Get file extension from artifact type
const getExtension = (artifactType: string): string => {
  if (artifactType === 'pdf') return 'pdf';
  if (artifactType === 'audio_m4a') return 'm4a';
  if (artifactType === 'audio_mp3' || artifactType === 'audio') return 'mp3';
  if (artifactType === 'audio_song') return 'm4a';
  return 'bin';
};

// Get artifact category from type
const getArtifactCategory = (artifactType: string): 'audio' | 'pdf' | 'song' | null => {
  if (artifactType === 'pdf') return 'pdf';
  if (artifactType === 'audio_song') return 'song';
  if (artifactType.startsWith('audio')) return 'audio';
  return null;
};

/**
 * Download all artifacts for a job
 * Returns map of docNum -> { audioPath, pdfPath, songPath }
 */
export const downloadJobArtifacts = async (
  jobId: string,
  personName?: string,
  onProgress?: (docNum: number, type: string, progress: number) => void
): Promise<Map<number, { audioPath?: string; pdfPath?: string; songPath?: string }>> => {
  const results = new Map<number, { audioPath?: string; pdfPath?: string; songPath?: string }>();
  
  if (!isSupabaseConfigured) {
    console.warn('[ArtifactCache] Supabase not configured');
    return results;
  }

  try {
    // Fetch all artifacts for this job
    const artifacts = await fetchJobArtifacts(jobId);
    console.log(`[ArtifactCache] Found ${artifacts.length} artifacts for job ${jobId}`);

    // Group artifacts by docNum
    const byDocNum = new Map<number, JobArtifact[]>();
    for (const artifact of artifacts) {
      const docNum = (artifact.metadata as any)?.docNum ?? 1;
      const existing = byDocNum.get(docNum) || [];
      existing.push(artifact);
      byDocNum.set(docNum, existing);
    }

    // Process each docNum
    for (const [docNum, docArtifacts] of byDocNum) {
      const system = (docArtifacts[0]?.metadata as any)?.system;
      const folder = getArtifactFolder(jobId, docNum, personName, system);
      
      if (!folder || !(await ensureDir(folder))) {
        console.error(`[ArtifactCache] Failed to create folder for doc ${docNum}`);
        continue;
      }

      const paths: { audioPath?: string; pdfPath?: string; songPath?: string } = {};

      for (const artifact of docArtifacts) {
        const category = getArtifactCategory(artifact.artifact_type);
        if (!category) continue;

        // Check if already downloaded
        const existingPath = await isArtifactDownloaded(jobId, docNum, category);
        if (existingPath) {
          console.log(`[ArtifactCache] Already downloaded: ${category} for doc ${docNum}`);
          if (category === 'audio') paths.audioPath = existingPath;
          if (category === 'pdf') paths.pdfPath = existingPath;
          if (category === 'song') paths.songPath = existingPath;
          continue;
        }

        // Determine filename
        const ext = getExtension(artifact.artifact_type);
        let filename: string;
        if (category === 'audio') filename = `narration.${ext}`;
        else if (category === 'pdf') filename = `reading.pdf`;
        else filename = `song.${ext}`;

        const destPath = `${folder}${filename}`;

        // Download
        console.log(`[ArtifactCache] Downloading ${category} for doc ${docNum}...`);
        notifyProgress({ jobId, docNum, type: category, progress: 0 });
        
        const localPath = await downloadArtifact(artifact, destPath, (progress) => {
          onProgress?.(docNum, category, progress);
          notifyProgress({ jobId, docNum, type: category, progress });
        });

        if (localPath) {
          // Register in our tracking
          await registerDownloadedArtifact({
            jobId,
            docNum,
            artifactType: category,
            localPath,
            downloadedAt: new Date().toISOString(),
          });

          if (category === 'audio') paths.audioPath = localPath;
          if (category === 'pdf') paths.pdfPath = localPath;
          if (category === 'song') paths.songPath = localPath;
          
          console.log(`[ArtifactCache] Downloaded ${category} for doc ${docNum}: ${localPath}`);
          notifyProgress({ jobId, docNum, type: category, progress: 1 });
        }
      }

      results.set(docNum, paths);
    }

    return results;
  } catch (e) {
    console.error('[ArtifactCache] Error downloading job artifacts:', e);
    return results;
  }
};

/**
 * Get local paths for a job's artifacts (if downloaded)
 * Returns map of docNum -> { audioPath, pdfPath, songPath }
 */
export const getLocalArtifactPaths = async (
  jobId: string
): Promise<Map<number, { audioPath?: string; pdfPath?: string; songPath?: string }>> => {
  const results = new Map<number, { audioPath?: string; pdfPath?: string; songPath?: string }>();
  
  const artifacts = await getDownloadedArtifacts();
  const jobArtifacts = artifacts.filter(a => a.jobId === jobId);

  for (const artifact of jobArtifacts) {
    // Verify file still exists
    if (!(await fileExistsNonEmpty(artifact.localPath))) {
      continue;
    }

    const existing = results.get(artifact.docNum) || {};
    if (artifact.artifactType === 'audio') existing.audioPath = artifact.localPath;
    if (artifact.artifactType === 'pdf') existing.pdfPath = artifact.localPath;
    if (artifact.artifactType === 'song') existing.songPath = artifact.localPath;
    results.set(artifact.docNum, existing);
  }

  return results;
};

/**
 * Clean up artifacts for jobs that are no longer in the buffer
 */
export const cleanupOrphanedArtifacts = async (): Promise<number> => {
  try {
    const receipts = await getJobReceipts();
    const validJobIds = new Set(receipts.map(r => r.jobId));
    
    const artifacts = await getDownloadedArtifacts();
    const toKeep: DownloadedArtifact[] = [];
    const toDelete: string[] = [];

    for (const artifact of artifacts) {
      if (validJobIds.has(artifact.jobId)) {
        toKeep.push(artifact);
      } else {
        toDelete.push(artifact.localPath);
      }
    }

    // Delete orphaned files
    for (const path of toDelete) {
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch (e) {
        console.warn('[ArtifactCache] Failed to delete:', path, e);
      }
    }

    // Update registry
    await saveDownloadedArtifacts(toKeep);

    console.log(`[ArtifactCache] Cleaned up ${toDelete.length} orphaned artifacts`);
    return toDelete.length;
  } catch (e) {
    console.error('[ArtifactCache] Cleanup error:', e);
    return 0;
  }
};

/**
 * Sync artifacts for all jobs - fetches from Supabase directly
 * Call this on app startup to ensure all media is downloaded
 */
export const syncAllJobArtifacts = async (
  onJobProgress?: (jobId: string, completed: number, total: number) => void
): Promise<void> => {
  if (!isSupabaseConfigured) return;

  try {
    // Fetch user's recent jobs directly from Supabase (last 40)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[ArtifactCache] No user, skipping sync');
      return;
    }

    // Get jobs from Supabase - most recent 40
    // Note: jobs table uses 'type' not 'product_type', and params JSONB for person names
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, type, created_at, params')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(JOB_BUFFER_MAX);

    if (error) {
      console.error('[ArtifactCache] Failed to fetch jobs:', error);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log('[ArtifactCache] No jobs to sync');
      return;
    }

    console.log(`[ArtifactCache] Syncing artifacts for ${jobs.length} jobs from Supabase...`);

    // Also add these jobs to the local buffer for future reference
    for (const job of jobs) {
      const params = job.params as any;
      const person1Name = params?.person1?.name || params?.person?.name;
      const person2Name = params?.person2?.name;
      
      await addJobToBuffer({
        jobId: job.id,
        productType: job.type,
        personName: person1Name || undefined,
        partnerName: person2Name || undefined,
        createdAt: job.created_at,
      });
    }

    // Download artifacts for each job
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const params = job.params as any;
      const person1Name = params?.person1?.name || params?.person?.name;
      
      onJobProgress?.(job.id, i, jobs.length);
      
      // Download artifacts for this job
      await downloadJobArtifacts(job.id, person1Name || undefined);
    }

    // Clean up any orphaned artifacts
    await cleanupOrphanedArtifacts();

    console.log('[ArtifactCache] Sync complete');
  } catch (e) {
    console.error('[ArtifactCache] Sync error:', e);
  }
};

/**
 * Get total size of cached artifacts in MB
 */
export const getCacheSize = async (): Promise<number> => {
  try {
    const artifacts = await getDownloadedArtifacts();
    let totalSize = 0;

    for (const artifact of artifacts) {
      try {
        const info = await FileSystem.getInfoAsync(artifact.localPath);
        if (info.exists && (info as any).size) {
          totalSize += (info as any).size;
        }
      } catch {
        // Ignore errors for individual files
      }
    }

    return totalSize / (1024 * 1024); // Convert to MB
  } catch {
    return 0;
  }
};

/**
 * Clear all cached artifacts
 */
export const clearCache = async (): Promise<void> => {
  try {
    const artifacts = await getDownloadedArtifacts();
    
    for (const artifact of artifacts) {
      try {
        await FileSystem.deleteAsync(artifact.localPath, { idempotent: true });
      } catch {
        // Ignore errors
      }
    }

    await saveDownloadedArtifacts([]);
    console.log('[ArtifactCache] Cache cleared');
  } catch (e) {
    console.error('[ArtifactCache] Clear cache error:', e);
  }
};

/**
 * Get playable URL for an artifact - tries local cache first, falls back to signed URL
 * This ensures instant playback when cached, and downloads when not cached
 */
export const getPlayableArtifactUrl = async (
  jobId: string,
  docNum: number,
  artifactType: 'audio' | 'pdf' | 'song',
  storagePath: string
): Promise<string | null> => {
  try {
    // Try to get from local cache first
    const localPaths = await getLocalArtifactPaths(jobId);
    const paths = localPaths.get(docNum);
    
    let localPath: string | undefined;
    if (artifactType === 'audio') localPath = paths?.audioPath;
    else if (artifactType === 'pdf') localPath = paths?.pdfPath;
    else if (artifactType === 'song') localPath = paths?.songPath;
    
    // If we have a local file and it exists, use it
    if (localPath && await fileExistsNonEmpty(localPath)) {
      console.log(`[ArtifactCache] Using cached ${artifactType} for doc ${docNum}`);
      return localPath;
    }
    
    // Fall back to signed URL from Supabase
    console.log(`[ArtifactCache] No cache for ${artifactType} doc ${docNum}, fetching signed URL...`);
    const { createArtifactSignedUrl } = await import('./nuclearReadingsService');
    return await createArtifactSignedUrl(storagePath, 60 * 60);
  } catch (e) {
    console.error('[ArtifactCache] Error getting playable URL:', e);
    return null;
  }
};
