/**
 * PERSON READINGS SCREEN
 * 
 * Simple list of 5 readings with inline audio players.
 * Colors: Red, Black, Grey only.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Linking,
  PanResponder,
  PanResponderGestureState,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system/legacy';
import { getCacheDirectory, getDocumentDirectory } from '@/utils/fileSystem';
import * as Sharing from 'expo-sharing';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { createArtifactSignedUrl, downloadTextContent, fetchJobArtifacts } from '@/services/nuclearReadingsService';
import { getLocalArtifactPaths, getPlayableArtifactUrl } from '@/services/artifactCacheService';
import { onDownloadComplete } from '@/services/realtimeArtifactSync';
import { colors } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';
import { BackButton } from '@/components/BackButton';
import { SliderLoadingAnimation, SoundWaveAnimation } from '@/components/AudioLoadingAnimation';
import { FEATURES } from '@/config/features';
import { getJobReceipts } from '@/services/jobBuffer';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonReadings'>;

const SYSTEMS = [
  { id: 'western', name: 'Western Astrology' },
  { id: 'vedic', name: 'Vedic (Jyotish)' },
  { id: 'human_design', name: 'Human Design' },
  { id: 'gene_keys', name: 'Gene Keys' },
  { id: 'kabbalah', name: 'Kabbalah' },
  { id: 'verdict', name: 'Final Verdict' },
];

type Reading = {
  id: string;
  system: string;
  name: string;
  pdfPath?: string;
  audioPath?: string;
  songPath?: string; // Personalized song for this document
  duration?: number; // seconds
  timestamp?: string; // Job creation timestamp
  jobId?: string; // Source job for this row (required for duplicates)
  docNum?: number; // Document number within job (required for stable caching)
  // Local cache (A2 gating): enabled only after downloaded & verified
  localPdfPath?: string;
  localAudioPath?: string;
  localSongPath?: string;
};

export const PersonReadingsScreen = ({ navigation, route }: Props) => {
  const { personName, personType, jobId: routeJobId } = route.params;
  
  
  console.log('🔥 [PersonReadingsScreen] MOUNTED with:', {
    personName,
    personType,
    jobId: routeJobId
  });
  const routePersonId = (route.params as any).personId; // May not exist in older nav calls


  // Store access
  const people = useProfileStore((s) => s.people);
  const getReadingsByJobId = useProfileStore((s) => s.getReadingsByJobId);
  const createPlaceholderReadings = useProfileStore((s) => s.createPlaceholderReadings);
  const syncReadingArtifacts = useProfileStore((s) => s.syncReadingArtifacts);
  const savedAudios = useProfileStore((s) => s.savedAudios);
  const savedPDFs = useProfileStore((s) => s.savedPDFs);
  const addSavedAudio = useProfileStore((s) => s.addSavedAudio);
  const addSavedPDF = useProfileStore((s) => s.addSavedPDF);


  // Find person - try ID first, then fallback to name lookup
  const person = routePersonId 
    ? people.find(p => p.id === routePersonId)
    : people.find(p => p.name === personName);
  
  const personId = person?.id;

  // CRITICAL: jobId must be provided in route params (Audible Principle)
  // Each job = separate receipt. Never use fallback to person.jobIds[0]
  // as this causes old readings to show for new jobs.
  const jobId = routeJobId;

  if (!jobId) {
    console.error('❌ PersonReadingsScreen: No jobId provided in route params');
  }

  // Get readings from store (SINGLE SOURCE OF TRUTH - Audible style)
  // Always require explicit jobId - never aggregate across jobs
  const storedReadings = personId && jobId
    ? getReadingsByJobId(personId, jobId)
    : [];
  
  
  // Initialize with store readings for instant display (like Audible)
  // Convert store readings to screen format
  const initialReadingsRaw = storedReadings.map(r => ({
    id: r.id,
    system: r.system,
    name: SYSTEMS.find(s => s.id === r.system)?.name || r.system,
    pdfPath: r.pdfPath,
    audioPath: r.audioPath,
    songPath: r.songPath,
    duration: r.duration,
    timestamp: r.createdAt || r.generatedAt,
  }));
  
  // CRITICAL: Filter out readings without artifacts BEFORE displaying (prevents "flash" of empty readings)
  // This matches the filter logic used after loading fresh data
  const initialReadings = initialReadingsRaw.filter(r => {
    const hasRealContent = !!(r.pdfPath || r.audioPath || r.songPath);
    return hasRealContent;
  });
  
  
  const [readings, setReadings] = useState<Reading[]>(initialReadings);
  const [jobStatus, setJobStatus] = useState<string>('pending'); // NEW: Track job status
  const [jobProgress, setJobProgress] = useState<{percent: number; tasksComplete: number; tasksTotal: number} | null>(null); // NEW
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // CRITICAL: Correct personType if it's wrong (workaround for MyLibraryScreen bug)
  const [correctedPersonType, setCorrectedPersonType] = useState<'individual' | 'person1' | 'person2' | 'overlay'>(personType);
  const personTypeCorrectedRef = useRef(false); // Prevent infinite reload loops
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [audioLoadProgress, setAudioLoadProgress] = useState<Record<string, number>>({});
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const scrubbingNarrationIdRef = useRef<string | null>(null);
  const isPlayingMutex = useRef(false); // Prevent multiple plays at once
  
  // Song playback state (separate from narration)
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  
  // Text display state (for subtitles/reading along)
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());
  const [readingTexts, setReadingTexts] = useState<Record<string, string>>({});
  const [readingHeadlines, setReadingHeadlines] = useState<Record<string, string>>({});
  const [songTitles, setSongTitles] = useState<Record<string, string>>({});
  const [loadingTextIds, setLoadingTextIds] = useState<Set<string>>(new Set());
  const textScrollRefs = useRef<Record<string, ScrollView | null>>({});
  const [manuallyScrolling, setManuallyScrolling] = useState<Record<string, boolean>>({});
  const [songLyrics, setSongLyrics] = useState<Record<string, string>>({});

  
  // Pulsating animation for generating items (0 to 1 range for interpolation)
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current; // For blinking effect
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);
  const [songPosition, setSongPosition] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [isSongScrubbing, setIsSongScrubbing] = useState(false);
  const [songScrubPosition, setSongScrubPosition] = useState(0);
  const songSoundRef = useRef<Audio.Sound | null>(null);
  const scrubbingSongIdRef = useRef<string | null>(null);
  const isSongPlayingMutex = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingsCountRef = useRef(0);

  // ZIP export (server-side)
  const [zipLoading, setZipLoading] = useState(false);

  useEffect(() => {
    readingsCountRef.current = readings.length;
  }, [readings.length]);

  const withTimeout = useCallback(
    async <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
      let timeoutId: any;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms);
      });
      try {
        return await Promise.race([p, timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    []
  );

  const AUDIO_CACHE_DIR = getCacheDirectory() ? `${getCacheDirectory()}audio-cache/` : '';

  const ensureAudioCacheDir = useCallback(async () => {
    if (!AUDIO_CACHE_DIR) return;
    try {
      const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true });
      }
    } catch {
      // ignore
    }
  }, [AUDIO_CACHE_DIR]);

  const getCachedAudioPath = useCallback(
    (reading: Reading) => {
      if (!AUDIO_CACHE_DIR) return null;
      // Stable per job+doc; keeps caching predictable and avoids re-downloading.
      // Use .m4a extension since backend now outputs M4A format (not MP3)
      const safeId = `${jobId || 'nojob'}_${reading.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      return `${AUDIO_CACHE_DIR}${safeId}.m4a`;
    },
    [AUDIO_CACHE_DIR, jobId]
  );

  const getPlayableAudioUri = useCallback(
    async (reading: Reading): Promise<string> => {
      // Always play through the backend Range-capable proxy.
      // This avoids iOS AVPlayer flakiness with signed URLs and prevents format/extension issues in local caching.
      const m = reading.id.match(/^reading-(\d+)$/);
      const docNum = m ? Number(m[1]) : null;
      if (jobId && docNum && Number.isFinite(docNum)) {
        return `${env.CORE_API_URL}/api/jobs/v2/${jobId}/audio/${docNum}`;
      }

      const url = reading.audioPath;
      if (!url) throw new Error('Missing audio URL');
      return url;
    },
    [jobId]
  );

  const downloadAndCacheAudio = useCallback(
    async (reading: Reading): Promise<string | null> => {
      const url = reading.audioPath;
      if (!url || !url.startsWith('http')) return null;
      await ensureAudioCacheDir();
      const cached = getCachedAudioPath(reading);
      if (!cached) return null;
      try {
        // Use resumable download for better reliability on iOS (and progress reporting)
        const dl = FileSystem.createDownloadResumable(
          url,
          cached,
          {},
          (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            const total = p.totalBytesExpectedToWrite || 0;
            const pct = total > 0 ? Math.max(0, Math.min(1, p.totalBytesWritten / total)) : 0;
            setAudioLoadProgress((prev) => ({ ...prev, [reading.id]: pct }));
          }
        );
        const result = await dl.downloadAsync();
        if (result?.uri) {
          setAudioLoadProgress((prev) => ({ ...prev, [reading.id]: 0 }));
          return result.uri;
        }
        return null;
      } catch {
        setAudioLoadProgress((prev) => ({ ...prev, [reading.id]: 0 }));
        return null;
      }
    },
    [ensureAudioCacheDir, getCachedAudioPath]
  );

  // Document ranges per person type
  // - Nuclear Package: person1=[1-5], person2=[6-10], overlay=[11-16]
  // - Extended/Combined: individual=[1-5] (or fewer, based on actual systems)
  const getDocRange = useCallback((jobType?: string, systemCount?: number) => {
    // Use corrected personType if available, otherwise fallback to original
    const effectivePersonType = correctedPersonType || personType;
    
    // For extended jobs, docs are always 1-N where N = number of systems
    if (effectivePersonType === 'individual' || jobType === 'extended') {
      const count = systemCount || 5;
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    
    // Nuclear Package ranges
    let docRange: number[];
    switch (effectivePersonType) {
      case 'person1': docRange = [1, 2, 3, 4, 5]; break;
      case 'person2': docRange = [6, 7, 8, 9, 10]; break;
      case 'overlay': docRange = [11, 12, 13, 14, 15, 16]; break;
      default: docRange = [1, 2, 3, 4, 5];
    }
    
    
    return docRange;
  }, [personType, correctedPersonType]);

  const isZipReady = useCallback(() => {
    if (!FEATURES.ZIP_EXPORT_ENABLED) return false;
    if (!jobId) return false;
    if (jobStatus !== 'complete' && jobStatus !== 'completed') return false;
    const docRange = getDocRange();
    // Require the core bundle for every doc in this scope (pdf + narration).
    // Songs are included only if EVERY doc has a song; otherwise we still allow exporting the core package.
    return docRange.every((d) => {
      const r = readings.find((x) => x.docNum === d);
      return !!(r?.pdfPath && r?.audioPath);
    });
  }, [jobId, jobStatus, readings, personType]);

  const shouldIncludeSongInZip = useCallback(() => {
    if (!FEATURES.ZIP_EXPORT_ENABLED) return false;
    if (!jobId) return false;
    const docRange = getDocRange();
    // Include song only if every doc has it (prevents "button never appears" due to one missing song)
    return docRange.every((d) => {
      const r = readings.find((x) => x.docNum === d);
      return !!r?.songPath;
    });
  }, [jobId, readings, personType]);

  const handleZipDownload = useCallback(async () => {
    if (!jobId) return;
    if (!isZipReady()) return;

    try {
      setZipLoading(true);

      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) {
        Alert.alert('Download', 'You must be signed in to download the ZIP.');
        return;
      }

      const docRange = getDocRange();
      const include = shouldIncludeSongInZip() ? 'pdf,audio,song' : 'pdf,audio';
      const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}/export?docs=${encodeURIComponent(docRange.join(','))}&include=${include}`;

      const fileBase = `${personName || 'reading'}_${jobId.slice(0, 8)}.zip`.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const destDir = getDocumentDirectory() || FileSystem.documentDirectory || '';
      const dest = `${destDir}${fileBase}`;

      const dl = FileSystem.createDownloadResumable(
        url,
        dest,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await dl.downloadAsync();
      const uri = result?.uri;
      if (!uri) throw new Error('ZIP download failed');

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Download complete', 'ZIP saved, but sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/zip',
        dialogTitle: 'Save ZIP',
        UTI: 'public.zip-archive',
      });
    } catch (e: any) {
      Alert.alert('Download all', e?.message || 'ZIP download failed');
    } finally {
      setZipLoading(false);
    }
  }, [jobId, isZipReady, shouldIncludeSongInZip, personName, jobStatus, personType, readings]);

  const load = useCallback(async () => {
    console.log('🚀 [PersonReadings] Starting load for', personName, personType);
    // Only show full loading screen if we have no readings yet
    if (readings.length === 0) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setLoadError(null);

    // Fly can take >10s to assemble job results + sign URLs (especially nuclear_v2),
    // so use a more forgiving timeout and retry once on transient failures.
    const REQUEST_TIMEOUT_MS = 30000;
    const MAX_ATTEMPTS = 2;

    try {
      if (!jobId) {
        console.log('⚠️ [PersonReadings] Missing jobId receipt - showing empty state (no readings yet)');
        // Don't show placeholder cards for non-existent jobs.
        // An empty readings array will trigger the "No readings yet" empty state.
        setReadings([]);
        return;
      }

      // Fetch full job with documents from backend (documents are built from artifacts server-side)
      let jobData: any = null;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          console.log(`📦 [PersonReadings] Fetching job (attempt ${attempt}/${MAX_ATTEMPTS}):`, jobId);
          const jobRes = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${jobId}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!jobRes.ok) {
            const errorText = await jobRes.text().catch(() => '');
            throw new Error(`Failed to load job (${jobRes.status}) ${errorText}`);
          }
          jobData = await jobRes.json();
          break;
        } catch (e: any) {
          clearTimeout(timeoutId);
          lastErr = e;
          const msg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Network request failed');
          console.warn(`⚠️ [PersonReadings] Attempt ${attempt} failed:`, msg);
          // Small backoff before retry
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }
      if (!jobData) throw lastErr || new Error('Failed to load job');

      // CRITICAL: Correct personType if wrong (workaround for MyLibraryScreen bug)
      const jobParams = jobData.job?.params || jobData.job?.input || {};
      const person1Name = jobParams?.person1?.name;
      const person2Name = jobParams?.person2?.name;
      if (jobData.job?.type === 'nuclear_v2' && person1Name && person2Name) {
        const personNameLower = personName.toLowerCase().trim();
        const person1NameLower = person1Name.toLowerCase().trim();
        const person2NameLower = person2Name.toLowerCase().trim();
        
        // If personName doesn't match person1, it must be person2
        if (personNameLower !== person1NameLower && personNameLower === person2NameLower) {
          if (correctedPersonType !== 'person2' && !personTypeCorrectedRef.current) {
            console.log('🔧 [PersonReadings] Correcting personType: person1 → person2 for', personName);
            personTypeCorrectedRef.current = true; // Prevent infinite loops
            setCorrectedPersonType('person2');
            
          }
        }
      }

      // NEW: Extract and set job status and progress
      const status = jobData.job?.status || 'pending';
      const progress = jobData.job?.progress || null;
      setJobStatus(status);
      setJobProgress(progress);
      console.log(`📊 Job status: ${status}, progress:`, progress);

      // Detect job type and calculate document range
      const jobType = jobData.job?.type || 'nuclear_v2';
      const isExtendedJob = jobType === 'extended' || jobType === 'single_system';
      const initialOrderedSystems = jobData.job?.params?.systems || [];
      const systemCount = initialOrderedSystems.length || 5;
      
      // FIX: If current job only has 1 system but person has multiple jobs, fetch from ALL jobs
      const allJobIds = person?.jobIds || [];
      const shouldAggregateJobs = initialOrderedSystems.length === 1 && allJobIds.length > 1 && jobType === 'extended';
      
      
      const docRange = getDocRange(jobType, systemCount);
      console.log('🔥 [PersonReadings] DocRange for personType =', personType, ':', docRange);
      
      // Get documents from current job first
      const documents = jobData.job?.results?.documents || [];
      
      // AGGREGATE: If current job only has 1 system, fetch from all other jobs too
      let allDocuments = documents;
      if (shouldAggregateJobs) {
        const otherJobIds = allJobIds.filter(id => id !== jobId);
        const otherJobsData = await Promise.all(
          otherJobIds.map(async (otherJobId) => {
            try {
              const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${otherJobId}`, { signal: AbortSignal.timeout(10000) });
              if (!res.ok) return null;
              const data = await res.json();
              return { jobId: otherJobId, data };
            } catch {
              return null;
            }
          })
        );
        const otherDocuments = otherJobsData
          .filter(Boolean)
          .flatMap((jd: any) => (jd.data.job?.results?.documents || []).map((doc: any) => ({ ...doc, jobId: jd.jobId })));
        allDocuments = [...documents, ...otherDocuments];
      }
      const hasAnyAudioFromApi = Array.isArray(documents) && documents.some((d: any) => !!d?.audioUrl);

      console.log('📦 Job type:', jobType, '| Extended:', isExtendedJob, '| Systems:', systemCount);
      console.log('📦 Documents from API:', documents.length);
      console.log('📦 DocRange for', personType, ':', docRange);
      if (documents.length > 0) {
        console.log('📦 First doc:', JSON.stringify(documents[0]).slice(0, 200));
        console.log('📦 All docNums:', documents.map((d: any) => d.docNum).join(', '));
      }

      // Build readings from documents (use allDocuments if aggregated)
      // For aggregated jobs, use system as key to avoid docNum conflicts
      const readingsMap: Record<string, Reading> = {};
      const documentsToProcess = shouldAggregateJobs ? allDocuments : documents;

      for (const doc of documentsToProcess) {
        const docNum = Number(doc.docNum);
        const docJobId = doc.jobId || jobId; // Use source jobId for aggregated jobs
        
        // For aggregated jobs, skip docRange check (we want all systems)
        if (!shouldAggregateJobs) {
          console.log(`🔍 [PersonReadings] Processing doc: docNum=${docNum}, docRange=${JSON.stringify(docRange)}, includes=${docRange.includes(docNum)}, personType=${personType}`);
          if (!docNum || !docRange.includes(docNum)) {
            console.log(`❌ [PersonReadings] SKIPPING doc ${docNum} - not in range ${JSON.stringify(docRange)} for personType=${personType}`);
            continue;
          } else {
            console.log(`✅ [PersonReadings] KEEPING doc ${docNum} - in range for personType=${personType}`);
          }
        }

        // Use system from backend if available, otherwise calculate from docNum
        let system: { id: string; name: string } | undefined;
        
        if (doc.system) {
          // Backend provides system - use it directly (fixes Vedic showing as Western)
          system = SYSTEMS.find(s => s.id === doc.system);
          if (!system) {
            // Fallback: try to find by name match
            system = SYSTEMS.find(s => s.name.toLowerCase().includes(doc.system.toLowerCase()));
          }
        }
        
        // Fallback to docNum-based calculation for backward compatibility
        if (!system) {
          let systemIndex: number;
          let isVerdict = false;

          if (isExtendedJob || personType === 'individual') {
            // Extended jobs: docs 1-5 map directly to systems 0-4
            systemIndex = docNum - 1;
          } else if (personType === 'person1') {
            // Nuclear person1: docs 1-5 → systems 0-4
            systemIndex = docNum - 1;
          } else if (personType === 'person2') {
            // Nuclear person2: docs 6-10 → systems 0-4
            systemIndex = docNum - 6;
          } else {
            // Nuclear overlay: docs 11-15 → systems 0-4, doc 16 → verdict
            if (docNum === 16) {
              isVerdict = true;
              systemIndex = 5;
            } else {
              systemIndex = docNum - 11;
            }
          }

          system = isVerdict ? SYSTEMS[5] : SYSTEMS[systemIndex];
        }
        
        if (!system) continue;

        // Use system.id as key for aggregated jobs (avoids docNum conflicts)
        const mapKey = shouldAggregateJobs ? system.id : String(docNum);
        
        // If reading already exists (from another job), merge artifacts (keep best)
        const existing = readingsMap[mapKey];
        const reading = {
          id: existing?.id || `reading-${docNum}-${docJobId}`,
          system: system.id,
          name: system.name,
          docNum: existing?.docNum || docNum, // CRITICAL: Store docNum for artifact matching
          jobId: existing?.jobId || docJobId, // CRITICAL: Store jobId for artifact fetching
          pdfPath: existing?.pdfPath || doc.pdfUrl || undefined,
          // Use backend proxy URLs (streams bytes directly, iOS compatible)
          audioPath: existing?.audioPath || (doc.audioUrl ? `${env.CORE_API_URL}/api/jobs/v2/${docJobId}/audio/${docNum}` : undefined),
          songPath: existing?.songPath || (doc.songUrl ? `${env.CORE_API_URL}/api/jobs/v2/${docJobId}/song/${docNum}` : undefined),
          timestamp: existing?.timestamp || doc.created_at || jobData?.job?.created_at || new Date().toISOString(),
        };
        readingsMap[mapKey] = reading;
        

        console.log(`📄 Doc ${docNum} (${system.name}): pdf=${!!doc.pdfUrl} audio=${!!doc.audioUrl} song=${!!doc.songUrl}, docNum=${reading.docNum}, jobId=${reading.jobId}`);
        if (doc.audioUrl) {
          console.log(`   🎵 Audio URL: ${doc.audioUrl.substring(0, 80)}...`);
        }
        if (doc.songUrl) {
          console.log(`   🎶 Song URL: ${doc.songUrl.substring(0, 80)}...`);
        }
      }

      console.log('📦 Readings built:', Object.keys(readingsMap).length);

      // ALWAYS sync from Supabase artifacts - this ensures we get ALL artifacts even if API is incomplete
      // This makes the app resilient and ensures complete sync from Supabase
      if (isSupabaseConfigured) {
        try {
          // Fetch artifacts from ALL jobs if aggregating, otherwise just current job
          const jobIdsToCheck = shouldAggregateJobs ? allJobIds : [jobId];
          const allArtifacts: any[] = [];
          
          for (const checkJobId of jobIdsToCheck) {
            const { data: arts, error: aErr } = await supabase
              .from('job_artifacts')
              .select('*')
              .eq('job_id', checkJobId)
              .order('created_at', { ascending: true });
            
            if (!aErr && arts) {
              // Attach jobId to each artifact for aggregation
              allArtifacts.push(...arts.map((a: any) => ({ ...a, sourceJobId: checkJobId })));
            }
          }

          // #endregion

          // Fetch tasks to derive docNum from sequence (like backend does)
          const taskIdToSequence: Record<string, number> = {};
          for (const checkJobId of jobIdsToCheck) {
            try {
              const { data: tasks } = await supabase
                .from('job_tasks')
                .select('id, sequence')
                .eq('job_id', checkJobId);
              
              if (tasks) {
                tasks.forEach((t: any) => {
                  taskIdToSequence[t.id] = t.sequence;
                });
              }
            } catch (e) {
              // Ignore task fetch errors
            }
          }

          const byDoc: Record<string, { pdfPath?: string; audioPath?: string; songPath?: string; jobId?: string; system?: string }> = {};
          
          for (const a of allArtifacts) {
            const meta = (a as any).metadata || {};
            let docNumRaw = meta?.docNum ?? meta?.chapter_index;
            
            // Derive docNum from task sequence if missing (like backend does)
            if ((typeof docNumRaw !== 'number' || isNaN(docNumRaw)) && (a as any).task_id) {
              const seq = taskIdToSequence[(a as any).task_id];
              if (typeof seq === 'number') {
                if (seq >= 200) {
                  docNumRaw = seq - 199; // Audio: 200→1, 201→2, etc.
                } else if (seq >= 100) {
                  docNumRaw = seq - 99; // PDF: 100→1, 101→2, etc.
                } else {
                  docNumRaw = seq + 1; // Text: 0→1, 1→2, etc.
                }
              }
            }
            
            const docNum = typeof docNumRaw === 'number' && !isNaN(docNumRaw) ? docNumRaw : null;
            const system = meta?.system || null;
            
            // Determine key: for aggregated jobs prefer system, otherwise docNum
            let key: string | null = null;
            if (shouldAggregateJobs && system) {
              key = system;
            } else if (docNum) {
              key = String(docNum);
            } else if (shouldAggregateJobs && docNum) {
              // Fallback: try to map docNum to system for aggregated jobs
              const systemIndex = docNum - 1;
              if (systemIndex >= 0 && systemIndex < SYSTEMS.length) {
                key = SYSTEMS[systemIndex].id;
              }
            }
            
            if (!key) {
              continue;
            }
            
            // For non-aggregated jobs, check docRange (except nuclear_v2 - load all documents)
            if (!shouldAggregateJobs && jobType !== 'nuclear_v2' && docNum && !docRange.includes(docNum)) continue;

            const t = String((a as any).artifact_type || '');
            const sourceJobId = (a as any).sourceJobId || jobId;
            
            if (t === 'pdf') {
              byDoc[key] = byDoc[key] || { jobId: sourceJobId, system: system || undefined };
              byDoc[key].pdfPath = (a as any).storage_path;
            }
            if (t === 'audio' || t.startsWith('audio_')) {
              // Skip songs in this block (handled separately)
              if (t === 'audio_song') continue;
              byDoc[key] = byDoc[key] || { jobId: sourceJobId, system: system || undefined };
              byDoc[key].audioPath = (a as any).storage_path;
            }
            if (t === 'audio_song') {
              byDoc[key] = byDoc[key] || { jobId: sourceJobId, system: system || undefined };
              byDoc[key].songPath = (a as any).storage_path;
            }
          }

          // Sign URLs in parallel (1h) for all found artifacts
          const keysToProcess = Object.keys(byDoc);
          const signed = await Promise.all(
            keysToProcess.map(async (key) => {
              const entry = byDoc[key];
              const [pdfUrl, audioUrl, songUrl] = await Promise.all([
                entry.pdfPath ? createArtifactSignedUrl(entry.pdfPath, 60 * 60) : Promise.resolve(null),
                entry.audioPath ? createArtifactSignedUrl(entry.audioPath, 60 * 60) : Promise.resolve(null),
                entry.songPath ? createArtifactSignedUrl(entry.songPath, 60 * 60) : Promise.resolve(null),
              ]);
              return { key, pdfUrl, audioUrl, songUrl, jobId: entry.jobId };
            })
          );

          // Update readingsMap with Supabase artifacts (fill gaps, Supabase wins for missing API data)
          for (const s of signed) {
            if (!s) continue;
            const r = readingsMap[s.key];
            // Map key to docNum for proxy URL (key is docNum string or system ID)
            const docNumFromKey = !isNaN(parseInt(s.key, 10)) ? parseInt(s.key, 10) : 
              (SYSTEMS.findIndex(sys => sys.id === s.key) + 1) || 1;
            
            console.log('🔍 [Supabase Artifact Sync] Processing artifact:', {
              key: s.key,
              docNumFromKey,
              hasExistingReading: !!r,
              existingDocNum: r?.docNum,
              jobId: s.jobId
            });
            
            if (r) {
              // Update existing reading - fill gaps, prefer Supabase if API didn't provide
              // Use backend proxy URLs for iOS compatibility
              if (!r.docNum) {
                r.docNum = docNumFromKey; // Ensure docNum is set
                console.log(`  ✅ Set docNum=${docNumFromKey} for reading ${r.id}`);
              }
              if (!r.jobId) {
                r.jobId = s.jobId; // Ensure jobId is set
                console.log(`  ✅ Set jobId=${s.jobId} for reading ${r.id}`);
              }
              // Use existing docNum from API if available (more accurate than calculated docNumFromKey)
              const effectiveDocNum = r.docNum || docNumFromKey;
              if (!r.pdfPath && s.pdfUrl) r.pdfPath = s.pdfUrl;
              if (!r.audioPath && s.audioUrl) r.audioPath = `${env.CORE_API_URL}/api/jobs/v2/${r.jobId || s.jobId}/audio/${effectiveDocNum}`;
              if (!r.songPath && s.songUrl) r.songPath = `${env.CORE_API_URL}/api/jobs/v2/${r.jobId || s.jobId}/song/${effectiveDocNum}`;
            } else if (shouldAggregateJobs) {
              // For aggregated jobs, create reading from Supabase artifact if not in API response
              const system = SYSTEMS.find(sys => sys.id === s.key);
              if (system) {
                readingsMap[s.key] = {
                  id: `reading-${s.key}-${s.jobId}`,
                  system: system.id,
                  name: system.name,
                  docNum: docNumFromKey, // CRITICAL: Store docNum
                  jobId: s.jobId, // CRITICAL: Store jobId
                  pdfPath: s.pdfUrl || undefined,
                  audioPath: s.audioUrl ? `${env.CORE_API_URL}/api/jobs/v2/${s.jobId}/audio/${docNumFromKey}` : undefined,
                  songPath: s.songUrl ? `${env.CORE_API_URL}/api/jobs/v2/${s.jobId}/song/${docNumFromKey}` : undefined,
                  timestamp: jobData?.job?.created_at || new Date().toISOString(),
                };
              }
            }
          }
          
        } catch (e) {
          console.error('⚠️ Error syncing from Supabase:', e);
        }
      }

      // Fill in missing with placeholders - ONLY show systems that were actually ordered
      // For aggregated jobs, show all 5 systems
      const orderedSystems = shouldAggregateJobs 
        ? ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah']
        : (jobData.job?.params?.systems || []);
      console.log(`📋 Ordered systems from job params:`, orderedSystems);
      const systemsToShow = personType === 'overlay' 
        ? SYSTEMS 
        : SYSTEMS.filter(s => orderedSystems.includes(s.id));
      
      // If no systems specified, fall back to showing first N systems (legacy behavior)
      const finalSystemsToShow = systemsToShow.length > 0 ? systemsToShow : SYSTEMS.slice(0, systemCount);
      console.log(`📋 Final systems to show (${finalSystemsToShow.length}):`, finalSystemsToShow.map(s => s.name));
      
      // Build finalReadings: for aggregated jobs, use system-based lookup; otherwise use docNum
      let finalReadings: Reading[];
      if (shouldAggregateJobs) {
        // Aggregated: map each system to its reading (or placeholder)
        finalReadings = finalSystemsToShow.map((sys, i) => {
          const reading = readingsMap[sys.id];
          if (reading) {
            console.log(`✅ [PersonReadings] Found reading in map for system ${sys.id}`);
            return reading;
          }
          console.log(`⚠️ [PersonReadings] No reading in map for system ${sys.id}, creating placeholder`);
          return {
            id: `placeholder-${sys.id}`,
            system: sys.id,
            name: sys.name,
            timestamp: jobData?.job?.created_at || new Date().toISOString(),
          };
        });
      } else {
        // Normal: use docNum-based lookup
        finalReadings = docRange.map((docNum, i) => {
          const reading = readingsMap[String(docNum)];
          if (reading) {
            console.log(`✅ [PersonReadings] Found reading in map for docNum ${docNum}`);
            return reading;
          }
          console.log(`⚠️ [PersonReadings] No reading in map for docNum ${docNum}, creating placeholder`);
          const sys = finalSystemsToShow[i] || SYSTEMS[0];
          return {
            id: `placeholder-${docNum}`,
            system: sys.id,
            name: sys.name,
            timestamp: jobData?.job?.created_at || new Date().toISOString(),
          };
        });
      }

      // Add numbering + timestamps for duplicate system readings (newest first)
      const systemGroups: Record<string, typeof finalReadings> = {};
      finalReadings.forEach(r => {
        if (!systemGroups[r.system]) systemGroups[r.system] = [];
        systemGroups[r.system].push(r);
      });

      // Format names with numbers/dates if duplicates exist
      finalReadings = finalReadings.map(r => {
        const group = systemGroups[r.system];
        if (group.length > 1) {
          // Multiple readings of same system - add numbering + timestamp
          // Sort by docNum DESC (newest first - assumes higher docNum = newer)
          const sortedGroup = [...group].sort((a, b) => {
            const aNum = Number(a.id.match(/\d+/)?.[0] || 0);
            const bNum = Number(b.id.match(/\d+/)?.[0] || 0);
            return bNum - aNum; // DESC = newest first
          });
          const index = sortedGroup.indexOf(r) + 1;
          const timestamp = jobData?.job?.created_at || new Date().toISOString();
          const date = new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          return {
            ...r,
            name: index === 1 ? `${r.name} (${date})` : `${r.name} ${index} (${date})`
          };
        }
        // Single reading - no number/date needed
        return r;
      });

      // Show all readings if job is processing, otherwise filter out truly empty ones
      // This allows inactive placeholder readings to be visible while job processes
      const isJobProcessing = status === 'processing' || status === 'pending' || status === 'queued';
      const realReadings = isJobProcessing 
        ? finalReadings // Show all placeholders while processing
        : finalReadings.filter(r => {
            // After job completes, only show readings with at least one artifact
            const hasRealContent = !!(r.pdfPath || r.audioPath || r.songPath);
            return hasRealContent;
          });

      // If no real readings exist, show nothing (empty state)
      // Don't show placeholders for incomplete/failed jobs
      
      // Debug: Log all readings with their docNum values
      console.log('📋 [PersonReadings] Final readings array:', realReadings.map(r => ({
        id: r.id,
        system: r.system,
        name: r.name,
        docNum: r.docNum,
        jobId: r.jobId,
        hasAudio: !!r.audioPath,
        hasPdf: !!r.pdfPath,
        hasSong: !!r.songPath,
        hasLocalAudio: !!r.localAudioPath,
        hasLocalPdf: !!r.localPdfPath,
        hasLocalSong: !!r.localSongPath
      })));
      
      setReadings(realReadings);

      // AUDIBLE-STYLE PERSISTENCE: Sync to store for persistent library
      // CRITICAL: Only sync readings that have at least one artifact (prevents empty readings in cache)
      if (personId && jobId && realReadings.length > 0) {
        // Check if readings already exist in store for this job
        const existingReadings = getReadingsByJobId(personId, jobId);
        
        if (existingReadings.length === 0) {
          // First time loading - create placeholders ONLY for readings with artifacts
          // This prevents empty readings from being saved to the store
          const systemsWithArtifacts = realReadings
            .filter(r => !!(r.pdfPath || r.audioPath || r.songPath))
            .map(r => r.system as any);
          
          if (systemsWithArtifacts.length > 0) {
            const createdAt = jobData?.job?.created_at || new Date().toISOString();
            createPlaceholderReadings(personId, jobId, systemsWithArtifacts, createdAt);
            console.log(`✅ Created ${systemsWithArtifacts.length} placeholder readings in store for job ${jobId} (only systems with artifacts)`);
          }
        }
        
        // Sync artifact paths to store (updates existing placeholders)
        // CRITICAL: Only sync readings that have at least one artifact
        for (const reading of realReadings) {
          // Skip readings without any artifacts - don't save empty readings to store
          if (!reading.pdfPath && !reading.audioPath && !reading.songPath) {
            console.log(`⚠️ Skipping sync for ${reading.system} - no artifacts`);
            continue;
          }
          
          // Find corresponding store reading by system + jobId
          const storeReading = getReadingsByJobId(personId, jobId).find(r => r.system === reading.system);
          if (storeReading) {
            syncReadingArtifacts(personId, storeReading.id, {
              pdfPath: reading.pdfPath,
              audioPath: reading.audioPath,
              songPath: reading.songPath,
              duration: reading.duration,
            });
          }
        }
        console.log(`✅ Synced ${realReadings.filter(r => !!(r.pdfPath || r.audioPath || r.songPath)).length} readings to store (only readings with artifacts)`);
      }
    } catch (e: any) {
      const errorMsg = e.name === 'AbortError' ? 'Request timed out' : e.message;
      console.error('❌ [PersonReadings] Error loading readings:', errorMsg);
      // Only set error if we were refreshing existing readings (had readings before error)
      // If no readings existed, just show empty state - no error needed
      const hadReadingsBeforeError = readings.length > 0;
      if (hadReadingsBeforeError) {
        setLoadError(errorMsg || 'Could not load reading');
        // Keep existing readings so user can retry
      } else {
        setLoadError(null); // Clear error - empty state is appropriate when no readings exist
        setReadings([]);
      }
    } finally {
      console.log('✅ [PersonReadings] Load finished, setting loading=false');
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [jobId, personType, personName]); // ✅ REMOVED readings.length to prevent infinite loop

  /**
   * V2 loader: one row per (system × job instance), newest-first by job.created_at.
   * Also hydrates any already-downloaded local files from profileStore (savedAudios/savedPDFs).
   */
  const loadV2 = useCallback(async () => {
    if (readingsCountRef.current === 0) setLoading(true);
    else setIsRefreshing(true);
    setLoadError(null);

    const REQUEST_TIMEOUT_MS = 30000;
    const MAX_ATTEMPTS = 2;

    // STABILITY RULE: This screen renders a single "receipt" (one job) only.
    // Never aggregate across person.jobIds here — it causes mixing + thrash and makes the UI hard to test.
    const uniqueJobIds = (jobId ? [jobId] : []) as string[];

    if (uniqueJobIds.length === 0) {
      setReadings([]);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    const fetchJobWithRetry = async (jid: string) => {
      let lastErr: any = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${jid}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            throw new Error(`Failed to load job (${res.status}) ${errorText}`);
          }
          const data = await res.json();
          return data?.job ? data : null;
        } catch (e: any) {
          clearTimeout(timeoutId);
          lastErr = e;
          if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 600));
        }
      }
      throw lastErr || new Error('Failed to load job');
    };

    try {
      const jobPayloads = (await Promise.all(
        uniqueJobIds.map(async (jid) => {
          try {
            const payload = await fetchJobWithRetry(jid);
            return payload ? { jid, payload } : null;
          } catch {
            return null;
          }
        })
      )).filter(Boolean) as Array<{ jid: string; payload: any }>;

      const jobs = jobPayloads.map(({ payload }) => payload.job).filter(Boolean);
      const primaryJob = jobs[0];
      if (primaryJob) {
        setJobStatus(primaryJob.status || 'pending');
        setJobProgress(primaryJob.progress || null);
      }

      // Determine the effective view type for nuclear_v2 based on job params + personName.
      // This avoids relying on docNum ranges (which are NOT grouped by person in our DB schema),
      // and also protects against wrong personType being passed from navigation.
      const normalizeName = (v: any) => String(v || '').toLowerCase().trim();
      const effectiveViewType: 'individual' | 'person1' | 'person2' | 'overlay' = (() => {
        if (personType === 'overlay') return 'overlay';
        // If title includes "&", treat as overlay view.
        if (String(personName || '').includes('&')) return 'overlay';
        const jt = String(primaryJob?.type || '');
        if (jt === 'nuclear_v2') {
          const p = (primaryJob?.params || primaryJob?.input || {}) as any;
          const p1 = normalizeName(p?.person1?.name);
          const p2 = normalizeName(p?.person2?.name);
          const pn = normalizeName(personName);
          if (pn && p2 && pn === p2) return 'person2';
          if (pn && p1 && pn === p1) return 'person1';
        }
        return (personType as any) || 'person1';
      })();

      const systemIdForDoc = (jobType: string, systems: string[], docNum: number) => {
        if (jobType === 'extended' || jobType === 'single_system' || personType === 'individual') {
          const idx = Math.max(0, docNum - 1);
          return systems[idx] || SYSTEMS[idx]?.id || 'western';
        }
        // NOTE: For nuclear_v2 we do NOT rely on docNum ranges to map system.
        // We prefer doc.system from API; fallback handled below.
        if (personType === 'person1') return SYSTEMS[Math.max(0, docNum - 1)]?.id || 'western';
        if (personType === 'person2') return SYSTEMS[Math.max(0, docNum - 6)]?.id || 'western';
        if (personType === 'overlay') {
          if (docNum === 16) return 'verdict';
          return SYSTEMS[Math.max(0, docNum - 11)]?.id || 'western';
        }
        return 'western';
      };

      const rows: Reading[] = [];

      // If this screen title is a couple (e.g. "Charmaine & Michael"), use docNum ranges
      // to label each system card with the correct person, so we never show duplicates like
      // "Gene Keys / Gene Keys" without names.
      const parsePair = (value: string) => {
        const parts = String(value || '')
          .split('&')
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length >= 2) return { a: parts[0], b: parts.slice(1).join(' & ') };
        return null;
      };
      const pair = parsePair(personName);
      const nuclearV2DocTypeForDocNum = (docNum: number): 'person1' | 'person2' | 'overlay' | 'verdict' => {
        if (docNum === 16) return 'verdict';
        const mod = (docNum - 1) % 3;
        return mod === 0 ? 'person1' : mod === 1 ? 'person2' : 'overlay';
      };
      const nuclearV2SystemForDocNum = (docNum: number): string => {
        if (docNum === 16) return 'verdict';
        const systemOrder = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
        const idx = Math.floor((docNum - 1) / 3);
        return systemOrder[idx] || 'western';
      };
      const nuclearV2DocNumFor = (systemId: string, docType: 'person1' | 'person2' | 'overlay'): number => {
        const systemOrder = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
        const idx = Math.max(0, systemOrder.indexOf(systemId));
        const base = idx * 3;
        if (docType === 'person1') return base + 1;
        if (docType === 'person2') return base + 2;
        return base + 3;
      };
      const labelForDoc = (docType: string) => {
        if (!pair) return null;
        if (docType === 'person1') return pair.a;
        if (docType === 'person2') return pair.b;
        if (docType === 'overlay') return `${pair.a} & ${pair.b}`;
        if (docType === 'verdict') return 'Final Verdict';
        return null;
      };

      for (const j of jobs as any[]) {
        const jt = String(j?.type || '');
        // Keep couple-only job types out of single-person views.
        if (jt === 'synastry' && personType !== 'overlay') continue;

        const createdAt = j?.created_at || new Date().toISOString();
        const systems: string[] = Array.isArray(j?.params?.systems) ? j.params.systems : [];
        const docs: any[] = Array.isArray(j?.results?.documents) ? j.results.documents : [];
        const systemCount = systems.length || 5;
        const docRange = getDocRange(jt, systemCount);

        const desiredDocTypesForJob = (() => {
          if (jt !== 'nuclear_v2') return null as null | string[];
          if (effectiveViewType === 'overlay') return ['overlay', 'verdict'];
          if (effectiveViewType === 'person1') return ['person1'];
          if (effectiveViewType === 'person2') return ['person2'];
          return ['person1'];
        })();

        if (docs.length > 0) {
          for (const doc of docs) {
            const docNum = Number(doc?.docNum);
            if (!docNum) continue;

            // For nuclear_v2: filter by docType, NOT docNum range
            const docTypeFromApi = String(doc?.docType || doc?.doc_type || '');
            const docType = jt === 'nuclear_v2'
              ? (docTypeFromApi || nuclearV2DocTypeForDocNum(docNum))
              : docTypeFromApi;

            // For nuclear_v2: Load ALL documents (all 16) so all media can be downloaded
            // For other job types: filter by docRange
            if (jt !== 'nuclear_v2' && !docRange.includes(docNum)) continue;

            const systemId = String(
              doc?.system ||
              (jt === 'nuclear_v2' ? nuclearV2SystemForDocNum(docNum) : systemIdForDoc(jt, systems, docNum))
            );
            const systemName = SYSTEMS.find((s) => s.id === systemId)?.name || systemId;
            const who = labelForDoc(docType);
            const displayName = who ? `${systemName} — ${who}` : systemName;
            const rowId = `row-${j.id}-${docNum}`;

            const localPdf = savedPDFs.find((p) => p.readingId === `${rowId}:pdf`)?.filePath;
            const localAudio = savedAudios.find((a) => a.readingId === `${rowId}:audio`)?.filePath;
            const localSong = savedAudios.find((a) => a.readingId === `${rowId}:song`)?.filePath;

            rows.push({
              id: rowId,
              jobId: j.id,
              docNum,
              system: systemId,
              name: displayName,
              timestamp: createdAt,
              pdfPath: doc?.pdfUrl || undefined,
              // Use backend proxy URLs (streams bytes directly, iOS compatible)
              audioPath: doc?.audioUrl ? `${env.CORE_API_URL}/api/jobs/v2/${j.id}/audio/${docNum}` : undefined,
              songPath: doc?.songUrl ? `${env.CORE_API_URL}/api/jobs/v2/${j.id}/song/${docNum}` : undefined,
              localPdfPath: localPdf,
              localAudioPath: localAudio,
              localSongPath: localSong,
            });
          }
        } else if (systems.length > 0) {
          // Placeholder generation (e.g. processing jobs with no documents yet)
          if (jt === 'nuclear_v2') {
            // For nuclear_v2: Create placeholders for ALL 16 documents (all systems × all doc types + verdict)
            // This ensures all media can be downloaded when ready
            const sysOrder = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
            const docTypes: Array<'person1' | 'person2' | 'overlay'> = ['person1', 'person2', 'overlay'];

            for (const sysId of sysOrder) {
              for (const docType of docTypes) {
                const docNum = nuclearV2DocNumFor(sysId, docType);
                const sysName = SYSTEMS.find((s) => s.id === sysId)?.name || sysId;
                const who = labelForDoc(docType);
                const displayName = who ? `${sysName} — ${who}` : sysName;
                const rowId = `row-${j.id}-${docNum}`;

                const localPdf = savedPDFs.find((p) => p.readingId === `${rowId}:pdf`)?.filePath;
                const localAudio = savedAudios.find((a) => a.readingId === `${rowId}:audio`)?.filePath;
                const localSong = savedAudios.find((a) => a.readingId === `${rowId}:song`)?.filePath;

                rows.push({
                  id: rowId,
                  jobId: j.id,
                  docNum,
                  system: sysId,
                  name: displayName,
                  timestamp: createdAt,
                  localPdfPath: localPdf,
                  localAudioPath: localAudio,
                  localSongPath: localSong,
                });
              }
            }

            // Verdict placeholder (docNum 16)
            const rowId = `row-${j.id}-16`;
            rows.push({
              id: rowId,
              jobId: j.id,
              docNum: 16,
              system: 'verdict',
              name: 'Final Verdict',
              timestamp: createdAt,
            });
            continue;
          }

          for (const docNum of docRange) {
            const sysId = systemIdForDoc(jt, systems, docNum);
            const sysName = SYSTEMS.find((s) => s.id === sysId)?.name || sysId;
            const who = labelForDoc(String(docNum));
            const displayName = who ? `${sysName} — ${who}` : sysName;
            const rowId = `row-${j.id}-${docNum}`;

            const localPdf = savedPDFs.find((p) => p.readingId === `${rowId}:pdf`)?.filePath;
            const localAudio = savedAudios.find((a) => a.readingId === `${rowId}:audio`)?.filePath;
            const localSong = savedAudios.find((a) => a.readingId === `${rowId}:song`)?.filePath;

            rows.push({
              id: rowId,
              jobId: j.id,
              docNum,
              system: sysId,
              name: displayName,
              timestamp: createdAt,
              localPdfPath: localPdf,
              localAudioPath: localAudio,
              localSongPath: localSong,
            });
          }
        }
      }

      // -----------------------------------------------------------------------
      // FINALIZE LIST (dedupe + correct order)
      // User expectation:
      // - individual/person1/person2: ALWAYS 5 systems in fixed order
      // - overlay: ALWAYS 6 systems in fixed order incl Final Verdict
      // Also: never show duplicates of the same system (e.g. "Vedic" twice)
      // even if multiple jobs exist.
      // -----------------------------------------------------------------------
      const tsValue = (r: Reading) => Date.parse(r.timestamp || '') || 0;
      const pickLatest = (list: Reading[]) =>
        list
          .slice()
          .sort((a, b) => tsValue(b) - tsValue(a) || (b.docNum || 0) - (a.docNum || 0))[0];

      const makePlaceholder = (systemId: string, systemName: string): Reading => ({
        id: `placeholder-${jobId || 'job'}-${effectiveViewType}-${systemId}`,
        jobId: jobId || undefined,
        system: systemId,
        name: systemName,
        timestamp: new Date().toISOString(),
      });

      const orderedSystemIds =
        effectiveViewType === 'overlay'
          ? (['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict'] as const)
          : (['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'] as const);

      const normalized = rows.map((r) => ({
        ...r,
        system: r.system === 'vedic' ? 'vedic' : r.system, // (noop, but keeps intent explicit)
      }));

      const finalized: Reading[] = orderedSystemIds.map((sysId) => {
        const candidates = normalized.filter((r) => r.system === sysId);
        if (candidates.length > 0) return pickLatest(candidates);
        const sysName = SYSTEMS.find((s) => s.id === sysId)?.name || String(sysId);
        return makePlaceholder(sysId, sysName);
      });

      // Enrich readings with local cached paths from artifact cache service
      // This provides instant playback for previously downloaded files
      if (jobId) {
        try {
          const cachedPaths = await getLocalArtifactPaths(jobId);
          for (const reading of finalized) {
            if (!reading.docNum) continue;
            const cached = cachedPaths.get(reading.docNum);
            if (cached) {
              // IMPORTANT: local*Path must ONLY be set when a verified local file exists.
              // Some caches may store remote URLs; those must NOT enable buttons.
              const isLikelyLocalFile = (p?: string | null) =>
                !!p && !p.startsWith('http') && (p.startsWith('file://') || p.startsWith('/'));

              if (cached.audioPath && !reading.localAudioPath && isLikelyLocalFile(cached.audioPath)) {
                if (await fileExistsNonEmpty(cached.audioPath)) {
                  reading.localAudioPath = cached.audioPath;
                }
              }
              if (cached.pdfPath && !reading.localPdfPath && isLikelyLocalFile(cached.pdfPath)) {
                if (await fileExistsNonEmpty(cached.pdfPath)) {
                  reading.localPdfPath = cached.pdfPath;
                }
              }
              if (cached.songPath && !reading.localSongPath && isLikelyLocalFile(cached.songPath)) {
                if (await fileExistsNonEmpty(cached.songPath)) {
                  reading.localSongPath = cached.songPath;
                }
              }
            }
          }
          console.log(`✅ [V2 Loader] Enriched readings with ${cachedPaths.size} cached artifact paths`);
        } catch (e) {
          console.warn('[V2 Loader] Failed to get cached artifact paths:', e);
        }
      }

      setReadings(finalized);
    } catch (e: any) {
      const errorMsg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Could not load reading');
      setLoadError(errorMsg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [jobId, person?.jobIds, personType, savedAudios, savedPDFs]);

  // Reload when personType is corrected (workaround for MyLibraryScreen bug) - only once
  const hasReloadedAfterCorrectionRef = useRef(false);
  useEffect(() => {
    if (correctedPersonType !== personType && correctedPersonType === 'person2' && !hasReloadedAfterCorrectionRef.current) {
      console.log('🔄 [PersonReadings] Reloading due to personType correction');
      hasReloadedAfterCorrectionRef.current = true; // Only reload once
      loadV2();
    }
  }, [correctedPersonType, personType, loadV2]);

  // Load data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadV2();
    }, [loadV2])
  );

  // Separate cleanup effect that ALWAYS runs on unmount/blur - no dependencies
  // This ensures audio stops even if loadV2 changes
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log('🛑 [PersonReadings] Screen losing focus - stopping all audio');
        // Stop polling when leaving
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        // Stop audio when leaving
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => {});
          soundRef.current.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
        if (songSoundRef.current) {
          songSoundRef.current.stopAsync().catch(() => {});
          songSoundRef.current.unloadAsync().catch(() => {});
          songSoundRef.current = null;
        }
        setPlayingId(null);
        setPlayingSongId(null);
      };
    }, []) // Empty deps - cleanup always runs the same way
  );

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Auto-refresh ONLY while job is actively generating (processing/pending/queued).
  // Once job is complete, no need to poll - all content should be available.
  useEffect(() => {
    if (!jobId) return;
    if (loading) return;
    if (playingId) return; // don't disrupt active playback
    if (playingSongId) return; // don't disrupt active playback

    // STOP polling if job is complete or failed
    const jobIsActive = jobStatus === 'processing' || jobStatus === 'pending' || jobStatus === 'queued';
    if (!jobIsActive) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        console.log('✅ Job complete - stopping poll');
      }
      return;
    }

    // Only poll if job is still generating.
    // IMPORTANT: Polling causes UI churn; keep it extremely conservative.
    if (pollTimerRef.current) return; // already polling

    const pollInterval = 15000; // Poll every 15s while generating
    console.log(`🔄 Starting poll (job ${jobStatus}) every ${pollInterval}ms`);

    pollTimerRef.current = setInterval(() => {
      // If the user is interacting or any audio is active, don't poll.
      if (isScrubbing || isSongScrubbing) return;
      if (playingId || playingSongId) return;
      if (isPlayingMutex.current || isSongPlayingMutex.current) return;
      if (soundRef.current || songSoundRef.current) return;
      loadV2();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobId, jobStatus, loading, playingId, isScrubbing, isSongScrubbing, loadV2]);

  // Initialize headlines immediately with fallbacks.
  // IMPORTANT: do NOT preload all texts/titles; fetch on-demand when the user presses play.
  useEffect(() => {
    if (readings.length === 0) return;
    for (const reading of readings) {
      if (!readingHeadlines[reading.id]) {
        setReadingHeadlines((prev) => ({ ...prev, [reading.id]: reading.name }));
      }
      if (!songTitles[reading.id]) {
        setSongTitles((prev) => ({ ...prev, [reading.id]: reading.name }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readings.length]);

  // REALTIME SYNC: Listen for download completions and update readings instantly
  // This provides instant UI updates when artifacts are downloaded in background
  useEffect(() => {
    if (!jobId) return;

    const unsubscribe = onDownloadComplete((downloadJobId, docNum, type, localPath) => {
      // Only handle downloads for this job
      if (downloadJobId !== jobId) return;

      console.log(`📡 [PersonReadings] Realtime download complete: ${type} for doc ${docNum}`);

      // Update the reading with the new local path
      setReadings((prev) =>
        prev.map((r) => {
          if (r.docNum !== docNum) return r;

          const updates: Partial<Reading> = {};
          if (type === 'audio') updates.localAudioPath = localPath;
          if (type === 'pdf') updates.localPdfPath = localPath;
          if (type === 'song') updates.localSongPath = localPath;

          return { ...r, ...updates };
        })
      );
    });

    return () => unsubscribe();
  }, [jobId]);

  // Pulsating animation for generating items
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false, // Must be false for color animation
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    
    // Blinking animation for generating cards (opacity)
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: false, // Must match pulseAnim to avoid conflicts
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false, // Must match pulseAnim to avoid conflicts
        }),
      ])
    );
    
    // Only animate if there are items that need downloading
    // Animation stays until files are ACTUALLY downloaded locally, not just when remote paths exist
    (async () => {
      let hasGeneratingItems = false;
      
      for (const r of readings) {
        // Check if remote paths exist
        const needsPdf = r.pdfPath && !r.localPdfPath;
        const needsAudio = r.audioPath && !r.localAudioPath;
        const needsSong = r.songPath && !r.localSongPath;
        
        // If remote exists but local doesn't, check if file actually exists
        if (needsPdf || needsAudio || needsSong) {
          // Check if files actually exist on disk (not just if paths are set)
          const pdfExists = r.localPdfPath ? await fileExistsNonEmpty(r.localPdfPath) : !r.pdfPath;
          const audioExists = r.localAudioPath ? await fileExistsNonEmpty(r.localAudioPath) : !r.audioPath;
          const songExists = r.localSongPath ? await fileExistsNonEmpty(r.localSongPath) : !r.songPath;
          
          // If we have remote but not local (or local file doesn't exist), keep animating
          if ((r.pdfPath && !pdfExists) || (r.audioPath && !audioExists) || (r.songPath && !songExists)) {
            hasGeneratingItems = true;
            break;
          }
        }
        
        // Also check if remote paths don't exist yet (still generating)
        if (!r.pdfPath && !r.audioPath && !r.songPath && (jobStatus === 'processing' || jobStatus === 'pending' || jobStatus === 'queued')) {
          hasGeneratingItems = true;
          break;
        }
      }
      
      if (hasGeneratingItems) {
        pulseAnimation.start();
        blinkAnimation.start();
      } else {
        pulseAnimation.stop();
        blinkAnimation.stop();
      }
    })();
    
    return () => {
      pulseAnimation.stop();
      blinkAnimation.stop();
    };
  }, [readings, pulseAnim, blinkAnim, jobStatus, fileExistsNonEmpty]);

  // Interpolate scale and colors from pulseAnim
  const animatedScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const pdfColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FEE2E2'], // White to light red
  });

  const audioColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#DBEAFE'], // White to light blue
  });

  const songColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FCE7F3'], // White to light pink
  });

  // Auto-expand/collapse text when audio or song plays
  useEffect(() => {
    const currentPlayingReadingId = playingId || playingSongId;
    
    if (currentPlayingReadingId) {
      // Auto-expand text when audio/song starts
      setExpandedTextIds(prev => new Set(prev).add(currentPlayingReadingId));
    } else {
      // Auto-collapse all text when nothing is playing
      setExpandedTextIds(new Set());
    }
  }, [playingId, playingSongId]);

  // Auto-scroll text based on audio playback position
  useEffect(() => {
    const activePlayingId = playingId || playingSongId;
    const activeDuration = playingId ? playbackDuration : songDuration;
    const activePosition = playingId ? playbackPosition : songPosition;
    
    if (!activePlayingId || !activeDuration || activeDuration === 0) {
      return;
    }
    if (!expandedTextIds.has(activePlayingId)) {
      return;
    }
    if (isScrubbing || isSongScrubbing) return; // Don't auto-scroll while user is scrubbing
    if (manuallyScrolling[activePlayingId]) return; // Don't auto-scroll while user is manually scrolling
    
    const scrollRef = textScrollRefs.current[activePlayingId];
    if (!scrollRef) {
      return;
    }

    // Calculate scroll position based on playback percentage
    const playbackPercentage = activePosition / activeDuration;
    
    // Estimate scroll height (assumes text is roughly 200px max height)
    const estimatedScrollHeight = 200; // matches maxHeight in styles
    const scrollY = Math.max(0, playbackPercentage * estimatedScrollHeight);
    
    
    // Smooth scroll to position
    scrollRef.scrollTo({ y: scrollY, animated: true });
  }, [playbackPosition, playbackDuration, songPosition, songDuration, playingId, playingSongId, expandedTextIds, isScrubbing, isSongScrubbing, manuallyScrolling]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = async (reading: Reading) => {
    if (!reading.audioPath) {
      Alert.alert('Audio not ready', 'Still generating...');
      return;
    }

    // Prevent race conditions - if already processing a play request, ignore
    if (isPlayingMutex.current) {
      console.log('⏳ Audio operation in progress, ignoring');
      return;
    }

    isPlayingMutex.current = true;
    let safetyTimeout: NodeJS.Timeout | null = null;

    try {
      // If this reading is playing, pause it
      if (playingId === reading.id && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          setLoadingAudioId(null);
          await soundRef.current.pauseAsync();
          return;
        } else if (status.isLoaded) {
          setLoadingAudioId(null);
          await soundRef.current.playAsync();
          return;
        }
      }

      // ALWAYS stop and unload current audio FIRST before loading new one
      if (soundRef.current) {
        console.log('🛑 Stopping previous audio');
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (stopErr) {
          console.log('Warning: error stopping audio', stopErr);
        }
        soundRef.current = null;
        setPlayingId(null);
      }

      // Also stop song if playing (mutual exclusion - like Audible)
      if (songSoundRef.current) {
        console.log('🛑 Stopping song for narration');
        try {
          await songSoundRef.current.stopAsync();
          await songSoundRef.current.unloadAsync();
        } catch {}
        songSoundRef.current = null;
        setPlayingSongId(null);
        setSongPosition(0);
        setSongDuration(0);
      }

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Start new audio - prefer LOCAL file for instant playback, fallback to streaming
      setLoadingAudioId(reading.id);
      
      // PRIORITY: Use local cached file if available (instant playback)
      // Otherwise fall back to streaming URL (slower, requires buffering)
      const url = reading.localAudioPath || reading.audioPath;
      const isLocal = !!reading.localAudioPath;
      
      console.log(`🎵 Loading audio for ${reading.name} (${reading.system}):`, {
        url: url?.substring(0, 100),
        isLocal,
        docNum: reading.docNum,
        jobId: reading.jobId?.substring(0, 8)
      });
      
      if (!url) throw new Error('No audio URL');
      
      // Safety timeout to force reset loading state after 35 seconds
      safetyTimeout = setTimeout(() => {
        console.warn(`⏰ Audio load taking too long for ${reading.name}, resetting loading state`);
        setLoadingAudioId(prev => prev === reading.id ? null : prev);
      }, 35000);
      
      const { sound } = await Promise.race([
        Audio.Sound.createAsync(
          { uri: url },
          { 
            shouldPlay: true,
            progressUpdateIntervalMillis: 250,
            positionMillis: 0,
          },
          (status) => {
            if (status.isLoaded) {
              setLoadingAudioId(null);
              // While the user is scrubbing, do not fight the slider.
              if (scrubbingNarrationIdRef.current !== reading.id) {
                setPlaybackPosition(status.positionMillis / 1000);
              }
              setPlaybackDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
              if (status.didJustFinish) {
                console.log('✅ Audio finished:', reading.name);
                setPlayingId(null);
                soundRef.current = null;
                scrubbingNarrationIdRef.current = null;
                setIsScrubbing(false);
                setScrubPosition(0);
              }
            } else if ('error' in status) {
              console.error('❌ Audio status error:', status.error);
              // Reset loading state when error occurs to prevent stuck UI
              setLoadingAudioId(prev => prev === reading.id ? null : prev);
            }
          },
          false // downloadFirst = false for streaming (don't download entire file first)
        ),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Audio load timeout - try again')), 30000)
        )
      ]);
      
      console.log('✅ Audio loaded, playing...');
      setLoadingAudioId(null);

      if (!sound) throw new Error('Failed to initialize audio');
      soundRef.current = sound;
      setPlayingId(reading.id);
      setPlaybackPosition(0);
      setLoadingAudioId(null);
      if (safetyTimeout) clearTimeout(safetyTimeout);
    } catch (e: any) {
      console.error('❌ Audio error:', e);
      const errorMsg = e?.message || 'Unknown error';
      Alert.alert('Audio Error', `Could not play audio: ${errorMsg}\n\nCheck Metro console for details.`);
      setPlayingId(null);
      setLoadingAudioId(null);
      if (safetyTimeout) clearTimeout(safetyTimeout);
    } finally {
      isPlayingMutex.current = false;
    }
  };

  const seekTo = async (positionSeconds: number) => {
    if (soundRef.current && playingId) {
      try {
        await soundRef.current.setPositionAsync(positionSeconds * 1000);
        setPlaybackPosition(positionSeconds);
      } catch (e) {
        console.error('Seek error:', e);
      }
    }
  };

  // ==================== SONG PLAYBACK ====================
  const toggleSongPlay = async (reading: Reading) => {
    const songUrl = reading.localSongPath || reading.songPath;
    if (!songUrl) {
      Alert.alert('Song not ready', 'Still generating...');
      return;
    }

    // Auto-load text, song title, and lyrics when song starts
    ensureTextLoaded(reading);
    ensureSongTitleLoaded(reading);
    ensureSongLyricsLoaded(reading);

    if (isSongPlayingMutex.current) return;
    isSongPlayingMutex.current = true;

    try {
      // If this song is playing, pause/resume
      if (playingSongId === reading.id && songSoundRef.current) {
        const status = await songSoundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await songSoundRef.current.pauseAsync();
          return;
        } else if (status.isLoaded) {
          await songSoundRef.current.playAsync();
          return;
        }
      }

      // Stop any current song
      if (songSoundRef.current) {
        try {
          await songSoundRef.current.stopAsync();
          await songSoundRef.current.unloadAsync();
        } catch {}
        songSoundRef.current = null;
        setPlayingSongId(null);
      }

      // Stop narration if playing (mutual exclusion - like Audible)
      if (soundRef.current) {
        console.log('🛑 Stopping narration for song');
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
        setPlayingId(null);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      setLoadingSongId(reading.id);

      const { sound } = await Audio.Sound.createAsync(
        { uri: songUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (status) => {
          if (status.isLoaded) {
            setLoadingSongId(null);
            // While the user is scrubbing, do not fight the slider.
            if (scrubbingSongIdRef.current !== reading.id) {
              setSongPosition(status.positionMillis / 1000);
            }
            setSongDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
            if (status.didJustFinish) {
              setPlayingSongId(null);
              songSoundRef.current = null;
              scrubbingSongIdRef.current = null;
              setIsSongScrubbing(false);
              setSongScrubPosition(0);
            }
          } else if ('error' in status) {
            console.error('❌ Song status error:', status.error);
            // Reset loading state when error occurs to prevent stuck UI
            setLoadingSongId(prev => prev === reading.id ? null : prev);
          }
        },
        false // downloadFirst = false for streaming
      );

      songSoundRef.current = sound;
      setPlayingSongId(reading.id);
      setLoadingSongId(null);
    } catch (e: any) {
      console.error('❌ Song error:', e);
      Alert.alert('Song Error', e?.message || 'Could not play song');
      setPlayingSongId(null);
      setLoadingSongId(null);
    } finally {
      isSongPlayingMutex.current = false;
    }
  };

  const seekSongTo = async (positionSeconds: number) => {
    if (songSoundRef.current) {
      await songSoundRef.current.setPositionAsync(positionSeconds * 1000);
      setSongPosition(positionSeconds);
    }
  };
  // ==================== END SONG PLAYBACK ====================

  const MEDIA_BASE_DIR = (() => {
    const base = getDocumentDirectory() || getCacheDirectory() || '';
    return base ? `${base}library-media/` : '';
  })();

  const sanitize = (s: string) => String(s || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_');

  const ensureMediaDir = useCallback(async () => {
    if (!MEDIA_BASE_DIR) throw new Error('No writable directory available');
    const info = await FileSystem.getInfoAsync(MEDIA_BASE_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(MEDIA_BASE_DIR, { intermediates: true });
  }, [MEDIA_BASE_DIR]);

  const getRowFolder = useCallback(
    async (reading: Reading) => {
      await ensureMediaDir();
      const ts = reading.timestamp ? new Date(reading.timestamp).toISOString() : 'unknown_time';
      const folder = `${MEDIA_BASE_DIR}${sanitize(personName)}/${sanitize(reading.system)}/${sanitize(ts)}_${sanitize(
        reading.jobId || ''
      )}_${sanitize(String(reading.docNum || ''))}/`;
      const info = await FileSystem.getInfoAsync(folder);
      if (!info.exists) await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      return folder;
    },
    [MEDIA_BASE_DIR, ensureMediaDir, personName]
  );

  const fileExistsNonEmpty = useCallback(async (uri: string) => {
    if (!uri) return false;
    const info = await FileSystem.getInfoAsync(uri);
    const size = (info as any)?.size;
    return !!info.exists && (typeof size !== 'number' || size > 0);
  }, []);

  const inferAudioExtension = useCallback(async (url: string): Promise<'mp3' | 'm4a'> => {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('audio/mp4') || ct.includes('audio/aac') || ct.includes('audio/m4a')) return 'm4a';
      return 'mp3';
    } catch {
      return 'mp3';
    }
  }, []);

  const updateReadingLocal = useCallback((readingId: string, patch: Partial<Reading>) => {
    setReadings((prev) => prev.map((r) => (r.id === readingId ? { ...r, ...patch } : r)));
  }, []);

  // Check if a job is in the 40-job buffer (eligible for local storage)
  const isJobInBuffer = useCallback(async (checkJobId: string): Promise<boolean> => {
    try {
      const receipts = await getJobReceipts();
      return receipts.some((r) => r.jobId === checkJobId);
    } catch {
      return false;
    }
  }, []);

  const downloadTo = useCallback(
    async (url: string, destUri: string, readingIdForProgress?: string) => {
      const dl = FileSystem.createDownloadResumable(
        url,
        destUri,
        {},
        readingIdForProgress
          ? (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
              const total = p.totalBytesExpectedToWrite || 0;
              const pct = total > 0 ? Math.max(0, Math.min(1, p.totalBytesWritten / total)) : 0;
              setAudioLoadProgress((prev) => ({ ...prev, [readingIdForProgress]: pct }));
            }
          : undefined
      );
      const result = await dl.downloadAsync();
      return result?.uri || null;
    },
    []
  );

  const ensureLocalAudio = useCallback(
    async (reading: Reading) => {
      console.log(`🎵 [ensureLocalAudio] Starting for ${reading.name}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:ensureLocalAudio:entry',message:'ensureLocalAudio called',data:{name:reading.name,localAudioPath:reading.localAudioPath?.substring(0,80),audioPath:reading.audioPath?.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B-H3D'})}).catch(()=>{});
      // #endregion
      if (reading.localAudioPath && (await fileExistsNonEmpty(reading.localAudioPath))) {
        console.log(`🎵 [ensureLocalAudio] Already have local file: ${reading.localAudioPath}`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:ensureLocalAudio:cached',message:'Using cached local audio',data:{name:reading.name,localAudioPath:reading.localAudioPath?.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3B'})}).catch(()=>{});
        // #endregion
        return reading.localAudioPath;
      }
      
      // Try artifact cache service first (instant if cached)
      if (reading.jobId && reading.audioPath?.startsWith('job-artifacts/')) {
        console.log(`🎵 [ensureLocalAudio] Checking artifact cache...`);
        const docNum = reading.docNum || 1;
        const cachedUrl = await getPlayableArtifactUrl(reading.jobId, docNum, 'audio', reading.audioPath);
        if (cachedUrl && !cachedUrl.includes('http')) {
          // It's a local file path
          console.log(`🎵 [ensureLocalAudio] Found in artifact cache: ${cachedUrl}`);
          return cachedUrl;
        }
      }
      
      if (!reading.audioPath) {
        console.log(`🎵 [ensureLocalAudio] No audioPath for ${reading.name}`);
        throw new Error('Audio not ready yet');
      }

      console.log(`🎵 [ensureLocalAudio] AudioPath: ${reading.audioPath.substring(0, 100)}...`);

      // Convert storage path to signed URL if needed
      let audioUrl = reading.audioPath;
      if (audioUrl.startsWith('job-artifacts/') || audioUrl.includes('/job-artifacts/')) {
        console.log(`🎵 [ensureLocalAudio] Converting storage path to signed URL...`);
        const signedUrl = await createArtifactSignedUrl(audioUrl, 60 * 60); // 1 hour expiry
        if (!signedUrl) throw new Error('Failed to create signed URL for audio');
        audioUrl = signedUrl;
        console.log(`🎵 [ensureLocalAudio] Got signed URL: ${signedUrl.substring(0, 100)}...`);
      }

      const folder = await getRowFolder(reading);
      const ext = await inferAudioExtension(audioUrl);
      const dest = `${folder}narration.${ext}`;
      console.log(`🎵 [ensureLocalAudio] Downloading to: ${dest}`);

      // Download silently (no visual indicators)
      console.log(`🎵 [ensureLocalAudio] Starting download...`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:ensureLocalAudio:downloadStart',message:'Starting audio download',data:{name:reading.name,audioUrl:audioUrl.substring(0,100),dest:dest.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3D'})}).catch(()=>{});
      // #endregion
      const uri = await downloadTo(audioUrl, dest, reading.id);
      console.log(`🎵 [ensureLocalAudio] Download complete, URI: ${uri}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:ensureLocalAudio:downloadComplete',message:'Audio download complete',data:{name:reading.name,uri:uri?.substring(0,80),success:!!uri},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3D'})}).catch(()=>{});
      // #endregion
      if (!uri) throw new Error('Audio download failed');
      if (!(await fileExistsNonEmpty(uri))) throw new Error('Audio file is empty');

      // Verify playable (2B)
      let durationSeconds = 0;
      const check = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
      const st = await check.sound.getStatusAsync();
      if ((st as any)?.isLoaded && (st as any)?.durationMillis) {
        durationSeconds = Math.round(((st as any).durationMillis as number) / 1000);
      }
      await check.sound.unloadAsync();

      // Persist local file reference
      const info = await FileSystem.getInfoAsync(uri);
      const sizeMB = typeof (info as any)?.size === 'number' ? (info as any).size / (1024 * 1024) : 0;
      addSavedAudio({
        readingId: `${reading.id}:audio`,
        personId,
        system: reading.system as any,
        fileName: `narration.${ext}`,
        filePath: uri,
        durationSeconds,
        fileSizeMB: Number(sizeMB.toFixed(2)),
        createdAt: new Date().toISOString(),
        title: `${personName} — ${reading.name}`,
      });

      updateReadingLocal(reading.id, { localAudioPath: uri });
      return uri;
    },
    [
      addSavedAudio,
      createArtifactSignedUrl,
      downloadTo,
      fileExistsNonEmpty,
      getRowFolder,
      inferAudioExtension,
      personId,
      personName,
      updateReadingLocal,
    ]
  );

  const ensureLocalSong = useCallback(
    async (reading: Reading) => {
      if (reading.localSongPath && (await fileExistsNonEmpty(reading.localSongPath))) {
        return reading.localSongPath;
      }
      
      // Try artifact cache service first (instant if cached)
      if (reading.jobId && reading.songPath?.startsWith('job-artifacts/')) {
        console.log(`🎵 [ensureLocalSong] Checking artifact cache...`);
        const docNum = reading.docNum || 1;
        const cachedUrl = await getPlayableArtifactUrl(reading.jobId, docNum, 'song', reading.songPath);
        if (cachedUrl && !cachedUrl.includes('http')) {
          // It's a local file path
          console.log(`🎵 [ensureLocalSong] Found in artifact cache: ${cachedUrl}`);
          return cachedUrl;
        }
      }
      
      if (!reading.songPath) throw new Error('Song not ready yet');

      // Convert storage path to signed URL if needed
      let songUrl = reading.songPath;
      if (songUrl.startsWith('job-artifacts/') || songUrl.includes('/job-artifacts/')) {
        const signedUrl = await createArtifactSignedUrl(songUrl, 60 * 60); // 1 hour expiry
        if (!signedUrl) throw new Error('Failed to create signed URL for song');
        songUrl = signedUrl;
      }

      const folder = await getRowFolder(reading);
      const ext = await inferAudioExtension(songUrl);
      const dest = `${folder}song.${ext}`;

      const uri = await downloadTo(songUrl, dest);
      if (!uri) throw new Error('Song download failed');
      if (!(await fileExistsNonEmpty(uri))) throw new Error('Song file is empty');

      // Verify playable (2B)
      const check = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
      await check.sound.unloadAsync();

      const info = await FileSystem.getInfoAsync(uri);
      const sizeMB = typeof (info as any)?.size === 'number' ? (info as any).size / (1024 * 1024) : 0;
      addSavedAudio({
        readingId: `${reading.id}:song`,
        personId,
        system: reading.system as any,
        fileName: `song.${ext}`,
        filePath: uri,
        durationSeconds: 0,
        fileSizeMB: Number(sizeMB.toFixed(2)),
        createdAt: new Date().toISOString(),
        title: `${personName} — ${reading.name} (Song)`,
      });

      updateReadingLocal(reading.id, { localSongPath: uri });
      return uri;
    },
    [addSavedAudio, createArtifactSignedUrl, downloadTo, fileExistsNonEmpty, getRowFolder, inferAudioExtension, personId, personName, updateReadingLocal]
  );

  const ensureLocalPdf = useCallback(
    async (reading: Reading) => {
      if (reading.localPdfPath && (await fileExistsNonEmpty(reading.localPdfPath))) {
        return reading.localPdfPath;
      }
      if (!reading.pdfPath) throw new Error('PDF not ready yet');

      // Convert storage path to signed URL if needed
      let pdfUrl = reading.pdfPath;
      if (pdfUrl.startsWith('job-artifacts/') || pdfUrl.includes('/job-artifacts/')) {
        const signedUrl = await createArtifactSignedUrl(pdfUrl, 60 * 60); // 1 hour expiry
        if (!signedUrl) throw new Error('Failed to create signed URL for PDF');
        pdfUrl = signedUrl;
      }

      const folder = await getRowFolder(reading);
      const dest = `${folder}reading.pdf`;
      const uri = await downloadTo(pdfUrl, dest);
      if (!uri) throw new Error('PDF download failed');
      if (!(await fileExistsNonEmpty(uri))) throw new Error('PDF file is empty');

      const info = await FileSystem.getInfoAsync(uri);
      const sizeMB = typeof (info as any)?.size === 'number' ? (info as any).size / (1024 * 1024) : 0;
      addSavedPDF({
        readingId: `${reading.id}:pdf`,
        personId,
        system: reading.system as any,
        fileName: 'reading.pdf',
        filePath: uri,
        pageCount: 0,
        fileSizeMB: Number(sizeMB.toFixed(2)),
        createdAt: new Date().toISOString(),
        title: `${personName} — ${reading.name}`,
        type: 'individual',
      });

      updateReadingLocal(reading.id, { localPdfPath: uri });
      return uri;
    },
    [addSavedPDF, createArtifactSignedUrl, downloadTo, fileExistsNonEmpty, getRowFolder, personId, personName, updateReadingLocal]
  );

  // Download all 3 files (PDF + audio + song) together for a reading
  // Only downloads files that exist and aren't already cached
  const ensureLocalMedia = useCallback(
    async (reading: Reading): Promise<void> => {
      const promises: Promise<any>[] = [];
      
      // Download PDF if available and not cached
      if (reading.pdfPath && !reading.localPdfPath) {
        promises.push(
          ensureLocalPdf(reading).catch((e) => {
            console.warn(`[ensureLocalMedia] PDF download failed: ${e?.message}`);
          })
        );
      }
      
      // Download audio if available and not cached
      if (reading.audioPath && !reading.localAudioPath) {
        promises.push(
          ensureLocalAudio(reading).catch((e) => {
            console.warn(`[ensureLocalMedia] Audio download failed: ${e?.message}`);
          })
        );
      }
      
      // Download song if available and not cached
      if (reading.songPath && !reading.localSongPath) {
        promises.push(
          ensureLocalSong(reading).catch((e) => {
            console.warn(`[ensureLocalMedia] Song download failed: ${e?.message}`);
          })
        );
      }
      
      if (promises.length > 0) {
        console.log(`📥 [ensureLocalMedia] Downloading ${promises.length} file(s) for ${reading.name}...`);
        await Promise.all(promises);
        console.log(`✅ [ensureLocalMedia] Download complete for ${reading.name}`);
      }
    },
    [ensureLocalPdf, ensureLocalAudio, ensureLocalSong]
  );

  // AUTO-DOWNLOAD: When readings have artifacts but no local paths, download them
  // This ensures media is on the phone as soon as it's ready (not on button click)
  // Track media signatures to detect when new media becomes available
  const autoDownloadMediaSignatureRef = useRef<Map<string, string>>(new Map());
  const autoDownloadInProgressRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (readings.length === 0) {
      console.log(`🔍 [AutoDownload] No readings to check`);
      return;
    }
    
    console.log(`🔍 [AutoDownload] Checking ${readings.length} readings for download...`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:autoDownload',message:'AutoDownload effect triggered',data:{readingsCount:readings.length,readingNames:readings.map(r=>r.name)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3A-H3C'})}).catch(()=>{});
    // #endregion
    
    // Check which readings need download (async file existence check)
    (async () => {
      const needsDownload: Reading[] = [];
      
      for (const r of readings) {
        const hasRemote = !!(r.pdfPath || r.audioPath || r.songPath);
        if (!hasRemote) continue; // No remote artifacts, skip
        
        // Skip if already downloading
        if (autoDownloadInProgressRef.current.has(r.id)) {
          console.log(`   ⏳ ${r.name}: Already downloading, skipping`);
          continue;
        }
        
        // Create media signature: which remote paths are available
        const mediaSignature = `${r.pdfPath ? 'pdf' : ''}${r.audioPath ? 'audio' : ''}${r.songPath ? 'song' : ''}`;
        const lastSignature = autoDownloadMediaSignatureRef.current.get(r.id);
        
        // If media signature changed (new media appeared), allow re-check
        if (lastSignature && lastSignature === mediaSignature) {
          // Same signature - check if we already downloaded everything
          const pdfExists = r.localPdfPath ? await fileExistsNonEmpty(r.localPdfPath) : !r.pdfPath;
          const audioExists = r.localAudioPath ? await fileExistsNonEmpty(r.localAudioPath) : !r.audioPath;
          const songExists = r.localSongPath ? await fileExistsNonEmpty(r.localSongPath) : !r.songPath;
          const hasAllLocal = pdfExists && audioExists && songExists;
          
          if (hasAllLocal) {
            // Already downloaded everything for this signature, skip
            continue;
          }
          // Signature same but files missing - might have been deleted, allow re-download
        } else if (lastSignature && lastSignature !== mediaSignature) {
          // Media signature changed - new media appeared! Clear old signature and allow download
          console.log(`   🔄 ${r.name}: Media signature changed (${lastSignature} → ${mediaSignature}), new media available!`);
          autoDownloadMediaSignatureRef.current.delete(r.id);
        }
        
        // Check if files actually exist (not just if paths are set)
        const pdfExists = r.localPdfPath ? await fileExistsNonEmpty(r.localPdfPath) : !r.pdfPath;
        const audioExists = r.localAudioPath ? await fileExistsNonEmpty(r.localAudioPath) : !r.audioPath;
        const songExists = r.localSongPath ? await fileExistsNonEmpty(r.localSongPath) : !r.songPath;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:fileCheck',message:'File existence check',data:{name:r.name,pdfPath:r.pdfPath?.substring(0,50),localPdfPath:r.localPdfPath?.substring(0,50),pdfExists,audioPath:r.audioPath?.substring(0,50),localAudioPath:r.localAudioPath?.substring(0,50),audioExists,songPath:r.songPath?.substring(0,50),localSongPath:r.localSongPath?.substring(0,50),songExists},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3A'})}).catch(()=>{});
        // #endregion
        
        const hasAllLocal = pdfExists && audioExists && songExists;
        
        if (!hasAllLocal) {
          console.log(`   📦 ${r.name}: needs download (pdf=${r.pdfPath ? 'yes' : 'no'}, pdfLocal=${r.localPdfPath ? 'exists' : 'no'}, audio=${r.audioPath ? 'yes' : 'no'}, audioLocal=${r.localAudioPath ? 'exists' : 'no'})`);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:needsDownload',message:'Reading needs download',data:{name:r.name,pdfPath:!!r.pdfPath,localPdfPath:!!r.localPdfPath,pdfExists,audioPath:!!r.audioPath,localAudioPath:!!r.localAudioPath,audioExists},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3A-H3B'})}).catch(()=>{});
          // #endregion
          needsDownload.push(r);
        }
      }
      
      if (needsDownload.length === 0) {
        console.log(`✅ [AutoDownload] All readings already have valid local files`);
        return;
      }
      
      console.log(`📥 [AutoDownload] Starting download for ${needsDownload.length} readings...`);
      
      // Update media signatures and start downloads
      for (const reading of needsDownload) {
        const mediaSignature = `${reading.pdfPath ? 'pdf' : ''}${reading.audioPath ? 'audio' : ''}${reading.songPath ? 'song' : ''}`;
        autoDownloadMediaSignatureRef.current.set(reading.id, mediaSignature);
        console.log(`   ✅ Updated signature for ${reading.name}: ${mediaSignature}`);
      }
      
      // Download all in parallel (fire and forget - don't block UI)
      for (const reading of needsDownload) {
        // Mark as in progress
        autoDownloadInProgressRef.current.add(reading.id);
        console.log(`   🚀 Starting download for ${reading.name}...`);
        
        ensureLocalMedia(reading)
          .then(() => {
            console.log(`   ✅ Successfully downloaded media for ${reading.name}`);
            // Remove from in-progress set
            autoDownloadInProgressRef.current.delete(reading.id);
          })
          .catch(e => {
            console.error(`   ❌ [AutoDownload] Failed for ${reading.name}:`, e?.message || e);
            // Remove signature so it can retry
            autoDownloadMediaSignatureRef.current.delete(reading.id);
            // Remove from in-progress set
            autoDownloadInProgressRef.current.delete(reading.id);
          });
      }
    })();
  }, [readings, ensureLocalMedia, fileExistsNonEmpty]);

  const handlePdfPress = useCallback(
    async (reading: Reading) => {
      try {
        console.log(`📄 [handlePdfPress] Opening PDF for ${reading.name}`);
        
        // Check if we have a valid local file
        let uri = reading.localPdfPath;
        if (uri && !(await fileExistsNonEmpty(uri))) {
          // Local path is set but file doesn't exist - clear it
          console.log(`   Local path exists but file missing, will re-download`);
          uri = undefined;
        }
        
        if (!uri) {
          if (!reading.pdfPath) {
            Alert.alert('PDF Not Ready', 'The PDF is still being generated.');
            return;
          }
          console.log(`   Downloading PDF...`);
          uri = await ensureLocalPdf(reading);
        }
        console.log(`   Final URI: ${uri}`);
        
        // Try Linking.openURL first (opens in native PDF viewer on iOS)
        const canOpen = await Linking.canOpenURL(uri);
        if (canOpen) {
          console.log(`   Opening with Linking.openURL...`);
          await Linking.openURL(uri);
          return;
        }
        
        // Fallback to Sharing (shows share sheet with "Open in..." options)
        console.log(`   Linking failed, falling back to Sharing...`);
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('Cannot Open PDF', 'File sharing is not available on this device.');
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Open PDF',
          UTI: 'com.adobe.pdf',
        });
      } catch (e: any) {
        console.error(`   ❌ PDF error:`, e);
        Alert.alert('PDF Error', e?.message || 'Could not open PDF');
      }
    },
    [ensureLocalPdf, fileExistsNonEmpty]
  );

  const handlePdfShare = useCallback(
    async (reading: Reading) => {
      try {
        const uri = await ensureLocalPdf(reading);
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('Sharing not available', 'Unable to share files on this device.');
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save PDF',
          UTI: 'com.adobe.pdf',
        });
      } catch (e: any) {
        Alert.alert('PDF', e?.message || 'Could not share PDF');
      }
    },
    [ensureLocalPdf]
  );

  const handleSongPress = useCallback(
    async (reading: Reading) => {
      try {
        // Check if we have a valid local file
        let uri = reading.localSongPath;
        if (uri && !(await fileExistsNonEmpty(uri))) {
          // Local path is set but file doesn't exist - clear it
          uri = undefined;
        }
        
        if (!uri && reading.songPath) {
          // No local file - download first
          console.log(`🎶 [handleSongPress] No local file, downloading first...`);
          uri = await ensureLocalSong(reading);
          console.log(`🎶 [handleSongPress] Download complete: ${uri}`);
        }
        
        if (!uri) {
          Alert.alert('Song', 'Song not ready yet');
          return;
        }
        navigation.navigate('AudioPlayer', {
          audioUrl: uri,
          title: `${personName} — ${reading.name} (Song)`,
          personName,
          system: reading.system,
          readingId: `${reading.id}:song`,
        });
      } catch (e: any) {
        Alert.alert('Song', e?.message || 'Could not open song');
      }
    },
    [navigation, personName, ensureLocalSong, fileExistsNonEmpty]
  );

  const handlePlayPress = useCallback(
    async (reading: Reading) => {
      try {
        // Auto-load text when audio starts (for karaoke sync)
        ensureTextLoaded(reading);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:handlePlayPress',message:'Play button pressed',data:{name:reading.name,hasLocalAudioPath:!!reading.localAudioPath,hasAudioPath:!!reading.audioPath,localAudioPath:reading.localAudioPath?.substring(0,80),audioPath:reading.audioPath?.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3E'})}).catch(()=>{});
        // #endregion
        
        // Check if we have a valid local file
        let localPath = reading.localAudioPath;
        if (localPath && !(await fileExistsNonEmpty(localPath))) {
          // Local path is set but file doesn't exist - clear it
          localPath = undefined;
        }
        
        if (localPath) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:handlePlayPress:local',message:'Playing LOCAL audio',data:{name:reading.name,localAudioPath:localPath?.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3E'})}).catch(()=>{});
          // #endregion
          await togglePlay({ ...reading, audioPath: localPath });
        } else if (reading.audioPath) {
          // No local file - download first, then play
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/c57797a3-6ffd-4efa-8ba1-8119a00b829d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:handlePlayPress:downloading',message:'Downloading audio before play',data:{name:reading.name,audioPath:reading.audioPath?.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3E'})}).catch(()=>{});
          // #endregion
          console.log(`🎵 [handlePlayPress] No local file, downloading first...`);
          const downloadedPath = await ensureLocalAudio(reading);
          console.log(`🎵 [handlePlayPress] Download complete, playing: ${downloadedPath}`);
          await togglePlay({ ...reading, audioPath: downloadedPath });
        } else {
          Alert.alert('Audio', 'Audio not ready yet');
        }
      } catch (e: any) {
        Alert.alert('Audio', e?.message || 'Could not play audio');
      }
    },
    [togglePlay, ensureTextLoaded, ensureLocalAudio, fileExistsNonEmpty]
  );

  const handleDownloadAllPress = useCallback(
    async (reading: Reading) => {
      try {
        await ensureLocalMedia(reading);
        Alert.alert('Downloaded', 'All files saved to device');
      } catch (e: any) {
        Alert.alert('Download All', e?.message || 'Download failed');
      }
    },
    [ensureLocalMedia]
  );

  // Extract headline from reading text (markdown heading or first meaningful line)
  const extractHeadline = useCallback((text: string): string => {
    if (!text) return '';
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return '';
    
    // Priority 1: First line if it looks like a headline (NEW prompts format)
    const firstLine = lines[0];
    if (firstLine && firstLine.length >= 5 && firstLine.length <= 150) {
      // Check if it's NOT a full paragraph (ends with period and too long)
      const isShortAndCapitalized = 
        firstLine.length < 100 && 
        !firstLine.match(/^[a-z]/) && // Doesn't start lowercase
        !firstLine.includes('═'); // Not a separator
      
      if (isShortAndCapitalized) {
        return firstLine.length > 70 ? firstLine.substring(0, 67) + '...' : firstLine;
      }
    }
    
    // Priority 2: Markdown headings (## or ###)
    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        const title = line.replace(/^#+\s*/, '').trim();
        if (title.length > 0) {
          return title.length > 70 ? title.substring(0, 67) + '...' : title;
        }
      }
    }
    
    // Priority 3: ALL CAPS headings
    for (const line of lines) {
      if (line === line.toUpperCase() && line.length >= 10 && line.length < 100 && !line.includes('═')) {
        return line;
      }
    }
    
    // Priority 4: First substantial line (not too long, not a separator)
    for (const line of lines) {
      if (line.length >= 20 && line.length < 150 && !line.includes('═') && !line.startsWith('#')) {
        return line.length > 70 ? line.substring(0, 67) + '...' : line;
      }
    }
    
    // Ultimate fallback: just use first line trimmed
    return firstLine.length > 70 ? firstLine.substring(0, 67) + '...' : firstLine;
  }, []);

  // Track song error states for displaying emergency messages (REQUIREMENT #9)
  const [songErrors, setSongErrors] = useState<Record<string, string>>({});

  // Load song lyrics from artifacts
  const ensureSongLyricsLoaded = useCallback(
    async (reading: Reading) => {
      // If lyrics already loaded, nothing to do
      if (songLyrics[reading.id]) {
        return;
      }
      
      try {
        
        const artifacts = await fetchJobArtifacts(reading.jobId || jobId, ['audio_song']); // FIX: Remove 'song' - enum only accepts 'audio_song'
        
        
        // Find song artifact matching this reading's system AND docNum (CRITICAL for nuclear_v2)
        const songArtifact = artifacts.find(a => {
          const meta = a.metadata as any;
          const artifactDocNum = meta?.docNum ?? meta?.chapter_index;
          return meta?.system === reading.system && 
                 artifactDocNum === reading.docNum; // CRITICAL: Match by docNum too!
        });

        // REQUIREMENT #9: Check for error state in song artifact
        const meta = songArtifact?.metadata as any;
        if (meta?.error && meta?.errorMessage) {
          // Song generation failed - store the error message to display
          setSongErrors(prev => ({ ...prev, [reading.id]: meta.errorMessage }));
          console.log(`⚠️ Song failed for ${reading.system}: ${meta.errorMessage}`);
          return;
        }

        if (songArtifact?.metadata?.lyrics) {
          setSongLyrics(prev => ({ ...prev, [reading.id]: songArtifact.metadata.lyrics }));
        }
      } catch (error: any) {
        console.error('Failed to load song lyrics:', error);
      }
    },
    [songLyrics, jobId]
  );

  // Load song title from artifacts
  const ensureSongTitleLoaded = useCallback(
    async (reading: Reading) => {
      // If song title already loaded, nothing to do
      if (songTitles[reading.id]) {
        return;
      }
      
      try {
        if (!jobId) {
          return;
        }

        const artifacts = await fetchJobArtifacts(reading.jobId || jobId, ['audio_song']);
        
        // Find song artifact matching this reading's system AND docNum (CRITICAL for nuclear_v2)
        const songArtifact = artifacts.find(a => {
          const meta = a.metadata as any;
          const artifactDocNum = meta?.docNum ?? meta?.chapter_index;
          return meta?.system === reading.system && 
                 artifactDocNum === reading.docNum; // CRITICAL: Match by docNum too!
        });

        // Try to get dramatic song title from TEXT artifact first (NEW)
        const textArtifacts = await fetchJobArtifacts(reading.jobId || jobId, ['text']);
        const textArtifact = textArtifacts.find(a => {
          const meta = a.metadata as any;
          const artifactDocNum = meta?.docNum ?? meta?.chapter_index;
          return meta?.system === reading.system && 
                 artifactDocNum === reading.docNum; // CRITICAL: Match by docNum too!
        });
        
        const dramaticSongTitle = textArtifact?.metadata?.songTitle; // NEW: Dramatic LLM-generated song title
        
        // Fallback to song artifact metadata title (OLD)
        const fallbackSongTitle = songArtifact?.metadata?.title;
        
        const songTitle = dramaticSongTitle || fallbackSongTitle || reading.name;
        
        setSongTitles(prev => ({ ...prev, [reading.id]: songTitle }));
      } catch (error: any) {
        // Keep fallback on error
      }
    },
    [songTitles, jobId]
  );

  // Auto-load text when audio/song starts playing
  const ensureTextLoaded = useCallback(
    async (reading: Reading) => {
      // If text already loaded AND headline is not just the placeholder, we're done
      if (readingTexts[reading.id] && readingHeadlines[reading.id] && readingHeadlines[reading.id] !== reading.name) {
        return;
      }
      
      // If we have text but no real headline yet, extract it now
      if (readingTexts[reading.id] && (!readingHeadlines[reading.id] || readingHeadlines[reading.id] === reading.name)) {
        const headline = extractHeadline(readingTexts[reading.id]);
        if (headline && headline !== reading.name) {
          setReadingHeadlines(prev => ({ ...prev, [reading.id]: headline }));
        }
        return;
      }
      
      // If already loading, don't start another request
      if (loadingTextIds.has(reading.id)) {
        return;
      }

      setLoadingTextIds(prev => new Set(prev).add(reading.id));
      
      try {
        // Fetch text artifact for this reading
        if (!jobId) {
          return;
        }

        const artifacts = await fetchJobArtifacts(reading.jobId || jobId, ['text']);
        
        // CRITICAL: Derive docNum from task sequence if missing (like we do in load function)
        const taskIdToSequence: Record<string, number> = {};
        try {
          const { data: tasks } = await supabase
            .from('job_tasks')
            .select('id, sequence')
            .eq('job_id', reading.jobId || jobId);
          
          if (tasks) {
            tasks.forEach((t: any) => {
              taskIdToSequence[t.id] = t.sequence;
            });
          }
        } catch (e) {
          console.warn('⚠️ [ensureTextLoaded] Failed to fetch tasks for docNum derivation:', e);
        }
        
        // Debug logging
        console.log('🔍 [ensureTextLoaded] Matching text for reading:', {
          readingId: reading.id,
          readingSystem: reading.system,
          readingDocNum: reading.docNum,
          readingJobId: reading.jobId || jobId,
          totalArtifacts: artifacts.length
        });
        
        // Log all artifacts for debugging (with derived docNum)
        artifacts.forEach((a, idx) => {
          const meta = a.metadata as any;
          let artifactDocNum = meta?.docNum ?? meta?.chapter_index;
          
          // Derive docNum from task sequence if missing (like backend does)
          if ((typeof artifactDocNum !== 'number' || isNaN(artifactDocNum)) && (a as any).task_id) {
            const seq = taskIdToSequence[(a as any).task_id];
            if (typeof seq === 'number') {
              if (seq >= 200) {
                artifactDocNum = seq - 199; // Audio: 200→1, 201→2, etc.
              } else if (seq >= 100) {
                artifactDocNum = seq - 99; // PDF: 100→1, 101→2, etc.
              } else {
                artifactDocNum = seq + 1; // Text: 0→1, 1→2, etc.
              }
            }
          }
          
          console.log(`  Artifact ${idx}:`, {
            system: meta?.system,
            docNum: artifactDocNum,
            chapter_index: meta?.chapter_index,
            docType: meta?.docType,
            taskId: (a as any).task_id,
            taskSequence: taskIdToSequence[(a as any).task_id]
          });
        });
        
        // Find text artifact matching this reading's system AND docNum (CRITICAL for nuclear_v2)
        const textArtifact = artifacts.find(a => {
          const meta = a.metadata as any;
          let artifactDocNum = meta?.docNum ?? meta?.chapter_index;
          
          // Derive docNum from task sequence if missing (like backend does)
          if ((typeof artifactDocNum !== 'number' || isNaN(artifactDocNum)) && (a as any).task_id) {
            const seq = taskIdToSequence[(a as any).task_id];
            if (typeof seq === 'number') {
              if (seq >= 200) {
                artifactDocNum = seq - 199; // Audio: 200→1, 201→2, etc.
              } else if (seq >= 100) {
                artifactDocNum = seq - 99; // PDF: 100→1, 101→2, etc.
              } else {
                artifactDocNum = seq + 1; // Text: 0→1, 1→2, etc.
              }
            }
          }
          
          if (meta?.system === reading.system) {
            console.log('🔍 [ensureTextLoaded] Candidate artifact with matching system:', {
              artifactDocNum,
              readingDocNum: reading.docNum,
              matches: artifactDocNum === reading.docNum,
              systemMatch: meta?.system === reading.system,
              derivedFromSequence: !meta?.docNum && !meta?.chapter_index
            });
          }
          
          const matches = meta?.system === reading.system && 
                 artifactDocNum === reading.docNum; // CRITICAL: Match by docNum too!
          
          
          return matches;
        });


        if (!textArtifact) {
          console.warn('⚠️ [ensureTextLoaded] No text artifact found for:', {
            readingId: reading.id,
            readingSystem: reading.system,
            readingDocNum: reading.docNum,
            availableArtifacts: artifacts.map(a => ({
              system: (a.metadata as any)?.system,
              docNum: (a.metadata as any)?.docNum ?? (a.metadata as any)?.chapter_index,
              docType: (a.metadata as any)?.docType
            }))
          });
          return;
        }
        
        console.log('✅ [ensureTextLoaded] Found matching text artifact:', {
          artifactDocNum: (textArtifact.metadata as any)?.docNum ?? (textArtifact.metadata as any)?.chapter_index,
          readingDocNum: reading.docNum
        });

        // First, check metadata for dramatic titles (NEW) or headlines (OLD)
        const meta = textArtifact.metadata as any;
        const dramaticTitle = meta?.readingTitle; // NEW: Dramatic LLM-generated title
        const fallbackHeadline = meta?.headline; // OLD: Extracted headline from first line
        const headlineFromMeta = dramaticTitle || fallbackHeadline;
        
        if (headlineFromMeta && headlineFromMeta !== reading.name) {
          setReadingHeadlines(prev => ({ ...prev, [reading.id]: headlineFromMeta }));
        }

        const textContent = await downloadTextContent(textArtifact.storage_path);
        
        if (!textContent) {
          return; // Keep placeholder headline
        }
        
        
        // Store the text content
        setReadingTexts(prev => ({ ...prev, [reading.id]: textContent }));
        
        // If no headline from metadata, extract from text (for OLD readings)
        if (!headlineFromMeta || headlineFromMeta === reading.name) {
          const extractedHeadline = extractHeadline(textContent);
          
          // Only update if we found a real headline (not empty, not same as system name)
          if (extractedHeadline && extractedHeadline !== reading.name) {
            setReadingHeadlines(prev => ({ ...prev, [reading.id]: extractedHeadline }));
          }
        }
      } catch (error: any) {
        // Keep fallback headline on error
      } finally {
        setLoadingTextIds(prev => {
          const next = new Set(prev);
          next.delete(reading.id);
          return next;
        });
      }
    },
    [readingTexts, readingHeadlines, loadingTextIds, jobId, extractHeadline]
  );

  // NOTE: PDF/audio/song are gated by local download+verification (A2 + 2B).
  // Handlers are defined further below once we have download helpers.
  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{personName}</Text>
        </View>

        {/* Job Status Banner: Error only (Ready banner removed per user request) */}
        {jobStatus === 'error' && (
          <View style={[styles.statusBanner, styles.statusBannerError]}>
            <Text style={styles.statusTextError}>❌ Error</Text>
          </View>
        )}

        {!!loadError && !loading && jobId && readings.length > 0 ? (
          <TouchableOpacity
            onPress={loadV2}
            onLongPress={() => {
              if (!__DEV__) return;
              const msg = [
                '1 IN A BILLION — PersonReadings Debug',
                `jobId: ${jobId || ''}`,
                `personName: ${personName || ''}`,
                `personType: ${personType || ''}`,
                `api: ${env.CORE_API_URL}`,
                `error: ${loadError || ''}`,
              ]
                .filter(Boolean)
                .join('\n');
              Share.share({ message: msg }).catch(() => { });
            }}
            activeOpacity={0.8}
            style={{
              borderWidth: 1,
              borderColor: '#F0C2C8',
              backgroundColor: '#FFF5F6',
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontFamily: 'System', color: '#C41E3A', fontWeight: '600', textAlign: 'center' }}>
              Couldn’t load this reading. Tap to retry.
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Intentionally no "Refreshing..." label: it caused layout shifts under the title. */}

        {loading && readings.length === 0 ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : readings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Readings Yet</Text>
            <Text style={styles.emptyStateText}>
              {personName}'s readings will appear here once generated.
            </Text>
          </View>
        ) : (
          <View style={styles.readingsList}>
            {readings.map((reading, index) => {
              const isPlaying = playingId === reading.id;
              const hasAudioRemote = !!reading.localAudioPath; // ✅ Only enable when downloaded locally
              const hasPdfRemote = !!reading.localPdfPath;     // ✅ Only enable when downloaded locally
              const hasSongRemote = !!reading.localSongPath;   // ✅ Only enable when downloaded locally
              const hasAudioLocal = !!reading.localAudioPath;
              const hasPdfLocal = !!reading.localPdfPath;
              const hasSongLocal = !!reading.localSongPath;
              const isGenerating =
                !hasPdfRemote &&
                !hasAudioRemote &&
                !hasSongRemote &&
                (jobStatus === 'processing' || jobStatus === 'pending' || jobStatus === 'queued');
              const canScrubNarration =
                playingId === reading.id && !!soundRef.current && playbackDuration > 0;
              const narrationSliderValue = canScrubNarration
                ? isScrubbing && scrubbingNarrationIdRef.current === reading.id
                  ? scrubPosition
                  : playbackPosition
                : 0;

              const isSongPlaying = playingSongId === reading.id;
              const canScrubSong =
                playingSongId === reading.id && !!songSoundRef.current && songDuration > 0;
              const songSliderValue = canScrubSong
                ? isSongScrubbing && scrubbingSongIdRef.current === reading.id
                  ? songScrubPosition
                  : songPosition
                : 0;
              const allRemoteReady = hasPdfRemote && hasAudioRemote && hasSongRemote;

              return (
                <View key={reading.id} style={styles.readingCard}>
                  {/* System Name with Timestamp */}
                  <View style={styles.systemNameContainer}>
                    <Text style={styles.systemName}>{reading.name}</Text>
                    {isGenerating ? (
                      <Text style={styles.generatingText}>Generating...</Text>
                    ) : null}
                    {reading.timestamp && (jobStatus === 'complete' || hasPdfRemote || hasAudioRemote || hasSongRemote) ? (
                      <Text style={styles.timestampText}>
                        {' '}
                        {new Date(reading.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                  </View>
                  
                  {/* Action Buttons: PDF + Download All (black arrow) */}
                  <View style={styles.actionButtons}>
                    <Animated.View style={[
                      !hasPdfRemote && isGenerating && { 
                        transform: [{ scale: animatedScale }],
                        backgroundColor: pdfColor,
                        borderRadius: 8,
                        padding: 2,
                        opacity: blinkAnim,
                      }
                    ]}>
                      <TouchableOpacity
                        onPress={() => handlePdfPress(reading)}
                        onLongPress={() => handlePdfShare(reading)}
                        style={[
                          styles.pdfButton,
                          !hasPdfRemote && styles.disabledButton,
                          !hasPdfRemote && isGenerating && styles.generatingButton
                        ]}
                        disabled={!hasPdfRemote}
                      >
                        <Text style={[
                          styles.pdfText,
                          !hasPdfRemote && styles.disabledText,
                          !hasPdfRemote && isGenerating && styles.generatingText
                        ]}>PDF</Text>
                      </TouchableOpacity>
                    </Animated.View>
                    
                    {/* Download All - black down-arrow icon, only when all files ready */}
                    {allRemoteReady ? (
                      <TouchableOpacity
                        onPress={() => handleDownloadAllPress(reading)}
                        style={styles.downloadAllBlackButton}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.downloadAllBlackText}>⬇︎</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Narration Audio Section */}
                  <Text style={styles.audioHeadline} numberOfLines={2}>
                    {readingHeadlines[reading.id] || reading.name}
                  </Text>
                  <View style={styles.audioBar}>
                    <Animated.View style={[
                      !hasAudioRemote && isGenerating && { 
                        transform: [{ scale: animatedScale }],
                        backgroundColor: audioColor,
                        borderRadius: 20,
                        padding: 2,
                        opacity: blinkAnim,
                      }
                    ]}>
                      <TouchableOpacity
                        onPress={() => handlePlayPress(reading)}
                        style={[
                          styles.playButton,
                          !hasAudioRemote && styles.disabledButton,
                          !hasAudioRemote && isGenerating && styles.generatingPlayButton
                        ]}
                        disabled={!hasAudioRemote}
                      >
                        {loadingAudioId === reading.id ? (
                          <SoundWaveAnimation size={20} color="#FFF" />
                        ) : (
                          <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.progressContainer}>
                      {loadingAudioId === reading.id ? (
                        // Show animated loading indicator while audio is loading
                        <View style={styles.sliderLoadingContainer}>
                          <SliderLoadingAnimation width={180} height={4} color="#C41E3A" />
                        </View>
                      ) : (
                        <Slider
                          style={styles.slider}
                          minimumValue={0}
                          maximumValue={canScrubNarration ? playbackDuration : 1}
                          value={narrationSliderValue}
                          onSlidingStart={() => {
                            if (!canScrubNarration) return;
                            scrubbingNarrationIdRef.current = reading.id;
                            setIsScrubbing(true);
                            setScrubPosition(playbackPosition);
                          }}
                          onValueChange={(v) => {
                            if (!canScrubNarration) return;
                            setScrubPosition(v);
                          }}
                          onSlidingComplete={async (v) => {
                            if (!canScrubNarration) return;
                            scrubbingNarrationIdRef.current = null;
                            setIsScrubbing(false);
                            await seekTo(v);
                          }}
                          minimumTrackTintColor="#C41E3A"
                          maximumTrackTintColor="#E5E7EB"
                          thumbTintColor="#C41E3A"
                          disabled={!canScrubNarration}
                        />
                      )}
                    </View>

                    <Text style={styles.timeText}>
                      {loadingAudioId === reading.id
                        ? 'Loading...'
                        : canScrubNarration
                          ? `${formatTime(
                              isScrubbing && scrubbingNarrationIdRef.current === reading.id
                                ? scrubPosition
                                : playbackPosition
                            )} / ${formatTime(playbackDuration)}`
                          : '--:--'
                      }
                    </Text>
                  </View>

                  {/* Song Audio Section */}
                  <Text style={styles.audioHeadline} numberOfLines={2}>
                    {songTitles[reading.id] || reading.name}
                  </Text>
                  <View style={styles.songAudioBar}>
                    <Animated.View style={[
                      !hasSongRemote && isGenerating && { 
                        transform: [{ scale: animatedScale }],
                        backgroundColor: songColor,
                        borderRadius: 20,
                        padding: 2,
                        opacity: blinkAnim,
                      }
                    ]}>
                      <TouchableOpacity
                        onPress={() => toggleSongPlay(reading)}
                        style={[
                          styles.songPlayButton,
                          !hasSongRemote && styles.songDisabledButton,
                          !hasSongRemote && isGenerating && styles.generatingSongButton
                        ]}
                        disabled={!hasSongRemote}
                      >
                        {loadingSongId === reading.id ? (
                          <SoundWaveAnimation size={20} color="#FFF" />
                        ) : (
                          <Text style={styles.songPlayIcon}>{isSongPlaying ? '❚❚' : '♪'}</Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.songProgressContainer}>
                      {loadingSongId === reading.id ? (
                        // Show animated loading indicator while song is loading
                        <View style={styles.sliderLoadingContainer}>
                          <SliderLoadingAnimation width={180} height={4} color="#000" />
                        </View>
                      ) : (
                      <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={canScrubSong ? songDuration : 1}
                        value={songSliderValue}
                        onSlidingStart={() => {
                          if (!canScrubSong) return;
                          scrubbingSongIdRef.current = reading.id;
                          setIsSongScrubbing(true);
                          setSongScrubPosition(songPosition);
                        }}
                        onValueChange={(v) => {
                          if (!canScrubSong) return;
                          setSongScrubPosition(v);
                        }}
                        onSlidingComplete={async (v) => {
                          if (!canScrubSong) return;
                          scrubbingSongIdRef.current = null;
                          setIsSongScrubbing(false);
                          await seekSongTo(v);
                        }}
                        minimumTrackTintColor="#000"
                        maximumTrackTintColor="#E5E7EB"
                        thumbTintColor="#000"
                        disabled={!canScrubSong}
                      />
                      )}
                    </View>

                    <Text style={styles.songTimeText}>
                      {canScrubSong
                        ? `${formatTime(
                            isSongScrubbing && scrubbingSongIdRef.current === reading.id
                              ? songScrubPosition
                              : songPosition
                          )} / ${formatTime(songDuration)}`
                        : '--:--'
                      }
                    </Text>
                  </View>

                  {/* Auto-expanding Text Display (opens when audio/music plays) */}
                  {expandedTextIds.has(reading.id) && (
                    (playingId === reading.id && readingTexts[reading.id]) || 
                    (playingSongId === reading.id && songLyrics[reading.id])
                  ) && (
                    <View style={styles.textDisplayArea}>
                      <ScrollView 
                        ref={(ref) => {
                          textScrollRefs.current[reading.id] = ref;
                        }}
                        style={styles.textScroll} 
                        contentContainerStyle={styles.textScrollContent}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                        onScrollBeginDrag={() => {
                          // User started manual scroll - disable auto-scroll
                          setManuallyScrolling(prev => ({ ...prev, [reading.id]: true }));
                        }}
                        onScrollEndDrag={() => {
                          // Wait 3 seconds after manual scroll before re-enabling auto-scroll
                          setTimeout(() => {
                            setManuallyScrolling(prev => ({ ...prev, [reading.id]: false }));
                          }, 3000);
                        }}
                      >
                        <Text style={[
                          styles.textContentBigger,
                          songErrors[reading.id] && playingSongId === reading.id && styles.errorText
                        ]} selectable>
                          {playingId === reading.id 
                            ? readingTexts[reading.id]  // Narration shows reading text
                            : songErrors[reading.id]    // REQUIREMENT #9: Show error if song failed
                              ? `⚠️ ${songErrors[reading.id]}`
                              : songLyrics[reading.id]  // Song shows lyrics
                          }
                        </Text>
                      </ScrollView>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Bottom ZIP export: one subtle button for this screen’s scope (5 systems or 6 for overlay) */}
        {isZipReady() ? (
          <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={handleZipDownload}
              disabled={zipLoading}
              activeOpacity={0.8}
              style={[styles.zipCircleBtn, zipLoading && { opacity: 0.6 }]}
            >
              <View style={styles.zipCircleStripes}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    style={[
                      styles.zipStripe,
                      { backgroundColor: i % 2 === 0 ? '#C41E3A' : '#FFF' },
                    ]}
                  />
                ))}
              </View>
              {zipLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.zipCircleText}>zip</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.zipHintText}>Download all</Text>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep root transparent so leather texture shows through.
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backText: {
    fontFamily: 'System',
    fontSize: 16,
    color: '#C41E3A', // Red
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    // Ensure title never overlaps the absolute BackButton.
    paddingTop: 72,
    paddingBottom: 40,
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: '#000',
    textAlign: 'center',
  },
  jobIdText: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#888',
    marginTop: -18,
    marginBottom: 18,
    textAlign: 'center',
  },
  zipButton: {
    backgroundColor: '#C41E3A',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  zipButtonLoading: {
    backgroundColor: '#888',
  },
  zipButtonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  zipCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zipCircleStripes: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    transform: [{ rotate: '20deg' }],
  },
  zipStripe: {
    height: 10,
    width: '140%',
    opacity: 0.45,
  },
  zipCircleText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  zipHintText: {
    marginTop: 8,
    fontFamily: 'System',
    fontSize: 13,
    color: '#6B7280',
  },
  loadingText: {
    fontFamily: 'System',
    fontSize: 16,
    color: '#888', // Grey
    textAlign: 'center',
    marginTop: 40,
  },
  readingsList: {
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontFamily: 'System',
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  readingCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  // System name container - LEFT ALIGNED ABOVE buttons
  systemNameContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  systemName: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'left', // LEFT ALIGNED
  },
  timestampText: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  generatingText: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  // Action buttons row - LEFT ALIGNED
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'flex-start', // LEFT ALIGN
  },
  pdfButton: {
    height: 34,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6', // soft grey-white (matches UI buttons)
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pdfText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  downloadButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#666', // Grey
  },
  downloadIcon: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  songButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#8B4513', // Brown
  },
  songIcon: {
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
    borderColor: '#CCCCCC',
  },
  disabledText: {
    color: '#999999',
  },
  generatingButton: {
    backgroundColor: '#E0E0E0',
    borderColor: '#CCCCCC',
  },
  generatingText: {
    color: '#666666',
  },
  generatingPlayButton: {
    backgroundColor: '#E0E0E0',
  },
  generatingSongButton: {
    backgroundColor: '#E0E0E0',
    borderColor: '#CCCCCC',
  },
  audioHeadline: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  progressContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingVertical: 8,
    // Keep the slider a bit shorter so it doesn't crowd the play button/time.
    paddingHorizontal: 4,
  },
  sliderLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 22,
  },
  slider: {
    width: '100%',
    height: 22,
    marginHorizontal: 6,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#FFE4E4',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C41E3A',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#C41E3A',
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  timeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#888',
    minWidth: 45,
    textAlign: 'center',
  },
  // Download All - same style as PDF button
  downloadAllBlackButton: {
    width: 40,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadAllBlackText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  // Song Audio Bar (black themed)
  songAudioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  songPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songDisabledButton: {
    backgroundColor: '#ccc',
  },
  songPlayIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  songProgressContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  songProgressTrack: {
    height: 3,
    backgroundColor: '#ddd',
    borderRadius: 1.5,
    overflow: 'visible',
  },
  songProgressFill: {
    height: 3,
    backgroundColor: '#1a1a1a',
    borderRadius: 1.5,
  },
  songProgressThumb: {
    position: 'absolute',
    top: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a1a1a',
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  songTimeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#666',
    minWidth: 45,
    textAlign: 'center',
  },
  // NEW: Status banner styles
  statusBanner: {
    backgroundColor: '#FFF5E1',
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  statusBannerComplete: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  statusBannerError: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  statusText: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    marginBottom: 4,
  },
  statusTextComplete: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  statusTextError: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
  },
  statusProgress: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#856404',
  },
  // Text Display (Auto-expanding, Subtitles/Read-Along)
  textDisplayArea: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  textScroll: {
    maxHeight: 200,
  },
  textScrollContent: {
    paddingBottom: 8,
  },
  textContent: {
    fontFamily: 'System',
    fontSize: 14,
    lineHeight: 24,
    color: '#374151',
    letterSpacing: 0.2,
  },
  textContentBigger: {
    fontFamily: 'System',
    fontSize: 18,
    lineHeight: 32,
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  // REQUIREMENT #9: Style for song generation error messages
  errorText: {
    color: '#92400E', // Amber/warning color
    fontStyle: 'italic',
  },
});
