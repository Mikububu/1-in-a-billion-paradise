/**
 * REALTIME ARTIFACT SYNC SERVICE
 * 
 * Uses Supabase Realtime to instantly download artifacts when they're created.
 * No polling needed - artifacts download the moment they're ready.
 * 
 * Architecture:
 * 1. Backend creates artifact in job_artifacts table
 * 2. Supabase broadcasts INSERT event via Realtime
 * 3. This service receives event and downloads artifact immediately
 * 4. Local cache is updated, UI reflects instantly
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { downloadJobArtifacts, getLocalArtifactPaths } from './artifactCacheService';
import { getJobReceipts } from './jobBuffer';
import { useAuthStore } from '@/store/authStore';

// Types
type ArtifactInsertPayload = {
  id: string;
  job_id: string;
  task_id: string;
  artifact_type: 'text' | 'audio' | 'pdf' | 'audio_mp3' | 'audio_m4a' | 'audio_song';
  storage_path: string;
  metadata?: {
    title?: string;
    docNum?: number;
    system?: string;
  };
  created_at: string;
};

type ArtifactEventCallback = (artifact: ArtifactInsertPayload) => void;
type DownloadCompleteCallback = (jobId: string, docNum: number, type: 'audio' | 'pdf' | 'song', localPath: string) => void;

// Singleton state
let realtimeChannel: RealtimeChannel | null = null;
let isSubscribed = false;
let currentUserId: string | null = null;

// Event callbacks
const artifactCallbacks: Set<ArtifactEventCallback> = new Set();
const downloadCompleteCallbacks: Set<DownloadCompleteCallback> = new Set();

// Download queue to prevent duplicate downloads
const downloadQueue = new Map<string, Promise<void>>();

/**
 * Register callback for artifact events (for UI updates)
 */
export const onArtifactReceived = (callback: ArtifactEventCallback): (() => void) => {
  artifactCallbacks.add(callback);
  return () => artifactCallbacks.delete(callback);
};

/**
 * Register callback for download completion (for UI updates)
 */
export const onDownloadComplete = (callback: DownloadCompleteCallback): (() => void) => {
  downloadCompleteCallbacks.add(callback);
  return () => downloadCompleteCallbacks.delete(callback);
};

/**
 * Notify all artifact callbacks
 */
const notifyArtifactReceived = (artifact: ArtifactInsertPayload) => {
  artifactCallbacks.forEach(cb => {
    try {
      cb(artifact);
    } catch (e) {
      console.error('[RealtimeSync] Callback error:', e);
    }
  });
};

/**
 * Notify all download complete callbacks
 */
const notifyDownloadComplete = (jobId: string, docNum: number, type: 'audio' | 'pdf' | 'song', localPath: string) => {
  downloadCompleteCallbacks.forEach(cb => {
    try {
      cb(jobId, docNum, type, localPath);
    } catch (e) {
      console.error('[RealtimeSync] Download callback error:', e);
    }
  });
};

/**
 * Get artifact category from type
 */
const getArtifactCategory = (artifactType: string): 'audio' | 'pdf' | 'song' | 'text' | null => {
  if (artifactType === 'pdf') return 'pdf';
  if (artifactType === 'text') return 'text';
  if (artifactType === 'audio_song') return 'song';
  if (artifactType.startsWith('audio')) return 'audio';
  return null;
};

/**
 * Handle incoming artifact from Realtime
 */
