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
import { deletePersonFromSupabase, fetchPeopleWithPaidReadings } from '@/services/peopleService';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { fetchNuclearJobs, fetchJobArtifacts } from '@/services/nuclearReadingsService';
import { calculatePlacements, Placements } from '@/services/placementsCalculator';

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

  // Local state for temporary placements (calculated on the fly for queue jobs)
  const [tempPlacements, setTempPlacements] = useState<Record<string, Placements>>({});


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
  // People with paid readings from Supabase (source of truth)
  const [paidPeopleNames, setPaidPeopleNames] = useState<Set<string>>(new Set());
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
  const deletePerson = useProfileStore((state) => state.deletePerson);
  const repairPeople = useProfileStore((state) => state.repairPeople);
  const repairReadings = useProfileStore((state) => state.repairReadings);
  const fixDuplicateIds = useProfileStore((state) => state.fixDuplicateIds);
  const linkJobToPerson = useProfileStore((state) => state.linkJobToPerson);
  const linkJobToPersonByName = useProfileStore((state) => state.linkJobToPersonByName);

  // Onboarding store for hook readings
  const authUser = useAuthStore((s) => s.user);
  const cloudEnabled = env.ENABLE_SUPABASE_LIBRARY_SYNC && isSupabaseConfigured && !!authUser?.id;

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

  // Activity feed: show background queue status (RunPod/Supabase jobs)
  const mountedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      let interval: any;

      const setPolling = (enabled: boolean) => {
        if (!mountedRef.current) return;
        if (enabled) {
          if (!interval) {
            interval = setInterval(loadQueue, 15000);
            console.log('🔄 [MyLibrary] Polling ON (active jobs)');
          }
        } else {
          if (interval) {
            clearInterval(interval);
            interval = null;
            console.log('✅ [MyLibrary] Polling OFF (no active jobs)');
          }
        }
      };

      const loadQueue = async () => {
        const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
        const isUuid = (v: string | null): v is string =>
          !!v &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

        // Prefer a real authenticated user id (either from auth store or Supabase session).
        // Falling back to the test UUID will hide "real" jobs created under your actual user.
        let resolvedUserId: string | null = authUser?.id || null;
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
          resolvedUserId = null;
        }
        const userId = resolvedUserId ?? TEST_USER_ID;

        const fetchJobsForUser = async (uid: string) => {
          const url = `${env.CORE_API_URL}/api/jobs/v2/user/${uid}/jobs`;
          console.log('📡 [MyLibrary] Fetching jobs from:', url);
          const response = await fetch(url);
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Failed to fetch jobs for ${uid}: ${response.status} ${errorText}`);
          }
          const result = await response.json();
          return { result, url };
        };

        const fetchJobsFromDevDashboard = async () => {
          const url = `${env.CORE_API_URL}/api/dev/dashboard`;
          console.log('📡 [MyLibrary] No user UUID found; using dev dashboard:', url);
          const response = await fetch(url);
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Failed to fetch dev dashboard: ${response.status} ${errorText}`);
          }
          const data = await response.json();
          const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
          // Normalize to the same shape as /api/jobs/v2/user/:id/jobs
          return jobs.map((j: any) => ({
            id: j.id,
            status: j.status,
            type: j.type,
            createdAt: j.createdAt,
            percent: j?.progress?.percent,
            tasksComplete: j?.progress?.tasksComplete,
            tasksTotal: j?.progress?.tasksTotal,
          }));
        };

        // Fetch from backend API (works with or without auth)
        setLoadingQueueJobs(true);
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

          let mergedJobs: any[] = [];
          if (!resolvedUserId && __DEV__) {
            // Dev fallback: show jobs even if Supabase auth isn't available yet (e.g. after reinstall).
            mergedJobs = await fetchJobsFromDevDashboard();
            console.log('📥 [MyLibrary] Dev dashboard jobs:', mergedJobs.length);
          } else {
            // IMPORTANT: Some jobs may have been created under the "test" UUID (when auth wasn't hydrated).
            // To prevent "missing" readings, always merge jobs from both ids when they differ.
            const userIdsToTry = resolvedUserId ? [resolvedUserId, TEST_USER_ID] : [TEST_USER_ID];
            console.log('📡 [MyLibrary] Trying userIds:', userIdsToTry);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:300',message:'Before fetching jobs',data:{resolvedUserId,userIdsToTry,testUserId:TEST_USER_ID},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
            // #endregion
            const results = await Promise.allSettled(userIdsToTry.map((uid) => fetchJobsForUser(uid)));

            const allJobs: any[] = [];
            for (const r of results) {
              if (r.status === 'fulfilled') {
                const res = r.value.result;
                console.log('📥 [MyLibrary] Got jobs:', res.totalJobs, 'jobs from', r.value.url);
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:308',message:'API response received',data:{url:r.value.url,totalJobs:res.totalJobs,jobsCount:res.jobs?.length||0,jobTypes:res.jobs?.map((j:any)=>j.type)||[],jobStatuses:res.jobs?.map((j:any)=>j.status)||[]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
                // #endregion
                if (res.jobs && res.jobs.length > 0) {
                  console.log('📥 [MyLibrary] Job types:', res.jobs.map((j: any) => `${j.type}:${j.status}`));
                }
                allJobs.push(...(res.jobs || []));
              } else {
                console.error('❌ [MyLibrary] Backend API failed for one userId:', r.reason?.message || String(r.reason));
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:314',message:'API fetch failed',data:{error:r.reason?.message||String(r.reason)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
                // #endregion
              }
            }

            // Deduplicate by job id
            const byId = new Map<string, any>();
            for (const j of allJobs) {
              if (j?.id) byId.set(j.id, j);
            }
            mergedJobs = Array.from(byId.values());
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:332',message:'After deduplication',data:{allJobsCount:allJobs.length,mergedJobsCount:mergedJobs.length,mergedJobIds:mergedJobs.map((j:any)=>j.id?.slice(0,8))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
            // #endregion
          }

          console.log('📥 [MyLibrary] Merged jobs:', mergedJobs.length);
          console.log('📥 [MyLibrary] Job statuses:', mergedJobs.map((j: any) => `${j.id?.slice(0, 8)}:${j.status}`));
          console.log(
            '📥 [MyLibrary] Complete jobs:',
            mergedJobs.filter((j: any) => j.status === 'complete' || j.status === 'completed').length
          );
          const fetchJobDetail = async (jobIdToFetch: string) => {
            const url = `${env.CORE_API_URL}/api/jobs/v2/${jobIdToFetch}`;
            // Try with auth header first (if we have it), then fall back without.
            let resp = await fetch(url, {
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });

            // If auth fails (401/403) OR backend is misconfigured for auth (500), try without auth
            if (resp.status === 401 || resp.status === 403 || resp.status === 500) {
              console.log('⚠️ [MyLibrary] Auth request failed with', resp.status, '- retrying without auth');
              resp = await fetch(url);
            }
            const detailData = await resp.json().catch(() => ({}));
            return detailData;
          };

          // Fetch full details for completed jobs to get person names
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:352',message:'Before fetching job details',data:{mergedJobsCount:mergedJobs.length,mergedJobTypes:mergedJobs.map((j:any)=>j.type),mergedJobStatuses:mergedJobs.map((j:any)=>j.status)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
          // #endregion
          const jobsWithDetails = await Promise.all(
            mergedJobs.map(async (j: any) => {
              // For relationship jobs AND extended/single_system jobs, we want person names even while processing so the Library can explain what's happening.
              const needsParams = j.type === 'synastry' || j.type === 'nuclear_v2' || j.type === 'extended' || j.type === 'single_system';
              const isFinished = j.status === 'complete' || j.status === 'completed';

              if (needsParams || isFinished) {
                try {
                  const detailData = await fetchJobDetail(j.id);
                  const params = detailData.job?.params || {};
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:361',message:'Job detail fetched',data:{jobId:j.id?.slice(0,8),hasParams:!!params,person1Name:params.person1?.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
                  // #endregion
                  return {
                    id: j.id,
                    type: j.type,
                    status: j.status,
                    progress: { percent: j.percent, tasksComplete: j.tasksComplete, tasksTotal: j.tasksTotal },
                    created_at: j.createdAt,
                    updated_at: j.createdAt,
                    params, // Include full params with person names
                  };
                } catch (e: any) {
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:372',message:'Job detail fetch failed',data:{jobId:j.id?.slice(0,8),error:e?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
                  // #endregion
                  return {
                    id: j.id,
                    type: j.type,
                    status: j.status,
                    progress: { percent: j.percent, tasksComplete: j.tasksComplete, tasksTotal: j.tasksTotal },
                    created_at: j.createdAt,
                    updated_at: j.createdAt,
                  };
                }
              }
              // For extended/single_system jobs, params are already in the job object from the list endpoint
              return {
                id: j.id,
                type: j.type,
                status: j.status,
                progress: { percent: j.percent, tasksComplete: j.tasksComplete, tasksTotal: j.tasksTotal },
                created_at: j.createdAt,
                updated_at: j.createdAt,
                params: j.params || j.input || {}, // Use params from list endpoint
              };
            })
          );

          console.log('✅ Setting queueJobs:', jobsWithDetails.length, 'jobs');
          console.log('✅ Jobs with person names:', jobsWithDetails.filter((j: any) => j.params?.person1 || j.params?.person2).length);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:415',message:'About to setQueueJobs - REMOVED MOUNTED CHECK',data:{jobsWithDetailsCount:jobsWithDetails.length,jobsWithParams:jobsWithDetails.filter((j:any)=>j.params).length,jobIds:jobsWithDetails.map((j:any)=>j.id?.slice(0,8))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
          // #endregion
          setQueueJobs(jobsWithDetails);
          setQueueJobsUpdatedAt(new Date().toISOString());
          setLoadingQueueJobs(false);

          const hasActiveJobs = jobsWithDetails.some((j: any) =>
            ['pending', 'queued', 'processing', 'claimed'].includes(String(j.status || '').toLowerCase())
          );
          setPolling(hasActiveJobs);
          return;
        } catch (apiError: any) {
          console.error('❌ Backend API failed:', apiError);
          console.error('❌ Error details:', apiError.message, apiError.stack);
          if (mountedRef.current) {
            setLoadingQueueJobs(false);
          }
        }

        // Fallback to Supabase direct query (needs auth)
        if (!isSupabaseConfigured) {
          if (mountedRef.current) {
            setQueueJobs([]);
            setQueueJobsUpdatedAt(null);
            setLoadingQueueJobs(false);
          }
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

          const hasActiveJobs = (data || []).some((j: any) =>
            ['pending', 'queued', 'processing', 'claimed'].includes(String(j.status || '').toLowerCase())
          );
          setPolling(hasActiveJobs);
        } catch (e: any) {
          // Don't block the library if this fails
          if (mountedRef.current) {
            setQueueJobsUpdatedAt(new Date().toISOString());
          }
        } finally {
          if (mountedRef.current) setLoadingQueueJobs(false);
        }
      };

      loadQueue();

      return () => {
        mountedRef.current = false;
        if (interval) clearInterval(interval);
      };
    }, [authUser?.id])
  );

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
  // User name fallback
  const userName = 'User';

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
  // 1. Profile store (people with readings array - single-system purchases)
  // 2. Nuclear_v2 job artifacts (person1 and person2 from completed jobs)
  // 3. Extended/single-system jobs (person1 from completed jobs)
  // Group by person name (one card per person)
  const allPeopleWithReadings = useMemo<LibraryPerson[]>(() => {
    const peopleMap = new Map<string, LibraryPerson>();

    // IMPORTANT: Always process newest jobs first so `person.jobIds[0]` is the most recent receipt.
    // This prevents picking an older job (which may have missing artifacts) and showing greyed-out audio.
    const queueJobsNewestFirst = [...queueJobs].sort((a: any, b: any) => {
      const ta = new Date(a?.created_at || a?.createdAt || 0).getTime();
      const tb = new Date(b?.created_at || b?.createdAt || 0).getTime();
      return tb - ta;
    });

    // 1. Add people from profile store who have readings
    console.log('📊 [MyLibrary] Total queueJobs:', queueJobs.length);
    console.log('📊 [MyLibrary] Job types:', queueJobs.map((j: any) => `${j.type}(${j.status})`).join(', '));
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:557',message:'All queueJobs analysis',data:{totalJobs:queueJobs.length,jobs:queueJobs.map((j:any,i:number)=>({idx:i,id:j.id?.slice(0,8),type:j.type,status:j.status,hasParams:!!j.params,hasInput:!!j.input,paramsType:typeof j.params,inputType:typeof j.input}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
    // #endregion

    // REMOVED: Don't add people from local store - ONLY show people from jobs
    // This prevents test/imported people from appearing without purchases

    // 2. Add people from nuclear_v2 and extended jobs (person1 and person2) - include processing jobs
    queueJobsNewestFirst
      .filter((j: any) =>
        (j.type === 'nuclear_v2' || j.type === 'extended') &&
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

        console.log('🔍 [MyLibrary] Final p1Name:', p1Name, 'from params.person1?.name:', params.person1?.name);

        // Add person1 - deduplicate by name, merge jobIds
        if (p1Name) {
          const existing = peopleMap.get(p1Name);
          if (existing) {
            // Merge jobIds if person already exists
            existing.jobIds = [...new Set([...(existing.jobIds || []), job.id])];
            // Persist to store (Audible-style) - use name lookup to handle temp IDs
            linkJobToPersonByName(p1Name, job.id);
          } else {
            // Create placeholder readings based on job type
            const isOverlay = job.type === 'overlay' || job.type === 'compatibility';
            const systems = isOverlay 
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

            peopleMap.set(p1Name, {
              id: `job-${job.id}-p1`,
              name: p1Name,
              isUser: p1Name === userName,
              birthData: params.person1 || {},
              placements: {},
              readings: placeholderReadings,
              createdAt: job.created_at || job.createdAt || new Date().toISOString(),
              jobIds: [job.id],
            });
          }
        }

        // Add person2 - deduplicate by name, merge jobIds
        if (p2Name) {
          const existing = peopleMap.get(p2Name);
          if (existing) {
            // Merge jobIds if person already exists
            existing.jobIds = [...new Set([...(existing.jobIds || []), job.id])];
            // Persist to store (Audible-style) - use name lookup to handle temp IDs
            linkJobToPersonByName(p2Name, job.id);
          } else {
            // Create placeholder readings based on job type
            const isOverlay = job.type === 'overlay' || job.type === 'compatibility';
            const systems = isOverlay 
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

            peopleMap.set(p2Name, {
              id: `job-${job.id}-p2`,
              name: p2Name,
              isUser: false,
              birthData: params.person2 || {},
              placements: {},
              readings: placeholderReadings,
              createdAt: job.created_at || job.createdAt || new Date().toISOString(),
              jobIds: [job.id],
            });
          }
        }
      });

    // 3. Add people from extended/single-system jobs (person1) - include processing jobs
    queueJobsNewestFirst
      .filter((j: any) =>
        (j.type === 'extended' || j.type === 'single_system') &&
        (j.status === 'complete' || j.status === 'completed' || j.status === 'processing' || j.status === 'pending' || j.status === 'queued')
      )
      .forEach((job: any) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:664',message:'Processing extended/single_system job',data:{jobId:job.id?.slice(0,8),type:job.type,status:job.status,hasParams:!!job.params,hasInput:!!job.input},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
        // #endregion
        let params = job.params || job.input || {};
        if (typeof params === 'string') {
          try {
            params = JSON.parse(params);
          } catch {
            params = {};
          }
        }

        const isProcessing = job.status === 'processing' || job.status === 'pending' || job.status === 'queued';
        const p1Name = params.person1?.name || (isProcessing ? `Reading ${job.id.slice(0, 8)}` : undefined);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:677',message:'Extracted person name from job',data:{jobId:job.id?.slice(0,8),p1Name,paramsPerson1Name:params.person1?.name,isProcessing,willMerge:!!peopleMap.get(p1Name)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
        // #endregion

        if (p1Name) {
          // FIXED: Use person name as key (not job ID) to deduplicate same person
          const existing = peopleMap.get(p1Name);
          if (existing) {
            // Merge jobIds if person already exists
            existing.jobIds = [...new Set([...(existing.jobIds || []), job.id])];
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:682',message:'Merged jobId into existing person',data:{personName:p1Name,jobId:job.id?.slice(0,8),newJobIdsCount:existing.jobIds.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
            // #endregion
          } else {
            // Create placeholder readings based on job type
            const isOverlay = job.type === 'overlay' || job.type === 'compatibility';
            const systems = isOverlay 
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

            peopleMap.set(p1Name, {
              id: `job-${job.id}-p1`,
              name: p1Name,
              isUser: p1Name === userName,
              birthData: params.person1 || {},
              placements: {},
              readings: placeholderReadings,
              createdAt: job.created_at || job.createdAt || new Date().toISOString(),
              jobIds: [job.id],
            });
          }
        }
      });

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:697',message:'After processing all jobs - peopleMap state',data:{peopleMapSize:peopleMap.size,peopleNames:Array.from(peopleMap.keys()),peopleWithJobIds:Array.from(peopleMap.values()).filter(p=>p.jobIds&&p.jobIds.length>0).map(p=>({name:p.name,jobIdsCount:p.jobIds.length}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOB_LINK'})}).catch(()=>{});
    // #endregion

    // Convert to array and sort by most recent
    let result = Array.from(peopleMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA; // Most recent first
    });

    // CRITICAL FILTER 1: Only show people with has_paid_reading = true in Supabase
    // This is the source of truth - prevents showing "added" people without paid readings
    if (paidPeopleNames.size > 0) {
      result = result.filter(person => paidPeopleNames.has(person.name));
      console.log('📊 [MyLibrary] After paid filter:', result.length);
    }

    // CRITICAL FILTER 2: Only show people with complete placements (no "Calculating..." entries)
    // This ensures "My Souls Library" only displays valid, complete profiles with sun/moon/rising signs
    result = result.filter(person => {
      // Check stored placements
      if (person.placements?.sunSign) return true;
      // Check temp calculated placements
      if (tempPlacements[person.name]?.sunSign) return true;
      // Otherwise, hide this person (they're still processing)
      return false;
    });

    console.log('📊 [MyLibrary] Final peopleMap size:', peopleMap.size);
    console.log('📊 [MyLibrary] People names:', Array.from(peopleMap.keys()).join(', '));
    console.log('📊 [MyLibrary] After placements filter:', result.length);

    return result;
  }, [queueJobs, people, userName, paidPeopleNames, tempPlacements]);

  // Effect: Calculate placements for any person (from queue or store) who has birth data but no signs
  useEffect(() => {
    // Only run if we have people to check
    if (!allPeopleWithReadings || allPeopleWithReadings.length === 0) return;

    const peopleNeedingPlacements = allPeopleWithReadings.filter(p => {
      // Check if missing placements
      const hasPlacements = p.placements?.sunSign;
      // Check if we already calculated temp placements
      const hasTemp = tempPlacements[p.name];
      if (hasPlacements || hasTemp) return false;

      // Check if has valid birth data
      const bd = p.birthData;
      return bd?.birthDate && bd?.birthTime && typeof bd?.latitude === 'number';
    });

    if (peopleNeedingPlacements.length === 0) return;

    peopleNeedingPlacements.forEach(async (p) => {
      // console.log(`🔮 [MyLibrary] Calculating missing placements for ${p.name}...`);
      try {
        const result = await calculatePlacements({
          birthDate: p.birthData.birthDate,
          birthTime: p.birthData.birthTime,
          timezone: p.birthData.timezone || 'UTC',
          latitude: p.birthData.latitude,
          longitude: p.birthData.longitude,
        });

        if (result) {
          console.log(`✅ [MyLibrary] Calculated for ${p.name}: ${result.sunSign}`);
          setTempPlacements(prev => ({ ...prev, [p.name]: result }));

          // Optionally save to persistent store if it's a real person (has ID)
          if (p.id && !p.id.startsWith('job-')) {
            // We can't easily import updatePerson here without context, so we just rely on local state for now
          }
        }
      } catch (err) {
        console.warn(`⚠️ [MyLibrary] Failed to calculate for ${p.name}`, err);
      }
    });
  }, [allPeopleWithReadings, tempPlacements]);

  // Map jobId -> job params so we can determine whether a person was person1 or person2 for a given job.
  // This avoids incorrect heuristics like "non-user == person2" (e.g. Eva can be person1).
  const jobIdToParams = useMemo(() => {
    const m = new Map<string, any>();
    for (const j of queueJobs as any[]) {
      if (j?.id && (j as any)?.params) m.set(j.id, (j as any).params);
    }
    return m;
  }, [queueJobs]);

  const hasUserReadings = useMemo(() => {
    return allPeopleWithReadings.some(p => p.isUser || p.name === userName);
  }, [allPeopleWithReadings, userName]);

  const partners = useMemo(() => {
    return allPeopleWithReadings.filter(p => !p.isUser && p.name !== userName);
  }, [allPeopleWithReadings, userName]);

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
                  navigation.navigate('PersonReadings', { personName: (j as any).params?.person1?.name || 'Unknown', personType: 'person1', jobId: j.id });
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
                // If this is a job-based person (from nuclear_v2), route to PersonReadings for progress tracking
                if (person.id.startsWith('job-')) {
                  const [_, jobId, suffix] = person.id.split('-');
                  const personType = suffix === 'p1' ? 'person1' : 'person2';
                  navigation.navigate('PersonReadings', {
                    personName: person.name,
                    personType: personType as any,
                    jobId: jobId
                  });
                } else {
                  navigation.navigate('PersonProfile', { personId: person.id });
                }
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
    const completedOverlayJobs = queueJobs.filter((j) =>
      (j.type === 'synastry' || j.type === 'nuclear_v2') &&
      (j.status === 'complete' || j.status === 'completed' || j.status === 'processing')
    );
    console.log('🔄 [MyLibrary] Completed overlay jobs:', completedOverlayJobs.length);

    const seen = new Set<string>();
    const cards = completedOverlayJobs
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenId}>14</Text>

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

        {/* ALL CARDS - Only show when data exists */}
        <View style={styles.tabContent}>

          {/* Person Cards - show ALL people who have readings (grouped by name) */}
          {/* #region agent log */}
          {(() => { const keys = allPeopleWithReadings.map((p,i) => ({ idx: i, name: p.name, id: p.id, computedKey: `person-${p.name}-${p.id || 'no-id'}` })); const duplicateKeys = keys.filter((k,i,arr) => arr.findIndex(x => x.computedKey === k.computedKey) !== i); fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:1809',message:'allPeopleWithReadings keys analysis',data:{totalPeople:keys.length,allKeys:keys,duplicateKeys,hasUndefinedIds:keys.filter(k=>!k.id||k.id==='no-id').length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C,E'})}).catch(()=>{}); return null; })()}
          {/* #endregion */}
          {allPeopleWithReadings.map((person, mapIndex) => {
            // #region agent log
            const computedKey = `person-${person.name}-${person.id || 'no-id'}`;
            fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:1812',message:'Rendering person card',data:{mapIndex,name:person.name,id:person.id,computedKey},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C'})}).catch(()=>{});
            // #endregion
            // Determine personType based on the actual job params for the job we're linking to.
            // - Extended/Combined jobs: personType = 'individual' (1 person, 1-5 systems)
            // - Nuclear jobs: personType = 'person1' | 'person2' | 'overlay'
            const primaryJobId = person.jobIds?.[0];
            const primaryJob = queueJobs.find((j: any) => j.id === primaryJobId);
            const jobType = primaryJob?.type;
            const isExtendedJob = jobType === 'extended' || jobType === 'single_system';
            
            // For extended jobs, use 'individual' personType
            // For nuclear jobs, determine person1/person2 based on job params
            let personType: 'individual' | 'person1' | 'person2' = 'person1';
            if (isExtendedJob) {
              personType = 'individual';
            } else {
              const p = primaryJobId ? jobIdToParams.get(primaryJobId) : null;
              
              // DEBUG: Log the job params lookup
              if (primaryJobId && !p) {
                console.warn(`⚠️ [MyLibrary] No job params found for jobId ${primaryJobId} (${person.name})`);
                console.warn(`   Available job IDs in map:`, Array.from(jobIdToParams.keys()).slice(0, 5));
              }
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:personType',message:'Determining personType',data:{personName:person.name,personId:person.id,jobId:primaryJobId,person1Id:p?.person1?.id,person1Name:p?.person1?.name,person2Id:p?.person2?.id,person2Name:p?.person2?.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
              // #endregion
              
              // CRITICAL: Match by ID first (unique), fallback to name only if no IDs
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
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:personTypeResult',message:'PersonType determined',data:{personName:person.name,personId:person.id,jobId:primaryJobId,determinedType:fromJob||'person1'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
              // #endregion
              
              if (!fromJob && primaryJobId) {
                console.warn(`⚠️ [MyLibrary] Could not determine personType from job params for ${person.name}`);
                console.warn(`   Job params:`, p);
                console.warn(`   Person name:`, person.name);
                console.warn(`   person1 name:`, p?.person1?.name);
                console.warn(`   person2 name:`, p?.person2?.name);
              }
              
              // CRITICAL: Only use fallback if we truly can't find the job params
              // Default to person1 to avoid swapping (better to show wrong range than wrong person's reading)
              personType = fromJob || 'person1';
              
              if (!fromJob) {
                console.warn(`⚠️ [MyLibrary] Using fallback personType='person1' for ${person.name} - readings may be incorrect`);
              }
            }

            return (
              <TouchableOpacity
                key={`person-${person.name}-${person.id || 'no-id'}`}
                style={styles.personCard}
                onPress={() => {
                  // #region agent log
                  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MyLibraryScreen.tsx:navigation',message:'Navigating to PersonReadings',data:{personName:person.name,personId:person.id,personType,jobId:person.jobIds?.[0],jobIdsCount:person.jobIds?.length,allJobIds:person.jobIds,personFromStore:people.find(p=>p.id===person.id||p.name===person.name)?.jobIds},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'NAV'})}).catch(()=>{});
                  // #endregion
                  navigation.navigate('PersonReadings', {
                    personName: person.name,
                    personId: person.id,
                    personType: personType,
                    // If this person is coming from a queued job, include a verifiable receipt.
                    // PersonReadings can then render the correct job instead of guessing (or falling back to test UUID).
                    jobId: person.jobIds?.[0],
                  });
                }}
                onLongPress={() => {
                  Alert.alert(
                    person.name,
                    'What would you like to do?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          Alert.alert(
                            'Delete ' + person.name + '?',
                            'This will remove all their readings and data.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  // Delete locally
                                  deletePerson(person.id);
                                  
                                  // Delete from Supabase if user is authenticated
                                  if (authUser?.id) {
                                    const result = await deletePersonFromSupabase(authUser.id, person.id);
                                    if (result.success) {
                                      console.log(`✅ Deleted "${person.name}" from Supabase`);
                                    } else {
                                      console.warn(`⚠️ Failed to delete from Supabase: ${result.error}`);
                                    }
                                  }
                                  
                                  Alert.alert('Deleted', person.name + ' has been removed');
                                }
                              }
                            ]
                          );
                        }
                      }
                    ]
                  );
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
                      // CRITICAL: We now filter out people without placements in allPeopleWithReadings,
                      // so we can safely assume this person has placements (either stored or temp)
                      const placements = person.placements?.sunSign
                        ? person.placements
                        : (tempPlacements[person.name] || {});

                      // If still no placements, this should not happen due to filter, but handle gracefully
                      if (!placements.sunSign) {
                        console.warn(`⚠️ Person "${person.name}" shown without placements - should have been filtered out`);
                        return null;
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
                              personType: personType,
                              jobId: person.jobIds?.[0],
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
            );
          })}

          {/* Shared Karma Cards (from overlay/compatibility jobs) - deduplicated by couple + purchase type */}
          {cloudPeopleCards.map((card, idx) => (
            <TouchableOpacity
              key={card.jobId || idx}
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
          ))}

          {/* Empty state when no cards */}
          {!hasUserReadings && partners.length === 0 && cloudPeopleCards.length === 0 && !loadingQueueJobs && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✧</Text>
              <Text style={styles.emptyTitle}>Your library is empty</Text>
              <Text style={styles.emptySubtitle}>
                {queueJobs.length > 0
                  ? `${queueJobs.length} job(s) found but no readings yet.\nJobs may still be processing.`
                  : 'Complete onboarding to receive your readings.'}
              </Text>

              {/* ON-SCREEN DEBUG DISPLAY - Always visible if jobs exist but no cards */}
              {queueJobs.length > 0 && (
                <View style={{ marginTop: 20, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 8, width: '90%', alignSelf: 'center' }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 10, fontSize: 13, color: '#333' }}>🔍 Debug Details:</Text>
                  {queueJobs.slice(0, 2).map((job: any, idx: number) => {
                    let params = job.params || job.input || {};
                    if (typeof params === 'string') {
                      try { params = JSON.parse(params); } catch { params = {}; }
                    }
                    return (
                      <View key={idx} style={{ marginBottom: 8, padding: 8, backgroundColor: 'white', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#666' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#444' }}>
                          Type: {job.type} ({job.status}){'\n'}
                          Keys: {Object.keys(job).join(', ')}{'\n'}
                          Params keys: {params ? Object.keys(params).join(', ') : 'none'}{'\n'}
                          P1 name: {params.person1?.name || params.personName || params.name || 'MISSING'}{'\n'}
                          Raw params: {JSON.stringify(params).slice(0, 100)}...
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Loading indicator */}
          {loadingQueueJobs && (
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
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: RADIUS_CARD,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
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




