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
  useEffect(() => {
    if (!cloudEnabled || !userId) return;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      syncSavedAudiosToSupabase(userId, savedAudios || []).catch(() => { });
      syncPeopleToSupabase(userId, people || []).catch(() => { });
    }, 1200);

    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [cloudEnabled, userId, savedAudios, people]);
}




