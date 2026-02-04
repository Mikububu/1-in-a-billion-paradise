import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, Animated, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { downloadTextContent, fetchJobArtifacts } from '@/services/nuclearReadingsService';
import { downloadAudioFromUrl, shareAudioFile, downloadPdfFromUrl, sharePdfFile } from '@/services/audioDownload';
import { BackButton } from '@/components/BackButton';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { AudioPlayerSection } from '@/components/AudioPlayerSection';
import { SystemEssence } from '@/components/SystemEssence';
import { colors, layout, radii, spacing, typography } from '@/theme/tokens';
import { useProfileStore } from '@/store/profileStore';

type Props = NativeStackScreenProps<MainStackParamList, 'ReadingChapter'>;

export const ReadingChapterScreen = ({ navigation, route }: Props) => {
  const { personName, personId, jobId, systemId, systemName, docNum, timestamp, nextChapter } = route.params;
  const { width: windowW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const person = useProfileStore((s) => (personId ? s.getPerson(personId) : undefined));
  

  const nextSystemIcon = useMemo(() => {
    const sid = String(nextChapter?.systemId || '');
    const map: Record<string, string> = {
      western: '☉',
      vedic: 'ॐ',
      human_design: '◬',
      gene_keys: '❋',
      kabbalah: '✧',
      verdict: '✶',
    };
    return map[sid] || '→';
  }, [nextChapter?.systemId]);

  const [text, setText] = useState<string>('');
  const [loadingText, setLoadingText] = useState<boolean>(true);
  const [songLyrics, setSongLyrics] = useState<string>('');
  const [loadingSongLyrics, setLoadingSongLyrics] = useState<boolean>(true);
  const [pdfReady, setPdfReady] = useState<boolean>(false);
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [songReady, setSongReady] = useState<boolean>(false);
  const [pdfChecked, setPdfChecked] = useState<boolean>(false);
  const [audioChecked, setAudioChecked] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const pdfReadyRef = useRef(false);
  const audioReadyRef = useRef(false);
  const songReadyRef = useRef(false);

  const narrationUrl = useMemo(() => {
    const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}/audio/${docNum}`;
    console.log(`🎙️ Narration URL: ${url}`);
    return url;
  }, [jobId, docNum]);
  const songUrl = useMemo(() => {
    const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}/song/${docNum}`;
    console.log(`🎵 Song URL: ${url}`);
    return url;
  }, [jobId, docNum]);
  const pdfUrl = useMemo(() => {
    const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}/pdf/${docNum}`;
    console.log(`📄 PDF URL: ${url}`);
    return url;
  }, [jobId, docNum]);

  const cleanupLyricsForDisplay = (raw: string) => {
    return (raw || '')
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        // Filter out structure tags like [Verse], [Chorus], etc.
        if (/^\[[^\]]+\]$/.test(t)) return false;
        // Filter out standalone section labels
        if (/^(verse|chorus|bridge|intro|outro|hook|build up|interlude|pre chorus)\s*\d*\s*:?\s*$/i.test(t)) return false;
        // Filter out stage directions in parentheses (music production instructions)
        if (/^\([^)]+\)$/.test(t)) return false;
        return true;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Load text content - useFocusEffect ensures it runs when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setLoadingText(true);
          console.log(`📖 Loading text for jobId=${jobId}, systemId=${systemId}, docNum=${docNum}`);
          
          // Try new artifact system first
          const artifacts = await fetchJobArtifacts(jobId, ['text']);
          console.log(`📚 Found ${artifacts.length} text artifacts in job_artifacts table`);
          
          const textArtifact = artifacts.find((a) => {
            const meta = (a.metadata as any) || {};
            if (Number(meta?.docNum) !== Number(docNum)) return false;
            // Verdict can have system: null, 'western', or docType: 'verdict'
            let sysMatch: boolean;
            if (systemId === 'verdict') {
              sysMatch = meta?.docType === 'verdict' || !meta?.system || (Number(docNum) === 16 && meta?.system === 'western');
            } else {
              sysMatch = meta?.system === systemId;
            }
            if (sysMatch) console.log(`✅ Found matching artifact: ${a.storage_path}`);
            return sysMatch;
          });
          
          if (textArtifact?.storage_path) {
            console.log(`📥 Downloading text from: ${textArtifact.storage_path}`);
            const content = await downloadTextContent(textArtifact.storage_path);
            console.log(`✅ Text loaded: ${content?.length || 0} chars`);
            if (mounted) setText(content || '');
          } else {
            // FALLBACK: Try loading from job.results.documents (old format)
            console.log(`🔄 No artifact found, trying job.results.documents fallback...`);
            const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${jobId}`);
            const payload = await res.json();
            const docs = payload?.job?.results?.documents || [];
            const matchingDoc = docs.find((d: any) => {
              if (Number(d.docNum) !== Number(docNum)) return false;
              if (systemId === 'verdict') return d.docType === 'verdict' || !d.system || d.system === 'western';
              return d.system === systemId;
            });
            if (matchingDoc?.text) {
              console.log(`✅ Found text in job.results.documents: ${matchingDoc.text.length} chars`);
              if (mounted) setText(matchingDoc.text);
            } else {
              console.warn(`⚠️ No text found in either artifacts or job.results`);
              if (mounted) setText('');
            }
          }
        } catch (error: any) {
          console.error(`❌ Failed to load text:`, error.message);
          if (mounted) setText('');
        } finally {
          if (mounted) setLoadingText(false);
        }
      })();
      return () => { mounted = false; };
    }, [jobId, systemId, docNum])
  );

  // Load song lyrics from artifact metadata (with polling since song is created after text)
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 10; // Poll for up to ~50 seconds (10 * 5s)
    let retryTimeout: any;
    
    const loadLyrics = async () => {
      if (!mounted) return;
      try {
        if (retryCount === 0) setLoadingSongLyrics(true);
        console.log(`🎵 Loading song lyrics for jobId=${jobId}, systemId=${systemId}, docNum=${docNum} (attempt ${retryCount + 1})`);
        
        // First try Supabase artifacts
        const artifacts = await fetchJobArtifacts(jobId, ['audio_song']);
        console.log(`🎶 Found ${artifacts.length} song artifacts`);
        const songArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          if (Number(meta?.docNum) !== Number(docNum)) return false;
          const sysMatch = systemId === 'verdict' 
            ? (meta?.docType === 'verdict' || !meta?.system || (Number(docNum) === 16 && meta?.system === 'western')) 
            : meta?.system === systemId;
          if (sysMatch) console.log(`✅ Found matching song artifact`);
          return sysMatch;
        });
        
        let lyrics = (songArtifact?.metadata as any)?.lyrics;
        
        // Fallback: fetch from backend API if no artifact yet
        if (!lyrics && retryCount < maxRetries) {
          try {
            const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/${jobId}`);
            const payload = await res.json();
            const songArtifactFromApi = payload?.job?.artifacts?.find((a: any) => {
              if (a.artifact_type !== 'audio_song') return false;
              const meta = a.metadata || {};
              if (Number(meta?.docNum) !== Number(docNum)) return false;
              return systemId === 'verdict' 
                ? (meta?.docType === 'verdict' || !meta?.system)
                : meta?.system === systemId;
            });
            lyrics = songArtifactFromApi?.metadata?.lyrics;
            if (lyrics) console.log(`✅ Found lyrics from backend API`);
          } catch (e) {
            console.log(`⚠️ Backend API fallback failed`);
          }
        }
        
        if (lyrics && mounted) {
          const cleaned = typeof lyrics === 'string' ? cleanupLyricsForDisplay(lyrics) : '';
          console.log(`✅ Song lyrics loaded: ${cleaned.length} chars`);
          setSongLyrics(cleaned);
          setLoadingSongLyrics(false);
        } else if (retryCount < maxRetries && mounted) {
          // Song artifact not ready yet, retry after delay
          retryCount++;
          console.log(`⏳ Song lyrics not ready, retrying in 5s...`);
          retryTimeout = setTimeout(loadLyrics, 5000);
        } else if (mounted) {
          console.log(`⚠️ Song lyrics not found after ${maxRetries} attempts`);
          setSongLyrics('');
          setLoadingSongLyrics(false);
        }
      } catch (error: any) {
        console.error(`❌ Failed to load song lyrics:`, error.message);
        if (mounted) {
          setSongLyrics('');
          setLoadingSongLyrics(false);
        }
      }
    };
    
    loadLyrics();
    return () => { 
      mounted = false; 
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [jobId, systemId, docNum]);

  // Check if PDF is ready (by checking artifacts table)
  useEffect(() => {
    let mounted = true;
    let interval: any;
    
    const checkPdf = async () => {
      if (!mounted || pdfReadyRef.current) return;
      try {
        console.log(`🔍 Checking PDF artifacts for doc ${docNum}...`);
        const artifacts = await fetchJobArtifacts(jobId, ['pdf']);
        const pdfArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          if (Number(meta?.docNum) !== Number(docNum)) return false;
          // Verdict can have system: null, 'western', or docType: 'verdict'
          if (systemId === 'verdict') {
            return meta?.docType === 'verdict' || !meta?.system || (Number(docNum) === 16 && meta?.system === 'western');
          }
          return meta?.system === systemId;
        });
        
        if (mounted) {
          const ready = !!pdfArtifact?.storage_path;
          if (ready) {
            console.log(`✅ PDF ready!`);
            pdfReadyRef.current = true;
            setPdfReady(true);
            if (interval) clearInterval(interval);
          } else {
            console.log(`❌ PDF not ready yet`);
            setPdfReady(false);
          }
          setPdfChecked(true);
        }
      } catch (error: any) {
        console.error(`❌ PDF check failed:`, error.message);
        if (mounted) {
          setPdfReady(false);
          setPdfChecked(true);
        }
      }
    };
    
    // Reset ref when job/doc changes
    pdfReadyRef.current = false;
    setPdfReady(false);
    setPdfChecked(false);
    
    // Check immediately
    checkPdf();
    
    // Poll every 5 seconds until PDF is ready
    interval = setInterval(checkPdf, 5000);
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, systemId, docNum]);

  // Check if audio is ready (by checking artifacts table)
  useEffect(() => {
    let mounted = true;
    let interval: any;
    
    const checkAudio = async () => {
      if (!mounted || audioReadyRef.current) return;
      try {
        console.log(`🔍 Checking audio artifacts for doc ${docNum}...`);
        const artifacts = await fetchJobArtifacts(jobId, ['audio_mp3', 'audio_m4a']);
        const audioArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          if (Number(meta?.docNum) !== Number(docNum)) return false;
          // Verdict can have system: null, 'western', or docType: 'verdict'
          if (systemId === 'verdict') {
            return meta?.docType === 'verdict' || !meta?.system || (Number(docNum) === 16 && meta?.system === 'western');
          }
          return meta?.system === systemId;
        });
        
        if (mounted) {
          const ready = !!audioArtifact?.storage_path;
          if (ready) {
            console.log(`✅ Audio ready!`);
            audioReadyRef.current = true;
            setAudioReady(true);
            if (interval) clearInterval(interval);
          } else {
            console.log(`❌ Audio not ready yet`);
            setAudioReady(false);
          }
          setAudioChecked(true);
        }
      } catch (error: any) {
        console.error(`❌ Audio check failed:`, error.message);
        if (mounted) {
          setAudioReady(false);
          setAudioChecked(true);
        }
      }
    };
    
    // Reset ref when job/doc changes
    audioReadyRef.current = false;
    setAudioReady(false);
    setAudioChecked(false);
    
    // Check immediately
    checkAudio();
    
    // Poll every 5 seconds until audio is ready
    interval = setInterval(checkAudio, 5000);
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, systemId, docNum]);

  // Check if song is ready (with polling until ready)
  useEffect(() => {
    let mounted = true;
    let interval: any;
    
    const checkSong = async () => {
      if (!mounted || songReadyRef.current) return;
      try {
        const artifacts = await fetchJobArtifacts(jobId, ['audio_song']);
        const songArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          if (Number(meta?.docNum) !== Number(docNum)) return false;
          // Verdict can have system: null, 'western', or docType: 'verdict'
          if (systemId === 'verdict') {
            return meta?.docType === 'verdict' || !meta?.system || (Number(docNum) === 16 && meta?.system === 'western');
          }
          return meta?.system === systemId;
        });
        if (mounted) {
          const ready = !!songArtifact?.storage_path;
          if (ready) {
            console.log(`🎵 Song ready!`);
            songReadyRef.current = true;
            setSongReady(true);
            if (interval) clearInterval(interval);
          } else {
            setSongReady(false);
          }
        }
      } catch (error: any) {
        console.error(`❌ Failed to check song:`, error.message);
        if (mounted) setSongReady(false);
      }
    };
    
    // Reset ref when job/doc changes
    songReadyRef.current = false;
    setSongReady(false);
    
    // Check immediately
    checkSong();
    
    // Poll every 5 seconds until song is ready
    interval = setInterval(checkSong, 5000);
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [jobId, systemId, docNum]);

  // Compute: main media ready (text + audio, PDF is optional)
  const mainMediaReady = useMemo(() => {
    // Text and audio must be ready. PDF is optional (may fail or not be generated yet).
    return !loadingText && !!text && text.length > 0 && audioReady;
  }, [loadingText, text, audioReady]);

  // Compute: ALL 3 media files ready for download (audio + song + PDF)
  const allThreeMediaReady = useMemo(() => {
    // Download button only shows when ALL 3 files are ready:
    // 1. Narration audio
    // 2. Song audio
    // 3. PDF
    return audioReady && songReady && pdfReady;
  }, [audioReady, songReady, pdfReady]);

  const niceTimestamp = useMemo(() => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [timestamp]);

  const ctaGap = 10;
  const ctaWidth = useMemo(() => {
    const sidePad = 18 * 2;
    const w = Math.floor((windowW - sidePad - ctaGap) / 2);
    return Math.max(130, w);
  }, [windowW]);

  // Download ALL 3 media files (narration + song + PDF) - button only shows when all 3 ready
  const handleDownloadAllFiles = async () => {
    if (downloading || !allThreeMediaReady) return;
    
    setDownloading(true);
    try {
      const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const baseName = `${sanitize(personName)}_${sanitize(systemName)}_doc${docNum}`;
      
      // Download narration audio (REQUIRED)
      const narrationFileName = `${baseName}_narration`;
      console.log(`📥 Downloading narration: ${narrationUrl}`);
      const narrationPath = await downloadAudioFromUrl(narrationUrl, narrationFileName);
      console.log(`✅ Narration downloaded: ${narrationPath}`);
      
      // Download song audio (REQUIRED)
      const songFileName = `${baseName}_song`;
      console.log(`📥 Downloading song: ${songUrl}`);
      const songPath = await downloadAudioFromUrl(songUrl, songFileName);
      console.log(`✅ Song downloaded: ${songPath}`);
      
      // Download PDF (REQUIRED)
      const pdfFileName = `${baseName}_reading`;
      console.log(`📥 Downloading PDF: ${pdfUrl}`);
      const pdfPath = await downloadPdfFromUrl(pdfUrl, pdfFileName);
      console.log(`✅ PDF downloaded: ${pdfPath}`);
      
      // Share all 3 files sequentially with delays
      await shareAudioFile(narrationPath, `${personName} - ${systemName} - Narration`);
      setTimeout(async () => {
        await shareAudioFile(songPath, `${personName} - ${systemName} - Song`);
      }, 500);
      setTimeout(async () => {
        await sharePdfFile(pdfPath, `${personName} - ${systemName} - Reading`);
      }, 1000);
      
      Alert.alert(
        'Download Complete',
        `Downloaded 3 files:\n• Narration Audio\n• Song Audio\n• Reading PDF\n\nYou can find them in your Files app.`
      );
    } catch (error: any) {
      console.error('❌ Download error:', error);
      Alert.alert('Download Failed', error.message || 'Could not download all files. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      {!!niceTimestamp && (
        <Text style={[styles.headerTimestamp, { top: insets.top + layout.backButtonOffsetTop + 10 }]}>
          {niceTimestamp}
        </Text>
      )}
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          {/* Title row */}
          <View style={styles.titleRow}>
          {/* PDF/Download buttons - show ONLY when ALL 3 media files ready */}
          {allThreeMediaReady ? (
            <View style={styles.titleButtonsCol}>
              <TouchableOpacity 
                style={styles.headerYellowButton} 
                onPress={() => {
                  Linking.openURL(pdfUrl).catch(() => {
                    Alert.alert('Error', 'Could not open PDF');
                  });
                }}
              >
                <Text style={styles.headerYellowText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.headerYellowButton, downloading && styles.headerYellowButtonDisabled]} 
                onPress={handleDownloadAllFiles}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#111827" />
                ) : (
                  <Text style={styles.headerYellowText}>↓</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.titleButtonsCol} />
          )}

          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>{personName}</Text>
            <Text style={styles.systemNameCentered}>{systemName}</Text>
            {/* Display system essences (works for all systems) */}
            <SystemEssence
              systemId={systemId}
              essences={person?.essences}
              placements={person?.placements}
            />
          </View>
          <View style={styles.titleRightSpacer} />
        </View>

        {/* Audio players - modular components */}
        <View style={styles.card}>
          <AudioPlayerSection
            audioUrl={narrationUrl}
            text={text}
            loadingText={loadingText}
            type="narration"
            // Rule: narration must NOT play until main reading media is ready (PDF + narration + text).
            controlsDisabled={!mainMediaReady}
            textNotReady={!!text && !loadingText && !mainMediaReady}
            isPending={!audioReady}
          />

          <View style={styles.musicSpacer} />
          <AudioPlayerSection
            audioUrl={songUrl}
            text={songLyrics}
            loadingText={loadingSongLyrics}
            type="song"
            // Song can become playable as soon as the song audio is ready.
            isPending={!songReady}
            controlsDisabled={!songReady}
            textNotReady={!!songLyrics && !loadingSongLyrics && !songReady}
          />
        </View>
        </View>

        {/* Bottom navigation buttons */}
        {nextChapter ? (
          <View style={styles.bottomCtasRow}>
            <TouchableOpacity
              style={[styles.ctaButtonBase, { width: ctaWidth }, styles.backToLibraryButton]}
              onPress={() => navigation.navigate('MyLibrary')}
              activeOpacity={0.75}
            >
              <Text style={styles.backToLibraryText} numberOfLines={1} ellipsizeMode="tail">
                Back to Soul Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctaButtonBase, { width: ctaWidth }, styles.nextChapterRowSmall]}
              onPress={() => navigation.push('ReadingChapter', nextChapter)}
              activeOpacity={0.7}
            >
              <AnimatedSystemIcon icon={nextSystemIcon} size={24} />
              <View style={styles.nextChapterInfo}>
                <Text style={styles.nextChapterName} numberOfLines={1} ellipsizeMode="tail">
                  {nextChapter.systemName}
                </Text>
              </View>
              <Text style={styles.nextChapterArrow}>→</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bottomCtasRow}>
            <TouchableOpacity
              style={[styles.ctaButtonBase, { width: '100%' }, styles.backToLibraryButton]}
              onPress={() => navigation.navigate('MyLibrary')}
              activeOpacity={0.75}
            >
              <Text style={styles.backToLibraryText} numberOfLines={1} ellipsizeMode="tail">
                Back to Soul Library
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  scrollContent: { 
    padding: 18, 
    paddingTop: 70, 
    paddingBottom: 30,
    flexGrow: 1,
  },
  contentWrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 400, // Minimum height to ensure content doesn't get too cramped
  },

  headerTimestamp: {
    position: 'absolute',
    right: spacing.page,
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
    zIndex: 60,
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titleButtonsCol: { width: 50, gap: 8, marginLeft: 20 },
  headerYellowButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: 45,
    borderWidth: 2,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  headerYellowText: { fontFamily: typography.sansSemiBold, color: '#111827', fontSize: 14 },
  headerYellowButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#d0d0d0',
    opacity: 0.5,
  },
  headerYellowTextDisabled: { color: '#999999' },

  titleBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { fontFamily: typography.headline, fontSize: 34, color: colors.text, textAlign: 'center' },
  systemNameCentered: {
    fontFamily: typography.sansSemiBold,
    fontSize: 24,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  titleRightSpacer: { width: 40 },

  card: { backgroundColor: 'transparent', borderRadius: 16, padding: 16, marginBottom: 16, position: 'relative' },
  musicSpacer: { height: 18 },

  bottomCtasRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, width: '100%' },
  ctaButtonBase: {
    height: 54,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToLibraryButton: { paddingHorizontal: 16 },
  backToLibraryText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },

  nextChapterRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  nextChapterInfo: { flex: 1 },
  nextChapterName: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  nextChapterArrow: { fontSize: 18, color: colors.textSecondary },
});
