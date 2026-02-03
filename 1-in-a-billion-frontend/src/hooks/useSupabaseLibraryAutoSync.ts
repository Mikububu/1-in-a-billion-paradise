import { useEffect, useRef, useCallback } from 'react';
import { env } from '@/config/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useSyncStore, getRetryDelay } from '@/store/syncStore';
import { fetchSavedAudiosFromSupabase, syncSavedAudiosToSupabase } from '@/services/libraryCloud';
import { fetchPeopleFromSupabase, syncPeopleToSupabase } from '@/services/peopleCloud';

const isUuid = (v: string | null | undefined): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

// Fixed UUID for dev users (so they can sync to Supabase too)
const DEV_USER_UUID = '00000000-0000-4000-a000-000000000001';

/**
 * Auto sync "library" metadata with Supabase when enabled:
 * - Saved audios (metadata rows)
 * - People (birth data + placements + hook readings)
 * 
 * FEATURES:
 * - Tracks sync status (synced/pending/error)
 * - Exponential backoff retry on failure
 * - Syncs on app open and when data changes
 * 
 * SAFETY: Never delete cloud data when local store appears empty/reset.
 * This prevents accidental data loss from store resets or app crashes.
 */
export function useSupabaseLibraryAutoSync() {
  const authUser = useAuthStore((s) => s.user);
  const isDevUser = authUser?.id === DEV_USER_UUID;

  const people = useProfileStore((s) => s.people);
  const savedAudios = useProfileStore((s) => s.savedAudios);
  const upsertSavedAudioById = useProfileStore((s) => s.upsertSavedAudioById);
  const upsertPersonById = useProfileStore((s) => s.upsertPersonById);

  // Sync status store
  const syncStatus = useSyncStore((s) => s.status);
  const failureCount = useSyncStore((s) => s.failureCount);
  const setSyncing = useSyncStore((s) => s.setSyncing);
  const setSynced = useSyncStore((s) => s.setSynced);
  const setError = useSyncStore((s) => s.setError);
  const setPending = useSyncStore((s) => s.setPending);
  const addPendingItem = useSyncStore((s) => s.addPendingItem);

  // Enable sync for both real users (UUID) and dev users (use fixed dev UUID)
  const hasRealUser = isUuid(authUser?.id);
  const cloudEnabled = env.ENABLE_SUPABASE_LIBRARY_SYNC && isSupabaseConfigured && (hasRealUser || isDevUser);
  const userId = cloudEnabled ? (hasRealUser ? authUser!.id : DEV_USER_UUID) : null;

  const didHydrateRef = useRef(false);
  const pushTimerRef = useRef<any>(null);
  const retryTimerRef = useRef<any>(null);
  
  // SAFETY: Track how many people were in cloud when we hydrated
  // This prevents deleting cloud data when local store is reset
  const cloudPeopleCountRef = useRef<number>(0);
  const cloudAudiosCountRef = useRef<number>(0);

  // Core sync function - can be called for initial sync or retry
  const performSync = useCallback(async (isRetry = false) => {
    if (!cloudEnabled || !userId) return;
    if (!didHydrateRef.current && !isRetry) return;
    
    const localPeopleCount = (people || []).length;
    const localAudiosCount = (savedAudios || []).length;
    
    // SAFETY: If local has significantly fewer people than cloud had, something is wrong
    if (cloudPeopleCountRef.current > 1 && localPeopleCount <= 1) {
      console.error(`🛑 SYNC BLOCKED: Local has ${localPeopleCount} people but cloud had ${cloudPeopleCountRef.current}. Refusing to potentially delete cloud data!`);
      return;
    }
    
    // SAFETY: If local has 0 people but cloud had people, block sync
    if (cloudPeopleCountRef.current > 0 && localPeopleCount === 0) {
      console.error(`🛑 SYNC BLOCKED: Local has 0 people but cloud had ${cloudPeopleCountRef.current}. Refusing to wipe cloud data!`);
      return;
    }
    
    // Update status to syncing
    setSyncing();
    console.log(`☁️ ${isRetry ? 'Retrying' : 'Syncing'} to cloud: ${localPeopleCount} people, ${localAudiosCount} audios`);
    
    try {
      // Sync and wait for results
      const [audiosResult, peopleResult] = await Promise.all([
        syncSavedAudiosToSupabase(userId, savedAudios || []),
        syncPeopleToSupabase(userId, people || []),
      ]);
      
      const audioSuccess = audiosResult.success;
      const peopleSuccess = peopleResult.success;
      
      if (audioSuccess && peopleSuccess) {
        // Both succeeded
        console.log(`✅ Sync successful: ${localPeopleCount} people, ${localAudiosCount} audios`);
        cloudPeopleCountRef.current = localPeopleCount;
        cloudAudiosCountRef.current = localAudiosCount;
        setSynced();
      } else {
        // At least one failed
        const errors: string[] = [];
        if (!audioSuccess) errors.push(`Audio: ${audiosResult.error}`);
        if (!peopleSuccess) errors.push(`People: ${peopleResult.error}`);
        const errorMsg = errors.join('; ');
        console.error(`❌ Sync FAILED:`, errorMsg);
        setError(errorMsg);
        
        // Schedule retry with exponential backoff
        scheduleRetry();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Sync exception:`, errorMsg);
      setError(errorMsg);
      scheduleRetry();
    }
  }, [cloudEnabled, userId, people, savedAudios, setSyncing, setSynced, setError]);

  // Schedule retry with exponential backoff
  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    
    const delay = getRetryDelay(failureCount);
    console.log(`⏳ Scheduling retry in ${Math.round(delay / 1000)}s (attempt ${failureCount + 1})`);
    
    retryTimerRef.current = setTimeout(() => {
      performSync(true);
    }, delay);
  }, [failureCount, performSync]);

  // Pull: hydrate local store from Supabase once per session
  useEffect(() => {
    let mounted = true;
    if (!cloudEnabled || !userId) return;
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    (async () => {
      try {
        setSyncing();
        const [audiosRes, peopleRes] = await Promise.all([
          fetchSavedAudiosFromSupabase(userId),
          fetchPeopleFromSupabase(userId),
        ]);

        if (!mounted) return;

        // SAFETY: Remember cloud counts before hydrating
        cloudPeopleCountRef.current = peopleRes.success ? peopleRes.people.length : 0;
        cloudAudiosCountRef.current = audiosRes.success ? audiosRes.audios.length : 0;
        
        console.log(`☁️ Hydrated from cloud: ${cloudPeopleCountRef.current} people, ${cloudAudiosCountRef.current} audios`);

        if (audiosRes.success) {
          for (const a of audiosRes.audios) upsertSavedAudioById(a);
        }
        if (peopleRes.success) {
          for (const p of peopleRes.people) upsertPersonById(p);
        }
        
        setSynced();
      } catch (err) {
        console.error('❌ Hydration failed:', err);
        setError(err instanceof Error ? err.message : 'Hydration failed');
        scheduleRetry();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [cloudEnabled, userId, upsertSavedAudioById, upsertPersonById, setSyncing, setSynced, setError, scheduleRetry]);

  // Push: debounce upserts when local library changes
  useEffect(() => {
    if (!cloudEnabled || !userId) return;
    
    // SAFETY CHECK: Don't sync until we've hydrated from cloud first
    if (!didHydrateRef.current) {
      console.log('⚠️ Sync blocked: waiting for cloud hydration first');
      return;
    }

    // Mark as pending immediately
    setPending();
    addPendingItem('people');

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      performSync();
    }, 1200);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [cloudEnabled, userId, savedAudios, people, setPending, addPendingItem, performSync]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);
}
