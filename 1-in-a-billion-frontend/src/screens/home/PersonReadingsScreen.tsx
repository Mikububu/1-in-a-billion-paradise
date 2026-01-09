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
import * as FileSystem from 'expo-file-system/legacy';
import { getCacheDirectory, getDocumentDirectory } from '@/utils/fileSystem';
import * as Sharing from 'expo-sharing';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { createArtifactSignedUrl } from '@/services/nuclearReadingsService';
import { colors } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';

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
};

export const PersonReadingsScreen = ({ navigation, route }: Props) => {
  const { personName, personType, jobId: routeJobId } = route.params;
  const routePersonId = (route.params as any).personId; // May not exist in older nav calls

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:mount',message:'Screen mounted',data:{personName,personType,routeJobId,routePersonId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  // Store access
  const people = useProfileStore((s) => s.people);
  const getReadingsByJobId = useProfileStore((s) => s.getReadingsByJobId);
  const createPlaceholderReadings = useProfileStore((s) => s.createPlaceholderReadings);
  const syncReadingArtifacts = useProfileStore((s) => s.syncReadingArtifacts);

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:people',message:'People from store',data:{peopleCount:people.length,peopleNames:people.map(p=>p.name),peopleIds:people.map(p=>p.id)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion

  // Find person - try ID first, then fallback to name lookup
  const person = routePersonId 
    ? people.find(p => p.id === routePersonId)
    : people.find(p => p.name === personName);
  
  const personId = person?.id;

  // FALLBACK: If no jobId from route, use first jobId from person's store
  const jobId = routeJobId || person?.jobIds?.[0] || undefined;

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:personLookup',message:'Person lookup result',data:{found:!!person,personId,personName:person?.name,routePersonId,searchName:personName,personJobIds:person?.jobIds,personJobIdsCount:person?.jobIds?.length||0,routeJobId,resolvedJobId:jobId,usedFallback:!routeJobId&&!!person?.jobIds?.[0]},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion

  // Get readings from store (SINGLE SOURCE OF TRUTH - Audible style)
  // If jobId provided, use it. Otherwise, get readings from ALL jobs for this person
  const storedReadings = personId 
    ? (jobId 
        ? getReadingsByJobId(personId, jobId)
        : (person?.readings || [])) // Show all readings if no specific jobId
    : [];
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:storedReadings',message:'Readings from store',data:{personId,jobId,storedReadingsCount:storedReadings.length,storedReadings:storedReadings.map(r=>({id:r.id,system:r.system,jobId:r.jobId,hasPdf:!!r.pdfPath,hasAudio:!!r.audioPath}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3,H4'})}).catch(()=>{});
  // #endregion
  
  // Initialize with store readings for instant display (like Audible)
  // Convert store readings to screen format
  const initialReadings = storedReadings.map(r => ({
    id: r.id,
    system: r.system,
    name: SYSTEMS.find(s => s.id === r.system)?.name || r.system,
    pdfPath: r.pdfPath,
    audioPath: r.audioPath,
    songPath: r.songPath,
    duration: r.duration,
    timestamp: r.createdAt || r.generatedAt,
  }));
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:initialReadings',message:'Initial readings mapped',data:{initialReadingsCount:initialReadings.length,systemsAvailable:!!SYSTEMS,systemsCount:SYSTEMS?.length,initialReadings:initialReadings.map(r=>({id:r.id,system:r.system,name:r.name}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5,H6'})}).catch(()=>{});
  // #endregion
  
  const [readings, setReadings] = useState<Reading[]>(initialReadings);
  const [jobStatus, setJobStatus] = useState<string>('pending'); // NEW: Track job status
  const [jobProgress, setJobProgress] = useState<{percent: number; tasksComplete: number; tasksTotal: number} | null>(null); // NEW
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [audioLoadProgress, setAudioLoadProgress] = useState<Record<string, number>>({});
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressBarWidths = useRef<Record<string, number>>({});
  const isPlayingMutex = useRef(false); // Prevent multiple plays at once
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:loadStart',message:'loadReadings start',data:{jobId,personType,personName,hasJobId:!!jobId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'LOAD'})}).catch(()=>{});
    // #endregion
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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:jobData',message:'Job data loaded',data:{jobId,status:jobData.job?.status,type:jobData.job?.type,documentsCount:jobData.job?.results?.documents?.length||0,documents:(jobData.job?.results?.documents||[]).map((d:any)=>({docNum:d.docNum,hasPdf:!!d.pdfUrl,hasAudio:!!d.audioUrl,hasSong:!!d.songUrl}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOBDATA'})}).catch(()=>{});
      // #endregion
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
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:aggregateCheck',message:'Checking if should aggregate jobs',data:{currentJobId:jobId,currentJobSystemsCount:orderedSystems.length,allJobIdsCount:allJobIds.length,allJobIds,shouldAggregateJobs},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'AGGREGATE'})}).catch(()=>{});
      // #endregion
      
      const docRange = getDocRange(jobType, systemCount);
      
      // AGGREGATE: If current job only has 1 system, fetch from all other jobs too
      let allDocuments = documents;
      if (shouldAggregateJobs) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:aggregateStart',message:'Starting job aggregation',data:{allJobIdsCount:allJobIds.length,otherJobIds:allJobIds.filter(id=>id!==jobId)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'AGGREGATE'})}).catch(()=>{});
        // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:aggregateResult',message:'Job aggregation complete',data:{originalDocumentsCount:documents.length,otherDocumentsCount:otherDocuments.length,totalDocumentsCount:allDocuments.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'AGGREGATE'})}).catch(()=>{});
        // #endregion
      }

      const documents = jobData.job?.results?.documents || [];
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
          // Use backend proxy endpoint for audio streaming (AVPlayer-friendly Range support).
          // This avoids sending Supabase signed URLs directly to clients.
          audioPath: existing?.audioPath || (doc.audioUrl ? `${env.CORE_API_URL}/api/jobs/v2/${docJobId}/audio/${docNum}` : undefined),
          // Song URL (if generated)
          // Use backend proxy endpoint for song downloads (consistent with audio)
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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:songCheck',message:'Song artifact check',data:{docNum,system:system.id,hasSongUrl:!!doc.songUrl,hasSongPath:!!readingsMap[mapKey]?.songPath,docJobId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SONG'})}).catch(()=>{});
        // #endregion
      }

      console.log('📦 Readings built:', Object.keys(readingsMap).length);

      // If API isn't returning audio URLs yet, fall back to Supabase artifacts directly.
      // This makes the app resilient when audio artifacts are stored as audio_mp3/audio_m4a.
      if (!hasAnyAudioFromApi && isSupabaseConfigured) {
        try {
          const { data: arts, error: aErr } = await supabase
            .from('job_artifacts')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
          if (aErr) throw aErr;

          const byDoc: Record<number, { pdfPath?: string; audioPath?: string; songPath?: string }> = {};
          for (const a of arts || []) {
            const meta = (a as any).metadata || {};
            const docNumRaw = meta?.docNum ?? meta?.chapter_index;
            const docNum = typeof docNumRaw === 'number' ? docNumRaw : Number(docNumRaw);
            if (!docNum || !docRange.includes(docNum)) continue;

            const t = String((a as any).artifact_type || '');
            if (t === 'pdf') {
              byDoc[docNum] = byDoc[docNum] || {};
              byDoc[docNum].pdfPath = (a as any).storage_path;
            }
            if (t === 'audio' || t.startsWith('audio_')) {
              // Skip songs in this block (handled separately)
              if (t === 'audio_song') continue;
              byDoc[docNum] = byDoc[docNum] || {};
              byDoc[docNum].audioPath = (a as any).storage_path;
            }
            if (t === 'audio_song') {
              byDoc[docNum] = byDoc[docNum] || {};
              byDoc[docNum].songPath = (a as any).storage_path;
            }
          }

          // Sign URLs in parallel (1h)
          const signed = await Promise.all(
            docRange.map(async (docNum) => {
              const entry = byDoc[docNum] || {};
              const [pdfUrl, audioUrl, songUrl] = await Promise.all([
                entry.pdfPath ? createArtifactSignedUrl(entry.pdfPath, 60 * 60) : Promise.resolve(null),
                entry.audioPath ? createArtifactSignedUrl(entry.audioPath, 60 * 60) : Promise.resolve(null),
                entry.songPath ? createArtifactSignedUrl(entry.songPath, 60 * 60) : Promise.resolve(null),
              ]);
              return { docNum, pdfUrl, audioUrl, songUrl };
            })
          );

          for (const s of signed) {
            if (!s) continue;
            const r = readingsMap[s.docNum];
            if (!r) continue;
            // Only fill gaps so API values win when present
            if (!r.pdfPath && s.pdfUrl) r.pdfPath = s.pdfUrl;
            if (!r.audioPath && s.audioUrl) r.audioPath = s.audioUrl;
            if (!r.songPath && s.songUrl) r.songPath = s.songUrl;
          }
        } catch (e) {
          // ignore fallback failures
        }
      }

      // Fill in missing with placeholders - ONLY show systems that were actually ordered
      // For aggregated jobs, show all 5 systems
      const orderedSystems = shouldAggregateJobs 
        ? ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah']
        : (jobData.job?.params?.systems || []);
      console.log(`📋 Ordered systems from job params:`, orderedSystems);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:orderedSystems',message:'Ordered systems analysis',data:{orderedSystemsCount:orderedSystems.length,orderedSystems,personType,systemCount:orderedSystems.length,docRange,shouldAggregateJobs},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYSTEMS'})}).catch(()=>{});
      // #endregion
      const systemsToShow = personType === 'overlay' 
        ? SYSTEMS 
        : SYSTEMS.filter(s => orderedSystems.includes(s.id));
      
      // If no systems specified, fall back to showing first N systems (legacy behavior)
      const finalSystemsToShow = systemsToShow.length > 0 ? systemsToShow : SYSTEMS.slice(0, systemCount);
      console.log(`📋 Final systems to show (${finalSystemsToShow.length}):`, finalSystemsToShow.map(s => s.name));
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:finalSystemsToShow',message:'Final systems to show',data:{finalSystemsToShowCount:finalSystemsToShow.length,finalSystemsToShow:finalSystemsToShow.map(s=>s.id),readingsMapKeys:Object.keys(readingsMap),readingsMapCount:Object.keys(readingsMap).length,shouldAggregateJobs},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYSTEMS'})}).catch(()=>{});
      // #endregion
      
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:finalReadingsBeforeFilter',message:'Final readings before filter',data:{finalReadingsCount:finalReadings.length,finalReadings:finalReadings.map(r=>({id:r.id,system:r.system,name:r.name,hasPdf:!!r.pdfPath,hasAudio:!!r.audioPath,hasSong:!!r.songPath,isPlaceholder:r.id.startsWith('placeholder')}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FILTER'})}).catch(()=>{});
      // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:beforeFilter',message:'Pre-filter readings',data:{finalReadingsCount:finalReadings.length,jobStatus:status,finalReadings:finalReadings.map(r=>({id:r.id,system:r.system,hasPdf:!!r.pdfPath,hasAudio:!!r.audioPath,hasSong:!!r.songPath}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FILTER'})}).catch(()=>{});
      // #endregion
      const isJobProcessing = status === 'processing' || status === 'pending' || status === 'queued';
      const realReadings = isJobProcessing 
        ? finalReadings // Show all placeholders while processing
        : finalReadings.filter(r => {
            // After job completes, only show readings with at least one artifact
            const hasRealContent = !!(r.pdfPath || r.audioPath || r.songPath);
            return hasRealContent;
          });

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:afterFilter',message:'Post-filter readings',data:{realReadingsCount:realReadings.length,realReadings:realReadings.map(r=>({id:r.id,system:r.system}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FILTER'})}).catch(()=>{});
      // #endregion
      // If no real readings exist, show nothing (empty state)
      // Don't show placeholders for incomplete/failed jobs
      setReadings(realReadings);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:setReadings',message:'State updated with readings',data:{newReadingsCount:realReadings.length,systems:realReadings.map(r=>r.system)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'STATE'})}).catch(()=>{});
      // #endregion

      // AUDIBLE-STYLE PERSISTENCE: Sync to store for persistent library
      if (personId && jobId && realReadings.length > 0) {
        // Check if readings already exist in store for this job
        const existingReadings = getReadingsByJobId(personId, jobId);
        
        if (existingReadings.length === 0) {
          // First time loading - create placeholders in store
          const systems = realReadings.map(r => r.system as any);
          const createdAt = jobData?.job?.created_at || new Date().toISOString();
          createPlaceholderReadings(personId, jobId, systems, createdAt);
          console.log(`✅ Created ${systems.length} placeholder readings in store for job ${jobId}`);
        }
        
        // Sync artifact paths to store (updates existing placeholders)
        for (const reading of realReadings) {
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
        console.log(`✅ Synced ${realReadings.length} readings to store (Audible-style persistence)`);
      }
    } catch (e: any) {
      const errorMsg = e.name === 'AbortError' ? 'Request timed out' : e.message;
      console.error('❌ [PersonReadings] Error loading readings:', errorMsg);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:catch',message:'Error in loadReadings',data:{error:errorMsg,jobId,personType},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ERROR'})}).catch(()=>{});
      // #endregion
      setLoadError(errorMsg || 'Could not load reading');
      // Show empty state on error - the loadError banner provides retry option
      setReadings([]);
    } finally {
      console.log('✅ [PersonReadings] Load finished, setting loading=false');
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [jobId, personType, personName]); // ✅ REMOVED readings.length to prevent infinite loop

  useFocusEffect(
    useCallback(() => {
      load();
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
    }, [load])
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

  // Auto-refresh while chapters are still arriving (PDF/audio often lands at slightly different times).
  // This prevents the "everything greyed out / missing one chapter" experience.
  // 
  // ✅ OPTIMIZATION: Now that placements are saved during hooks, we don't need to poll
  // for basic user data anymore. Only poll if there's an ACTIVE JOB generating content.
  useEffect(() => {
    if (!jobId) return; // No job = nothing to poll for
    if (loading) return;
    if (playingId) return; // don't disrupt active playback

    // Only poll if we're ACTUALLY missing content from an active job
    const hasActualReadings = readings.some((r) => r.id.startsWith('reading-'));
    const missingAudio = readings.some((r) => r.id.startsWith('reading-') && !r.audioPath);
    const missingPdf = readings.some((r) => r.id.startsWith('reading-') && !r.pdfPath);

    // If we have NO real readings yet (all placeholders), poll more frequently
    const shouldPollFast = !hasActualReadings;
    // If we have SOME readings but missing audio/PDF, poll slowly
    const shouldPollSlow = hasActualReadings && (missingAudio || missingPdf);

    if (!shouldPollFast && !shouldPollSlow) {
      // Everything is complete - stop polling
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        console.log('✅ All content loaded - stopping poll');
      }
      return;
    }

    if (pollTimerRef.current) return; // already polling

    const pollInterval = shouldPollFast ? 8000 : 20000; // Fast while generating, slow for stragglers
    console.log(`🔄 Starting poll: ${shouldPollFast ? 'FAST' : 'SLOW'} (${pollInterval}ms)`);

    pollTimerRef.current = setInterval(() => {
      // Don't poll while seeking or playing; keep UI stable
      if (isSeeking) return;
      if (isPlayingMutex.current) return;
      if (soundRef.current) return;
      load();
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobId, loading, readings, playingId, isSeeking, load]);

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

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start new audio
      setLoadingAudioId(reading.id);
      let url: string = await getPlayableAudioUri(reading);

      console.log('▶️ Starting audio:', reading.name);
      console.log('▶️ Audio URL:', url.substring(0, 100) + '...');

      let sound: Audio.Sound | null = null;
      const created = await withTimeout(
        Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              // Stop showing spinner once we have any loaded status
              setLoadingAudioId(null);
              setPlaybackPosition(status.positionMillis / 1000);
              setPlaybackDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
              if (status.didJustFinish) {
                console.log('✅ Audio finished:', reading.name);
                setPlayingId(null);
                soundRef.current = null;
                // Auto-play next
                const currentIndex = readings.findIndex((r) => r.id === reading.id);
                if (currentIndex < readings.length - 1) {
                  const next = readings[currentIndex + 1];
                  if (next.audioPath) {
                    setTimeout(() => togglePlay(next), 500);
                  }
                }
              }
            }
          }
        ),
        60000, // Increased to 60s for large audio files
        'Audio load timed out'
      );
      sound = created.sound;
      // createAsync resolves only after initial load
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

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekPosition(playbackPosition);
  };

  const handleSeekMove = (readingId: string, locationX: number) => {
    if (!isSeeking || playingId !== readingId) return;
    const barWidth = progressBarWidths.current[readingId] || 200;
    const clampedX = Math.max(0, Math.min(locationX, barWidth));
    const newPosition = (clampedX / barWidth) * playbackDuration;
    setSeekPosition(newPosition);
  };

  const handleSeekEnd = async (readingId: string, locationX: number) => {
    if (!isSeeking || playingId !== readingId) {
      setIsSeeking(false);
      return;
    }
    const barWidth = progressBarWidths.current[readingId] || 200;
    const clampedX = Math.max(0, Math.min(locationX, barWidth));
    const newPosition = (clampedX / barWidth) * playbackDuration;
    setIsSeeking(false);
    await seekTo(newPosition);
  };

  const openPdf = async (reading: Reading) => {
    if (!reading.pdfPath) {
      Alert.alert('PDF not ready', 'Still generating...');
      return;
    }
    // URL is already signed from API
    Linking.openURL(reading.pdfPath);
  };

  const downloadAudio = async (reading: Reading) => {
    if (!reading.audioPath) {
      Alert.alert('Audio not ready', 'Still generating...');
      return;
    }

    try {
      // Download to local file
      const fileName = `${reading.name.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
      const localUri = (getDocumentDirectory() || '') + fileName;

      Alert.alert('Downloading...', 'Please wait');

      const downloadResult = await FileSystem.downloadAsync(reading.audioPath, localUri);

      if (downloadResult.status === 200) {
        // Share the file (opens iOS share sheet to save to Files, etc.)
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'audio/mpeg',
            dialogTitle: `Save ${reading.name}`,
          });
        } else {
          Alert.alert('Downloaded', `Saved to: ${localUri}`);
        }
      } else {
        Alert.alert('Error', 'Download failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Download failed');
    }
  };

  const downloadAllAsZip = async () => {
    if (!jobId) {
      Alert.alert('Error', 'No job ID available');
      return;
    }

    setZipLoading(true);
    try {
      // Extract docNums from reading IDs (handle both 'reading-1' and 'reading-1-{jobId}' formats)
      const docNums = readings
        .filter((r) => r.id.startsWith('reading-'))
        .map((r) => {
          // Try standard format: reading-1
          let m = r.id.match(/^reading-(\d+)$/);
          if (m) return Number(m[1]);
          // Try aggregated format: reading-1-{jobId}
          m = r.id.match(/^reading-(\d+)-/);
          if (m) return Number(m[1]);
          return null;
        })
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PersonReadingsScreen.tsx:zipDownload',message:'ZIP download initiated',data:{jobId,readingsCount:readings.length,docNums,readingsWithSongs:readings.filter(r=>!!r.songPath).length,readingsWithPdf:readings.filter(r=>!!r.pdfPath).length,readingsWithAudio:readings.filter(r=>!!r.audioPath).length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ZIP'})}).catch(()=>{});
      // #endregion

      const docsParam = docNums.length > 0 ? `?docs=${encodeURIComponent(docNums.sort((a, b) => a - b).join(','))}` : '';
      const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}/download-zip${docsParam}`;

      const response = await fetch(url);
      const raw = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        // Non-JSON response (e.g. Not Found). Surface a helpful error.
        throw new Error(raw?.slice(0, 120) || `ZIP request failed (${response.status})`);
      }

      if (!response.ok || !data?.success || !data?.downloadUrl) {
        throw new Error(data?.error || `Failed to create ZIP (${response.status})`);
      }

      await Linking.openURL(data.downloadUrl);
    } catch (error: any) {
      console.error('ZIP download error:', error);
      Alert.alert('Download Error', error.message || 'Could not download ZIP');
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{personName}</Text>
        </View>

        {/* Job Status Banner: Complete or Error only */}
        {jobStatus === 'complete' && (
          <View style={[styles.statusBanner, styles.statusBannerComplete]}>
            <Text style={styles.statusTextComplete}>✅ Ready</Text>
          </View>
        )}
        {jobStatus === 'error' && (
          <View style={[styles.statusBanner, styles.statusBannerError]}>
            <Text style={styles.statusTextError}>❌ Error</Text>
          </View>
        )}

        {!!loadError && !loading ? (
          <TouchableOpacity
            onPress={load}
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

        {isRefreshing && readings.length > 0 && (
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
              const hasAudio = !!reading.audioPath;
              const hasPdf = !!reading.pdfPath;
              const hasSong = !!reading.songPath;
              const progress = isPlaying && playbackDuration > 0
                ? (playbackPosition / playbackDuration) * 100
                : 0;

              return (
                <View key={`${jobId}-${reading.id}-${reading.system}-${index}`} style={styles.readingCard}>
                  {/* System Name with Timestamp - LEFT ALIGNED ABOVE BUTTONS */}
                  <View style={styles.systemNameContainer}>
                    <Text style={styles.systemName}>{reading.name}</Text>
                    {reading.timestamp && (
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
                    )}
                  </View>
                  
                  {/* Action Buttons Row */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      onPress={() => openPdf(reading)}
                      style={[styles.pdfButton, !hasPdf && styles.disabledButton]}
                      disabled={!hasPdf}
                    >
                      <Text style={[styles.pdfText, !hasPdf && styles.disabledText]}>PDF</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => downloadAudio(reading)}
                      style={[styles.downloadButton, !hasAudio && styles.disabledButton]}
                      disabled={!hasAudio}
                    >
                      <Text style={[styles.downloadIcon, !hasAudio && styles.disabledText]}>↓</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => {
                        if (reading.songPath) {
                          Linking.openURL(reading.songPath).catch(() => {
                            Alert.alert('Error', 'Could not open song');
                          });
                        }
                      }}
                      style={[styles.songButton, !hasSong && styles.disabledButton]}
                      disabled={!hasSong}
                    >
                      <Text style={[styles.songIcon, !hasSong && styles.disabledText]}>🎵</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Audio Bar */}
                  <View style={styles.audioBar}>
                    <TouchableOpacity
                      onPress={() => togglePlay(reading)}
                      style={[styles.playButton, !hasAudio && styles.disabledButton]}
                      disabled={!hasAudio}
                    >
                      {loadingAudioId === reading.id ? (
                        audioLoadProgress[reading.id] && audioLoadProgress[reading.id] > 0 ? (
                          <Text style={styles.playIcon}>
                            {Math.round(audioLoadProgress[reading.id] * 100)}%
                          </Text>
                        ) : (
                          <ActivityIndicator size="small" color="#FFF" />
                        )
                      ) : (
                        <Text style={styles.playIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
                      )}
                    </TouchableOpacity>

                    {/* Seekable Progress Bar */}
                    <View
                      style={styles.progressContainer}
                      onLayout={(e: LayoutChangeEvent) => {
                        progressBarWidths.current[reading.id] = e.nativeEvent.layout.width;
                      }}
                      onStartShouldSetResponder={() => isPlaying && hasAudio}
                      onMoveShouldSetResponder={() => isPlaying && hasAudio}
                      onResponderGrant={(e: GestureResponderEvent) => {
                        if (isPlaying) handleSeekStart();
                      }}
                      onResponderMove={(e: GestureResponderEvent) => {
                        if (isPlaying) handleSeekMove(reading.id, e.nativeEvent.locationX);
                      }}
                      onResponderRelease={(e: GestureResponderEvent) => {
                        if (isPlaying) handleSeekEnd(reading.id, e.nativeEvent.locationX);
                      }}
                    >
                      <View style={styles.progressTrack}>
                        <View style={[
                          styles.progressFill,
                          { width: `${isSeeking && isPlaying ? (seekPosition / playbackDuration) * 100 : progress}%` }
                        ]} />
                        {/* Draggable thumb - only show when playing */}
                        {isPlaying && (
                          <View style={[
                            styles.progressThumb,
                            { left: `${isSeeking ? (seekPosition / playbackDuration) * 100 : progress}%` }
                          ]} />
                        )}
                      </View>
                    </View>

                    <Text style={styles.timeText}>
                      {isPlaying
                        ? `${formatTime(isSeeking ? seekPosition : playbackPosition)} / ${formatTime(playbackDuration)}`
                        : hasAudio ? '0:00' : (hasPdf ? '…' : '--:--')
                      }
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Download All ZIP Button - only when everything is actually ready */}
        {(() => {
          const expectedCount = personType === 'overlay' ? 6 : 5;
          const actual = readings.filter((r) => r.id.startsWith('reading-'));
          const allReady =
            jobId &&
            !loading &&
            actual.length === expectedCount &&
            actual.every((r) => !!r.audioPath && !!r.pdfPath && !!r.songPath);
          if (!allReady) return null;
          return (
            <TouchableOpacity
              onPress={downloadAllAsZip}
              disabled={zipLoading}
              style={[styles.zipButton, zipLoading && styles.zipButtonLoading]}
              activeOpacity={0.8}
            >
              <Text style={styles.zipButtonText}>
                {zipLoading ? 'Creating ZIP...' : 'Download All (ZIP)'}
              </Text>
            </TouchableOpacity>
          );
        })()}
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
  // Action buttons row - LEFT ALIGNED
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'flex-start', // LEFT ALIGN
  },
  pdfButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#C41E3A', // Red
  },
  pdfText: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
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
    gap: 8,
    marginTop: 4,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 14,
    color: '#FFF',
  },
  progressContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingVertical: 8,
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
