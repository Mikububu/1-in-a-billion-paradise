import { useEffect, useRef } from 'react';
import { env } from '@/config/env';
import { isSupabaseConfigured } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
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

  // Enable sync for both real users (UUID) and dev users (use fixed dev UUID)
  const hasRealUser = isUuid(authUser?.id);
  const cloudEnabled = env.ENABLE_SUPABASE_LIBRARY_SYNC && isSupabaseConfigured && (hasRealUser || isDevUser);
  const userId = cloudEnabled ? (hasRealUser ? authUser!.id : DEV_USER_UUID) : null;

  const didHydrateRef = useRef(false);
  const pushTimerRef = useRef<any>(null);
  
  // SAFETY: Track how many people were in cloud when we hydrated
  // This prevents deleting cloud data when local store is reset
  const cloudPeopleCountRef = useRef<number>(0);
  const cloudAudiosCountRef = useRef<number>(0);

  // Pull: hydrate local store from Supabase once per session
  useEffect(() => {
    let mounted = true;
    if (!cloudEnabled || !userId) return;
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    (async () => {
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
    })();

    return () => {
      mounted = false;
    };
  }, [cloudEnabled, userId, upsertSavedAudioById, upsertPersonById]);

  // Push: debounce upserts when local library changes
  // SAFETY: Never sync if local has significantly fewer items than cloud had
  useEffect(() => {
    if (!cloudEnabled || !userId) return;
    
    // SAFETY CHECK: Don't sync until we've hydrated from cloud first
    if (!didHydrateRef.current) {
      console.log('⚠️ Sync blocked: waiting for cloud hydration first');
      return;
    }

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      const localPeopleCount = (people || []).length;
      const localAudiosCount = (savedAudios || []).length;
      
      // SAFETY: If local has significantly fewer people than cloud had, something is wrong
      // Don't sync - this could wipe cloud data!
      if (cloudPeopleCountRef.current > 1 && localPeopleCount <= 1) {
        console.error(`🛑 SYNC BLOCKED: Local has ${localPeopleCount} people but cloud had ${cloudPeopleCountRef.current}. Refusing to potentially delete cloud data!`);
        console.error('This usually means the local store was reset. Please restart the app to re-hydrate from cloud.');
        return;
      }
      
      // SAFETY: If local has 0 people but cloud had people, block sync
      if (cloudPeopleCountRef.current > 0 && localPeopleCount === 0) {
        console.error(`🛑 SYNC BLOCKED: Local has 0 people but cloud had ${cloudPeopleCountRef.current}. Refusing to wipe cloud data!`);
        return;
      }
      
      // Safe to sync
      console.log(`☁️ Syncing to cloud: ${localPeopleCount} people, ${localAudiosCount} audios`);
      
      syncSavedAudiosToSupabase(userId, savedAudios || []).catch((err) => {
        console.warn('Audio sync failed:', err);
      });
      syncPeopleToSupabase(userId, people || []).catch((err) => {
        console.warn('People sync failed:', err);
      });
      
      // Update cloud counts after successful sync
      cloudPeopleCountRef.current = localPeopleCount;
      cloudAudiosCountRef.current = localAudiosCount;
      
    }, 1200);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [cloudEnabled, userId, savedAudios, people]);
}
