/**
 * AUDIO PLAYER SCREEN
 * 
 * Dedicated screen for playing audio readings with full controls.
 * Features: progress bar, play/pause, skip ±15s, speed control, download.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { SimpleSlider } from '@/components/SimpleSlider';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { shareAudioFile, saveAudioToFile, generateAudioFileName, downloadAudioFromUrl, getAudioFileSize } from '@/services/audioDownload';
import { useProfileStore } from '@/store/profileStore';
import { audioApi } from '@/services/api';
import { AUDIO_CONFIG, estimateAudioTime, AUDIO_GENERATION_MESSAGE } from '@/config/readingConfig';

type Props = NativeStackScreenProps<MainStackParamList, 'AudioPlayer'>;

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export const AudioPlayerScreen = ({ navigation, route }: Props) => {
  const {
    audioUrl: initialAudioUrl,
    title: routeTitle = 'Audio Reading',
    personName = 'You',
    system = 'western',
    readingId,
    readingText,
    playlist,
    startIndex = 0,
    seriesIntroText,
  } = route.params || {};

  const [queue] = useState<Array<{ title: string; audioUrl: string; system?: string; headlineText?: string; systemBlurbText?: string }>>(() => {
    if (Array.isArray(playlist) && playlist.length > 0) return playlist;
    if (typeof initialAudioUrl === 'string' && initialAudioUrl.length > 0) {
      return [{ title: routeTitle, audioUrl: initialAudioUrl, system }];
    }
    return [];
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    const i = Number.isFinite(startIndex) ? Math.max(0, Math.floor(startIndex)) : 0;
    return Math.min(i, Math.max(0, queue.length - 1));
  });
  const currentItem = queue[currentIndex];

  const [audioUrl, setAudioUrl] = useState<string | undefined>(currentItem?.audioUrl);
  const [title, setTitle] = useState<string>(currentItem?.title || routeTitle);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(AUDIO_GENERATION_MESSAGE.title);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // Default 1x
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const autoPlayCancelRef = useRef(false);
  const addSavedAudio = useProfileStore((state) => state.addSavedAudio);
  const getUser = useProfileStore((state) => state.getUser);
  const savedPDFs = useProfileStore((state) => state.savedPDFs);

  // Check if this reading has a PDF
  const pdfForReading = readingId ? savedPDFs.find(p => p.readingId === readingId) : null;

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const SINGING_BOWL = require('../../../assets/sounds/tibetan-singing-bowl.mp3');
  const introAssetForSystem = (sys?: string) => {
    switch (sys) {
      case 'western':
        return require('../../../assets/audio/intros/intro_western.mp3');
      case 'vedic':
        return require('../../../assets/audio/intros/intro_vedic.mp3');
      case 'human_design':
        return require('../../../assets/audio/intros/intro_human_design.mp3');
      case 'gene_keys':
        return require('../../../assets/audio/intros/intro_gene_keys.mp3');
      case 'kabbalah':
        return require('../../../assets/audio/intros/intro_kabbalah.mp3');
      default:
        return null;
    }
  };

  // Generate or load audio on mount
  useEffect(() => {
    if (queue.length > 0) {
      // Queue mode: auto-play sequence (intro → spoken headline → chapter → chime → next)
      autoPlayCancelRef.current = false;
      setIsAutoPlaying(true);
      playQueueFrom(currentIndex).catch((e) => {
        console.error('Queue autoplay failed:', e);
        setIsAutoPlaying(false);
      });
      return;
    }

    if (!audioUrl && readingText) {
      // Generate audio from text
      generateAudio();
    } else if (audioUrl) {
      // Load existing audio
      loadAudioFromUrl(audioUrl);
    } else {
      Alert.alert('Error', 'No audio or text provided');
      navigation.goBack();
    }

    return () => {
      autoPlayCancelRef.current = true;
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
    };
  }, []);

  // CRITICAL: Stop audio when screen loses focus (useFocusEffect runs cleanup BEFORE blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log('🛑 AudioPlayerScreen LOSING FOCUS - stopping audio immediately');
        autoPlayCancelRef.current = true;
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => { });
          soundRef.current.unloadAsync().catch(() => { });
          soundRef.current = null;
        }
        setIsPlaying(false);
      };
    }, [])
  );

  // Cycling messages for generation (from centralized config)
  useEffect(() => {
    if (isGenerating) {
      const messages = AUDIO_GENERATION_MESSAGE.cyclingMessages;
      let index = 0;
      const interval = setInterval(() => {
        index = (index + 1) % messages.length;
        setGeneratingMessage(messages[index]);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const generateAudio = async () => {
    if (!readingText) return;

    setIsGenerating(true);
    setIsLoading(true);

    try {
      // Use the new Chatterbox TTS API (MP3 output) with centralized config
      const result = await audioApi.generateTTS(readingText, {
        exaggeration: AUDIO_CONFIG.exaggeration,
      });

      if (result.success && result.audioBase64) {
        // Create data URL for MP3 playback
        const dataUrl = `data:audio/mpeg;base64,${result.audioBase64}`;
        setAudioUrl(dataUrl);

        // Set audio mode for proper playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          // Never keep playing when the user leaves the screen (prevents "ghost audio" elsewhere)
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
        });

        // Load the audio
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUrl },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
      } else {
        Alert.alert('Audio Error', result.error || 'Could not generate audio. Please try again.');
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      Alert.alert('Audio Error', 'Network error generating audio.');
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const loadAudioFromUrl = async (url?: string) => {
    if (!url) return;

    try {
      setIsLoading(true);

      // Cleanup any existing sound before loading a new one
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => { });
        await soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }

      // Set audio mode for proper playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Could not load audio');
      setIsLoading(false);
    }
  };

  const loadAndPlay = async (
    source: any,
    opts?: {
      preDelayMs?: number;
      postDelayMs?: number;
    }
  ) => {
    // source can be { uri } or a require() number
    if (autoPlayCancelRef.current) return;
    try {
      if (opts?.preDelayMs && opts.preDelayMs > 0) {
        await sleep(opts.preDelayMs);
        if (autoPlayCancelRef.current) return;
      }

      setIsLoading(true);

      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => { });
        await soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true }, onPlaybackStatusUpdate);
      soundRef.current = sound;
      setIsLoading(false);

      // Wait until finish (polling the status)
      while (!autoPlayCancelRef.current) {
        const st = await sound.getStatusAsync();
        if (st.isLoaded && st.didJustFinish) break;
        await new Promise((r) => setTimeout(r, 250));
      }

      if (opts?.postDelayMs && opts.postDelayMs > 0) {
        await sleep(opts.postDelayMs);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const playQueueFrom = async (startAt: number) => {
    // One-time audiobook preface (only at the beginning of the full listening session)
    if (startAt === 0 && seriesIntroText) {
      setIsGenerating(true);
      setGeneratingMessage('Preparing audiobook introduction…');
      try {
        const r = await audioApi.generateTTS(seriesIntroText, { exaggeration: AUDIO_CONFIG.exaggeration });
        if (r.success && r.audioBase64) {
          const dataUrl = `data:audio/mpeg;base64,${r.audioBase64}`;
          await loadAndPlay({ uri: dataUrl }, { preDelayMs: 900, postDelayMs: 1400 });
        }
      } finally {
        setIsGenerating(false);
      }
    }

    for (let i = startAt; i < queue.length; i++) {
      if (autoPlayCancelRef.current) break;
      const item = queue[i];
      setCurrentIndex(i);
      setTitle(item.title);
      setAudioUrl(item.audioUrl);

      // 1) System intro (local asset)
      const intro = introAssetForSystem(item.system);
      if (intro) {
        await loadAndPlay(intro, { postDelayMs: 800 });
      }

      // 2) 2-sentence explainer (standard, per-system)
      if (item.systemBlurbText) {
        setIsGenerating(true);
        setGeneratingMessage('Preparing system explainer…');
        try {
          const r = await audioApi.generateTTS(item.systemBlurbText, { exaggeration: AUDIO_CONFIG.exaggeration });
          if (r.success && r.audioBase64) {
            const dataUrl = `data:audio/mpeg;base64,${r.audioBase64}`;
            await loadAndPlay({ uri: dataUrl }, { preDelayMs: 700, postDelayMs: 1200 });
          }
        } finally {
          setIsGenerating(false);
        }
      }

      // 3) Spoken headline (short TTS) if provided
      if (item.headlineText) {
        setIsGenerating(true);
        setGeneratingMessage('Preparing chapter introduction…');
        try {
          const r = await audioApi.generateTTS(item.headlineText, { exaggeration: AUDIO_CONFIG.exaggeration });
          if (r.success && r.audioBase64) {
            const dataUrl = `data:audio/mpeg;base64,${r.audioBase64}`;
            // Add space before + after headline so it lands cleanly.
            await loadAndPlay({ uri: dataUrl }, { preDelayMs: 700, postDelayMs: 900 });
          }
        } finally {
          setIsGenerating(false);
        }
      }

      // 4) Chapter audio (remote)
      await loadAndPlay({ uri: item.audioUrl }, { preDelayMs: 400, postDelayMs: 300 });

      // 5) Transition interlude (Tibetan singing bowl between chapters)
      if (i < queue.length - 1) {
        await loadAndPlay(SINGING_BOWL, { preDelayMs: 300, postDelayMs: 1200 });
      }
    }
    setIsAutoPlaying(false);
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  // Manual prev/next in queue mode cancels autoplay and loads the selected chapter audio directly
  useEffect(() => {
    if (queue.length === 0) return;
    const item = queue[currentIndex];
    if (!item) return;
    setTitle(item.title);
    setAudioUrl(item.audioUrl);
    setDuration(0);
    setPosition(0);
    if (!isAutoPlaying) {
      loadAudioFromUrl(item.audioUrl);
    }
  }, [currentIndex, isAutoPlaying]);

  const togglePlayPause = async () => {
    if (!soundRef.current) return;

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const skipForward = async () => {
    if (!soundRef.current) return;
    const newPosition = Math.min(position + 15000, duration);
    await soundRef.current.setPositionAsync(newPosition);
  };

  const skipBackward = async () => {
    if (!soundRef.current) return;
    const newPosition = Math.max(position - 15000, 0);
    await soundRef.current.setPositionAsync(newPosition);
  };

  const onSliderChange = async (value: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(value);
  };

  const cycleSpeed = async () => {
    if (!soundRef.current) return;
    const nextIndex = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIndex);
    await soundRef.current.setRateAsync(PLAYBACK_SPEEDS[nextIndex], true);
  };

  const handleDownload = async () => {
    if (!audioUrl) {
      Alert.alert('Error', 'No audio available to download');
      return;
    }

    setIsDownloading(true);
    try {
      // Check if it's a data URL (base64)
      const isDataUrl = audioUrl.startsWith('data:audio');

      const fileName = generateAudioFileName(personName, undefined, system, 'solo');
      let filePath: string | null = null;
      let fileSizeMB = 0;

      if (isDataUrl) {
        // Extract base64 from data URL

        const base64Data = audioUrl.replace(/^data:audio\/\w+;base64,/, '');
        if (!base64Data || base64Data.length < 100) {
          throw new Error('Invalid audio data');
        }
        filePath = await saveAudioToFile(base64Data, fileName);
        fileSizeMB = Number(((base64Data.length * 0.75) / (1024 * 1024)).toFixed(2));
      } else {
        // Remote URL (RunPod chapter or combined MP3)
        filePath = await downloadAudioFromUrl(audioUrl, fileName, (p) => {
          // Minimal: keep UI responsive; could add a progress bar later.
          if (p > 0.95) setGeneratingMessage('Finishing download…');
        });
        fileSizeMB = await getAudioFileSize(filePath);
      }

      // Save to profile store
      const user = getUser();
      if (user && filePath) {
        addSavedAudio({
          readingId: readingId || `audio_${Date.now()}`,
          personId: user.id,
          system: system as any,
          fileName: fileName + '.mp3',
          filePath,
          durationSeconds: Math.round(duration / 1000),
          fileSizeMB: Number((fileSizeMB || 0).toFixed(2)),
          createdAt: new Date().toISOString(),
          title: title || routeTitle,
        });
      }

      // Share/export
      if (filePath) await shareAudioFile(filePath, title);
      setIsDownloaded(true);
      Alert.alert('Success', 'Audio saved to your library!');
    } catch (error: any) {
      console.error('Download error:', error);
      Alert.alert('Error', `Could not download audio: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Format time MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Queue header */}
        {queue.length > 1 && (
          <View style={{ alignItems: 'center', marginTop: -spacing.lg, marginBottom: spacing.lg }}>
            <Text style={{ fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText }}>
              Chapter {currentIndex + 1} of {queue.length}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={isLoading || currentIndex === 0}
              >
                <Text style={styles.secondaryButtonText}>Prev</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setCurrentIndex((i) => Math.min(queue.length - 1, i + 1))}
                disabled={isLoading || currentIndex >= queue.length - 1}
              >
                <Text style={styles.secondaryButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <SimpleSlider
            style={styles.progressBar}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            // minimumTrackTintColor={colors.primary}
            // maximumTrackTintColor={colors.cardStroke}
            // thumbTintColor={colors.primary}
            onValueChange={onSliderChange}
          /><Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Generating State - with background info (centralized config) */}
      {isGenerating && (
        <View style={styles.generatingContainer}>
          <Text style={styles.generatingSymbol}>♬</Text>
          <Text style={styles.generatingMessage}>{generatingMessage}</Text>
          <Text style={styles.generatingHint}>{AUDIO_GENERATION_MESSAGE.hint}</Text>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
          {/* Exit button */}
          <TouchableOpacity
            style={styles.exitButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.exitButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Controls */}
      {!isGenerating && (
        <View style={styles.mainControls}>
          {/* Skip Back 15s */}
          <TouchableOpacity style={styles.skipButton} onPress={skipBackward} disabled={isLoading}>
            <Text style={styles.skipIcon}>⏮</Text>
            <Text style={styles.skipLabel}>15</Text>
          </TouchableOpacity>

          {/* Play/Pause */}
          {isLoading ? (
            <View style={styles.playButton}>
              <ActivityIndicator size="large" color={colors.text} />
            </View>
          ) : (
            <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
              <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
          )}

          {/* Skip Forward 15s */}
          <TouchableOpacity style={styles.skipButton} onPress={skipForward} disabled={isLoading}>
            <Text style={styles.skipLabel}>15</Text>
            <Text style={styles.skipIcon}>⏭</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Secondary Controls */}
      <View style={styles.secondaryControls}>
        {/* Speed */}
        <TouchableOpacity style={styles.secondaryButton} onPress={cycleSpeed}>
          <Text style={styles.secondaryButtonText}>{PLAYBACK_SPEEDS[speedIndex]}x</Text>
        </TouchableOpacity>

        {/* Download Audio */}
        <TouchableOpacity
          style={[styles.secondaryButton, isDownloaded && styles.downloadedButton]}
          onPress={handleDownload}
          disabled={isDownloading || isLoading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.secondaryButtonText}>
              {isDownloaded ? '✓ Saved' : '🎵 Save Audio'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PDF Section - only show for deep dive readings with PDF */}
      {pdfForReading && (
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={() => {
            Alert.alert(
              'PDF Available',
              'Download the full written reading as PDF',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Download PDF',
                  onPress: () => {
                    // TODO: Implement PDF download/share
                    Alert.alert('Coming Soon', 'PDF download will be available soon');
                  }
                },
              ]
            );
          }}
        >
          <View style={styles.pdfContent}>
            <Text style={styles.pdfIcon}>📄</Text>
            <View style={styles.pdfTextContainer}>
              <Text style={styles.pdfTitle}>Written Reading (PDF)</Text>
              <Text style={styles.pdfSubtitle}>Download the full text version</Text>
            </View>
            <Text style={styles.pdfArrow}>→</Text>
          </View>
        </TouchableOpacity>
      )}

    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontSize: 24,
    color: colors.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.page * 2,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl * 2,
  },
  progressContainer: {
    marginBottom: spacing.xl,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  timeText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl * 2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.button,
    gap: spacing.xs,
  },
  skipIcon: {
    fontSize: 16,
    color: colors.text,
  },
  skipLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 32,
    color: colors.text,
    marginLeft: 4, // Visual centering for play icon
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.button,
    minWidth: 80,
    alignItems: 'center',
  },
  downloadedButton: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  generatingSymbol: {
    fontSize: 64,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  generatingMessage: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 2,
  },
  exitButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  exitButtonText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.text,
  },
  generatingEstimate: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: '#1A1A1A',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  generatingHint: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: '#6A6A6A',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 40,
  },
  pdfButton: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.page,
  },
  pdfContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pdfIcon: {
    fontSize: 24,
  },
  pdfTextContainer: {
    flex: 1,
  },
  pdfTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  pdfSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  pdfArrow: {
    fontSize: 18,
    color: colors.primary,
    fontFamily: typography.sansBold,
  },
});
