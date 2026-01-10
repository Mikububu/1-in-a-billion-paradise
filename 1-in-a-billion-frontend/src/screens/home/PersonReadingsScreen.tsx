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
import { createArtifactSignedUrl } from '@/services/nuclearReadingsService';
import { colors } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';
import { BackButton } from '@/components/BackButton';

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

  // FALLBACK: If no jobId from route, use first jobId from person's store
  const jobId = routeJobId || person?.jobIds?.[0] || undefined;


  // Get readings from store (SINGLE SOURCE OF TRUTH - Audible style)
  // If jobId provided, use it. Otherwise, get readings from ALL jobs for this person
  const storedReadings = personId 
    ? (jobId 
        ? getReadingsByJobId(personId, jobId)
        : (person?.readings || [])) // Show all readings if no specific jobId
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
      const safeId = `${jobId || 'nojob'}_${reading.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      return `${AUDIO_CACHE_DIR}${safeId}.mp3`;
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
  const getDocRange = (jobType?: string, systemCount?: number) => {
    // For extended jobs, docs are always 1-N where N = number of systems
    if (personType === 'individual' || jobType === 'extended') {
      const count = systemCount || 5;
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    
    // Nuclear Package ranges
    switch (personType) {
      case 'person1': return [1, 2, 3, 4, 5];
      case 'person2': return [6, 7, 8, 9, 10];
      case 'overlay': return [11, 12, 13, 14, 15, 16];
      default: return [1, 2, 3, 4, 5];
    }
  };

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
          console.log(`🔍 [PersonReadings] Processing doc: docNum=${docNum} (type=${typeof doc.docNum}), docRange=${JSON.stringify(docRange)}, includes=${docRange.includes(docNum)}`);
          if (!docNum || !docRange.includes(docNum)) {
            console.log(`⚠️ [PersonReadings] Skipping doc ${docNum}: !docNum=${!docNum}, !includes=${!docRange.includes(docNum)}`);
            continue;
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
        readingsMap[mapKey] = {
          id: existing?.id || `reading-${docNum}-${docJobId}`,
          system: system.id,
          name: system.name,
          pdfPath: existing?.pdfPath || doc.pdfUrl || undefined,
          // Use backend proxy URLs (streams bytes directly, iOS compatible)
          audioPath: existing?.audioPath || (doc.audioUrl ? `${env.CORE_API_URL}/api/jobs/v2/${docJobId}/audio/${docNum}` : undefined),
          songPath: existing?.songPath || (doc.songUrl ? `${env.CORE_API_URL}/api/jobs/v2/${docJobId}/song/${docNum}` : undefined),
          timestamp: existing?.timestamp || doc.created_at || jobData?.job?.created_at || new Date().toISOString(),
        };

        console.log(`📄 Doc ${docNum} (${system.name}): pdf=${!!doc.pdfUrl} audio=${!!doc.audioUrl} song=${!!doc.songUrl}`);
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
            
            // For non-aggregated jobs, check docRange
            if (!shouldAggregateJobs && docNum && !docRange.includes(docNum)) continue;

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
            if (r) {
              // Update existing reading - fill gaps, prefer Supabase if API didn't provide
              // Use backend proxy URLs for iOS compatibility
              if (!r.pdfPath && s.pdfUrl) r.pdfPath = s.pdfUrl;
              if (!r.audioPath && s.audioUrl) r.audioPath = `${env.CORE_API_URL}/api/jobs/v2/${s.jobId}/audio/${docNumFromKey}`;
              if (!r.songPath && s.songUrl) r.songPath = `${env.CORE_API_URL}/api/jobs/v2/${s.jobId}/song/${docNumFromKey}`;
            } else if (shouldAggregateJobs) {
              // For aggregated jobs, create reading from Supabase artifact if not in API response
              const system = SYSTEMS.find(sys => sys.id === s.key);
              if (system) {
                readingsMap[s.key] = {
                  id: `reading-${s.key}-${s.jobId}`,
                  system: system.id,
                  name: system.name,
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

    const uniqueJobIds = Array.from(
      new Set<string>([...(person?.jobIds || []), ...(jobId ? [jobId] : [])].filter(Boolean) as string[])
    );

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

      const jobs = jobPayloads
        .map(({ payload }) => payload.job)
        .filter(Boolean)
        .sort((a: any, b: any) => (Date.parse(b?.created_at) || 0) - (Date.parse(a?.created_at) || 0));

      const primaryJob = jobs.find((j: any) => j?.id === jobId) || jobs[0];
      if (primaryJob) {
        setJobStatus(primaryJob.status || 'pending');
        setJobProgress(primaryJob.progress || null);
      }

      const systemIdForDoc = (jobType: string, systems: string[], docNum: number) => {
        if (jobType === 'extended' || jobType === 'single_system' || personType === 'individual') {
          const idx = Math.max(0, docNum - 1);
          return systems[idx] || SYSTEMS[idx]?.id || 'western';
        }
        if (personType === 'person1') return SYSTEMS[Math.max(0, docNum - 1)]?.id || 'western';
        if (personType === 'person2') return SYSTEMS[Math.max(0, docNum - 6)]?.id || 'western';
        if (personType === 'overlay') {
          if (docNum === 16) return 'verdict';
          return SYSTEMS[Math.max(0, docNum - 11)]?.id || 'western';
        }
        return 'western';
      };

      const rows: Reading[] = [];

      for (const j of jobs as any[]) {
        const jt = String(j?.type || '');
        // Keep couple-only job types out of single-person views.
        if (jt === 'synastry' && personType !== 'overlay') continue;

        const createdAt = j?.created_at || new Date().toISOString();
        const systems: string[] = Array.isArray(j?.params?.systems) ? j.params.systems : [];
        const docs: any[] = Array.isArray(j?.results?.documents) ? j.results.documents : [];
        const systemCount = systems.length || 5;
        const docRange = getDocRange(jt, systemCount);

        if (docs.length > 0) {
          for (const doc of docs) {
            const docNum = Number(doc?.docNum);
            if (!docNum || !docRange.includes(docNum)) continue;

            const systemId = String(doc?.system || systemIdForDoc(jt, systems, docNum));
            const systemName = SYSTEMS.find((s) => s.id === systemId)?.name || systemId;
            const rowId = `row-${j.id}-${docNum}`;

            const localPdf = savedPDFs.find((p) => p.readingId === `${rowId}:pdf`)?.filePath;
            const localAudio = savedAudios.find((a) => a.readingId === `${rowId}:audio`)?.filePath;
            const localSong = savedAudios.find((a) => a.readingId === `${rowId}:song`)?.filePath;

            rows.push({
              id: rowId,
              jobId: j.id,
              docNum,
              system: systemId,
              name: systemName,
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
          for (const docNum of docRange) {
            const sysId = systemIdForDoc(jt, systems, docNum);
            const sysName = SYSTEMS.find((s) => s.id === sysId)?.name || sysId;
            const rowId = `row-${j.id}-${docNum}`;

            const localPdf = savedPDFs.find((p) => p.readingId === `${rowId}:pdf`)?.filePath;
            const localAudio = savedAudios.find((a) => a.readingId === `${rowId}:audio`)?.filePath;
            const localSong = savedAudios.find((a) => a.readingId === `${rowId}:song`)?.filePath;

            rows.push({
              id: rowId,
              jobId: j.id,
              docNum,
              system: sysId,
              name: sysName,
              timestamp: createdAt,
              localPdfPath: localPdf,
              localAudioPath: localAudio,
              localSongPath: localSong,
            });
          }
        }
      }

      rows.sort(
        (a, b) =>
          (Date.parse(b.timestamp || '') || 0) - (Date.parse(a.timestamp || '') || 0) ||
          String(a.name).localeCompare(String(b.name))
      );

      setReadings(rows);
    } catch (e: any) {
      const errorMsg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Could not load reading');
      setLoadError(errorMsg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [jobId, person?.jobIds, personType, savedAudios, savedPDFs]);

  useFocusEffect(
    useCallback(() => {
      loadV2();
      return () => {
        // Stop polling when leaving
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        // Stop audio when leaving
        if (soundRef.current) {
          soundRef.current.stopAsync();
          soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingId(null);
      };
    }, [loadV2])
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

    // Only poll if job is still generating
    if (pollTimerRef.current) return; // already polling

    const pollInterval = 15000; // Poll every 15s while generating
    console.log(`🔄 Starting poll (job ${jobStatus}) every ${pollInterval}ms`);

    pollTimerRef.current = setInterval(() => {
      if (isScrubbing || isSongScrubbing) return;
      if (isPlayingMutex.current) return;
      if (soundRef.current) return;
      loadV2();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobId, jobStatus, loading, playingId, isScrubbing, isSongScrubbing, loadV2]);

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

      // Start new audio - STREAM directly from URL
      setLoadingAudioId(reading.id);
      const url = reading.audioPath;
      
      if (!url) throw new Error('No audio URL');
      
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
    } catch (e: any) {
      console.error('❌ Audio error:', e);
      const errorMsg = e?.message || 'Unknown error';
      Alert.alert('Audio Error', `Could not play audio: ${errorMsg}\n\nCheck Metro console for details.`);
      setPlayingId(null);
      setLoadingAudioId(null);
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
      if (reading.localAudioPath && (await fileExistsNonEmpty(reading.localAudioPath))) {
        return reading.localAudioPath;
      }
      if (!reading.audioPath) throw new Error('Audio not ready yet');

      const folder = await getRowFolder(reading);
      const ext = await inferAudioExtension(reading.audioPath);
      const dest = `${folder}narration.${ext}`;

      setLoadingAudioId(reading.id);
      const uri = await downloadTo(reading.audioPath, dest, reading.id);
      setLoadingAudioId(null);
      setAudioLoadProgress((prev) => ({ ...prev, [reading.id]: 0 }));
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
      if (!reading.songPath) throw new Error('Song not ready yet');

      const folder = await getRowFolder(reading);
      const ext = await inferAudioExtension(reading.songPath);
      const dest = `${folder}song.${ext}`;

      const uri = await downloadTo(reading.songPath, dest);
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
    [addSavedAudio, downloadTo, fileExistsNonEmpty, getRowFolder, inferAudioExtension, personId, personName, updateReadingLocal]
  );

  const ensureLocalPdf = useCallback(
    async (reading: Reading) => {
      if (reading.localPdfPath && (await fileExistsNonEmpty(reading.localPdfPath))) {
        return reading.localPdfPath;
      }
      if (!reading.pdfPath) throw new Error('PDF not ready yet');

      const folder = await getRowFolder(reading);
      const dest = `${folder}reading.pdf`;
      const uri = await downloadTo(reading.pdfPath, dest);
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
    [addSavedPDF, downloadTo, fileExistsNonEmpty, getRowFolder, personId, personName, updateReadingLocal]
  );

  const handlePdfPress = useCallback(
    async (reading: Reading) => {
      try {
        const uri = await ensureLocalPdf(reading);
        await Linking.openURL(uri);
      } catch (e: any) {
        Alert.alert('PDF', e?.message || 'Could not open PDF');
      }
    },
    [ensureLocalPdf]
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
        // Use local file if available, otherwise stream from remote
        const uri = reading.localSongPath || reading.songPath;
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
    [navigation, personName]
  );

  const handlePlayPress = useCallback(
    async (reading: Reading) => {
      try {
        // STREAM first (don't wait for download) - use local if available
        if (reading.localAudioPath) {
          await togglePlay({ ...reading, audioPath: reading.localAudioPath });
        } else if (reading.audioPath) {
          // Stream directly from remote URL
          await togglePlay(reading);
        } else {
          Alert.alert('Audio', 'Audio not ready yet');
        }
      } catch (e: any) {
        Alert.alert('Audio', e?.message || 'Could not play audio');
      }
    },
    [togglePlay]
  );

  const handleDownloadAllPress = useCallback(
    async (reading: Reading) => {
      try {
        await ensureLocalPdf(reading);
        await ensureLocalAudio(reading);
        await ensureLocalSong(reading);
      } catch (e: any) {
        Alert.alert('Download All', e?.message || 'Download failed');
      }
    },
    [ensureLocalAudio, ensureLocalPdf, ensureLocalSong]
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

        {isRefreshing && readings.length > 0 && jobStatus !== 'complete' && (
          <Text style={styles.refreshingText}>Refreshing...</Text>
        )}

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
              const hasAudioRemote = !!reading.audioPath;
              const hasPdfRemote = !!reading.pdfPath;
              const hasSongRemote = !!reading.songPath;
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
                    <TouchableOpacity
                      onPress={() => handlePdfPress(reading)}
                      onLongPress={() => handlePdfShare(reading)}
                      style={[styles.pdfButton, !hasPdfRemote && styles.disabledButton]}
                      disabled={!hasPdfRemote}
                    >
                      <Text style={[styles.pdfText, !hasPdfRemote && styles.disabledText]}>PDF</Text>
                    </TouchableOpacity>
                    
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

                  {/* Narration Audio Bar (pink/red) */}
                  <View style={styles.audioBar}>
                    <TouchableOpacity
                      onPress={() => handlePlayPress(reading)}
                      style={[styles.playButton, !hasAudioRemote && styles.disabledButton]}
                      disabled={!hasAudioRemote}
                    >
                      {loadingAudioId === reading.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.progressContainer}>
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
                    </View>

                    <Text style={styles.timeText}>
                      {canScrubNarration
                        ? `${formatTime(
                            isScrubbing && scrubbingNarrationIdRef.current === reading.id
                              ? scrubPosition
                              : playbackPosition
                          )} / ${formatTime(playbackDuration)}`
                        : '--:--'
                      }
                    </Text>
                  </View>

                  {/* Song Audio Bar (black) */}
                  <View style={styles.songAudioBar}>
                    <TouchableOpacity
                      onPress={() => toggleSongPlay(reading)}
                      style={[styles.songPlayButton, !hasSongRemote && styles.songDisabledButton]}
                      disabled={!hasSongRemote}
                    >
                      {loadingSongId === reading.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.songPlayIcon}>{isSongPlaying ? '❚❚' : '♪'}</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.songProgressContainer}>
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
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  loadingText: {
    fontFamily: 'System',
    fontSize: 16,
    color: '#888', // Grey
    textAlign: 'center',
    marginTop: 40,
  },
  refreshingText: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
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
    marginLeft: 8,
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
    opacity: 0.4,
  },
  disabledText: {
    color: '#AAA', // Lighter grey for disabled text
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
    fontFamily: 'System',
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
    fontFamily: 'System',
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
});
