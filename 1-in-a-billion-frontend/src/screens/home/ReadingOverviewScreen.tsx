import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Animated,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useOnboardingStore } from '@/store/onboardingStore';
import { env } from '@/config/env';
import { colors } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';
import { isSupabaseConfigured } from '@/services/supabase';
import { supabase } from '@/services/supabase';
import { Audio } from 'expo-av';

// API URL (RunPod / local dev)
const API_URL = env.CORE_API_URL;

// Chapter status types
// Local ChapterStatus separate from component if needed, or derived
type ChapterStatus = 'pending' | 'generating_text' | 'generating_audio' | 'generating_pdf' | 'complete' | 'error';
// Chapter interface imported from component

interface ReadingOverviewParams {
  readingId?: string;
  title?: string;
  person1Name?: string;
  person2Name?: string;
  person1?: {
    name: string;
    birthDate: string;
    birthTime: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  person2?: {
    name: string;
    birthDate: string;
    birthTime: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  productType?: string;
  systems?: string[];
  readingType?: 'individual' | 'overlay';
  voiceId?: string;
  audioUrl?: string; // URL for cloning
}

import { ChapterCard, Chapter } from '@/components/ChapterCard';
import { toAbsoluteUrl } from '@/utils/url';
import { systemLabelForHeadline, systemBlurb } from '@/data/systems';
import { BackButton } from '@/components/BackButton';

const BRAND_RED = '#FF4FA3';
const SYSTEM_NAMES: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

// ... (keep constant definitions)

export default function ReadingOverviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = (route.params || {}) as ReadingOverviewParams;

  const {
    title = 'Reading',
    person1Name,
    person2Name,
    person1,
    person2,
    productType = 'single_system',
    systems = ['western'],
    readingType = 'individual',
    voiceId = 'david', // Default if missing
    audioUrl = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/voices/voice_10sec.wav', // Default if missing
  } = params;

  // Store & State
  const relationshipIntensity = useOnboardingStore((s) => s.relationshipIntensity);
  // Fix: name is now in people array
  const mainUser = useOnboardingStore((s) => s.getMainUser());
  const userData = person1 || {
    name: mainUser?.name || 'User',
    birthDate: mainUser?.birthDate || '',
    birthTime: mainUser?.birthTime || '',
    timezone: mainUser?.birthCity?.timezone || 'UTC',
    latitude: mainUser?.birthCity?.latitude || 0,
    longitude: mainUser?.birthCity?.longitude || 0,
  };

  const partnerData = person2 || {
    name: person2Name || 'Partner',
    birthDate: '',
    birthTime: '',
    timezone: 'UTC',
    latitude: 0,
    longitude: 0,
  };

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const hasBuiltDocChaptersRef = useRef(false);
  const hasSavedToLibraryRef = useRef(false);

  const { addSavedAudio, savedAudios } = useProfileStore();

  // Names for display
  const displayName1 = person1Name || userData.name;
  const displayName2 = person2Name || partnerData.name;
  const storedPartnerName = 'Partner'; // Placeholder if needed

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startGeneration = async (initialChapters: Chapter[]) => {
    setIsGenerating(true);
    setError(null);

    try {
      const isOverlay = readingType === 'overlay' || !!person2Name;

      // Build job payload - use 'nuclear_v2' for nuclear_package (16 docs)
      const jobType = productType === 'nuclear_package' ? 'nuclear_v2' : (isOverlay ? 'synastry' : 'extended');

      const payload: any = {
        type: jobType,
        systems,
        person1: {
          id: userData.id, // CRITICAL: Include unique person ID
          name: userData.name,
          birthDate: userData.birthDate,
          birthTime: userData.birthTime,
          timezone: userData.timezone,
          latitude: userData.latitude,
          longitude: userData.longitude,
        },
        relationshipIntensity,
        voiceId,     // Pass voiceId
        audioUrl,    // Pass audioUrl for cloning
      };

      if (isOverlay) {
        payload.person2 = {
          id: partnerData.id, // CRITICAL: Include unique person ID
          name: partnerData.name,
          birthDate: partnerData.birthDate,
          birthTime: partnerData.birthTime,
          timezone: partnerData.timezone,
          latitude: partnerData.latitude,
          longitude: partnerData.longitude,
        };
      }

      console.log('📤 Starting job:', JSON.stringify(payload, null, 2));

      // Get user ID from Supabase session (optional). If Supabase isn't configured, use test user.
      let userId = '00000000-0000-0000-0000-000000000001';
      let isAuthed = false;
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            userId = session.user.id;
            isAuthed = true;
          }
        } catch (e) {
          // ignore
        }
      }
      console.log('👤 Using user ID:', userId, isAuthed ? '(authenticated)' : '(test user)');

