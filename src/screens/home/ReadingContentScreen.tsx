import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { BackButton } from '@/components/BackButton';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { createArtifactSignedUrl, downloadTextContent, fetchJobArtifacts, type JobArtifact } from '@/services/jobArtifacts';
import { splitIntoBlocks } from '@/utils/readingTextFormat';

type Props = NativeStackScreenProps<MainStackParamList, 'ReadingContent'>;

const isAudioArtifact = (a: JobArtifact) =>
    a.artifact_type === 'audio' || a.artifact_type === 'audio_mp3' || a.artifact_type === 'audio_m4a';

const getFirstTextArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => a.artifact_type === 'text' && a.storage_path);
const getFirstPdfArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => a.artifact_type === 'pdf' && a.storage_path);
const getFirstAudioArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => isAudioArtifact(a) && a.storage_path);

type Chapter = {
    index: number;
    blockIndex: number;
    title: string;
};

const formatClock = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ReadingContentScreen = ({ navigation, route }: Props) => {
    const { jobId } = route.params;

    const [job, setJob] = useState<any>(null);
    const [artifacts, setArtifacts] = useState<JobArtifact[]>([]);
    const [textBody, setTextBody] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isTextLoading, setIsTextLoading] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioDurationSec, setAudioDurationSec] = useState(0);
    const [audioPositionSec, setAudioPositionSec] = useState(0);
    const [audioSignedUrl, setAudioSignedUrl] = useState<string | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [activeChapterIndex, setActiveChapterIndex] = useState(0);

    const soundRef = useRef<Audio.Sound | null>(null);
    const loadedAudioPathRef = useRef<string | null>(null);
    const progressTrackWidthRef = useRef(1);
    const readingScrollRef = useRef<ScrollView | null>(null);
    const chapterOffsetsRef = useRef<Record<number, number>>({});
    const audioArtifact = useMemo(() => getFirstAudioArtifact(artifacts), [artifacts]);

    const title = useMemo(() => {
        const p1 = job?.input?.person1?.name || job?.input?.person?.name;
        const p2 = job?.input?.person2?.name;
        if (p1 && p2) return `${p1} & ${p2}`;
        return p1 || 'Reading';
    }, [job]);

    const statusLine = useMemo(() => {
        const status = String(job?.status || 'unknown').toUpperCase();
        const total = job?.progress?.totalTasks;
        const done = job?.progress?.completedTasks;
        const pctRaw = typeof job?.progress?.percent === 'number'
            ? job.progress.percent
            : typeof total === 'number' && total > 0
                ? (Number(done || 0) / total) * 100
                : 0;
        const pct = Math.max(0, Math.min(100, Math.round(pctRaw || 0)));
        const message = job?.progress?.message;

        return [status, `${pct}%`, message].filter(Boolean).join(' · ');
    }, [job]);

    const blocks = useMemo(() => splitIntoBlocks(textBody || ''), [textBody]);

    const chapters = useMemo<Chapter[]>(() => {
        const list = blocks
            .map((block, blockIndex) => (block.kind === 'heading' ? { block, blockIndex } : null))
            .filter(Boolean)
            .map((entry: any, idx: number) => ({
                index: idx,
                blockIndex: entry.blockIndex,
                title: entry.block.text,
            }));

        if (list.length > 0) return list;
        if (blocks.length > 0) {
            return [{ index: 0, blockIndex: 0, title: 'FULL READING' }];
        }
        return [];
    }, [blocks]);

    const load = useCallback(async () => {
        try {
            setErrorText(null);

            const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}`;
            let accessToken: string | undefined;

            if (isSupabaseConfigured) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    accessToken = session?.access_token;
                } catch {
                    // ignore
                }
            }

            let response = await fetch(url, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });

            if (response.status === 401 || response.status === 403) {
                response = await fetch(url);
            }

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `Failed to fetch job (${response.status})`);
            }

            const data = await response.json();
            setJob(data?.job || null);

            const rows = await fetchJobArtifacts(jobId);
            setArtifacts(rows);
        } catch (error: any) {
            setErrorText(error?.message || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!cancelled) {
                await load();
            }
        };

        run();
        const timer = setInterval(run, 15000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [load]);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => { });
                soundRef.current = null;
            }
            loadedAudioPathRef.current = null;
        };
    }, []);

    useEffect(() => {
        chapterOffsetsRef.current = {};
        setActiveChapterIndex(0);
    }, [textBody]);

    const handleLoadText = useCallback(async () => {
        const textArtifact = getFirstTextArtifact(artifacts);
        if (!textArtifact) {
            Alert.alert('Text not ready', 'No text artifact is available yet.');
            return;
        }

        setIsTextLoading(true);
        try {
            const body = await downloadTextContent(textArtifact.storage_path);
            if (!body) {
                Alert.alert('Text not ready', 'Could not load text content yet.');
                return;
            }
            setTextBody(body);
        } finally {
            setIsTextLoading(false);
        }
    }, [artifacts]);

    const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setAudioPositionSec((status.positionMillis || 0) / 1000);
        if (typeof status.durationMillis === 'number') {
            setAudioDurationSec(status.durationMillis / 1000);
        }
        setIsAudioPlaying(Boolean(status.isPlaying));
        if (status.didJustFinish) {
            setIsAudioPlaying(false);
            setAudioPositionSec(0);
        }
    }, []);

    const prepareAudio = useCallback(async (artifact: JobArtifact, shouldPlay: boolean): Promise<boolean> => {
        if (!artifact?.storage_path) return false;

        if (soundRef.current && loadedAudioPathRef.current === artifact.storage_path) {
            if (shouldPlay) {
                await soundRef.current.playAsync();
                setIsAudioPlaying(true);
            }
            return true;
        }

        setIsAudioLoading(true);
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });

            const signedUrl = await createArtifactSignedUrl(artifact.storage_path, 60 * 60);
            if (!signedUrl) {
                Alert.alert('Audio not ready', 'Could not create audio URL yet.');
                return false;
            }

            setAudioSignedUrl(signedUrl);

            if (soundRef.current) {
                await soundRef.current.unloadAsync().catch(() => { });
                soundRef.current = null;
            }

            const { sound, status } = await Audio.Sound.createAsync(
                { uri: signedUrl },
                { shouldPlay, progressUpdateIntervalMillis: 250 },
                onPlaybackStatusUpdate
            );

            soundRef.current = sound;
            loadedAudioPathRef.current = artifact.storage_path;

            if (status.isLoaded) {
                setAudioPositionSec((status.positionMillis || 0) / 1000);
                setAudioDurationSec((status.durationMillis || 0) / 1000);
                setIsAudioPlaying(Boolean(status.isPlaying));
            }

            return true;
        } catch (error: any) {
            Alert.alert('Audio error', error?.message || 'Could not load audio.');
            return false;
        } finally {
            setIsAudioLoading(false);
        }
    }, [onPlaybackStatusUpdate]);

    useEffect(() => {
        if (!audioArtifact?.storage_path) return;
        if (loadedAudioPathRef.current === audioArtifact.storage_path && soundRef.current) return;
        prepareAudio(audioArtifact, false).catch(() => { });
    }, [audioArtifact, prepareAudio]);

    const handleToggleAudio = useCallback(async () => {
        if (!audioArtifact) {
            Alert.alert('Audio not ready', 'No audio artifact is available yet.');
            return;
        }

        if (!soundRef.current || loadedAudioPathRef.current !== audioArtifact.storage_path) {
            await prepareAudio(audioArtifact, true);
            return;
        }

        try {
            const status = await soundRef.current.getStatusAsync();
            if (!status.isLoaded) return;
            if (status.isPlaying) {
                await soundRef.current.pauseAsync();
                setIsAudioPlaying(false);
            } else {
                await soundRef.current.playAsync();
                setIsAudioPlaying(true);
            }
        } catch (error: any) {
            Alert.alert('Audio error', error?.message || 'Could not play audio.');
        }
    }, [audioArtifact, prepareAudio]);

    const handleSeekPress = useCallback(async (locationX: number) => {
        if (!soundRef.current || audioDurationSec <= 0) return;
        const trackWidth = Math.max(1, progressTrackWidthRef.current);
        const ratio = Math.min(1, Math.max(0, locationX / trackWidth));
        const positionMillis = Math.round(ratio * audioDurationSec * 1000);
        try {
            await soundRef.current.setPositionAsync(positionMillis);
            setAudioPositionSec(positionMillis / 1000);
        } catch { }
    }, [audioDurationSec]);

    const handleOpenPdf = useCallback(async () => {
        const pdfArtifact = getFirstPdfArtifact(artifacts);
        if (!pdfArtifact) {
            Alert.alert('PDF not ready', 'No PDF artifact is available yet.');
            return;
        }

        const signedUrl = await createArtifactSignedUrl(pdfArtifact.storage_path, 60 * 60);
        if (!signedUrl) {
            Alert.alert('PDF not ready', 'Could not create PDF URL yet.');
            return;
        }

        Linking.openURL(signedUrl).catch(() => {
            Alert.alert('Open failed', 'Could not open the PDF URL.');
        });
    }, [artifacts]);

    const jumpToChapter = useCallback((chapterIndex: number) => {
        const chapter = chapters[chapterIndex];
        if (!chapter) return;

        const y = chapterOffsetsRef.current[chapter.blockIndex] ?? 0;
        readingScrollRef.current?.scrollTo({
            y: Math.max(0, y - 16),
            animated: true,
        });
        setActiveChapterIndex(chapterIndex);
    }, [chapters]);

    const handleReadingScroll = useCallback((event: any) => {
        if (chapters.length === 0) return;

        const y = Number(event?.nativeEvent?.contentOffset?.y || 0) + 24;
        let nextActive = activeChapterIndex;

        for (const chapter of chapters) {
            const offset = chapterOffsetsRef.current[chapter.blockIndex];
            if (typeof offset === 'number' && y >= offset) {
                nextActive = chapter.index;
            }
        }

        if (nextActive !== activeChapterIndex) {
            setActiveChapterIndex(nextActive);
        }
    }, [activeChapterIndex, chapters]);

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView
                ref={readingScrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.content}
                onScroll={handleReadingScroll}
                scrollEventThrottle={16}
            >
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{statusLine}</Text>
                <Text style={styles.jobLine}>Job: {jobId}</Text>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleLoadText}>
                        <Text style={styles.actionText}>{isTextLoading ? 'Loading text...' : 'Read Text'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleOpenPdf}>
                        <Text style={styles.actionText}>Open PDF</Text>
                    </TouchableOpacity>
                </View>

                {audioArtifact ? (
                    <View style={styles.playerCard}>
                        <View style={styles.playerRow}>
                            <TouchableOpacity style={styles.playerButton} onPress={handleToggleAudio}>
                                <Text style={styles.playerButtonText}>
                                    {isAudioLoading ? '...' : (isAudioPlaying ? 'Pause' : 'Play')}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.playerProgressWrap}>
                                <Pressable
                                    style={styles.playerTrack}
                                    onLayout={(event) => {
                                        progressTrackWidthRef.current = event.nativeEvent.layout.width || 1;
                                    }}
                                    onPress={(event) => handleSeekPress(event.nativeEvent.locationX)}
                                >
                                    <View
                                        style={[
                                            styles.playerFill,
                                            {
                                                width: `${audioDurationSec > 0
                                                    ? Math.min(100, Math.max(0, (audioPositionSec / audioDurationSec) * 100))
                                                    : 0}%`,
                                            },
                                        ]}
                                    />
                                </Pressable>
                                <Text style={styles.playerTime}>
                                    {formatClock(audioPositionSec)} / {formatClock(audioDurationSec)}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.playerMeta}>
                            {isAudioLoading
                                ? 'Preparing audio...'
                                : audioSignedUrl
                                    ? 'Audio ready (tap bar to seek)'
                                    : 'Audio will appear when artifact is ready'}
                        </Text>
                    </View>
                ) : null}

                {chapters.length > 0 ? (
                    <View style={styles.chapterSection}>
                        <Text style={styles.chapterLabel}>Chapters</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapterRow}>
                            {chapters.map((chapter) => {
                                const selected = chapter.index === activeChapterIndex;
                                return (
                                    <TouchableOpacity
                                        key={`${chapter.index}-${chapter.blockIndex}`}
                                        style={[styles.chapterPill, selected && styles.chapterPillActive]}
                                        onPress={() => jumpToChapter(chapter.index)}
                                    >
                                        <Text style={[styles.chapterPillText, selected && styles.chapterPillTextActive]} numberOfLines={1}>
                                            {chapter.title}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : null}

                {isLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingText}>Loading reading assets...</Text>
                    </View>
                ) : null}

                {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Artifacts</Text>
                    {artifacts.length === 0 ? (
                        <Text style={styles.cardText}>No artifacts yet. They will appear as generation continues.</Text>
                    ) : (
                        artifacts.slice(0, 20).map((a) => (
                            <View key={a.id} style={styles.artifactRow}>
                                <Text style={styles.artifactType}>{String(a.artifact_type).toUpperCase()}</Text>
                                <Text style={styles.artifactPath} numberOfLines={1}>{a.storage_path}</Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Reading Text</Text>
                    {blocks.length === 0 ? (
                        <Text style={styles.readingText} selectable>
                            {textBody || 'Text is not loaded yet. Tap "Read Text" when the text artifact is ready.'}
                        </Text>
                    ) : (
                        blocks.map((block, blockIndex) =>
                            block.kind === 'heading' ? (
                                <Text
                                    key={`h-${blockIndex}`}
                                    style={styles.readingHeading}
                                    onLayout={(event) => {
                                        chapterOffsetsRef.current[blockIndex] = event.nativeEvent.layout.y;
                                    }}
                                    selectable
                                >
                                    {block.text}
                                </Text>
                            ) : (
                                <Text key={`p-${blockIndex}`} style={styles.readingText} selectable>
                                    {block.text}
                                </Text>
                            )
                        )
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
    topSpacer: {
        height: 72,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.xl,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: spacing.xs,
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        textAlign: 'center',
    },
    jobLine: {
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'center',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    chapterSection: {
        marginBottom: spacing.md,
    },
    chapterLabel: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.text,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    chapterRow: {
        gap: spacing.xs,
        paddingRight: spacing.md,
    },
    chapterPill: {
        maxWidth: 200,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.button,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    chapterPillActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    chapterPillText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
    },
    chapterPillTextActive: {
        color: colors.primary,
        fontFamily: typography.sansSemiBold,
    },
    actionButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.button,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    actionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.text,
        textAlign: 'center',
    },
    playerCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    playerButton: {
        minWidth: 72,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: colors.primary,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primarySoft,
    },
    playerButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.primary,
    },
    playerProgressWrap: {
        flex: 1,
    },
    playerTrack: {
        height: 8,
        borderRadius: 999,
        backgroundColor: colors.border,
        overflow: 'hidden',
    },
    playerFill: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    playerTime: {
        marginTop: spacing.xs,
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
    },
    playerMeta: {
        marginTop: spacing.xs,
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
    },
    loadingWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    loadingText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    errorText: {
        marginBottom: spacing.md,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.error,
        textAlign: 'center',
    },
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    cardTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    cardText: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
    },
    artifactRow: {
        paddingVertical: spacing.xs,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    artifactType: {
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.text,
    },
    artifactPath: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
    },
    readingText: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.text,
        lineHeight: 22,
        marginTop: spacing.xs,
    },
    readingHeading: {
        marginTop: spacing.md,
        marginBottom: spacing.xs,
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
