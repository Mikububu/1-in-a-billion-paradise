/**
 * REALTIME ARTIFACT SYNC HOOK
 * 
 * Manages Supabase Realtime subscription for instant artifact downloads.
 * 
 * Usage:
 * - Add to RootNavigator or App.tsx
 * - Automatically subscribes when user is authenticated
 * - Automatically unsubscribes on logout
 * - Provides callbacks for UI updates
 */

import { useEffect, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import {
  subscribeToArtifacts,
  unsubscribeFromArtifacts,
  onArtifactReceived,
  onDownloadComplete,
  isRealtimeSubscribed,
  getSubscriptionStatus,
} from '@/services/realtimeArtifactSync';
import { syncAllJobArtifacts } from '@/services/artifactCacheService';

type ArtifactEvent = {
  jobId: string;
  type: string;
  docNum?: number;
  system?: string;
};

type DownloadEvent = {
  jobId: string;
  docNum: number;
  type: 'audio' | 'pdf' | 'song';
  localPath: string;
};

/**
 * Hook to manage Realtime artifact sync
 * Returns status and recent events for debugging/UI
 */
export const useRealtimeArtifactSync = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [recentArtifacts, setRecentArtifacts] = useState<ArtifactEvent[]>([]);
  const [recentDownloads, setRecentDownloads] = useState<DownloadEvent[]>([]);
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  // Subscribe when user is authenticated
  useEffect(() => {
    if (!isAuthReady || !user) {
      // Unsubscribe if user logs out
      if (isSubscribed) {
        unsubscribeFromArtifacts().then(() => {
          setIsSubscribed(false);
        });
      }
      return;
    }

    // Subscribe to realtime
    subscribeToArtifacts().then((success) => {
      setIsSubscribed(success);
      if (success) {
        console.log('✅ [useRealtimeArtifactSync] Subscribed to realtime artifacts');
      }
    });

    // Initial sync of existing artifacts (catch up on anything missed)
    if (!initialSyncDone) {
      console.log('🔄 [useRealtimeArtifactSync] Starting initial sync...');
      syncAllJobArtifacts().then(() => {
        setInitialSyncDone(true);
        console.log('✅ [useRealtimeArtifactSync] Initial sync complete');
      });
    }

    return () => {
      // Don't unsubscribe on unmount - keep subscription active
      // Only unsubscribe on logout (handled above)
    };
  }, [isAuthReady, user, isSubscribed, initialSyncDone]);

  // Re-subscribe when app comes to foreground (in case connection was lost)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && user && !isRealtimeSubscribed()) {
        console.log('🔄 [useRealtimeArtifactSync] App active, re-subscribing...');
        subscribeToArtifacts().then((success) => {
          setIsSubscribed(success);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user]);

  // Listen for artifact events
  useEffect(() => {
    const unsubArtifact = onArtifactReceived((artifact) => {
      const event: ArtifactEvent = {
        jobId: artifact.job_id,
        type: artifact.artifact_type,
        docNum: artifact.metadata?.docNum,
        system: artifact.metadata?.system,
      };
      
      setRecentArtifacts((prev) => {
        const next = [event, ...prev].slice(0, 10); // Keep last 10
        return next;
      });
    });

    const unsubDownload = onDownloadComplete((jobId, docNum, type, localPath) => {
      const event: DownloadEvent = { jobId, docNum, type, localPath };
      
      setRecentDownloads((prev) => {
        const next = [event, ...prev].slice(0, 10); // Keep last 10
        return next;
      });
    });

    return () => {
      unsubArtifact();
      unsubDownload();
    };
  }, []);

  // Manual re-sync function
  const resync = useCallback(async () => {
    console.log('🔄 [useRealtimeArtifactSync] Manual resync triggered');
    await syncAllJobArtifacts();
  }, []);

  // Get current status
  const getStatus = useCallback(() => {
    return getSubscriptionStatus();
  }, []);

  return {
    isSubscribed,
    recentArtifacts,
    recentDownloads,
    initialSyncDone,
    resync,
    getStatus,
  };
};

/**
 * Lightweight hook just for subscription management
 * Use this in RootNavigator - no state tracking overhead
 */
export const useRealtimeSubscription = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);

  useEffect(() => {
    if (!isAuthReady) return;

    if (user) {
      // Subscribe when user is authenticated
      subscribeToArtifacts().then((success) => {
        if (success) {
          console.log('✅ [RealtimeSubscription] Connected');
        }
      });

      // Initial sync
      syncAllJobArtifacts().catch((e) => {
        console.warn('[RealtimeSubscription] Initial sync failed:', e);
      });
    } else {
      // Unsubscribe when user logs out
      unsubscribeFromArtifacts();
    }
  }, [isAuthReady, user]);

  // Re-subscribe on app foreground
  useEffect(() => {
    if (!user) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && !isRealtimeSubscribed()) {
        subscribeToArtifacts();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user]);
};
