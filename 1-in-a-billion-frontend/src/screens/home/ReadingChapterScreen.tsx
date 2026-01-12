import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { downloadTextContent, fetchJobArtifacts } from '@/services/nuclearReadingsService';
import { BackButton } from '@/components/BackButton';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = NativeStackScreenProps<MainStackParamList, 'ReadingChapter'>;

export const ReadingChapterScreen = ({ navigation, route }: Props) => {
  const { personName, jobId, systemId, systemName, docNum, timestamp, nextChapter } = route.params;

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

  // Auto-scroll the reading text slowly as narration progresses
  const textScrollRef = useRef<ScrollView | null>(null);
  const [textViewportH, setTextViewportH] = useState(0);
  const [textContentH, setTextContentH] = useState(0);

  // Prevent race conditions when user taps narration + song quickly
  const actionLock = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  const [playingSong, setPlayingSong] = useState(false);
  const [loadingSong, setLoadingSong] = useState(false);
  const [songPos, setSongPos] = useState(0);
  const [songDur, setSongDur] = useState(0);

  const controlsDisabled = loadingAudio || loadingSong;

  const narrationRef = useRef<Audio.Sound | null>(null);
  const songRef = useRef<Audio.Sound | null>(null);

  const narrationUrl = useMemo(() => `${env.CORE_API_URL}/api/jobs/v2/${jobId}/audio/${docNum}`, [jobId, docNum]);
  const songUrl = useMemo(() => `${env.CORE_API_URL}/api/jobs/v2/${jobId}/song/${docNum}`, [jobId, docNum]);

  // Load text immediately (visible on screen load). No auto-scroll.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingText(true);
        const artifacts = await fetchJobArtifacts(jobId, ['text']);
        const textArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          return meta?.system === systemId && Number(meta?.docNum) === Number(docNum);
        });
        if (!textArtifact?.storage_path) {
          if (mounted) setText('');
          return;
        }
        const content = await downloadTextContent(textArtifact.storage_path);
        if (mounted) setText(content || '');
      } catch {
        if (mounted) setText('');
      } finally {
        if (mounted) setLoadingText(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [jobId, systemId, docNum]);

  // Load song lyrics preview immediately (4-line preview under Music).
  // Lyrics are stored in audio_song artifact metadata when available.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingSongLyrics(true);
        const artifacts = await fetchJobArtifacts(jobId, ['audio_song']);
        const songArtifact = artifacts.find((a) => {
          const meta = (a.metadata as any) || {};
          return meta?.system === systemId && Number(meta?.docNum) === Number(docNum);
        });
        const lyrics = (songArtifact?.metadata as any)?.lyrics;
        if (mounted) setSongLyrics(typeof lyrics === 'string' ? lyrics : '');
      } catch {
        if (mounted) setSongLyrics('');
      } finally {
        if (mounted) setLoadingSongLyrics(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [jobId, systemId, docNum]);

  useEffect(() => {
    return () => {
      narrationRef.current?.unloadAsync().catch(() => {});
      songRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const toggleNarration = async () => {
    if (actionLock.current) return;
    if (loadingAudio) return;
    try {
      actionLock.current = true;
      setLoadingAudio(true);

      // Stop song if playing
      if (songRef.current) {
        await songRef.current.stopAsync().catch(() => {});
        await songRef.current.unloadAsync().catch(() => {});
        songRef.current = null;
        setPlayingSong(false);
        setSongPos(0);
        setSongDur(0);
      }

      // Pause/resume if already loaded
      if (narrationRef.current) {
        const st = await narrationRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await narrationRef.current.pauseAsync();
          setPlaying(false);
          return;
        }
        if (st.isLoaded) {
          await narrationRef.current.playAsync();
          setPlaying(true);
          return;
        }
      }

      // Fresh load (STREAM ONLY). downloadFirst=false is the last param.
      const { sound } = await Audio.Sound.createAsync(
        { uri: narrationUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (st) => {
          if (!st.isLoaded) return;
          setPlaying(st.isPlaying);
          setPos(st.positionMillis / 1000);
          setDur(st.durationMillis ? st.durationMillis / 1000 : 0);
          if (st.didJustFinish) {
            setPlaying(false);
          }
        },
        false
      );
      narrationRef.current = sound;
      setPlaying(true);
    } catch (e: any) {
      Alert.alert('Audio Error', e?.message || 'Could not play audio');
      setPlaying(false);
    } finally {
      setLoadingAudio(false);
      actionLock.current = false;
    }
  };

  const toggleSong = async () => {
    if (actionLock.current) return;
    if (loadingSong) return;
    try {
      actionLock.current = true;
      setLoadingSong(true);

      // Quick preflight to fail fast on bad links/timeouts (helps avoid iOS AVPlayer -1001 with no context)
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7000);
        const head = await fetch(songUrl, { method: 'HEAD', signal: ctrl.signal });
        clearTimeout(t);
        if (!head.ok) {
          throw new Error(`Song not available (${head.status})`);
        }
      } catch (pre: any) {
        const msg = pre?.name === 'AbortError' ? 'Song timed out (try again)' : (pre?.message || 'Song not available');
        throw new Error(msg);
      }

      // Stop narration if playing
      if (narrationRef.current) {
        await narrationRef.current.stopAsync().catch(() => {});
        await narrationRef.current.unloadAsync().catch(() => {});
        narrationRef.current = null;
        setPlaying(false);
        setPos(0);
        setDur(0);
      }

      // Pause/resume if already loaded
      if (songRef.current) {
        const st = await songRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await songRef.current.pauseAsync();
          setPlayingSong(false);
          return;
        }
        if (st.isLoaded) {
          await songRef.current.playAsync();
          setPlayingSong(true);
          return;
        }
      }

      // Fresh load (STREAM ONLY)
      const { sound } = await Audio.Sound.createAsync(
        { uri: songUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        (st) => {
          if (!st.isLoaded) return;
          setPlayingSong(st.isPlaying);
          setSongPos(st.positionMillis / 1000);
          setSongDur(st.durationMillis ? st.durationMillis / 1000 : 0);
          if (st.didJustFinish) {
            setPlayingSong(false);
          }
        },
        false
      );
      songRef.current = sound;
      setPlayingSong(true);
    } catch (e: any) {
      // Common iOS timeout comes through as NSURLErrorDomain -1001
      Alert.alert('Song Error', e?.message || 'Could not play song');
      setPlayingSong(false);
    } finally {
      setLoadingSong(false);
      actionLock.current = false;
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

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

  // Keep the text "moving by itself" as audio progresses.
  useEffect(() => {
    if (!textScrollRef.current) return;
    if (!textViewportH || !textContentH) return;

    // Reset to top when not playing
    if (!playing || !dur) {
      textScrollRef.current.scrollTo({ y: 0, animated: false });
      return;
    }

    const progress = Math.max(0, Math.min(1, pos / dur));
    const maxScrollY = Math.max(0, textContentH - textViewportH);
    const y = maxScrollY * progress;
    textScrollRef.current.scrollTo({ y, animated: false });
  }, [playing, pos, dur, textViewportH, textContentH]);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Top title row: yellow buttons stacked on the LEFT, title centered */}
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
            {!!niceTimestamp && <Text style={styles.timestampCentered}>{niceTimestamp}</Text>}
          </View>

          {/* Right spacer keeps the title centered */}
          <View style={styles.titleRightSpacer} />
        </View>

        <View style={styles.card}>
          <View style={styles.mediaBlock}>
            <TouchableOpacity
              style={[styles.playButton, playing && styles.playButtonActive, controlsDisabled && styles.controlDisabled]}
              onPress={toggleNarration}
              disabled={controlsDisabled}
            >
              {loadingAudio ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
              )}
            </TouchableOpacity>
            <View style={[styles.sliderFrame, styles.sliderFrameRed]}>
              <Slider
                style={styles.sliderInner}
                value={dur > 0 ? Math.min(pos, dur) : 0}
                minimumValue={0}
                maximumValue={dur || 1}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="transparent"
                thumbTintColor={colors.primary}
                onSlidingComplete={async (v) => narrationRef.current?.setPositionAsync(v * 1000).catch(() => {})}
              />
            </View>
            <Text style={styles.sliderDuration}>{dur ? fmt(dur) : '--:--'}</Text>
          </View>

          {/* Reading text with standard white background (5-line window) */}
          <View style={styles.textArea}>
            <View style={styles.textBox}>
              {loadingText ? (
                <ActivityIndicator />
              ) : (
                <ScrollView
                  ref={textScrollRef as any}
                  style={styles.textWindow}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                  onLayout={(e) => setTextViewportH(e.nativeEvent.layout.height)}
                  onContentSizeChange={(_, h) => setTextContentH(h)}
                >
                  <Text style={styles.textBody}>{text || ''}</Text>
                </ScrollView>
              )}
            </View>
          </View>

          {/* More vertical space between narration and music as requested */}
          <View style={styles.musicSpacer} />

          <View style={styles.mediaBlock}>
            <TouchableOpacity
              style={[styles.songButton, playingSong && styles.songButtonActive, controlsDisabled && styles.controlDisabled]}
              onPress={toggleSong}
              disabled={controlsDisabled}
            >
              {loadingSong ? (
                <ActivityIndicator color="#2E7D32" />
              ) : (
                <Text style={styles.songIcon}>♪</Text>
              )}
            </TouchableOpacity>
            <View style={[styles.sliderFrame, styles.sliderFrameGreen]}>
              <Slider
                style={styles.sliderInner}
                value={songDur > 0 ? Math.min(songPos, songDur) : 0}
                minimumValue={0}
                maximumValue={songDur || 1}
                minimumTrackTintColor="#2E7D32"
                maximumTrackTintColor="transparent"
                thumbTintColor="#2E7D32"
                onSlidingComplete={async (v) => songRef.current?.setPositionAsync(v * 1000).catch(() => {})}
              />
            </View>
            <Text style={styles.sliderDuration}>{songDur ? fmt(songDur) : '--:--'}</Text>
          </View>

          {/* Song lyrics with same white background (5-line window) */}
          <View style={styles.songTextArea}>
            <View style={styles.textBox}>
              {loadingSongLyrics ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.songTextBody} numberOfLines={5} ellipsizeMode="tail">
                  {songLyrics || ''}
                </Text>
              )}
            </View>
          </View>
        </View>

        {nextChapter ? (
          <View style={styles.bottomCtasRow}>
            <TouchableOpacity
              style={styles.backToLibraryButton}
              onPress={() => navigation.navigate('MyLibrary')}
              activeOpacity={0.75}
            >
              <Text style={styles.backToLibraryText}>Back to Soul Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nextChapterRowSmall}
              onPress={() => navigation.push('ReadingChapter', nextChapter)}
              activeOpacity={0.7}
            >
              <AnimatedSystemIcon icon={nextSystemIcon} size={24} />
              <View style={styles.nextChapterInfo}>
                <Text style={styles.nextChapterName}>{nextChapter.systemName}</Text>
              </View>
              <Text style={styles.nextChapterArrow}>→</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  // Offset is inside the scroll content (no "header" placeholder outside the ScrollView)
  scrollContent: { padding: 18, paddingTop: 90, paddingBottom: 30 },

  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  // Inset a bit so the buttons sit inside the safe margin
  titleButtonsCol: { width: 40, gap: 6, marginLeft: 24 },
  headerYellowButton: {
    // Coated white (standard) inside, not yellow
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
  titleRightSpacer: { width: 40 },

  // Headline typography (same font family used elsewhere)
  title: { fontFamily: typography.headline, fontSize: 34, color: colors.text, textAlign: 'center' },
  systemNameCentered: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text, textAlign: 'center' },
  timestampCentered: { fontFamily: typography.sansRegular, fontSize: 10, color: colors.mutedText, textAlign: 'center', marginTop: 2 },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mediaBlock: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  controlDisabled: { opacity: 0.6 },
  // Match the avatar circle style from the previous screen (e.g. "C" / "M" circles)
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: { backgroundColor: colors.primary + '30' },
  // Keep icon "pure" (triangle/bars), no fancy font styling
  playIcon: { fontFamily: 'System', fontSize: 18, fontWeight: '700', color: colors.primary },

  // Slider capsule with colored stroke (matches the circle stroke)
  sliderFrame: {
    flex: 1,
    height: 28,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sliderInner: { flex: 1 },
  sliderFrameRed: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  sliderFrameGreen: { borderWidth: 2, borderColor: '#2E7D32', backgroundColor: '#2E7D3215' },
  sliderDuration: { width: 48, textAlign: 'right', fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText },

  // Keep text closer to audio to save estate
  textArea: { marginTop: 10 },
  // Standard white background behind text, with a 5-line viewing window
  textBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textWindow: { height: 134 }, // 5 lines @ lineHeight 22 + 24px padding
  textBody: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.text },
  musicSpacer: { height: 18 },
  songButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F4E8',
    borderWidth: 2,
    borderColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songButtonActive: { backgroundColor: '#DDF2DD' },
  // Bigger note icon, same circle size
  songIcon: { fontFamily: 'System', fontSize: 22, fontWeight: '700', color: '#2E7D32' },
  songTextArea: { marginTop: 10 },
  songTextBody: { fontFamily: typography.sansRegular, fontSize: 14, lineHeight: 22, color: colors.text },

  // Next Chapter row: match SystemsOverviewScreen / system list row 1:1
  bottomCtasRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  backToLibraryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToLibraryText: { fontFamily: typography.sansSemiBold, fontSize: 13, color: colors.text },

  nextChapterRowSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextChapterInfo: { flex: 1, marginLeft: spacing.sm },
  nextChapterName: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  nextChapterArrow: { fontFamily: typography.sansBold, fontSize: 18, color: colors.primary, marginLeft: spacing.sm },
});

