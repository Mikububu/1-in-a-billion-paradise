/**
 * MY LIBRARY SCREEN
 * 
 * The central hub for all user content - readings, audios, people, and more.
 * Designed with a clever, card-based UI that makes everything accessible.
 * 
 * SECTIONS:
 * 1. Your Profile Card - name, chart summary, verification status
 * 2. Your Readings - organized by system with audio/PDF indicators
 * 3. People - partners and friends you've analyzed
 * 4. Compatibility Analyses - overlays and synastry readings
 * 5. Saved Audio - downloadable audio files
 * 6. Quick Actions - regenerate, purchase, settings
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  Share,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore, Reading, Person, CompatibilityReading, ReadingSystem, SavedAudio, SavedPDF } from '@/store/profileStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { shareAudioFile, downloadAudioFromUrl, generateAudioFileName } from '@/services/audioDownload';
import { useAuthStore } from '@/store/authStore';
import { fetchPeopleWithPaidReadings, deletePersonFromSupabase } from '@/services/peopleService';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { fetchNuclearJobs, fetchJobArtifacts } from '@/services/nuclearReadingsService';

// Define radii values directly to avoid import issues
const RADIUS_CARD = 22;
const RADIUS_BUTTON = 999;
const RADIUS_INPUT = 16;
const RADIUS_PILL = 14;

type Props = NativeStackScreenProps<MainStackParamList, 'MyLibrary'>;

const screenId = '11'; // My Library

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// System display info
const SYSTEM_INFO: Record<ReadingSystem, { icon: string; name: string; color: string }> = {
  western: { icon: '☉', name: 'Western', color: '#E5A800' },
  vedic: { icon: 'ॐ', name: 'Vedic', color: '#FF6B35' },
  human_design: { icon: '◇', name: 'Human Design', color: '#7B68EE' },
  gene_keys: { icon: '⬡', name: 'Gene Keys', color: '#2DD4BF' },
  kabbalah: { icon: '✡', name: 'Kabbalah', color: '#8B5CF6' },
};

// Tab options - karma-based organization
type TabType = 'my_karma' | 'their_karma' | 'shared_karma';

// Memoized reading card to prevent re-renders
const ReadingCard = React.memo(({ reading, onPress }: {
  reading: { id: string; type: string; sign: string; intro: string; date: string; icon: string };
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.readingCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.readingIcon}>
      <Text style={styles.readingIconText}>{reading.icon}</Text>
    </View>
    <View style={styles.readingInfo}>
      <Text style={styles.readingType}>{reading.type}</Text>
      <Text style={styles.readingSign}>{reading.sign}</Text>
      <Text style={styles.readingPreview} numberOfLines={1}>
        {reading.intro}
      </Text>
      <Text style={styles.readingDate}>{reading.date}</Text>
    </View>
    <Text style={styles.readingArrow}>→</Text>
  </TouchableOpacity>
));



export const MyLibraryScreen = ({ navigation }: Props) => {
  console.log(`📱 Screen ${screenId}: MyLibraryScreen`);
  const [activeTab, setActiveTab] = useState<TabType>('my_karma');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);


  // Audio playback state for person cards
  const [playingPersonId, setPlayingPersonId] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const personAudioRefs = useRef<Record<string, Audio.Sound>>({});
  const progressBarWidths = useRef<Record<string, number>>({});
  const [queueJobs, setQueueJobs] = useState<
    Array<{
      id: string;
      type: string;
      status: 'pending' | 'processing' | 'complete' | 'error' | string;
      progress?: any;
      input?: any;
      created_at: string;
      updated_at: string;
    }>
  >([]);
  const [loadingQueueJobs, setLoadingQueueJobs] = useState(false);
  const [queueJobsUpdatedAt, setQueueJobsUpdatedAt] = useState<string | null>(null);
  const [queueJobsError, setQueueJobsError] = useState<string | null>(null);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  // People with paid readings from Supabase (source of truth)
  const [paidPeopleNames, setPaidPeopleNames] = useState<Set<string>>(new Set());
  // Cache of people profiles (placements, birth data) from Supabase library_people
  const [libraryPeopleById, setLibraryPeopleById] = useState<Record<string, Person>>({});
  // Track nuclear_v2 job artifacts for reading badges
  const [nuclearJobArtifacts, setNuclearJobArtifacts] = useState<Record<string, Array<{ system?: string; docType?: string }>>>({});

  // CRITICAL: Stop audio when screen loses focus (useFocusEffect runs cleanup BEFORE blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log('🛑 MyLibraryScreen LOSING FOCUS - stopping audio immediately');
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => { });
          soundRef.current.unloadAsync().catch(() => { });
          soundRef.current = null;
        }
        setPlayingAudioId(null);
        // Stop all person audio players
        Object.values(personAudioRefs.current).forEach(async (sound) => {
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
          } catch (e) {
            // Ignore errors
          }
        });
        personAudioRefs.current = {};
        setPlayingPersonId(null);
      };
    }, [])
  );

  // Also cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
    };
  }, []);

  // Profile store data - select raw data, not functions
  const people = useProfileStore((state) => state.people);
  const compatibilityReadings = useProfileStore((state) => state.compatibilityReadings);
  const savedAudios = useProfileStore((state) => state.savedAudios);
  const savedPDFs = useProfileStore((state) => state.savedPDFs);
  const deleteSavedAudio = useProfileStore((state) => state.deleteSavedAudio);
  const upsertSavedAudioById = useProfileStore((state) => state.upsertSavedAudioById);
  const addPerson = useProfileStore((state) => state.addPerson);
  const updatePerson = useProfileStore((state) => state.updatePerson);
  const repairPeople = useProfileStore((state) => state.repairPeople);
  const repairReadings = useProfileStore((state) => state.repairReadings);
  const fixDuplicateIds = useProfileStore((state) => state.fixDuplicateIds);
  const linkJobToPerson = useProfileStore((state) => state.linkJobToPerson);
  const linkJobToPersonByName = useProfileStore((state) => state.linkJobToPersonByName);

  // Onboarding store for hook readings
  const authUser = useAuthStore((s) => s.user);
  const cloudEnabled = env.ENABLE_SUPABASE_LIBRARY_SYNC && isSupabaseConfigured && !!authUser?.id;
  const selfPersonId = authUser?.id ? `self-${authUser.id}` : null;

  // One-time library repair (merges duplicate people like "Born Unknown" into the real profile)
  useEffect(() => {
    try {
      fixDuplicateIds(); // FIX duplicate IDs first
      repairPeople(); // Then merge duplicate people
      repairReadings(); // Then dedupe readings
    } catch {
      // ignore
    }
  }, [fixDuplicateIds, repairPeople, repairReadings]);

  // Fetch people with paid readings from Supabase (source of truth for who shows in library)
  useEffect(() => {
    if (!authUser?.id) return;
    
    fetchPeopleWithPaidReadings(authUser.id).then(paidPeople => {
      const names = new Set(paidPeople.map(p => p.name));
      setPaidPeopleNames(names);
      console.log(`📚 [MyLibrary] Paid people: ${Array.from(names).join(', ') || 'none'}`);
    }).catch(err => {
      console.warn('⚠️ Failed to fetch paid people:', err);
    });
  }, [authUser?.id]);

  // Cache the Supabase `library_people` rows for people referenced by jobs.
  // This provides stable placements/birthData even when job params are minimal.
  useEffect(() => {
    if (!authUser?.id) return;
    if (!isSupabaseConfigured) return;
    if (!Array.isArray(queueJobs) || queueJobs.length === 0) return;

    const ids = new Set<string>();
    for (const j of queueJobs as any[]) {
      let params: any = (j as any)?.params || (j as any)?.input || {};
      if (typeof params === 'string') {
        try {
          params = JSON.parse(params);
        } catch {
          params = {};
        }
      }
      const p1 = params?.person1?.id;
      const p2 = params?.person2?.id;
      if (typeof p1 === 'string' && p1.trim().length > 0) ids.add(p1);
      if (typeof p2 === 'string' && p2.trim().length > 0) ids.add(p2);
    }

    const idList = Array.from(ids);
    if (idList.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const chunkSize = 100;
        const nextMap: Record<string, Person> = {};

        for (let i = 0; i < idList.length; i += chunkSize) {
          const chunk = idList.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from('library_people')
            .select('*')
            .eq('user_id', authUser.id)
            .in('client_person_id', chunk);

          if (error) throw error;
          if (!data) continue;

          for (const row of data as any[]) {
            const id = row.client_person_id;
            if (!id) continue;
            nextMap[id] = {
              id,
              name: row.name,
              isUser: row.is_user || false,
              isVerified: row.is_user || false,
              gender: row.gender,
              birthData: row.birth_data,
              placements: row.placements,
              readings: [],
              jobIds: [],
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
            };
          }
        }

        if (!cancelled) {
          setLibraryPeopleById((prev) => ({ ...prev, ...nextMap }));
        }
      } catch (e) {
        // Non-blocking: if this fails we can still render from job params + local cache.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, queueJobs]);

  // Activity feed: show background queue status (RunPod/Supabase jobs)
  const mountedRef = useRef(true);
  const queueFetchInFlightRef = useRef(false);
  const pollingIntervalRef = useRef<any>(null);
  const linkedJobPairsRef = useRef<Set<string>>(new Set());

  // Absolute safety: never allow loading state to hang forever.
  // (Even if fetch/abort misbehaves or the promise never settles.)
  useEffect(() => {
    if (!loadingQueueJobs) return;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      console.warn('⏰ [MyLibrary] Global loading timeout - clearing loading state');
      setQueueJobsError((prev) => prev || 'Timed out loading cloud readings. Tap to retry.');
      setLoadingQueueJobs(false);
      queueFetchInFlightRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 20000);
    return () => clearTimeout(t);
  }, [loadingQueueJobs]);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      let interval: any;

      const setPolling = (enabled: boolean) => {
        if (!mountedRef.current) return;
        if (enabled) {
          if (!interval) {
            interval = setInterval(loadQueue, 15000);
            pollingIntervalRef.current = interval;
            console.log('🔄 [MyLibrary] Polling ON (active jobs)');
          }
        } else {
          if (interval) {
            clearInterval(interval);
            interval = null;
            pollingIntervalRef.current = null;
            console.log('✅ [MyLibrary] Polling OFF (no active jobs)');
          }
        }
      };

      // Use the latest authUser from closure - this function is recreated when authUser?.id changes
      const currentAuthUserId = authUser?.id;
      const loadQueue = async () => {
        if (queueFetchInFlightRef.current) return;
        queueFetchInFlightRef.current = true;

        console.log('🔄 [MyLibrary] loadQueue called - currentAuthUserId:', currentAuthUserId || 'null');
        // NOTE: On some RN runtimes AbortController may not reliably abort in-flight fetches.
        // This wrapper guarantees the await will settle via Promise.race + (best-effort) abort.
        const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 12000) => {
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const signal = controller?.signal;

          const fetchPromise = fetch(url, { ...init, ...(signal ? { signal } : {}) });

          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              try {
                controller?.abort();
              } catch {
                // ignore
              }
              reject(new Error(`Request timed out after ${timeoutMs}ms: ${url}`));
            }, timeoutMs);
          });

          try {
            return await Promise.race([fetchPromise, timeoutPromise]);
          } finally {
            if (timeoutId) clearTimeout(timeoutId);
          }
        };
        const isUuid = (v: string | null): v is string =>
          !!v &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

        // Prefer a real authenticated user id (either from auth store or Supabase session).
        let resolvedUserId: string | null = currentAuthUserId || null;
        console.log('🔄 [MyLibrary] Initial resolvedUserId:', resolvedUserId || 'null');
        if (!resolvedUserId && isSupabaseConfigured) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            resolvedUserId = session?.user?.id || null;
          } catch {
            // ignore
          }
        }
        // Only treat a resolved userId as valid if it is a real UUID. (Supabase user ids are UUIDs.)
        if (!isUuid(resolvedUserId)) {
          console.log('⚠️ [MyLibrary] resolvedUserId is not UUID');
          resolvedUserId = null;
        }
        const userId = resolvedUserId;
        console.log('🔄 [MyLibrary] Final userId to use:', userId || 'null');

        // If we don't have a userId, we cannot fetch the user's jobs.
        if (!userId) {
          if (mountedRef.current) {
            setQueueJobsError('Please sign in to load your cloud readings.');
            setLoadingQueueJobs(false);
            setPolling(false);
          }
          queueFetchInFlightRef.current = false;
          return;
        }

        if (!env.CORE_API_URL) {
          if (mountedRef.current) {
            setQueueJobsError('CORE_API_URL is not configured. Cannot load cloud readings.');
            setLoadingQueueJobs(false);
            setPolling(false);
          }
          queueFetchInFlightRef.current = false;
          return;
        }

        const fetchJobsForUser = async (uid: string, accessToken?: string) => {
          const url = `${env.CORE_API_URL}/api/jobs/v2/user/${uid}/jobs`;
          console.log('📡 [MyLibrary] Fetching jobs from:', url);
          let response = await fetchWithTimeout(url, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          });
          if (response.status === 401 || response.status === 403 || response.status === 500) {
            console.log('⚠️ [MyLibrary] Jobs list auth request failed with', response.status, '- retrying without auth');
            response = await fetchWithTimeout(url);
          }
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Failed to fetch jobs for ${uid}: ${response.status} ${errorText}`);
          }
          const result = await response.json();
          return { result, url };
        };

        // Fetch from backend API (works with or without auth)
        setLoadingQueueJobs(true);
        // Watchdog: never let the UI hang indefinitely if fetch never settles.
        // Cleared on success/error/early-return below.
        const loadingWatchdog = setTimeout(() => {
          if (!mountedRef.current) return;
          console.warn('⏰ [MyLibrary] Watchdog timeout: loadQueue still pending, clearing loading state');
          setQueueJobsError('Timed out loading cloud readings. Please reload the app (or restart Metro).');
          setLoadingQueueJobs(false);
          setPolling(false);
          queueFetchInFlightRef.current = false;
        }, 15000);
        try {
          console.log('📡 [MyLibrary] CORE_API_URL is:', env.CORE_API_URL);
          console.log('📡 [MyLibrary] resolvedUserId:', resolvedUserId || '(none)', '→ using:', userId);

          // Optional auth token for job detail endpoint (some backends require it).
          let accessToken: string | undefined;
          if (isSupabaseConfigured) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              accessToken = session?.access_token;
            } catch {
              // ignore
            }
          }

          const { result } = await fetchJobsForUser(userId, accessToken);
          const jobsArray = Array.isArray(result) ? result : (Array.isArray(result?.jobs) ? result.jobs : []);
          const mergedJobs: any[] = jobsArray;
          
          // If no jobs found, stop polling and exit cleanly.
          if (mergedJobs.length === 0) {
            if (mountedRef.current) {
              setQueueJobs([]);
              setQueueJobsUpdatedAt(new Date().toISOString());
              setQueueJobsError(null);
              setPolling(false);
              clearTimeout(loadingWatchdog);
              setLoadingQueueJobs(false);
            }
            queueFetchInFlightRef.current = false;
            return;
          }
          
          const fetchJobDetail = async (jobIdToFetch: string) => {
            const url = `${env.CORE_API_URL}/api/jobs/v2/${jobIdToFetch}`;
            // Try with auth header first (if we have it), then fall back without.
            let resp = await fetchWithTimeout(url, {
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });

            // If auth fails (401/403) OR backend is misconfigured for auth (500), try without auth
            if (resp.status === 401 || resp.status === 403 || resp.status === 500) {
              console.log('⚠️ [MyLibrary] Auth request failed with', resp.status, '- retrying without auth');
              resp = await fetchWithTimeout(url);
            }
            const detailData = await resp.json().catch(() => ({}));
            return detailData;
          };

          // Fetch details for jobs that need params (to show the correct person names).
          const jobsWithDetails = await Promise.all(
            mergedJobs.map(async (j: any) => {
              // For relationship jobs AND extended/single_system jobs, we want person names even while processing so the Library can explain what's happening.
              const needsParams = j.type === 'synastry' || j.type === 'nuclear_v2' || j.type === 'extended' || j.type === 'single_system';
              const isFinished = j.status === 'complete' || j.status === 'completed';

              if (needsParams || isFinished) {
                try {
                  const detailData = await fetchJobDetail(j.id);
                  const params = detailData.job?.params || {};
                  const createdAt = j.created_at || j.createdAt || detailData?.job?.created_at || new Date().toISOString();
                  const updatedAt = j.updated_at || j.updatedAt || detailData?.job?.updated_at || createdAt;
                  return {
                    id: j.id,
                    type: j.type,
                    status: j.status,
                    progress: j.progress || { percent: j.percent, tasksComplete: j.tasksComplete, tasksTotal: j.tasksTotal },
                    created_at: createdAt,
                    updated_at: updatedAt,
                    params, // Include full params with person names
                  };
                } catch (e: any) {
                  const createdAt = j.created_at || j.createdAt || new Date().toISOString();
                  const updatedAt = j.updated_at || j.updatedAt || createdAt;
                  return {
                    id: j.id,
                    type: j.type,
                    status: j.status,
                    progress: j.progress || { percent: j.percent, tasksComplete: j.tasksComplete, tasksTotal: j.tasksTotal },
                    created_at: createdAt,
                    updated_at: updatedAt,
                  };
                }
              }
              // For extended/single_system jobs, params are already in the job object from the list endpoint
              const createdAt = j.created_at || j.createdAt || new Date().toISOString();
              const updatedAt = j.updated_at || j.updatedAt || createdAt;
              return {
                id: j.id,
                type: j.type,
                status: j.status,
                progress: j.progress || { percent: j.percent, tasksComplete: j.tasksComplete, tasksTotal: j.tasksTotal },
                created_at: createdAt,
                updated_at: updatedAt,
                params: j.params || j.input || {}, // Use params from list endpoint
              };
            })
          );

          console.log('✅ Setting queueJobs:', jobsWithDetails.length, 'jobs');
          console.log('✅ Jobs with person names:', jobsWithDetails.filter((j: any) => j.params?.person1 || j.params?.person2).length);
          setQueueJobs(jobsWithDetails);
          setQueueJobsUpdatedAt(new Date().toISOString());
          setQueueJobsError(null); // Clear error on success
          clearTimeout(loadingWatchdog);
          setLoadingQueueJobs(false);

          const hasActiveJobs = jobsWithDetails.some((j: any) =>
            ['pending', 'queued', 'processing', 'claimed'].includes(String(j.status || '').toLowerCase())
          );
          setPolling(hasActiveJobs);
          queueFetchInFlightRef.current = false;
          return;
        } catch (apiError: any) {
          console.warn('⚠️ Backend API failed:', apiError?.message || apiError);
          if (mountedRef.current) {
            setQueueJobsError(`API Error: ${apiError.message || 'Unknown error'}`);
            clearTimeout(loadingWatchdog);
            setLoadingQueueJobs(false);
            setPolling(false);
            // Don't clear queueJobs - keep previous state on error
          }
        }

        // Fallback to Supabase direct query (needs auth)
        // Only try Supabase if configured; otherwise keep previous state
        if (!isSupabaseConfigured) {
          if (mountedRef.current) {
            console.warn('⚠️ [MyLibrary] Backend API failed and Supabase not configured - keeping previous jobs');
            setQueueJobsError('Backend API failed and Supabase not configured');
            clearTimeout(loadingWatchdog);
            setLoadingQueueJobs(false);
            // Don't clear queueJobs - keep previous state
          }
          queueFetchInFlightRef.current = false;
          return;
        }

        try {
          const { data, error } = await supabase
            .from('jobs')
            .select('id,type,status,progress,params,created_at,updated_at')
            .eq('user_id', userId)
            // Show full lifecycle so users can tell "what happened"
            .in('status', ['queued', 'pending', 'processing', 'complete', 'error'])
            .order('created_at', { ascending: false })
            .limit(12);

          if (error) throw error;
          if (!mountedRef.current) return;
          setQueueJobs(data || []);
          setQueueJobsUpdatedAt(new Date().toISOString());
          setQueueJobsError(null); // Clear error on success

          const hasActiveJobs = (data || []).some((j: any) =>
            ['pending', 'queued', 'processing', 'claimed'].includes(String(j.status || '').toLowerCase())
          );
          setPolling(hasActiveJobs);
        } catch (e: any) {
          // Don't block the library if this fails
          if (mountedRef.current) {
            setQueueJobsError(`Supabase Error: ${e.message || String(e)}`);
            setQueueJobsUpdatedAt(new Date().toISOString());
          }
        } finally {
          clearTimeout(loadingWatchdog);
          if (mountedRef.current) setLoadingQueueJobs(false);
          queueFetchInFlightRef.current = false;
        }
      };

      loadQueue();

      return () => {
        mountedRef.current = false;
        if (interval) clearInterval(interval);
      };
    }, [authUser?.id, queueRefreshKey])
  );

  // Persist job→person associations without updating state during render.
  // (Previously this happened inside `allPeopleWithReadings` useMemo, which triggered
  // "Cannot update a component while rendering a different component".)
  useEffect(() => {
    if (!Array.isArray(queueJobs) || queueJobs.length === 0) return;

    for (const job of queueJobs as any[]) {
      const jobId = job?.id;
      if (!jobId) continue;

      let params = job.params || job.input || {};
      if (typeof params === 'string') {
        try {
          params = JSON.parse(params);
        } catch {
          params = {};
        }
      }

      const peopleFromJob = [
        { id: params?.person1?.id, name: params?.person1?.name },
        { id: params?.person2?.id, name: params?.person2?.name },
      ].filter((p: any) => typeof p?.name === 'string' && p.name.trim().length > 0);

      for (const p of peopleFromJob as any[]) {
        // Prefer stable personId; fallback to name only when id is missing.
        const dedupeKey = p?.id ? `id:${p.id}:${jobId}` : `name:${p.name}:${jobId}`;
        if (linkedJobPairsRef.current.has(dedupeKey)) continue;
        linkedJobPairsRef.current.add(dedupeKey);

        if (typeof p?.id === 'string' && p.id.trim().length > 0) {
          linkJobToPerson(p.id, jobId);
        } else {
          linkJobToPersonByName(p.name, jobId);
        }
      }
    }
  }, [queueJobs, linkJobToPerson, linkJobToPersonByName]);

  // Load nuclear_v2 job artifacts to determine which systems have readings
  useEffect(() => {
    const loadNuclearArtifacts = async () => {
      if (!isSupabaseConfigured) return;

      const isDevUser = !authUser?.id || authUser?.id?.startsWith('dev-');
      const userId = isDevUser ? '00000000-0000-0000-0000-000000000001' : authUser?.id;
      if (!userId) return;

      try {
        // Fetch nuclear_v2 jobs (completed ones only for artifacts - processing jobs won't have artifacts yet)
        const jobs = await fetchNuclearJobs();
        const completedNuclearJobs = jobs.filter(
          (j) => ((j as any).status === 'complete' || (j as any).status === 'completed') && j.type === 'nuclear_v2'
        );
        // For each job, fetch artifacts and extract system info
        const artifactsByPerson: Record<string, Array<{ system?: string; docType?: string }>> = {};

        for (const job of completedNuclearJobs) {
          const artifacts = await fetchJobArtifacts(job.id, ['text']);
          const jobParams = (job as any).params;
          const person1Id = jobParams?.person1?.name || 'user';
          const person2Id = jobParams?.person2?.name || 'partner';

          // Extract system from artifact metadata
          artifacts.forEach(artifact => {
            const system = artifact.metadata?.system;
            const docType = (artifact.metadata as any)?.docType ||
              (artifact.metadata?.docNum ?
                (Number(artifact.metadata.docNum) <= 5 ? 'person1' :
                  Number(artifact.metadata.docNum) <= 10 ? 'person2' : 'overlay') :
                undefined);

            if (system && docType) {
              const personId = docType === 'person1' ? person1Id : docType === 'person2' ? person2Id : 'overlay';
              if (!artifactsByPerson[personId]) {
                artifactsByPerson[personId] = [];
              }
              if (!artifactsByPerson[personId].some(a => a.system === system)) {
                artifactsByPerson[personId].push({ system, docType });
              }
            }
          });
        }

        setNuclearJobArtifacts(artifactsByPerson);
      } catch (error) {
        console.error('Error loading nuclear artifacts:', error);
      }
    };

    loadNuclearArtifacts();
  }, [authUser?.id, queueJobs]);

  const hookReadings = useOnboardingStore((state) => state.hookReadings);
  const onboardingBirthDate = useOnboardingStore((state) => state.birthDate);
  const birthTime = useOnboardingStore((state) => state.birthTime);
  const birthCity = useOnboardingStore((state) => state.birthCity);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);

  // Derived data - compute user from people array
  const user = useMemo(() => people.find((p) => p.isUser), [people]);
  const authDisplayName = useAuthStore((s) => s.displayName);
  // User name fallback (avoid generic "User" when possible)
  const userName = user?.name || authDisplayName || 'User';

  // Explicit type for the merged person object
  interface LibraryPerson {
    id: string;
    name: string;
    isUser: boolean;
    birthData: any;
    placements: any;
    readings: any[];
    createdAt: string;
    jobIds: string[];
  }

  // Collect ALL people who have readings from ANY source:
  // Library overview rule (Audible model):
  // A card exists iff at least one job was initiated for that person/couple.
  // This screen must NOT show profile-only people without jobs.
  const allPeopleWithReadings = useMemo<LibraryPerson[]>(() => {
    const peopleMap = new Map<string, LibraryPerson>();

    const personKey = (p: { id?: string; name?: string } | null | undefined) => {
      const id = p?.id;
      if (typeof id === 'string' && id.trim().length > 0) return id;
      const name = p?.name;
      if (typeof name === 'string' && name.trim().length > 0) return name;
      return null;
    };

    // IMPORTANT: Always process newest jobs first so `person.jobIds[0]` is the most recent receipt.
    // This prevents picking an older job (which may have missing artifacts) and showing greyed-out audio.
    const queueJobsNewestFirst = [...queueJobs].sort((a: any, b: any) => {
      const ta = new Date(a?.created_at || a?.createdAt || 0).getTime();
      const tb = new Date(b?.created_at || b?.createdAt || 0).getTime();
      return tb - ta;
    });

    // 1. (Legacy) Debug logs only
    console.log('📊 [MyLibrary] Total queueJobs:', queueJobs.length);
    console.log('📊 [MyLibrary] Job types:', queueJobs.map((j: any) => `${j.type}(${j.status})`).join(', '));

    // Add people from job receipts (person1/person2) - include processing jobs.
    queueJobsNewestFirst
      .filter((j: any) =>
        (j.type === 'nuclear_v2' || j.type === 'synastry' || j.type === 'extended' || j.type === 'single_system') &&
        (j.status === 'complete' || j.status === 'completed' || j.status === 'processing' || j.status === 'pending' || j.status === 'queued')
      )
      .forEach((job: any) => {
        console.log('🔍 [MyLibrary] Processing extended job:', {
          id: job.id,
          type: job.type,
          status: job.status,
          hasParams: !!job.params,
          hasInput: !!job.input,
          paramsType: typeof job.params,
          inputType: typeof job.input,
        });

        let params = job.params || job.input || {};
        if (typeof params === 'string') {
          try {
            params = JSON.parse(params);
          } catch {
            params = {};
          }
        }

        console.log('🔍 [MyLibrary] Parsed params:', {
          hasPerson1: !!params.person1,
          person1Name: params.person1?.name,
          person1Keys: params.person1 ? Object.keys(params.person1) : [],
        });

        // For processing/pending/queued jobs, use a fallback name if person name is missing
        const isProcessing = job.status === 'processing' || job.status === 'pending' || job.status === 'queued';
        const p1Name = params.person1?.name || (isProcessing ? `Reading ${job.id.slice(0, 8)}` : undefined);
        const p2Name = params.person2?.name || (isProcessing && params.person2 ? 'Partner' : undefined);
        const p1Id = params.person1?.id;
        const p2Id = params.person2?.id;

        console.log('🔍 [MyLibrary] Final p1Name:', p1Name, 'from params.person1?.name:', params.person1?.name);

        const requestedSystemsRaw = params.systems || job?.params?.systems || job?.input?.systems;
        const requestedSystems: string[] = Array.isArray(requestedSystemsRaw)
          ? requestedSystemsRaw.map((s: any) => String(s).toLowerCase()).filter(Boolean)
          : [];

        // Add person1 - deduplicate by stable id first, merge jobIds
        if (p1Name) {
          const libMatch = p1Id ? libraryPeopleById[p1Id] : undefined;
          const storeMatch =
            libMatch ||
            (p1Id ? people.find((sp) => sp?.id === p1Id) : undefined) ||
            people.find((sp) => sp?.name === p1Name) ||
            (p1Name === userName ? user : undefined);
          const storePlacements = storeMatch?.placements || {};
          const storeBirthData = storeMatch?.birthData || {};
          const p1Key = (storeMatch?.id || p1Id || p1Name) as string;

          const existing = peopleMap.get(p1Key);
          if (existing) {
            // Merge jobIds if person already exists
            existing.jobIds = [...new Set([...(existing.jobIds || []), job.id])];
            // Also keep the stable id if this entry was previously name-keyed
            if (p1Id && existing.id !== p1Id && (!existing.id || existing.id === p1Name)) {
              existing.id = p1Id;
            }
            // Prefer real placements from store if available
            if (!existing.placements?.sunSign && (storePlacements as any)?.sunSign) {
              existing.placements = storePlacements as any;
            }
            // Prefer richer birth data from store if available
            if (!existing.birthData?.birthDate && (storeBirthData as any)?.birthDate) {
              existing.birthData = storeBirthData as any;
            }
          } else {
            // Create placeholder readings based on job type
            const isOverlay = job.type === 'overlay' || job.type === 'compatibility';
            const systems =
              requestedSystems.length > 0
                ? requestedSystems
                : isOverlay
                  ? ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict']
                  : ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
            
            const placeholderReadings = systems.map((system, index) => ({
              id: `reading-${index + 1}`,
              system: system,
              name: system === 'western' ? 'Western Astrology'
                  : system === 'vedic' ? 'Vedic (Jyotish)'
                  : system === 'human_design' ? 'Human Design'
                  : system === 'gene_keys' ? 'Gene Keys'
                  : system === 'kabbalah' ? 'Kabbalah'
                  : 'Final Verdict',
              // No paths yet - readings are inactive until artifacts are generated
              pdfPath: undefined,
              audioPath: undefined,
              songPath: undefined,
            }));

            peopleMap.set(p1Key, {
              // If the person already exists locally OR the job provides a client_person_id, keep it stable.
              id: storeMatch?.id || p1Id || `job-${job.id}-p1`,
              name: p1Name,
              isUser: !!storeMatch?.isUser || (!!selfPersonId && (p1Id === selfPersonId || storeMatch?.id === selfPersonId)),
              birthData: (Object.keys(storeBirthData || {}).length > 0 ? storeBirthData : (params.person1 || {})),
              placements: (Object.keys(storePlacements || {}).length > 0 ? storePlacements : {}),
              readings: placeholderReadings,
              createdAt: job.created_at || job.createdAt || new Date().toISOString(),
              jobIds: [job.id],
            });
          }
        }

        // Add person2 - deduplicate by name, merge jobIds
        if (p2Name) {
          const libMatch = p2Id ? libraryPeopleById[p2Id] : undefined;
          const storeMatch =
            libMatch ||
            (p2Id ? people.find((sp) => sp?.id === p2Id) : undefined) ||
            people.find((sp) => sp?.name === p2Name) ||
            (p2Name === userName ? user : undefined);
          const storePlacements = storeMatch?.placements || {};
          const storeBirthData = storeMatch?.birthData || {};
          const p2Key = (storeMatch?.id || p2Id || p2Name) as string;

          const existing = peopleMap.get(p2Key);
          if (existing) {
            // Merge jobIds if person already exists
            existing.jobIds = [...new Set([...(existing.jobIds || []), job.id])];
            if (p2Id && existing.id !== p2Id && (!existing.id || existing.id === p2Name)) {
              existing.id = p2Id;
            }
            if (!existing.placements?.sunSign && (storePlacements as any)?.sunSign) {
              existing.placements = storePlacements as any;
            }
            if (!existing.birthData?.birthDate && (storeBirthData as any)?.birthDate) {
              existing.birthData = storeBirthData as any;
            }
          } else {
            // Create placeholder readings based on job type
            const isOverlay = job.type === 'overlay' || job.type === 'compatibility';
            const systems =
              requestedSystems.length > 0
                ? requestedSystems
                : isOverlay
                  ? ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict']
                  : ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
            
            const placeholderReadings = systems.map((system, index) => ({
              id: `reading-${index + 1}`,
              system: system,
              name: system === 'western' ? 'Western Astrology'
                  : system === 'vedic' ? 'Vedic (Jyotish)'
                  : system === 'human_design' ? 'Human Design'
                  : system === 'gene_keys' ? 'Gene Keys'
                  : system === 'kabbalah' ? 'Kabbalah'
                  : 'Final Verdict',
              // No paths yet - readings are inactive until artifacts are generated
              pdfPath: undefined,
              audioPath: undefined,
              songPath: undefined,
            }));

            peopleMap.set(p2Key, {
              id: storeMatch?.id || p2Id || `job-${job.id}-p2`,
              name: p2Name,
              isUser: !!storeMatch?.isUser || (!!selfPersonId && (p2Id === selfPersonId || storeMatch?.id === selfPersonId)),
              birthData: (Object.keys(storeBirthData || {}).length > 0 ? storeBirthData : (params.person2 || {})),
              placements: (Object.keys(storePlacements || {}).length > 0 ? storePlacements : {}),
              readings: placeholderReadings,
              createdAt: job.created_at || job.createdAt || new Date().toISOString(),
              jobIds: [job.id],
            });
          }
        }
      });

    // Convert to array and sort by recency only (newest first).
    let result = Array.from(peopleMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // Hard guarantee for this screen: no job receipt => no card.
    result = result.filter((p) => Array.isArray(p.jobIds) && p.jobIds.length > 0);

    // NOTE: Paid reading filter disabled for now
    // The has_paid_reading flag in Supabase wasn't being set correctly for existing jobs
    // TODO: Re-enable when backfill is complete
    // if (paidPeopleNames.size > 0) {
    //   result = result.filter(person => paidPeopleNames.has(person.name));
    // }
    console.log('📊 [MyLibrary] Showing all people with jobs (paid filter disabled)');

    // NOTE: Placements filter disabled for debugging
    // Was hiding people without sunSign calculated
    // TODO: Re-enable once placements are working correctly
    // result = result.filter(person => {
    //   if (person.placements?.sunSign) return true;
    //   return false;
    // });
    console.log('📊 [MyLibrary] Placements filter disabled for debugging');

    console.log('📊 [MyLibrary] Final peopleMap size:', peopleMap.size);
    console.log('📊 [MyLibrary] People names:', Array.from(peopleMap.keys()).join(', '));
    console.log('📊 [MyLibrary] After placements filter:', result.length);

    return result;
  }, [queueJobs, people, userName, user, libraryPeopleById, paidPeopleNames]);

  // Map jobId -> job params so we can determine whether a person was person1 or person2 for a given job.
  // This avoids incorrect heuristics like "non-user == person2" (e.g. Eva can be person1).
  const jobIdToParams = useMemo(() => {
    const m = new Map<string, any>();
    for (const j of queueJobs as any[]) {
      const jobId = j?.id;
      if (!jobId) continue;

      let raw = (j as any)?.params ?? (j as any)?.input ?? null;
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = null;
        }
      }
      if (raw && typeof raw === 'object') m.set(jobId, raw);
    }
    return m;
  }, [queueJobs]);

  const hasUserReadings = useMemo(() => {
    return allPeopleWithReadings.some((p) => p.isUser || (!!selfPersonId && p.id === selfPersonId));
  }, [allPeopleWithReadings, selfPersonId]);

  const partners = useMemo(() => {
    return allPeopleWithReadings.filter((p) => !p.isUser && !(selfPersonId && p.id === selfPersonId));
  }, [allPeopleWithReadings, selfPersonId]);

  const userReadings = useMemo(() => user?.readings || [], [user]);

  // Known test user data (from repo rules) - REMOVED
  const getKnownUserData = (name: string) => null;

  const seedPeople = useCallback(
    (label: string, seeds: Array<Omit<Person, 'id' | 'createdAt' | 'updatedAt' | 'readings'>>) => {
      const added: string[] = [];
      const updated: string[] = [];
      for (const s of seeds) {
        // Upsert by identity (name + birthDate + timezone) so we can fix placeholder birth times
        // without creating duplicates.
        const match = partners.find(
          (p) =>
            p.name === s.name &&
            p.birthData.birthDate === s.birthData.birthDate &&
            p.birthData.timezone === s.birthData.timezone
        );

        if (match) {
          const needsBirthUpdate =
            match.birthData.birthTime !== s.birthData.birthTime ||
            match.birthData.birthCity !== s.birthData.birthCity ||
            match.birthData.latitude !== s.birthData.latitude ||
            match.birthData.longitude !== s.birthData.longitude;

          const hasPlacementsUpdate = !!s.placements;

          if (needsBirthUpdate || hasPlacementsUpdate) {
            updatePerson(match.id, {
              birthData: s.birthData,
              // If birth time changed, any saved placements are now unreliable.
              placements: match.birthData.birthTime !== s.birthData.birthTime ? undefined : (s.placements ?? match.placements),
            });
            updated.push(s.name);
          }
          continue;
        }

        addPerson(s);
        added.push(s.name);
      }

      if (added.length === 0 && updated.length === 0) {
        Alert.alert('Already added', `${label} are already in your People list.`);
        return;
      }

      const parts: string[] = [];
      if (added.length) parts.push(`Added: ${added.join(' + ')}`);
      if (updated.length) parts.push(`Updated: ${updated.join(' + ')}`);
      Alert.alert('Saved', parts.join('\n'));
    },
    [addPerson, partners, updatePerson]
  );

  const seedMichaelAndCharmaine = useCallback(() => {
    // Removed
  }, []);

  const seedStasAndShofia = useCallback(() => {
    // NOTE: Birth times were not provided by Michael; we store a placeholder time so they show up in the Library.
    // This is fine for visual database testing; for accurate astrology, birth time must be corrected later.
    seedPeople('Stas and Shofia', [
      {
        name: 'Stas',
        isUser: false,
        birthData: {
          birthDate: '1974-09-20',
          birthTime: '01:30',
          birthCity: 'Tambov, Russia',
          timezone: 'Europe/Moscow',
          latitude: 52.7212,
          longitude: 41.4523,
        },
      },
      {
        name: 'Shofia',
        isUser: false,
        birthData: {
          birthDate: '1996-09-26',
          birthTime: '08:00',
          birthCity: 'Bekasi, Indonesia',
          timezone: 'Asia/Jakarta',
          latitude: -6.2383,
          longitude: 106.9756,
        },
      },
    ]);
  }, [seedPeople]);

  const seedLucaAndMartina = useCallback(() => {
    seedPeople('Luca and Martina', [
      {
        name: 'Luca',
        isUser: false,
        birthData: {
          birthDate: '1958-07-01',
          birthTime: '10:30',
          birthCity: 'Bologna, Italy',
          timezone: 'Europe/Rome',
          latitude: 44.4949,
          longitude: 11.3426,
        },
      },
      {
        name: 'Martina',
        isUser: false,
        birthData: {
          birthDate: '1955-05-06',
          birthTime: '12:00',
          birthCity: 'Falun, Sweden',
          timezone: 'Europe/Stockholm',
          latitude: 60.6065,
          longitude: 15.6355,
        },
      },
    ]);
  }, [seedPeople]);

  const seedIyaAndJonathan = useCallback(() => {
    seedPeople('Iya and Jonathan', [
      {
        name: 'Iya',
        isUser: false,
        birthData: {
          birthDate: '1998-03-24',
          birthTime: '10:45',
          birthCity: 'Tagum, Davao, Philippines',
          timezone: 'Asia/Manila',
          latitude: 7.4472,
          longitude: 125.8074,
        },
      },
      {
        name: 'Jonathan',
        isUser: false,
        birthData: {
          birthDate: '1987-11-08',
          birthTime: '10:44',
          birthCity: 'London, United Kingdom',
          timezone: 'Europe/London',
          latitude: 51.5074,
          longitude: -0.1278,
        },
      },
    ]);
  }, [seedPeople]);

  const seedEvaAndFabrice = useCallback(() => {
    seedPeople('Eva and Fabrice', [
      {
        name: 'Eva',
        isUser: false,
        birthData: {
          birthDate: '1974-07-09',
          birthTime: '04:15',
          birthCity: 'Jaffa (Tel Aviv), Israel',
          timezone: 'Asia/Jerusalem',
          latitude: 32.0540,
          longitude: 34.7498,
        },
      },
      {
        name: 'Fabrice Renaudin',
        isUser: false,
        birthData: {
          birthDate: '1972-04-26',
          birthTime: '08:00',
          birthCity: 'Aix-en-Provence, France',
          timezone: 'Europe/Paris',
          latitude: 43.5297,
          longitude: 5.4474,
        },
      },
    ]);
  }, [seedPeople]);

  const generateNuclearForIyaAndJonathan = useCallback(() => {
    const iya = partners.find((p) => p.name === 'Iya');
    const jon = partners.find((p) => p.name === 'Jonathan');
    if (!iya || !jon) {
      Alert.alert('Missing people', 'First tap “Add Iya + Jonathan (test)” to add them to your People list.');
      return;
    }

    // Do NOT route into ReadingOverview anymore. Start job and jump directly to the finished view.
    navigation.navigate('SystemSelection', {
      readingType: 'overlay',
      forPartner: false,
      userName: iya.name,
      partnerName: jon.name,
      partnerBirthDate: jon.birthData.birthDate,
      partnerBirthTime: jon.birthData.birthTime,
      partnerBirthCity: {
        id: 'unknown',
        country: 'Unknown',
        name: jon.birthData.birthCity,
        latitude: jon.birthData.latitude,
        longitude: jon.birthData.longitude,
        timezone: jon.birthData.timezone,
      },
    });
  }, [navigation, partners]);

  // Group readings by system
  const readingsBySystem = useMemo(() => {
    const grouped: Record<ReadingSystem, Reading[]> = {
      western: [],
      vedic: [],
      human_design: [],
      gene_keys: [],
      kabbalah: [],
    };
    userReadings.forEach((r) => {
      if (grouped[r.system]) {
        grouped[r.system].push(r);
      }
    });
    return grouped;
  }, [userReadings]);

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const birthDate = user?.birthData?.birthDate?.trim()
    ? user.birthData.birthDate
    : onboardingBirthDate;

  // Render the profile summary card
  const renderProfileCard = () => (
    <TouchableOpacity
      style={styles.profileCard}
      onPress={() => navigation.navigate('YourChart')}
      activeOpacity={0.8}
    >
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>
            {(hookReadings.sun?.sign)?.charAt(0) || '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} selectable>Your Chart</Text>
          <Text style={styles.profileDate} selectable>
            {birthDate ? formatDate(birthDate) : 'Birth date not set'}
          </Text>
          <View style={styles.signsRow}>
            <Text style={styles.signBadge}>☉ {hookReadings.sun?.sign || '?'}</Text>
            <Text style={styles.signBadge}>☽ {hookReadings.moon?.sign || '?'}</Text>
            <Text style={styles.signBadge}>↑ {hookReadings.rising?.sign || '?'}</Text>
          </View>
        </View>
        <Text style={styles.profileArrow}>→</Text>
      </View>

      {user?.isVerified && (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✓ Verified</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render tab navigation
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['my_karma', 'their_karma', 'shared_karma'] as TabType[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'my_karma' && 'My Karma'}
            {tab === 'their_karma' && 'Their Karma'}
            {tab === 'shared_karma' && 'Shared Karma'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderActivitySection = () => {
    // Always show activity section - we fetch from backend API which works without auth
    // (uses test user ID 00000000-0000-0000-0000-000000000001 as fallback)

    const activeCount = queueJobs.filter((j) => j.status === 'pending' || j.status === 'processing').length;
    const errorCount = queueJobs.filter((j) => j.status === 'error').length;

    // If nothing is happening and we're not loading, keep it hidden (users don't need extra chrome).
    if (!loadingQueueJobs && queueJobs.length === 0) return null;

    const formatRelative = (iso: string | null) => {
      if (!iso) return '';
      const ms = Date.now() - Date.parse(iso);
      if (!Number.isFinite(ms)) return '';
      const s = Math.max(0, Math.floor(ms / 1000));
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      return `${h}h ago`;
    };

    const prettyJobTitle = (j: any) => {
      if (j?.type === 'nuclear_v2') {
        const p1 = j?.input?.person1?.name || 'Person 1';
        const p2 = j?.input?.person2?.name || 'Person 2';
        return `Soul Journey Audiobook · ${p1} + ${p2}`;
      }
      return String(j?.type || 'Job');
    };

    const prettyProgress = (j: any) => {
      const total = j?.progress?.totalTasks;
      const done = j?.progress?.completedTasks;
      if (typeof total === 'number' && total > 0) {
        return `${typeof done === 'number' ? done : 0}/${total}`;
      }
      const pct = j?.progress?.percent;
      if (typeof pct === 'number') return `${Math.round(pct)}%`;
      return '';
    };

    return (
      <View style={styles.section}>
        <View style={styles.activityHeaderRow}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <Text style={styles.activityMeta}>
            {loadingQueueJobs
              ? 'Updating…'
              : `${activeCount} running${errorCount ? ` · ${errorCount} error` : ''}${queueJobsUpdatedAt ? ` · ${formatRelative(queueJobsUpdatedAt)}` : ''}`}
          </Text>
        </View>

        <View style={styles.activityCard}>
          {queueJobs.slice(0, 6).map((j) => (
            <TouchableOpacity
              key={j.id}
              style={styles.activityRow}
              activeOpacity={0.7}
              onLongPress={() => {
                if (!__DEV__) return;
                const msg = [
                  '1 IN A BILLION — Job Debug Receipt',
                  `jobId: ${j.id}`,
                  `type: ${String(j?.type || '')}`,
                  `status: ${String(j?.status || '')}`,
                  `progress: ${prettyProgress(j) || ''}`,
                  `api: ${env.CORE_API_URL}`,
                ]
                  .filter(Boolean)
                  .join('\n');
                Share.share({ message: msg }).catch(() => {
                  Alert.alert('Share Error', 'Could not share debug info.');
                });
              }}
              onPress={() => {
                if (j?.type === 'nuclear_v2') {
                  navigation.navigate('PersonReadings', {
                    personName: (j as any).params?.person1?.name || 'Unknown',
                    personId: (j as any).params?.person1?.id,
                    personType: 'person1',
                    jobId: j.id,
                  });
                  return;
                }
                navigation.navigate('JobDetail', { jobId: j.id });
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {prettyJobTitle(j)}
                </Text>
                <Text style={styles.activitySubtitle} numberOfLines={1}>
                  {j.status === 'error' ? 'Error — tap for details' : j.status === 'pending' ? 'Queued' : j.status === 'complete' || j.status === 'completed' ? '✓ Complete — tap to view' : 'Processing'}
                  {prettyProgress(j) ? ` · ${prettyProgress(j)}` : ''}
                </Text>
              </View>
              <Text style={styles.activityArrow}>→</Text>
            </TouchableOpacity>
          ))}

          {queueJobs.length > 6 && (
            <Text style={styles.activityMoreText}>
              +{queueJobs.length - 6} more…
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render readings tab content - Designed summary (latest per system + optional history)
  const renderReadingsTab = () => {
    // Combine hook readings and full readings into one list
    const allReadings: { id: string; type: string; sign: string; intro: string; date: string; icon: string }[] = [];

    // Add hook readings (Sun, Moon, Rising)
    if (hookReadings.sun) {
      allReadings.push({
        id: 'hook-sun',
        type: 'Sun Sign',
        sign: hookReadings.sun.sign,
        intro: hookReadings.sun.intro?.substring(0, 80) + '...' || '',
        date: 'Your core identity',
        icon: '☉',
      });
    }
    if (hookReadings.moon) {
      allReadings.push({
        id: 'hook-moon',
        type: 'Moon Sign',
        sign: hookReadings.moon.sign,
        intro: hookReadings.moon.intro?.substring(0, 80) + '...' || '',
        date: 'Your emotional core',
        icon: '☽',
      });
    }
    if (hookReadings.rising) {
      allReadings.push({
        id: 'hook-rising',
        type: 'Rising Sign',
        sign: hookReadings.rising.sign,
        intro: hookReadings.rising.intro?.substring(0, 80) + '...' || '',
        date: 'Your outward self',
        icon: '↑',
      });
    }

    // Show latest per system (deep readings)
    const bySystem = new Map<string, (typeof userReadings)[number][]>();
    userReadings.forEach((r) => {
      const arr = bySystem.get(r.system) || [];
      arr.push(r);
      bySystem.set(r.system, arr);
    });
    for (const [sys, arr] of bySystem.entries()) {
      arr.sort((a, b) => (Date.parse(b.generatedAt) || 0) - (Date.parse(a.generatedAt) || 0));
      const latest = arr[0];
      if (!latest) continue;
      const systemInfo = SYSTEM_INFO[sys as ReadingSystem];
      allReadings.push({
        id: latest.id,
        type: `${systemInfo?.name || sys} Reading`,
        sign: 'Full Reading',
        intro: latest.content?.substring(0, 80) + '...' || '',
        date: `${formatDate(latest.generatedAt)}${arr.length > 1 ? ` · +${arr.length - 1} more` : ''}`,
        icon: systemInfo?.icon || '★',
      });
    }

    return (
      <View style={styles.tabContent}>
        {/* Activity section - show completed cloud jobs */}
        {renderActivitySection()}

        {allReadings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>■</Text>
            <Text style={styles.emptyTitle}>No readings yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete onboarding to get your first readings
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionHeader}>
              {allReadings.length} Reading{allReadings.length !== 1 ? 's' : ''}
            </Text>

            {allReadings.map((reading) => (
              <ReadingCard
                key={reading.id}
                reading={reading}
                onPress={() => {
                  // Navigate to reading detail (or replay for hook readings)
                  if (reading.id.startsWith('hook-')) {
                    navigation.navigate('HookSequence');
                  } else if (user?.id) {
                    navigation.navigate('SavedReading', { personId: user.id, readingId: reading.id });
                  }
                }}
              />
            ))}
          </>
        )}
      </View>
    );
  };

  // Render people tab content
  const renderPeopleTab = () => (
    <View style={styles.tabContent}>
      {partners.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>●</Text>
          <Text style={styles.emptyTitle}>No people added yet</Text>
          <Text style={styles.emptySubtitle}>
            Add someone to compare charts and get compatibility readings
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('PartnerInfo')}
          >
            <Text style={styles.emptyButtonText}>+ Add Someone</Text>
          </TouchableOpacity>

        </View>
      ) : (
        <>
          <Text style={styles.sectionHeader}>
            {partners.length} Soul{partners.length !== 1 ? 's' : ''}
          </Text>
          {partners.map((person) => (
            <TouchableOpacity
              key={person.id}
              style={styles.personCard}
              onPress={() => {
                const jobId = person.jobIds?.[0];
                if (!jobId) return;
                const job = queueJobs.find((j: any) => j.id === jobId);
                const isExtendedJob = job?.type === 'extended' || job?.type === 'single_system';
                let personType: 'individual' | 'person1' | 'person2' = isExtendedJob ? 'individual' : 'person1';
                if (!isExtendedJob) {
                  const p = jobIdToParams.get(jobId);
                  const fromJob =
                    (p?.person1?.id && p.person1.id === person.id)
                      ? 'person1'
                      : (p?.person2?.id && p.person2.id === person.id)
                        ? 'person2'
                        : (p?.person1?.name === person.name)
                          ? 'person1'
                          : (p?.person2?.name === person.name)
                            ? 'person2'
                            : null;
                  personType = (fromJob || 'person1') as any;
                }
                navigation.navigate('PersonReadings', {
                  personName: person.name,
                  personId: person.id,
                  personType,
                  jobId,
                });
              }}
            >
              <View style={styles.personAvatar}>
                <Text style={styles.personInitial}>{person.name.charAt(0)}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.personDate}>
                  Born {person.birthData?.birthDate ? formatDate(person.birthData.birthDate) : 'Unknown'}
                </Text>
                {person.placements && (
                  <View style={styles.personSigns}>
                    <Text style={styles.personSignBadge}>☉ {person.placements.sunSign}</Text>
                    <Text style={styles.personSignBadge}>☽ {person.placements.moonSign}</Text>
                  </View>
                )}
              </View>
              {person.readings.length > 0 && (
                <View style={styles.personStats}>
                  <Text style={styles.personStatNumber}>{person.readings.length}</Text>
                  <Text style={styles.personStatLabel}>readings</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

        </>
      )}
    </View>
  );

  // Format duration (seconds to MM:SS)
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time for audio playback (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get first audio for a person
  const getPersonAudio = (personId: string): SavedAudio | null => {
    const personAudios = savedAudios.filter((audio: any) => audio.personId === personId);
    return personAudios.length > 0 ? personAudios[0] : null;
  };

  // Delete person with deep deletion (jobs, tasks, artifacts, storage files)
  const handleDeletePerson = async (person: Person, event: GestureResponderEvent) => {
    event.stopPropagation(); // Prevent card navigation
    
    // Don't allow deleting the user themselves
    if (person.isUser) {
      Alert.alert('Cannot Delete', 'You cannot delete your own profile.');
      return;
    }

    Alert.alert(
      'Delete Person',
      `Are you sure you want to delete "${person.name}" and all their readings?\n\nThis will permanently delete:\n• All jobs and readings\n• All PDFs and audio files\n• All data from Supabase\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!authUser?.id) {
              Alert.alert('Error', 'You must be signed in to delete.');
              return;
            }

            try {
              console.log(`🗑️ Deleting person "${person.name}" (${person.id})...`);
              
              // Delete from Supabase (deep deletion via backend)
              const result = await deletePersonFromSupabase(authUser.id, person.id);
              
              if (!result.success) {
                Alert.alert('Delete Failed', result.error || 'Failed to delete person. Please try again.');
                return;
              }

              console.log(`✅ Deleted: ${result.deletedJobs || 0} jobs, ${result.deletedFiles || 0} files`);
              
              // Remove from local store
              deletePerson(person.id);
              
              // Refresh data
              setQueueRefreshKey(prev => prev + 1);
              
              // Refresh paid people list
              if (authUser.id) {
                fetchPeopleWithPaidReadings(authUser.id).then(paidPeople => {
                  const names = new Set(paidPeople.map(p => p.name));
                  setPaidPeopleNames(names);
                }).catch(() => {});
              }
              
              Alert.alert('Deleted', `"${person.name}" and all their data have been permanently deleted.`);
            } catch (error: any) {
              console.error('❌ Delete error:', error);
              Alert.alert('Error', error.message || 'Failed to delete person. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Delete job (for couple/overlay cards)
  const handleDeleteJob = async (jobId: string, displayName: string, event: GestureResponderEvent) => {
    event.stopPropagation(); // Prevent card navigation

    Alert.alert(
      'Delete Reading',
      `Are you sure you want to delete this reading for "${displayName}"?\n\nThis will permanently delete:\n• The job and all tasks\n• All PDFs and audio files\n• All artifacts from Supabase\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!authUser?.id) {
              Alert.alert('Error', 'You must be signed in to delete.');
              return;
            }

            try {
              console.log(`🗑️ Deleting job "${jobId}"...`);
              
              // Get Supabase access token
              const {
                data: { session },
                error: sessionError,
              } = await supabase.auth.getSession();

              const accessToken = session?.access_token;
              if (sessionError || !accessToken) {
                Alert.alert('Error', 'Missing session. Please sign in again.');
                return;
              }

              const coreApiUrl = (process.env.EXPO_PUBLIC_CORE_API_URL || env.CORE_API_URL || '').trim();
              if (!coreApiUrl) {
                Alert.alert('Error', 'CORE_API_URL not configured');
                return;
              }

              // Delete job via backend API
              const res = await fetch(`${coreApiUrl}/api/jobs/v2/${encodeURIComponent(jobId)}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              });

              const data = await res.json().catch(() => null);

              if (!res.ok || !data?.success) {
                const errMsg = data?.error || `Delete failed (HTTP ${res.status})`;
                Alert.alert('Delete Failed', errMsg);
                return;
              }

              console.log(`✅ Job "${jobId}" deleted`);
              
              // Refresh data
              setQueueRefreshKey(prev => prev + 1);
              
              Alert.alert('Deleted', `Reading for "${displayName}" has been permanently deleted.`);
            } catch (error: any) {
              console.error('❌ Delete job error:', error);
              Alert.alert('Error', error.message || 'Failed to delete job. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Toggle play/pause for person card audio
  const togglePersonAudio = async (personId: string) => {
    const audio = getPersonAudio(personId);
    if (!audio) {
      Alert.alert('No audio', 'No audio available for this person yet.');
      return;
    }

    const currentSound = personAudioRefs.current[personId];

    try {
      // If this person's audio is playing, pause it
      if (playingPersonId === personId && currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await currentSound.pauseAsync();
          return;
        } else if (status.isLoaded) {
          await currentSound.playAsync();
          return;
        }
      }

      // Stop any other playing audio
      if (playingPersonId && playingPersonId !== personId) {
        const otherSound = personAudioRefs.current[playingPersonId];
        if (otherSound) {
          await otherSound.stopAsync();
          await otherSound.unloadAsync();
          delete personAudioRefs.current[playingPersonId];
        }
        setPlayingPersonId(null);
      }

      // Stop current if exists
      if (currentSound) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
        delete personAudioRefs.current[personId];
      }

      // Load and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audio.filePath },
        { shouldPlay: true }
      );
      personAudioRefs.current[personId] = sound;
      setPlayingPersonId(personId);
      setPlaybackPosition(0);

      // Listen for playback updates
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis / 1000);
          setPlaybackDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          if (status.didJustFinish) {
            setPlayingPersonId(null);
            delete personAudioRefs.current[personId];
          }
        }
      });
    } catch (error: any) {
      console.error('Error playing person audio:', error);
      Alert.alert('Error', 'Could not play audio');
      setPlayingPersonId(null);
      delete personAudioRefs.current[personId];
    }
  };

  // Toggle play/pause for overlay/compatibility audio
  const toggleOverlayAudio = async (overlayCardId: string, audioUrl: string) => {
    const currentSound = personAudioRefs.current[overlayCardId];

    try {
      // If this overlay's audio is playing, pause it
      if (playingPersonId === overlayCardId && currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await currentSound.pauseAsync();
          return;
        } else if (status.isLoaded) {
          await currentSound.playAsync();
          return;
        }
      }

      // Stop any other playing audio
      if (playingPersonId && playingPersonId !== overlayCardId) {
        const otherSound = personAudioRefs.current[playingPersonId];
        if (otherSound) {
          await otherSound.stopAsync();
          await otherSound.unloadAsync();
          delete personAudioRefs.current[playingPersonId];
        }
        setPlayingPersonId(null);
      }

      // Stop current if exists
      if (currentSound) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
        delete personAudioRefs.current[overlayCardId];
      }

      // Load and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      personAudioRefs.current[overlayCardId] = sound;
      setPlayingPersonId(overlayCardId);
      setPlaybackPosition(0);

      // Listen for playback updates
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis / 1000);
          setPlaybackDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          if (status.didJustFinish) {
            setPlayingPersonId(null);
            delete personAudioRefs.current[overlayCardId];
          }
        }
      });
    } catch (error: any) {
      console.error('Error playing overlay audio:', error);
      Alert.alert('Error', 'Could not play audio');
      setPlayingPersonId(null);
      delete personAudioRefs.current[overlayCardId];
    }
  };

  // Seek in person audio
  const seekPersonAudio = async (personId: string, positionSeconds: number) => {
    const sound = personAudioRefs.current[personId];
    if (sound && playingPersonId === personId) {
      try {
        await sound.setPositionAsync(positionSeconds * 1000);
        setPlaybackPosition(positionSeconds);
      } catch (e) {
        console.error('Seek error:', e);
      }
    }
  };

  // Handle seek start
  const handlePersonSeekStart = (personId: string) => {
    if (playingPersonId === personId) {
      setIsSeeking(true);
      setSeekPosition(playbackPosition);
    }
  };

  // Handle seek move
  const handlePersonSeekMove = (personId: string, locationX: number) => {
    if (!isSeeking || playingPersonId !== personId) return;
    const barWidth = progressBarWidths.current[personId] || 200;
    const clampedX = Math.max(0, Math.min(locationX, barWidth));
    const newPosition = (clampedX / barWidth) * playbackDuration;
    setSeekPosition(newPosition);
  };

  // Handle seek end
  const handlePersonSeekEnd = async (personId: string, locationX: number) => {
    if (!isSeeking || playingPersonId !== personId) {
      setIsSeeking(false);
      return;
    }
    const barWidth = progressBarWidths.current[personId] || 200;
    const clampedX = Math.max(0, Math.min(locationX, barWidth));
    const newPosition = (clampedX / barWidth) * playbackDuration;
    setIsSeeking(false);
    await seekPersonAudio(personId, newPosition);
  };

  // Handle audio playback
  const handlePlayAudio = async (audio: SavedAudio) => {
    try {
      // If this audio is already playing, stop it
      if (playingAudioId === audio.id) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingAudioId(null);
        return;
      }

      // Stop any currently playing audio
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Load and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audio.filePath },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlayingAudioId(audio.id);

      // Listen for playback completion
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Playback Error', 'Could not play this audio file.');
      setPlayingAudioId(null);
    }
  };

  // Handle audio share/export
  const handleShareAudio = async (audio: SavedAudio) => {
    try {
      if (audio.filePath.startsWith('http://') || audio.filePath.startsWith('https://')) {
        // Download-on-demand, then share
        const safeName = generateAudioFileName('library', undefined, audio.system, 'solo');
        const localUri = await downloadAudioFromUrl(audio.filePath, safeName);
        await shareAudioFile(localUri, audio.title);
        Alert.alert('Downloaded', 'Audio was downloaded and is ready to save/share.');
        return;
      }
      await shareAudioFile(audio.filePath, audio.title);
    } catch (error) {
      console.error('Error sharing audio:', error);
      Alert.alert('Share Error', 'Could not share this audio file.');
    }
  };

  // Render audio tab content
  const renderAudioTab = () => (
    <View style={styles.tabContent}>
      {savedAudios.length === 0 ? (
        // Empty state - simple, no sales pitch
        <View style={styles.emptyStateCompact}>
          <Text style={styles.emptyIcon}>▶</Text>
          <Text style={styles.emptyTitle}>No saved audio yet</Text>
          <Text style={styles.emptySubtitle}>
            Audio from your readings will appear here
          </Text>
        </View>
      ) : (
        // Audio list
        <>
          <Text style={styles.sectionHeader}>
            {savedAudios.length} Audio{savedAudios.length !== 1 ? 's' : ''} Saved
          </Text>

          {savedAudios.map((audio) => {
            const systemInfo = SYSTEM_INFO[audio.system] || SYSTEM_INFO.western;
            const isRemote = audio.filePath.startsWith('http://') || audio.filePath.startsWith('https://');

            return (
              <View key={audio.id} style={styles.audioCard}>
                <View style={styles.audioCardHeader}>
                  <View style={[styles.audioSystemBadge, { backgroundColor: systemInfo.color + '20' }]}>
                    <Text style={[styles.audioSystemIcon, { color: systemInfo.color }]}>
                      {systemInfo.icon}
                    </Text>
                  </View>
                  <View style={styles.audioCardInfo}>
                    <Text style={styles.audioCardTitle} numberOfLines={1}>{audio.title}</Text>
                    <Text style={styles.audioCardMeta}>
                      {formatDuration(audio.durationSeconds)} • {audio.fileSizeMB.toFixed(1)}MB
                    </Text>
                    <Text style={styles.audioCardDate}>
                      Saved {formatDate(audio.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.audioCardActions}>
                  <TouchableOpacity
                    style={[styles.audioActionButton, isRemote && { opacity: 0.4 }]}
                    onPress={() => handleShareAudio(audio)}
                  >
                    <Text style={styles.audioActionIcon}>↓</Text>
                    <Text style={styles.audioActionText}>{isRemote ? 'Export' : 'Export'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.audioActionButton}
                    onPress={() => handlePlayAudio(audio)}
                  >
                    <Text style={styles.audioActionIcon}>{playingAudioId === audio.id ? '⏸' : '▶'}</Text>
                    <Text style={styles.audioActionText}>{playingAudioId === audio.id ? 'Pause' : 'Play'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.audioActionButton, styles.audioActionDelete]}
                    onPress={() => deleteSavedAudio(audio.id)}
                  >
                    <Text style={styles.audioActionIcon}>×</Text>
                    <Text style={styles.audioActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Add more */}
          <TouchableOpacity
            style={styles.addAudioButton}
            onPress={() => navigation.navigate('FullReading', { system: 'western' })}
          >
            <Text style={styles.addAudioIcon}>+</Text>
            <Text style={styles.addAudioText}>Generate New Audio Reading</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Saved PDFs Section */}
      {savedPDFs.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
            {savedPDFs.length} PDF{savedPDFs.length !== 1 ? 's' : ''} Saved
          </Text>

          {savedPDFs.map((pdf) => (
            <View key={pdf.id} style={styles.pdfCard}>
              <Text style={styles.pdfIcon}>▤</Text>
              <View style={styles.pdfInfo}>
                <Text style={styles.pdfTitle}>{pdf.title}</Text>
                <Text style={styles.pdfMeta}>
                  {pdf.pageCount} pages • {pdf.fileSizeMB.toFixed(1)}MB
                </Text>
              </View>
              <TouchableOpacity style={styles.pdfAction}>
                <Text style={styles.pdfActionText}>Open</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );

  // Build cards from cloud jobs - deduplicate by couple names, sorted by creation time
  const cloudPeopleCards = useMemo(() => {
    console.log('🔄 [MyLibrary] Building cloudPeopleCards from', queueJobs.length, 'queueJobs');

    // Include overlay/compatibility jobs (complete or processing):
    // - synastry (single system overlays like "Vedic overlay")
    // - nuclear_v2 (ultimate 16-reading package)
    const overlayJobs = queueJobs.filter((j) => j.type === 'synastry' || j.type === 'nuclear_v2');
    console.log('🔄 [MyLibrary] Overlay jobs:', overlayJobs.length);

    const seen = new Set<string>();
    const cards = overlayJobs
      .map((job: any) => {
        const p1 = job?.params?.person1?.name || job?.input?.person1?.name || null;
        const p2 = job?.params?.person2?.name || job?.input?.person2?.name || null;
        const systems = job?.params?.systems || job?.input?.systems || [];
        const systemKey = systems.length > 0 ? systems.sort().join(',') : job.type;
        console.log('🔄 [MyLibrary] Job', job.id?.slice(0, 8), '→ p1:', p1, 'p2:', p2, 'type:', job.type, 'systems:', systems);
        return {
          jobId: job.id,
          person1: p1,
          person2: p2,
          type: job.type,
          systems: systems,
          systemKey: systemKey, // For deduplication: same couple + same systems = same card
          createdAt: job.created_at || job.createdAt,
        };
      })
      .filter((card) => {
        // Only include cards with valid person2 name (not null, not 'Person 2' placeholder)
        if (!card.person2 || card.person2 === 'Person 2') {
          console.log('🔄 [MyLibrary] Skipping card - no valid person2');
          return false;
        }
        // Deduplicate by person1 + person2 + systemKey (same couple + same purchase type = 1 card)
        // This means:
        // - Michael + Charmaine + Vedic overlay = 1 card
        // - Michael + Charmaine + Western overlay = 1 card (different)
        // - Michael + Charmaine + nuclear_v2 = 1 card (different)
        const key = `${card.person1}+${card.person2}+${card.systemKey}`;
        if (seen.has(key)) {
          console.log('🔄 [MyLibrary] Skipping duplicate:', key);
          return false;
        }
        seen.add(key);
        return true;
      })
      // Sort by creation time (most recent first)
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

    console.log('🔄 [MyLibrary] Final cloudPeopleCards:', cards.length, cards.map(c => `${c.person1}+${c.person2}+${c.systemKey}`));
    return cards;
  }, [queueJobs]);

  // Chronological feed rule: newest card first, regardless of person/system.
  // CRITICAL: Each job = separate card (Audible Principle)
  const timelineItems = useMemo(() => {
    const toTime = (iso?: string | null) => {
      const t = iso ? new Date(iso).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    // FIXED: Create one card per job, not per person
    // If a person has 3 jobs, show 3 separate cards
    const personItems = allPeopleWithReadings
      .flatMap((person) => {
        // For each job this person is in, create a separate timeline item
        const jobIds = person.jobIds || [];
        if (jobIds.length === 0) return [];

        return jobIds.map((jobId) => {
          const job = queueJobs.find((j: any) => j.id === jobId);
          if (!job) return null;

          const jobType = job?.type;
          const isExtendedJob = jobType === 'extended' || jobType === 'single_system';

          // Get job params once (used in multiple places)
          // Try jobIdToParams first, then fallback to job.params or job.input
          let p = jobIdToParams.get(jobId) || null;
          if (!p && job) {
            p = (job as any).params || (job as any).input || null;
            if (typeof p === 'string') {
              try {
                p = JSON.parse(p);
              } catch {
                p = null;
              }
            }
          }

          let personType: 'individual' | 'person1' | 'person2' = 'person1';
          if (isExtendedJob) {
            personType = 'individual';
          } else if (job?.type === 'nuclear_v2') {
            // Nuclear_v2 jobs have both person1 AND person2
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:2048',message:'PersonType calculation start',data:{personName:person.name,personId:person.id,jobId,hasParams:!!p,person1Name:p?.person1?.name,person2Name:p?.person2?.name,person1Id:p?.person1?.id,person2Id:p?.person2?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            console.log('🔍 [PersonType Calculation] Starting for nuclear_v2:', {
              personName: person.name,
              personId: person.id,
              jobId,
              hasParams: !!p,
              person1Name: p?.person1?.name,
              person2Name: p?.person2?.name,
              person1Id: p?.person1?.id,
              person2Id: p?.person2?.id
            });
            
            // Try ID matching first
            if (p?.person1?.id && p.person1.id === person.id) {
              personType = 'person1';
              console.log('  ✅ Matched by person1 ID');
            } else if (p?.person2?.id && p.person2.id === person.id) {
              personType = 'person2';
              console.log('  ✅ Matched by person2 ID');
            }
            // Try name matching (MORE ROBUST) - exact match
            else if (p?.person1?.name && p.person1.name.toLowerCase().trim() === person.name.toLowerCase().trim()) {
              personType = 'person1';
              console.log('  ✅ Matched by person1 name (exact)');
            } else if (p?.person2?.name && p.person2.name.toLowerCase().trim() === person.name.toLowerCase().trim()) {
              personType = 'person2';
              console.log('  ✅ Matched by person2 name (exact)');
            }
            // Try partial name matching
            else if (person.name && p?.person2?.name && person.name.toLowerCase().includes(p.person2.name.toLowerCase())) {
              personType = 'person2';
              console.log('  ✅ Matched by person2 name (partial)');
            } else if (person.name && p?.person1?.name && person.name.toLowerCase().includes(p.person1.name.toLowerCase())) {
              personType = 'person1';
              console.log('  ✅ Matched by person1 name (partial)');
            }
            // Try reverse partial matching (job name in person name)
            else if (p?.person2?.name && person.name.toLowerCase().includes(p.person2.name.toLowerCase())) {
              personType = 'person2';
              console.log('  ✅ Matched by person2 name (reverse partial)');
            } else if (p?.person1?.name && person.name.toLowerCase().includes(p.person1.name.toLowerCase())) {
              personType = 'person1';
              console.log('  ✅ Matched by person1 name (reverse partial)');
            }
            // Final fallback with logging
            else {
              // SMART FALLBACK: If we have both person1 and person2, and person name doesn't match person1, it must be person2
              if (p?.person1?.name && p?.person2?.name) {
                const personNameLower = person.name.toLowerCase().trim();
                const person1NameLower = p.person1.name.toLowerCase().trim();
                const person2NameLower = p.person2.name.toLowerCase().trim();
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:2091',message:'Smart fallback check',data:{personName:person.name,personNameLower,person1NameLower,person2NameLower,matchesPerson1:personNameLower===person1NameLower,matchesPerson2:personNameLower===person2NameLower},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                // If name doesn't match person1, assume person2
                if (personNameLower !== person1NameLower) {
                  personType = 'person2';
                  console.log('  ✅ Smart fallback: Name does not match person1, defaulting to person2');
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:2097',message:'Smart fallback result',data:{personType:'person2',reason:'nameDoesNotMatchPerson1'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                } else {
                  personType = 'person1';
                  console.log('  ✅ Smart fallback: Name matches person1');
                  
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:2102',message:'Smart fallback result',data:{personType:'person1',reason:'nameMatchesPerson1'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                  // #endregion
                }
              } else {
                console.warn('⚠️ [PersonType Calculation] Could not determine personType:', {
                  personName: person.name,
                  personId: person.id,
                  jobId,
                  jobPerson1Name: p?.person1?.name,
                  jobPerson2Name: p?.person2?.name,
                  jobType: job.type,
                  willDefaultTo: 'person1 (no smart fallback possible)'
                });
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:2110',message:'Smart fallback failed',data:{personName:person.name,hasPerson1Name:!!p?.person1?.name,hasPerson2Name:!!p?.person2?.name,willDefaultTo:'person1'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                
                personType = 'person1';
              }
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:2118',message:'Final personType determined',data:{personName:person.name,personType,jobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            console.log('  📌 Final personType:', personType);
          } else {
            // Other job types - use original logic
            const fromJob =
              (p?.person1?.id && p.person1.id === person.id)
                ? 'person1'
                : (p?.person2?.id && p.person2.id === person.id)
                  ? 'person2'
                  : (p?.person1?.name === person.name)
                    ? 'person1'
                    : (p?.person2?.name === person.name)
                      ? 'person2'
                      : null;
            personType = fromJob || 'person1';
          }

          const createdAt = (job as any)?.created_at || (job as any)?.createdAt || person.createdAt;
          console.log('🔍 [MyLibrary] Building timeline item for:', {
            personName: person.name,
            personId: person.id,
            jobId,
            jobType,
            calculatedPersonType: personType,
            person1Name: p?.person1?.name,
            person2Name: p?.person2?.name,
            person1Id: p?.person1?.id,
            person2Id: p?.person2?.id,
            personJobIds: person.jobIds
          });
          return {
            kind: 'person' as const,
            key: `person-${person.id}-${jobId}`, // Unique key per job
            createdAt,
            person,
            personType,
            primaryJobId: jobId, // This job's ID
          };
        });
      })
      .filter(Boolean) as Array<{
      kind: 'person';
      key: string;
      createdAt: string;
      person: any;
      personType: 'individual' | 'person1' | 'person2';
      primaryJobId: string;
    }>;

    const coupleItems = cloudPeopleCards.map((card: any) => ({
      kind: 'couple' as const,
      key: `couple-${card.jobId}-${card.systemKey}`,
      createdAt: card.createdAt,
      card,
    }));

    const allItems = [...personItems, ...coupleItems].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
    
    console.log('📋 [MyLibrary] Timeline items created:', {
      personItems: personItems.length,
      coupleItems: coupleItems.length,
      total: allItems.length,
      personItemsDetails: personItems.map(p => ({
        name: p.person.name,
        personType: p.personType,
        jobId: p.primaryJobId
      })),
      coupleItemsDetails: coupleItems.map(c => ({
        name: `${c.card.person1} & ${c.card.person2}`,
        jobId: c.card.jobId
      }))
    });
    
    return allItems;
  }, [allPeopleWithReadings, cloudPeopleCards, queueJobs, jobIdToParams]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back arrow and settings */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Headline */}
        <Text style={styles.headerTitle}>My Souls Library</Text>

        {!!queueJobsError && !loadingQueueJobs && (
          <TouchableOpacity
            style={styles.errorBanner}
            activeOpacity={0.8}
            onPress={() => setQueueRefreshKey((k) => k + 1)}
          >
            <Text style={styles.errorBannerTitle}>Couldn’t load cloud readings</Text>
            <Text style={styles.errorBannerText}>{queueJobsError}</Text>
            <Text style={styles.errorBannerCta}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* ALL CARDS - Only show when data exists */}
        <View style={styles.tabContent}>

          {/* Chronological feed: newest first (across people + couples) */}
          {timelineItems.map((item: any) => {
            console.log('🎴 [MyLibrary] Rendering timeline item:', {
              kind: item.kind,
              key: item.key,
              personName: item.kind === 'person' ? item.person?.name : `${item.card?.person1} & ${item.card?.person2}`,
              personType: item.kind === 'person' ? item.personType : 'overlay'
            });
            if (item.kind === 'person') {
              const person = item.person;
              const personType = item.personType as 'individual' | 'person1' | 'person2';
              const primaryJobId = item.primaryJobId as string;
              return (
              <View key={item.key} style={styles.personCardContainer}>
              <TouchableOpacity
                style={styles.personCard}
                onPress={() => {
                  console.log('🔥 [MyLibrary] Navigating to PersonReadings:', {
                    personName: person.name,
                    personId: person.id,
                    personType: personType,
                    jobId: primaryJobId,
                    jobIds: person.jobIds
                  });
                  navigation.navigate('PersonReadings', {
                    personName: person.name,
                    personId: person.id,
                    personType: personType,
                    // If this person is coming from a queued job, include a verifiable receipt.
                    // PersonReadings can then render the correct job instead of guessing (or falling back to test UUID).
                    jobId: primaryJobId,
                  });
                }}
              >
                <View style={[styles.personAvatar, {
                  backgroundColor: person.isUser ? '#E8F4E4' : '#FFE4E4'
                }]}>
                  <Text style={[styles.personInitial, {
                    color: person.isUser ? '#2E7D32' : colors.primary
                  }]}>{person.name?.charAt(0) || '?'}</Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.name}</Text>
                  {/* Job creation date - helps distinguish multiple jobs for same person */}
                  {(() => {
                    const job = queueJobs.find((j: any) => j.id === primaryJobId);
                    const jobCreatedAt = (job as any)?.created_at || (job as any)?.createdAt;
                    if (jobCreatedAt) {
                      const date = new Date(jobCreatedAt);
                      const formatted = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      return (
                        <Text style={[styles.personDate, { color: colors.primary, fontSize: 9 }]}>
                          Reading from {formatted}
                        </Text>
                      );
                    }
                    return null;
                  })()}
                  {(() => {
                    const knownData = getKnownUserData(person.name);
                    const birthData = person.birthData || {};
                    const birthDate = birthData.birthDate || '';
                    const birthTime = birthData.birthTime || '';
                    let birthCity = '';
                    if (birthData.birthCity) {
                      if (typeof birthData.birthCity === 'string') {
                        birthCity = birthData.birthCity;
                      } else if (typeof birthData.birthCity === 'object' && birthData.birthCity.name) {
                        birthCity = birthData.birthCity.name;
                      }
                    }

                    return (
                      <>
                        <Text style={styles.personDate}>
                          {birthDate ? `Born ${formatDate(birthDate)}` : ''}
                          {birthTime ? ` at ${birthTime}` : ''}
                        </Text>
                        {birthCity ? (
                          <Text style={styles.personDate}>{birthCity}</Text>
                        ) : null}
                      </>
                    );
                  })()}
                  <View style={styles.personSigns}>
                    {(() => {
                      const placements = person.placements?.sunSign ? person.placements : {};

                      // If placements are missing, show placeholder (do not calculate here).
                      if (!placements.sunSign) {
                        return (
                          <>
                            <Text style={styles.personSignBadge}>☉ —</Text>
                            <Text style={styles.personSignBadge}>☽ —</Text>
                            <Text style={styles.personSignBadge}>↑ —</Text>
                          </>
                        );
                      }

                      return (
                        <>
                          <Text style={styles.personSignBadge}>
                            ☉ {placements.sunSign}
                          </Text>
                          <Text style={styles.personSignBadge}>
                            ☽ {placements.moonSign}
                          </Text>
                          <Text style={styles.personSignBadge}>
                            ↑ {placements.risingSign}
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                  {/* Audio player */}
                  {(() => {
                    const personAudio = getPersonAudio(person.id);
                    const isPlaying = playingPersonId === person.id;
                    const hasAudio = !!personAudio;
                    const progress = isPlaying && playbackDuration > 0
                      ? (isSeeking ? (seekPosition / playbackDuration) * 100 : (playbackPosition / playbackDuration) * 100)
                      : 0;

                    if (!hasAudio) return null;

                    return (
                      <View style={styles.personAudioPlayer}>
                        <TouchableOpacity
                          style={styles.personPlayButton}
                          onPress={() => togglePersonAudio(person.id)}
                        >
                          <Text style={styles.personPlayIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
                        </TouchableOpacity>
                        <View
                          style={styles.personProgressContainer}
                          onLayout={(e) => {
                            progressBarWidths.current[person.id] = e.nativeEvent.layout.width;
                          }}
                          onStartShouldSetResponder={() => isPlaying}
                          onMoveShouldSetResponder={() => isPlaying}
                          onResponderGrant={(e) => {
                            if (isPlaying) {
                              handlePersonSeekStart(person.id);
                            }
                          }}
                          onResponderMove={(e) => {
                            if (isPlaying) {
                              handlePersonSeekMove(person.id, e.nativeEvent.locationX);
                            }
                          }}
                          onResponderRelease={(e) => {
                            if (isPlaying) {
                              handlePersonSeekEnd(person.id, e.nativeEvent.locationX);
                            }
                          }}
                        >
                          <View style={styles.personProgressTrack}>
                            <View style={[styles.personProgressFill, { width: `${progress}%` }]} />
                            {isPlaying && (
                              <View style={[styles.personProgressThumb, { left: `${progress}%` }]} />
                            )}
                          </View>
                        </View>
                        <Text style={styles.personTimeText}>
                          {isPlaying
                            ? `${formatTime(isSeeking ? seekPosition : playbackPosition)} / ${formatTime(playbackDuration)}`
                            : `0:00 / ${formatTime(personAudio.durationSeconds)}`
                          }
                        </Text>
                        <TouchableOpacity
                          style={styles.personPdfButton}
                          onPress={() => {
                            navigation.navigate('PersonReadings', {
                              personName: person.name,
                              personId: person.id,
                              personType: personType,
                              jobId: primaryJobId,
                            });
                          }}
                        >
                          <Text style={styles.personPdfIcon}>📄</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </View>
              </TouchableOpacity>
              {primaryJobId && (
                <TouchableOpacity
                  style={styles.personDeleteButton}
                  onPress={(e) => handleDeleteJob(primaryJobId, person.name, e)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.personDeleteIcon}>✕</Text>
                </TouchableOpacity>
              )}
              </View>
            );
            }

            const card = item.card as any;
            return (
              <View key={item.key} style={styles.personCardContainer}>
              <TouchableOpacity
                style={styles.personCard}
                onPress={() => {
                  // Always navigate to PersonReadings with overlay type to show only overlay/verdict readings (6 max)
                  navigation.navigate('PersonReadings', {
                    personName: `${card.person1} & ${card.person2}`,
                    personType: 'overlay',
                    jobId: card.jobId,
                  });
                }}
              >
                <View style={styles.compatPeopleVertical}>
                  {/* Person 1 - GREEN (like Michael's card) - stacked vertically, close together, 50% opacity */}
                  <View style={[styles.personAvatar, { backgroundColor: '#E8F4E8', marginBottom: -8, opacity: 0.5 }]}>
                    <Text style={[styles.personInitial, { color: '#2E7D32' }]}>{card.person1?.charAt(0)}</Text>
                  </View>
                  {/* Heart - highest layer (zIndex) */}
                  <Text style={{ fontSize: 16, marginVertical: -4, color: colors.primary, zIndex: 10, elevation: 10 }}>♡</Text>
                  {/* Person 2 - RED (like partner's card) - stacked vertically, close together, 50% opacity */}
                  <View style={[styles.personAvatar, { backgroundColor: '#FFE4E4', marginTop: -8, opacity: 0.5 }]}>
                    <Text style={[styles.personInitial, { color: colors.primary }]}>{card.person2?.charAt(0)}</Text>
                  </View>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{card.person1} and {card.person2}</Text>
                  <Text style={styles.personDate}>Shared Karma</Text>
                  {/* Timestamp for couple reading */}
                  {(() => {
                    const coupleJobForTimestamp = queueJobs.find((j: any) => j.id === card.jobId);
                    const jobCreatedAt = (coupleJobForTimestamp as any)?.created_at || (coupleJobForTimestamp as any)?.createdAt;
                    if (jobCreatedAt) {
                      const date = new Date(jobCreatedAt);
                      const formatted = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      return (
                        <Text style={[styles.personDate, { color: colors.primary, fontSize: 9 }]}>
                          Reading from {formatted}
                        </Text>
                      );
                    }
                    return null;
                  })()}
                  {/* Reading badges for overlay - show which systems have readings */}
                  {(() => {
                    // Find completed job for this couple and purchase type
                    const coupleJob = queueJobs.find((j: any) =>
                      j.id === card.jobId &&
                      (j.status === 'complete' || j.status === 'completed')
                    );

                    if (!coupleJob) return null;

                    // For nuclear_v2: show systems from overlay documents (11-15)
                    const results = (coupleJob as any).results;
                    if (coupleJob.type === 'nuclear_v2' && results?.documents) {
                      const overlayDocs = results.documents.filter((d: any) =>
                        d.docNum >= 11 && d.docNum <= 15
                      );
                      const systemsWithOverlays = new Set(overlayDocs.map((d: any) => {
                        const systemMap: Record<number, string> = { 11: 'western', 12: 'vedic', 13: 'human_design', 14: 'gene_keys', 15: 'kabbalah' };
                        return systemMap[d.docNum];
                      }).filter(Boolean));

                      const badges = Array.from(systemsWithOverlays).map((sys) => {
                        const systemInfo = SYSTEM_INFO[sys as ReadingSystem];
                        return systemInfo ? { name: systemInfo.name, icon: systemInfo.icon } : null;
                      }).filter(Boolean);

                      return badges.length > 0 ? (
                        <View style={styles.personReadings}>
                          {badges.map((badge: any, idx: number) => (
                            <Text key={idx} style={styles.readingBadge}>
                              {badge.icon} {badge.name} ✓
                            </Text>
                          ))}
                        </View>
                      ) : null;
                    }

                    // For synastry: show the system(s) from the job
                    if (coupleJob.type === 'synastry' && card.systems && card.systems.length > 0) {
                      const badges = card.systems.map((sys: string) => {
                        const systemInfo = SYSTEM_INFO[sys as ReadingSystem];
                        return systemInfo ? { name: systemInfo.name, icon: systemInfo.icon } : null;
                      }).filter(Boolean);

                      return badges.length > 0 ? (
                        <View style={styles.personReadings}>
                          {badges.map((badge: any, idx: number) => (
                            <Text key={idx} style={styles.readingBadge}>
                              {badge.icon} {badge.name} ✓
                            </Text>
                          ))}
                        </View>
                      ) : null;
                    }

                    return null;
                  })()}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.personDeleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteJob(card.jobId, `${card.person1} & ${card.person2}`, e);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.personDeleteIcon}>✕</Text>
              </TouchableOpacity>
              </View>
            );
          })}

          {/* Empty state when no cards */}
          {allPeopleWithReadings.length === 0 && !hasUserReadings && partners.length === 0 && cloudPeopleCards.length === 0 && !loadingQueueJobs && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✧</Text>
              <Text style={styles.emptyTitle}>Your library is empty</Text>
              <Text style={styles.emptySubtitle}>
                {queueJobs.length > 0
                  ? `${queueJobs.length} job(s) found but no readings yet.\nJobs may still be processing.`
                  : 'Complete onboarding to receive your readings.'}
              </Text>
            </View>
          )}

          {/* Loading indicator */}
          {loadingQueueJobs && queueJobs.length === 0 && (
            <Text style={{ textAlign: 'center', color: colors.mutedText, marginTop: spacing.md }}>
              Loading cloud readings...
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenId: {
    position: 'absolute',
    top: 55,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  errorBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0C2C8',
    backgroundColor: '#FFF5F6',
  },
  errorBannerTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: '#C41E3A',
    marginBottom: 4,
  },
  errorBannerText: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: '#7A1B2A',
  },
  errorBannerCta: {
    marginTop: 8,
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: '#C41E3A',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backText: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  headerTitle: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
  },
  shopText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: spacing.sm,
  },
  backArrow: {
    fontFamily: typography.sansRegular,
    fontSize: 28,
    color: colors.text,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  settingsIcon: {
    fontFamily: typography.sansRegular,
    fontSize: 24,
    color: colors.text,
  },

  // Profile Card
  profileCard: {
    margin: spacing.page,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.text,
  },
  profileDate: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  signsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  signBadge: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  profileArrow: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.mutedText,
  },
  verifiedBadge: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.success,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.page,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.mutedText,
  },
  tabTextActive: {
    color: colors.primary,
    fontFamily: typography.sansSemiBold,
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: spacing.page,
  },

  // Section Card (for core identities)
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: typography.serifBold,
    fontSize: 18,
    color: colors.text,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    marginBottom: spacing.sm,
  },
  activityMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  activityCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.page,
    borderRadius: RADIUS_CARD,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  activityTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  activitySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  activityArrow: {
    fontFamily: typography.sansMedium,
    fontSize: 18,
    color: colors.mutedText,
    marginLeft: spacing.md,
  },
  activityMoreText: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sectionSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  coreReadingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coreReadingCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  coreIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  coreType: {
    fontFamily: typography.sansSemiBold,
    fontSize: 10,
    color: colors.mutedText,
    letterSpacing: 1,
  },
  coreSign: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },

  // Section Header
  sectionHeader: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // System Cards
  systemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  systemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemIconText: {
    fontSize: 22,
  },
  systemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  systemName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  systemCount: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  systemEmpty: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    fontStyle: 'italic',
  },
  systemArrow: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.primary,
  },

  // Reading Card (simple list item)
  readingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readingIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readingIconText: {
    fontSize: 20,
  },
  readingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  readingType: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readingSign: {
    fontFamily: typography.serifBold,
    fontSize: 17,
    color: colors.text,
    marginTop: 2,
  },
  readingPreview: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  readingDate: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 4,
  },
  readingArrow: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.primary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyStateCompact: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
    color: colors.mutedText,
  },
  emptyTitle: {
    fontFamily: typography.serifBold,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: RADIUS_BUTTON,
  },
  emptyButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },

  // Person Cards
  personCardContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personDeleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  personDeleteIcon: {
    color: '#d0d0d0',
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 14,
  },
  personAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: {
    fontFamily: typography.headline,
    fontSize: 22,
    color: colors.primary,
  },
  personInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  personName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  personJobId: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  personDate: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  personSigns: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  personSignBadge: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  personReadings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  readingBadge: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  personActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  personActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: RADIUS_BUTTON,
    gap: spacing.xs,
  },
  personActionIcon: {
    fontSize: 14,
    color: colors.background,
  },
  personActionText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.background,
  },
  // Audio player for person cards
  personAudioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  personPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personPlayIcon: {
    fontSize: 14,
    color: colors.background,
  },
  personProgressContainer: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  personProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.divider,
    borderRadius: 3,
    position: 'relative',
  },
  personProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  personProgressThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    top: -3,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  personTimeText: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    minWidth: 70,
    textAlign: 'right',
  },
  personPdfButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personPdfIcon: {
    fontSize: 16,
    color: colors.background,
  },
  personStats: {
    alignItems: 'center',
  },
  personStatNumber: {
    fontFamily: typography.serifBold,
    fontSize: 24,
    color: colors.text,
  },
  personStatLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
  },
  addPersonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: RADIUS_BUTTON,
    borderStyle: 'dashed',
  },
  addPersonIcon: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  addPersonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.primary,
  },

  // Compatibility Cards
  compatCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Nuclear package styles
  nuclearSection: {
    marginBottom: spacing.xl,
  },
  nuclearCard: {
    backgroundColor: '#1a0000',
    borderRadius: RADIUS_CARD,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: '#8B0000',
  },
  nuclearCardComplete: {
    borderColor: '#228B22',
    backgroundColor: '#001a00',
  },
  nuclearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nuclearHeart: {
    fontSize: 20,
    color: '#FF4444',
    marginHorizontal: spacing.xs,
  },
  nuclearStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: RADIUS_PILL,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  nuclearStatusText: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
  },
  nuclearStatusComplete: {
    color: '#22C55E',
  },
  nuclearStatusProcessing: {
    color: '#FFA500',
  },
  nuclearNames: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  nuclearDate: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  loadingText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    padding: spacing.lg,
  },
  compatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  compatPeople: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compatPeopleVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compatInitial: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: colors.primary,
  },
  compatHeart: {
    fontSize: 20,
    color: colors.primary,
    marginHorizontal: spacing.sm,
  },
  compatScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  compatScoreNumber: {
    fontFamily: typography.serifBold,
    fontSize: 32,
    color: colors.text,
  },
  compatScoreLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  compatNames: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  compatSystem: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 4,
  },
  compatDate: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },

  section: {
    marginBottom: spacing.lg,
  },

  // Nuclear Card
  nuclearCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#FFD19410',
  },
  nuclearIcon: {
    fontSize: 28,
  },
  nuclearInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nuclearTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  nuclearSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  nuclearPrice: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: '#E67E22',
  },

  // Audio Features
  audioFeatures: {
    marginTop: spacing.xl,
    width: '100%',
  },
  audioFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  audioFeatureIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  audioFeatureText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
  },

  // Audio Cards (when there are audios)
  audioCard: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioSystemBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSystemIcon: {
    fontSize: 24,
  },
  audioCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  audioCardTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  audioCardMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  audioCardDate: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  audioCardActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    justifyContent: 'space-around',
  },
  audioActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  audioActionIcon: {
    fontSize: 18,
    marginRight: 6,
    color: colors.primary,
  },
  audioActionText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.primary,
  },
  audioActionDelete: {
    opacity: 0.6,
  },
  addAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: RADIUS_BUTTON,
    borderStyle: 'dashed',
  },
  addAudioIcon: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  addAudioText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.primary,
  },

  // PDF Cards
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pdfIcon: {
    fontSize: 32,
  },
  pdfInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  pdfTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  pdfMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  pdfAction: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  pdfActionText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
});




