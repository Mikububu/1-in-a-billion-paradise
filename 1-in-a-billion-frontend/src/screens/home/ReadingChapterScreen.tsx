import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { downloadTextContent, fetchJobArtifacts } from '@/services/nuclearReadingsService';
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

  const cleanupLyricsForDisplay = (raw: string) => {
    return (raw || '')
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        if (/^\[[^\]]+\]$/.test(t)) return false;
        if (/^(verse|chorus|bridge|intro|outro)\s*\d*\s*:?\s*$/i.test(t)) return false;
        return true;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Load text content
  useEffect(() => {
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
          const matches = meta?.system === systemId && Number(meta?.docNum) === Number(docNum);
          if (matches) console.log(`✅ Found matching artifact: ${a.storage_path}`);
          return matches;
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
          const matchingDoc = docs.find((d: any) => d.system === systemId && Number(d.docNum) === Number(docNum));
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
  }, [jobId, systemId, docNum]);

  // Load song lyrics from artifact metadata
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingSongLyrics(true);
        console.log(`🎵 Loading song lyrics for jobId=${jobId}, systemId=${systemId}, docNum=${docNum}`);
        const artifacts = await fetchJobArtifacts(jobId, ['audio_song']);
        console.log(`🎶 Found ${artifacts.length} song artifacts`);
        const songArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          const matches = meta?.system === systemId && Number(meta?.docNum) === Number(docNum);
          if (matches) console.log(`✅ Found matching song artifact`);
          return matches;
        });
        const lyrics = (songArtifact?.metadata as any)?.lyrics;
        if (mounted) {
          const cleaned = typeof lyrics === 'string' ? cleanupLyricsForDisplay(lyrics) : '';
          console.log(`✅ Song lyrics loaded: ${cleaned.length} chars`);
          setSongLyrics(cleaned);
        }
      } catch (error: any) {
        console.error(`❌ Failed to load song lyrics:`, error.message);
        // Fallback: Leave empty for now (song lyrics are less critical than main text)
        if (mounted) setSongLyrics('');
      } finally {
        if (mounted) setLoadingSongLyrics(false);
      }
    })();
    return () => { mounted = false; };
  }, [jobId, systemId, docNum]);

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

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      {!!niceTimestamp && (
        <Text style={[styles.headerTimestamp, { top: insets.top + layout.backButtonOffsetTop + 10 }]}>
          {niceTimestamp}
        </Text>
      )}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={styles.titleButtonsCol}>
            <TouchableOpacity style={styles.headerYellowButton} onPress={() => {}}>
              <Text style={styles.headerYellowText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerYellowButton} onPress={() => {}}>
              <Text style={styles.headerYellowText}>↓</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{personName}</Text>
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
          />

          <View style={styles.musicSpacer} />

          <AudioPlayerSection
            audioUrl={songUrl}
            text={songLyrics}
            loadingText={loadingSongLyrics}
            type="song"
          />
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
  scrollContent: { padding: 18, paddingTop: 90, paddingBottom: 30 },

  headerTimestamp: {
    position: 'absolute',
    right: spacing.page,
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
    zIndex: 60,
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titleButtonsCol: { width: 40, gap: 6, marginLeft: 24 },
  headerYellowButton: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    width: 36,
    borderWidth: 2,
    borderColor: '#111827',
  },
  headerYellowText: { fontFamily: typography.sansSemiBold, color: '#111827', fontSize: 12 },

  titleBlock: { flex: 1, alignItems: 'center' },
  title: { fontFamily: typography.headline, fontSize: 34, color: colors.text, textAlign: 'center' },
  systemNameCentered: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
  },
  titleRightSpacer: { width: 40 },

  card: { backgroundColor: 'transparent', borderRadius: 16, padding: 16, marginBottom: 16 },
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