      // Start the job (V2 - Supabase queue)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      };

      const url = `${API_URL}/api/jobs/v2/start`;
      console.log('🌐 Fetching:', url);
      console.log('📤 Payload:', JSON.stringify(payload, null, 2));
      console.log('📋 Headers:', JSON.stringify(headers, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }).catch((fetchError: any) => {
        console.error('❌ Fetch error:', fetchError.message, fetchError.name);
        console.error('   URL:', url);
        console.error('   API_URL:', API_URL);
        throw new Error(`Network request failed: ${fetchError.message}`);
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Job start failed:', response.status, errorText);
        throw new Error(`Failed to start job: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('📥 Job start response:', JSON.stringify(responseData, null, 2));
      const { jobId: newJobId } = responseData;

      if (!newJobId) {
        console.error('❌ No jobId in response:', responseData);
        throw new Error('No jobId returned from backend');
      }

      setJobId(newJobId);
      console.log('✅ Job started:', newJobId);

      // Start polling
      pollingRef.current = setInterval(() => pollJobStatus(newJobId, initialChapters), 2000);

    } catch (err: any) {
      console.error('❌ Failed to start generation:', err);
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const pollJobStatus = async (id: string, initialChapters: Chapter[]) => {
    try {
      console.log('🔄 Polling job:', id);

      const url = `${API_URL}/api/jobs/v2/${id}`;

      // Get auth token ONLY if Supabase is configured; otherwise this can hang on placeholder URL.
      let accessToken: string | undefined;
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          accessToken = session?.access_token;
        } catch (e) {
          console.log('⚠️ Supabase getSession failed; polling without auth header');
        }
      }

      // Try with auth header if available; if backend rejects it, retry without auth.
      let response = await fetch(url, {
        headers: accessToken
          ? { 'Authorization': `Bearer ${accessToken}` }
          : {},
      });
      if (response.status === 401 || response.status === 403) {
        console.log(`⚠️ Poll got ${response.status}; retrying without auth header`);
        response = await fetch(url);
      }
      if (!response.ok) {
        console.error('❌ Poll failed:', response.status);
        throw new Error('Failed to get job status');
      }

      const data = await response.json();
      const job = data.job;

      if (!job) {
        console.error('❌ No job in response:', data);
        return;
      }

      console.log('📊 Job status:', job.status, job.progress?.percent || 0, job.progress?.message);

      // Update overall progress
      setOverallProgress(job.progress?.percent || 0);

      const phase = job.progress?.phase || 'calculating';
      const callsComplete = job.progress?.callsComplete || 0;
      const callsTotal = job.progress?.callsTotal || 16;
      const tasksComplete = job.progress?.tasksComplete || 0; // NEW: Use tasksComplete from trigger
      const tasksTotal = job.progress?.tasksTotal || 16; // NEW: Use tasksTotal from trigger
      const currentStep = job.progress?.currentStep || '';
      const message = job.progress?.message || '';
      console.log(`📈 Progress: ${job.progress?.percent}% | phase=${phase} | tasks=${tasksComplete}/${tasksTotal} | calls=${callsComplete}/${callsTotal}`);
      console.log(`   Step: ${currentStep} | Message: ${message}`);

      // Nuclear_v2: ALWAYS prefer real document list from backend (16 docs with per-chapter audioUrl)
      const docs = job.results?.documents;
      console.log(`🔍 Documents check:`, {
        hasResults: !!job.results,
        hasDocuments: !!job.results?.documents,
        docsLength: Array.isArray(docs) ? docs.length : 'not an array',
        firstDoc: Array.isArray(docs) && docs.length > 0 ? {
          title: docs[0]?.title,
          pdfUrl: docs[0]?.pdfUrl ? 'exists' : 'missing',
          audioUrl: docs[0]?.audioUrl ? 'exists' : 'missing',
        } : null,
      });
      if (Array.isArray(docs) && docs.length > 0) {
        console.log(`✅ Using ${docs.length} documents from backend`);
        hasBuiltDocChaptersRef.current = true;
        setChapters(() =>
          docs.map((d: any, idx: number) => {
            const title = String(d?.title || `Chapter ${idx + 1}`);
            const sys = String(d?.system || '');
            const sysName = SYSTEM_NAMES[sys] || sys || 'Reading';
            const hasText = typeof d?.text === 'string' && d.text.length > 0;
            const pdfUrl = typeof d?.pdfUrl === 'string' ? toAbsoluteUrl(d.pdfUrl) : undefined;
            const hasPdf = !!pdfUrl; // PDF is ready when pdfUrl exists
            const audioUrl = typeof d?.audioUrl === 'string' ? toAbsoluteUrl(d.audioUrl) : undefined;
            const hasAudio = !!audioUrl;
            console.log(`📄 Doc ${idx + 1} (${title}): pdfUrl=${!!pdfUrl} audioUrl=${!!audioUrl} hasPdf=${hasPdf}`);

            const docType = String(d?.docType || '');
            const headlineSystem = systemLabelForHeadline(sys || undefined);
            const systemBlurbText = systemBlurb(sys || undefined);
            const p1 = person1?.name || userData.name;
            const p2 = person2?.name || partnerData.name;
            const headlineText =
              docType === 'person1'
                ? `The karmic soul journey of ${p1} under ${headlineSystem}.`
                : docType === 'person2'
                  ? `The karmic soul journey of ${p2} under ${headlineSystem}.`
                  : docType === 'overlay'
                    ? `The soul journey of ${p1} and ${p2} under the umbrella of ${headlineSystem}.`
                    : docType === 'verdict'
                      ? `The Final Verdict for ${p1} and ${p2}'s connection in this life.`
                      : `The soul journey under the umbrella of ${headlineSystem}.`;

            return {
              id: String(d?.id || `doc_${idx + 1}`),
              number: idx + 1,
              name: title,
              system: sysName,
              systemId: sys || undefined,
              description: String(d?.docType || '').includes('overlay')
                ? 'Compatibility overlay'
                : String(d?.docType || '').includes('verdict')
                  ? 'Final verdict'
                  : 'Chapter',
              status: hasAudio ? ('complete' as ChapterStatus) : hasPdf ? ('generating_audio' as ChapterStatus) : ('generating_text' as ChapterStatus),
              textProgress: hasText ? 100 : 100, // Text is done if we have a document
              audioProgress: hasAudio ? 100 : 0,
              pdfProgress: hasPdf ? 100 : 0, // PDF progress = 100% only when pdfUrl actually exists
              pdfUrl,
              audioUrl,
              headlineText,
              systemBlurbText,
            } satisfies Chapter;
          })
        );
        console.log(`✅ Updated chapters with ${docs.length} documents, PDFs ready: ${docs.filter((d: any) => d?.pdfUrl).length}`);
      } else if (!hasBuiltDocChaptersRef.current) {
        console.log(`⚠️ No documents array found or empty, falling back to task-based progress`);
        // Query task status by type from Supabase to show PDF progress
        const isNuclear = productType === 'nuclear_package';

        // Get task counts by type (may fail if Supabase not configured)
        let tasks: any[] | null = null;
        try {
          const { data } = await supabase
            .from('job_tasks')
            .select('task_type, status, sequence')
            .eq('job_id', id)
            .order('sequence', { ascending: true });
          tasks = data;
        } catch (e) {
          console.log('⚠️ Supabase task query failed, using backend progress only');
        }

        const textTasks = tasks?.filter(t => t.task_type === 'text_generation') || [];
        const pdfTasks = tasks?.filter(t => t.task_type === 'pdf_generation') || [];
        const audioTasks = tasks?.filter(t => t.task_type === 'audio_generation') || [];

        const textComplete = textTasks.filter(t => t.status === 'complete').length;
        const pdfComplete = pdfTasks.filter(t => t.status === 'complete').length;
        const audioComplete = audioTasks.filter(t => t.status === 'complete').length;

        const textTotal = textTasks.length || 16;
        const pdfTotal = pdfTasks.length || 16;
        const audioTotal = audioTasks.length || 16;

        // Use backend's overall progress as fallback
        const backendPercent = job.progress?.percent || 0;
        console.log(`📊 Tasks: Text ${textComplete}/${textTotal}, PDF ${pdfComplete}/${pdfTotal}, Audio ${audioComplete}/${audioTotal}, Backend: ${backendPercent}%`);

        // Update chapters with REAL progress estimates
        // PDF bar = Text (0-70%) + PDF creation (70-100%)
        // Audio bar = Audio generation (0-100%)
        setChapters((prev) =>
          prev.map((ch, index) => {
            if (phase === 'complete') {
              return { ...ch, status: 'complete', textProgress: 100, audioProgress: 100, pdfProgress: 100 };
            }

            // Calculate PDF progress based on ACTUAL task status
            let pdfProgress = 0;
            let status: ChapterStatus = 'pending';

            // Find the PDF task for this chapter (by sequence/index)
            const pdfTask = pdfTasks.find((t: any) => t.sequence === index);

            if (pdfTask) {
              // PDF task exists - check its actual status
              if (pdfTask.status === 'complete') {
                pdfProgress = 100;
                status = 'generating_audio';
              } else if (pdfTask.status === 'processing' || pdfTask.status === 'claimed') {
                // PDF is being generated - show 50% progress
                pdfProgress = 50;
                status = 'generating_pdf';
              } else {
                // PDF task exists but not started yet - wait for text first
                if (index < textComplete) {
                  // Text is done, PDF task exists but not started - show 10% (queued)
                  pdfProgress = 10;
                  status = 'generating_pdf';
                } else {
                  // Text not done yet - PDF can't start
                  pdfProgress = 0;
                  status = 'generating_text';
                }
              }
            } else {
              // No PDF task yet - check if text is done
              if (index < textComplete) {
                // Text done but no PDF task created yet - show 5% (waiting for PDF task creation)
                pdfProgress = 5;
                status = 'generating_pdf';
              } else if (index === textComplete) {
                // Currently generating text - show 0% for PDF
                pdfProgress = 0;
                status = 'generating_text';
              } else {
                // Not started yet
                pdfProgress = 0;
                status = 'pending';
              }
            }

            // Calculate Audio progress
            let audioProgress = 0;
            if (index < audioComplete) {
              audioProgress = 100;
              if (pdfProgress >= 100) status = 'complete';
            } else if (index === audioComplete && audioComplete < audioTotal && pdfProgress >= 70) {
              // Currently generating audio - estimate based on position
              audioProgress = 25; // Show some progress
            }

            return {
              ...ch,
              status,
              textProgress: index < textComplete ? 100 : 0,
              pdfProgress,
              audioProgress,
            };
          })
        );
      }

      // Check if complete
      if (job.status === 'complete' || job.status === 'completed') {
        console.log('🎉 Job complete!');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        setIsGenerating(false);
        setOverallProgress(100);

        // Save chapter audio URLs to My Library (streamable; local download can be added later)
        if (!hasSavedToLibraryRef.current && Array.isArray(job.results?.documents)) {
          hasSavedToLibraryRef.current = true;
          const documents = job.results.documents as any[];
          const now = new Date().toISOString();
          const combinedUrl = toAbsoluteUrl(`/api/jobs/${id}/audio/combined.m4a`);

          const alreadyHas = (filePath: string) =>
            savedAudios.some((a) => a.readingId === id && a.filePath === filePath);

          // Combined (Play All)
          if (!alreadyHas(combinedUrl)) {
            addSavedAudio({
              readingId: id,
              system: 'western',
              fileName: `combined_${id}.m4a`,
              filePath: combinedUrl,
              durationSeconds: 0,
              fileSizeMB: 0,
              createdAt: now,
              title: `${title} (Combined)`,
            });
          }

          // Chapters
          for (const d of documents) {
            const rel = typeof d?.audioUrl === 'string' ? toAbsoluteUrl(d.audioUrl) : '';
            if (!rel) continue;
            if (alreadyHas(rel)) continue;
            const t = String(d?.title || 'Chapter');
            const sys = String(d?.system || 'western');
            addSavedAudio({
              readingId: id,
              system: (sys as any) || 'western',
              fileName: `${String(d?.id || 'ch')}.m4a`,
              filePath: rel,
              durationSeconds: 0,
              fileSizeMB: 0,
              createdAt: now,
              title: t,
            });
          }
        }

        // If we don't have doc-level audio URLs yet, just mark them complete
        if (!hasBuiltDocChaptersRef.current) {
          setChapters(prev => prev.map(ch => ({
            ...ch,
            status: 'complete' as ChapterStatus,
            textProgress: 100,
            audioProgress: 100,
            pdfProgress: 100,
            audioDuration: 10,
            pdfPages: 7,
          })));
        }

        // Don't show alert - just let the chapter list display naturally
        // The chapter list will show all chapters with their status
      }

      if (job.status === 'error') {
        // Stop polling on job failure
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        setIsGenerating(false);
        setError(job.progress?.message || job.error || 'Job failed');
        Alert.alert(
          'Generation Failed',
          job.progress?.message || job.error || 'An error occurred. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

    } catch (err: any) {
      console.error('❌ Polling error:', err);
      // Don't stop polling on transient network errors (job might still be running)
    }
  };

  const pdfReadyChapters = chapters.filter(ch => ch.pdfProgress >= 100 || ch.pdfUrl).length;
  const completedChapters = pdfReadyChapters;

  // Calculate READY totals (actual PDF available)
  const readyAudioMinutes = 0;
  const readyPages = chapters.reduce((acc, ch) =>
    (ch.pdfProgress >= 100 || ch.pdfUrl) ? acc + (ch.pdfPages || 7) : acc, 0);
  // Calculate ESTIMATED totals (what we'll have when done)
  const estimatedAudioMinutes = chapters.length * 10; // ~10 min per chapter
  const estimatedPages = chapters.length * 7; // ~7 pages per chapter
  // Show ready/estimated during generation, just ready when complete
  const totalAudioMinutes = isGenerating ? readyAudioMinutes : (readyAudioMinutes || estimatedAudioMinutes);
  const totalPages = isGenerating ? readyPages : (readyPages || estimatedPages);

  // USER-FACING overall progress: PDFs are the PRIMARY metric (user can READ)
  // Audio is generated LAST and shown as secondary indicator
  // When all PDFs are ready = 100% (readable), audio is bonus
  const pdfReadyCount = chapters.filter(ch => ch.pdfProgress >= 100 || ch.pdfUrl).length;
  const userFacingProgress = chapters.length > 0
    ? (pdfReadyCount / chapters.length) * 100
    : 0;

  const audioReadyCount = 0;

  const handleDownloadPDF = async (chapter: Chapter) => {
    if (!jobId) {
      Alert.alert('Error', 'Job ID not found');
      return;
    }

    try {
      // Fetch fresh job data to get latest PDF URLs (avoid cached/stale URLs)
      console.log(`📄 Fetching fresh PDF URL for chapter: ${chapter.name}`);
      const response = await fetch(`${API_URL}/api/jobs/${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job status');
      }

      const data = await response.json();
      const job = data.job;

      if (!job || !job.results?.documents) {
        // Fallback to cached URL if backend doesn't have documents
        if (chapter.pdfUrl) {
          console.log('⚠️ Using cached PDF URL (backend documents not available)');
          const supported = await Linking.canOpenURL(chapter.pdfUrl);
          if (supported) {
            await Linking.openURL(chapter.pdfUrl);
          } else {
            Alert.alert('Error', 'Cannot open PDF URL');
          }
          return;
        }
        Alert.alert('PDF not ready', 'This chapter PDF is not available yet.');
        return;
      }

      // Find the matching document by title or index
      const documents = job.results.documents as any[];
      const matchingDoc = documents.find((d: any) =>
        d.title === chapter.name ||
        d.system === chapter.systemId ||
        documents.indexOf(d) === chapter.number - 1
      );

      const pdfUrl = matchingDoc?.pdfUrl || chapter.pdfUrl;

      if (!pdfUrl) {
        Alert.alert('PDF not ready', 'This chapter PDF is not available yet.');
        return;
      }

      console.log(`✅ Opening PDF: ${pdfUrl.substring(0, 50)}...`);
      const supported = await Linking.canOpenURL(pdfUrl);
      if (supported) {
        // Add cache-busting parameter to ensure fresh PDF
        const urlWithCacheBust = pdfUrl.includes('?')
          ? `${pdfUrl}&_t=${Date.now()}`
          : `${pdfUrl}?_t=${Date.now()}`;
        await Linking.openURL(urlWithCacheBust);
      } else {
        Alert.alert('Error', 'Cannot open PDF URL');
      }
    } catch (error: any) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', `Failed to open PDF: ${error.message || 'Unknown error'}`);
    }
  };

  // ARTS Animation State
  const [statusPulse] = useState(new Animated.Value(1));
  const [cyclingMessage, setCyclingMessage] = useState('Preparing your reading...');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Cycling loading messages
  useEffect(() => {
    if (isGenerating) {
      const messages = [
        'Preparing your reading...',
        'Generating chapters...',
        'Creating PDFs...',
        'Almost ready...',
      ];
      let index = 0;
      const interval = setInterval(() => {
        index = (index + 1) % messages.length;
        setCyclingMessage(messages[index]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  // Start ARTS animations when generating
  useEffect(() => {
    if (isGenerating) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();

      const statusPulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse, { toValue: 1.15, duration: 800, useNativeDriver: false }),
          Animated.timing(statusPulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        ])
      );
      statusPulseAnim.start();

      return () => {
        statusPulseAnim.stop();
        fadeAnim.setValue(0);
      };
    }
  }, [isGenerating]);

  // Show ARTS animation screen while generating
  if (isGenerating) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <Animated.View style={[styles.artsContainer, { opacity: fadeAnim }]}>
          <Text style={styles.artsLine1}>Your</Text>
          <Text style={styles.artsLine2}>Soul Journey</Text>
          <Text style={styles.artsLine3}>Audiobook</Text>
          <Text style={styles.artsLine4}>Is Being</Text>
          <Text style={styles.artsLine5}>Created</Text>

          <Animated.Text style={[styles.artsStatus, { transform: [{ scale: statusPulse }] }]}>
            {cyclingMessage}
          </Animated.Text>

          {/* Exit buttons */}
          <View style={styles.exitButtons}>
            <Pressable
              style={styles.libraryButton}
              onPress={() => navigation.navigate('MyLibrary')}
            >
              <Text style={styles.libraryButtonText}>Go to My Souls Library</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // When complete, stay on this screen and show chapter list (don't navigate away)
  useEffect(() => {
    if (!isGenerating && jobId && (productType === 'nuclear_package')) {
      // For nuclear_v2 jobs, stay on this screen and show the chapter list
      // No explicit navigation needed here, as the component will re-render
      // with isGenerating = false, showing the ScrollView content.
      console.log('🎉 Nuclear package job complete! Displaying chapters on this screen.');
    } else if (!isGenerating && jobId && chapters.some(ch => ch.status === 'complete')) {
      // For other job types, if complete, navigate to MyLibrary
      navigation.navigate('MyLibrary');
    }
  }, [isGenerating, jobId, chapters, productType, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBackButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Reading Overview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={styles.readingTitle}>
            {productType === 'nuclear_package' ? 'Soul Journey Audiobook' : title}
          </Text>
          <Text style={styles.readingSubtitle}>
            {(person2Name || storedPartnerName)
              ? `${userData.name} & ${storedPartnerName}`
              : userData.name}
          </Text>
        </View>

        {/* Group chapters by type for nuclear_v2 */}
        {productType === 'nuclear_package' ? (
          <>
            {/* Person 1 Section */}
            <Text style={styles.sectionTitle}>{displayName1}'s Readings</Text>
            {chapters.slice(0, 5).map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                onDownloadPDF={() => handleDownloadPDF(chapter)}
              />
            ))}

            {/* Person 2 Section */}
            <Text style={styles.sectionTitle}>{displayName2}'s Readings</Text>
            {chapters.slice(5, 10).map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                onDownloadPDF={() => handleDownloadPDF(chapter)}
              />
            ))}

            {/* Overlay Section */}
            <Text style={styles.sectionTitle}>Compatibility Overlays</Text>
            {chapters.slice(10, 15).map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                onDownloadPDF={() => handleDownloadPDF(chapter)}
              />
            ))}

            {/* Final Verdict */}
            <Text style={styles.sectionTitle}>Final Verdict</Text>
            {chapters.slice(15, 16).map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                onDownloadPDF={() => handleDownloadPDF(chapter)}
              />
            ))}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Chapters</Text>
            {chapters.map((chapter) => (
              <ChapterCard
                key={chapter.id}
                chapter={chapter}
                onDownloadPDF={() => handleDownloadPDF(chapter)}
              />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  titleSection: {
    padding: 20,
    alignItems: 'center',
  },
  readingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  readingSubtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 4,
  },
  overallProgressCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  overallProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overallProgressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  overallProgressSubtitle: {
    fontSize: 12,
    color: BRAND_RED,
    marginTop: 4,
  },
  overallProgressPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: BRAND_RED,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    color: BRAND_RED,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_RED,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  playAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  chapterCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  chapterCardComplete: {
    borderColor: '#2D8C4B',
    borderWidth: 1,
  },
  chapterCardPending: {
    opacity: 0.6,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chapterNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  chapterSystem: {
    fontSize: 13,
    color: '#888',
  },
  chapterDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  progressSection: {
    marginBottom: 8,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#888',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#EEE',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 13,
    color: '#888',
  },
  statusTextComplete: {
    color: '#2D8C4B',
  },
  statusTextGenerating: {
    color: BRAND_RED,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  // ARTS Animation Styles
  artsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: colors.background,
  },
  artsLine1: {
    fontSize: 48,
    fontFamily: 'System',
    fontWeight: '300',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },
  artsLine2: {
    fontSize: 120,
    fontFamily: 'System',
    fontWeight: '700',
    color: BRAND_RED,
    textAlign: 'center',
    marginBottom: 20,
  },
  artsLine3: {
    fontSize: 52,
    fontFamily: 'System',
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  artsLine4: {
    fontSize: 52,
    fontFamily: 'System',
    fontWeight: '400',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  artsLine5: {
    fontSize: 52,
    fontFamily: 'System',
    fontStyle: 'italic',
    fontWeight: '300',
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 40,
  },
  artsStatus: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '500',
    color: BRAND_RED,
    textAlign: 'center',
    marginTop: 20,
  },
  exitButtons: {
    marginTop: 40,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  libraryButton: {
    backgroundColor: BRAND_RED,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  libraryButtonText: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#FFF',
  },
});
