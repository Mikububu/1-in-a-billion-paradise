/**
 * ARTIFACT SYNC HOOK
 * 
 * Automatically downloads and caches job artifacts in the background.
 * - Syncs on app startup
 * - Syncs when new jobs are added to the buffer
 * - Maintains 40-job limit with automatic cleanup
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { 
  downloadJobArtifacts, 
  syncAllJobArtifacts, 
  cleanupOrphanedArtifacts,
  getLocalArtifactPaths,
  onDownloadProgress,
} from '@/services/artifactCacheService';
import { getJobReceipts, addJobToBuffer, JobReceipt } from '@/services/jobBuffer';
import { isSupabaseConfigured } from '@/services/supabase';

// Track which jobs we've already synced this session
const syncedJobsThisSession = new Set<string>();

/**
 * Hook to automatically sync artifacts for all jobs in the buffer
 * Call this in your root component (e.g., App.tsx or RootNavigator)
 */
export const useArtifactSync = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const syncInProgressRef = useRef(false);
  const hasInitialSyncRef = useRef(false);

  // Sync all job artifacts
  const syncArtifacts = useCallback(async () => {
    if (!isSupabaseConfigured || !user || syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;
    console.log('[ArtifactSync] Starting artifact sync...');

    try {
      const receipts = await getJobReceipts();
      
      // Only sync jobs we haven't synced this session
      const toSync = receipts.filter(r => !syncedJobsThisSession.has(r.jobId));
      
      if (toSync.length === 0) {
        console.log('[ArtifactSync] All jobs already synced this session');
        return;
      }

      console.log(`[ArtifactSync] Syncing ${toSync.length} jobs...`);

      for (const receipt of toSync) {
        try {
          await downloadJobArtifacts(receipt.jobId, receipt.personName);
          syncedJobsThisSession.add(receipt.jobId);
        } catch (e) {
          console.warn(`[ArtifactSync] Failed to sync job ${receipt.jobId}:`, e);
        }
      }

      // Clean up orphaned artifacts
      await cleanupOrphanedArtifacts();

      console.log('[ArtifactSync] Sync complete');
    } catch (e) {
      console.error('[ArtifactSync] Sync error:', e);
    } finally {
      syncInProgressRef.current = false;
    }
  }, [user]);

  // Initial sync on mount (when auth is ready)
  useEffect(() => {
    if (isAuthReady && user && !hasInitialSyncRef.current) {
      hasInitialSyncRef.current = true;
      // Delay initial sync slightly to not block app startup
      const timer = setTimeout(() => {
        syncArtifacts();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAuthReady, user, syncArtifacts]);

  // Re-sync when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && user) {
        // Small delay to let other things settle
        setTimeout(() => {
          syncArtifacts();
        }, 1000);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user, syncArtifacts]);

  return { syncArtifacts };
};

/**
 * Hook to sync artifacts for a specific job
 * Use this when a job completes (e.g., in GeneratingReadingScreen)
 */
export const useJobArtifactSync = (jobId: string | undefined, personName?: string) => {
  const syncInProgressRef = useRef(false);
  const hasSyncedRef = useRef(false);

  const syncJobArtifacts = useCallback(async () => {
    if (!jobId || !isSupabaseConfigured || syncInProgressRef.current || hasSyncedRef.current) {
      return null;
    }

    // Check if already synced this session
    if (syncedJobsThisSession.has(jobId)) {
      console.log(`[JobArtifactSync] Job ${jobId} already synced this session`);
      return await getLocalArtifactPaths(jobId);
    }

    syncInProgressRef.current = true;
    console.log(`[JobArtifactSync] Syncing artifacts for job ${jobId}...`);

    try {
      const results = await downloadJobArtifacts(jobId, personName);
      syncedJobsThisSession.add(jobId);
      hasSyncedRef.current = true;
      console.log(`[JobArtifactSync] Synced ${results.size} documents for job ${jobId}`);
      return results;
    } catch (e) {
      console.error(`[JobArtifactSync] Failed to sync job ${jobId}:`, e);
      return null;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [jobId, personName]);

  // Auto-sync when jobId is provided
  useEffect(() => {
    if (jobId) {
      syncJobArtifacts();
    }
  }, [jobId, syncJobArtifacts]);

  return { syncJobArtifacts };
};

/**
 * Add a job to the buffer and start downloading its artifacts
 * Call this when a job is created (e.g., in GeneratingReadingScreen)
 */
export const addJobAndSync = async (receipt: JobReceipt): Promise<void> => {
  // Add to buffer (enforces 40-job limit)
  await addJobToBuffer(receipt);
  
  // Start downloading artifacts in background
  downloadJobArtifacts(receipt.jobId, receipt.personName).catch(e => {
    console.warn(`[addJobAndSync] Failed to download artifacts for ${receipt.jobId}:`, e);
  });
};

/**
 * Get local artifact paths for a job
 * Returns cached paths if available, or downloads if not
 */
export const getOrDownloadArtifacts = async (
  jobId: string,
  personName?: string
): Promise<Map<number, { audioPath?: string; pdfPath?: string; songPath?: string }>> => {
  // First check if we have local paths
  const localPaths = await getLocalArtifactPaths(jobId);
  
  if (localPaths.size > 0) {
    console.log(`[getOrDownloadArtifacts] Found ${localPaths.size} cached documents for job ${jobId}`);
    return localPaths;
  }

  // Download if not cached
  console.log(`[getOrDownloadArtifacts] Downloading artifacts for job ${jobId}...`);
  return await downloadJobArtifacts(jobId, personName);
};