const handleArtifactInsert = async (payload: { new: ArtifactInsertPayload }) => {
  const artifact = payload.new;
  console.log(`📡 [RealtimeSync] Artifact received:`, {
    jobId: artifact.job_id,
    type: artifact.artifact_type,
    docNum: artifact.metadata?.docNum,
    system: artifact.metadata?.system,
  });

  // Notify listeners immediately (for UI feedback)
  notifyArtifactReceived(artifact);

  // Skip text artifacts (we don't cache those locally)
  const category = getArtifactCategory(artifact.artifact_type);
  if (!category || category === 'text') {
    console.log(`📡 [RealtimeSync] Skipping ${artifact.artifact_type} artifact (not cached)`);
    return;
  }

  // Check if this job is in our buffer (we only cache jobs we care about)
  const receipts = await getJobReceipts();
  const jobReceipt = receipts.find(r => r.jobId === artifact.job_id);
  
  if (!jobReceipt) {
    console.log(`📡 [RealtimeSync] Job ${artifact.job_id} not in buffer, skipping download`);
    return;
  }

  // Create unique key for this download
  const downloadKey = `${artifact.job_id}-${artifact.metadata?.docNum || 0}-${category}`;

  // Check if already downloading
  if (downloadQueue.has(downloadKey)) {
    console.log(`📡 [RealtimeSync] Already downloading ${downloadKey}, skipping`);
    return;
  }

  // Check if already downloaded
  const cachedPaths = await getLocalArtifactPaths(artifact.job_id);
  const docNum = artifact.metadata?.docNum || 1;
  const cached = cachedPaths.get(docNum);
  
  if (cached) {
    const alreadyHas = (category === 'audio' && cached.audioPath) ||
                       (category === 'pdf' && cached.pdfPath) ||
                       (category === 'song' && cached.songPath);
    if (alreadyHas) {
      console.log(`📡 [RealtimeSync] Already have ${category} for doc ${docNum}, skipping`);
      return;
    }
  }

  // Start download
  console.log(`📡 [RealtimeSync] Starting download for ${category} (job=${artifact.job_id}, doc=${docNum})`);
  
  const downloadPromise = (async () => {
    try {
      const results = await downloadJobArtifacts(artifact.job_id, jobReceipt.personName);
      const downloaded = results.get(docNum);
      
      if (downloaded) {
        const localPath = category === 'audio' ? downloaded.audioPath :
                         category === 'pdf' ? downloaded.pdfPath :
                         downloaded.songPath;
        
        if (localPath) {
          console.log(`✅ [RealtimeSync] Downloaded ${category} for doc ${docNum}: ${localPath}`);
          notifyDownloadComplete(artifact.job_id, docNum, category, localPath);
        }
      }
    } catch (e) {
      console.error(`❌ [RealtimeSync] Download failed for ${downloadKey}:`, e);
    } finally {
      downloadQueue.delete(downloadKey);
    }
  })();

  downloadQueue.set(downloadKey, downloadPromise);
};

/**
 * Subscribe to artifact changes for current user
 */
export const subscribeToArtifacts = async (): Promise<boolean> => {
  if (!isSupabaseConfigured) {
    console.warn('[RealtimeSync] Supabase not configured');
    return false;
  }

  // Get current user
  const user = useAuthStore.getState().user;
  if (!user) {
    console.warn('[RealtimeSync] No authenticated user');
    return false;
  }

  // If already subscribed for this user, skip
  if (isSubscribed && currentUserId === user.id) {
    console.log('[RealtimeSync] Already subscribed for user', user.id);
    return true;
  }

  // Unsubscribe from previous channel if exists
  if (realtimeChannel) {
    await unsubscribeFromArtifacts();
  }

  currentUserId = user.id;

  try {
    console.log(`📡 [RealtimeSync] Subscribing to artifacts for user ${user.id}...`);

    // Subscribe to job_artifacts table for this user's jobs
    // We filter by job_id in the handler since Supabase Realtime doesn't support JOINs
    realtimeChannel = supabase
      .channel(`artifacts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_artifacts',
        },
        async (payload) => {
          // Verify this artifact belongs to a job owned by current user
          const artifact = payload.new as ArtifactInsertPayload;
          
          try {
            const { data: job } = await supabase
              .from('jobs')
              .select('user_id')
              .eq('id', artifact.job_id)
              .single();
            
            if (job?.user_id === user.id) {
              handleArtifactInsert({ new: artifact });
            }
          } catch (e) {
            // Silently ignore - job might not exist or user mismatch
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 [RealtimeSync] Subscription status: ${status}`);
        isSubscribed = status === 'SUBSCRIBED';
      });

    return true;
  } catch (e) {
    console.error('[RealtimeSync] Subscription error:', e);
    return false;
  }
};

/**
 * Unsubscribe from artifact changes
 */
export const unsubscribeFromArtifacts = async (): Promise<void> => {
  if (realtimeChannel) {
    console.log('[RealtimeSync] Unsubscribing from artifacts...');
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    isSubscribed = false;
    currentUserId = null;
  }
};

/**
 * Check if currently subscribed
 */
export const isRealtimeSubscribed = (): boolean => {
  return isSubscribed;
};

/**
 * Get subscription status for debugging
 */
export const getSubscriptionStatus = (): { subscribed: boolean; userId: string | null; queueSize: number } => {
  return {
    subscribed: isSubscribed,
    userId: currentUserId,
    queueSize: downloadQueue.size,
  };
};
