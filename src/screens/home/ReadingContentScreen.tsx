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
import { downloadTextContent, fetchJobArtifacts, type JobArtifact } from '@/services/jobArtifacts';
import { getCachedArtifactSignedUrl, prewarmArtifactSignedUrls } from '@/services/artifactSignedUrlCache';
import { splitIntoBlocks } from '@/utils/readingTextFormat';

type Props = NativeStackScreenProps<MainStackParamList, 'ReadingContent'>;

type AudioKind = 'narration' | 'song';

const isNarrationArtifact = (a: JobArtifact) =>
    a.artifact_type === 'audio' || a.artifact_type === 'audio_mp3' || a.artifact_type === 'audio_m4a';
const isSongArtifact = (a: JobArtifact) => a.artifact_type === 'audio_song';

const getFirstTextArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => a.artifact_type === 'text' && a.storage_path);
const getFirstPdfArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => a.artifact_type === 'pdf' && a.storage_path);
const getFirstNarrationArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => isNarrationArtifact(a) && a.storage_path);
const getFirstSongArtifact = (artifacts: JobArtifact[]) => artifacts.find((a) => isSongArtifact(a) && a.storage_path);

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
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioDurationSec, setAudioDurationSec] = useState(0);
    const [audioPositionSec, setAudioPositionSec] = useState(0);
    const [audioSignedUrl, setAudioSignedUrl] = useState<string | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [activeChapterIndex, setActiveChapterIndex] = useState(0);
    const [activeAudioKind, setActiveAudioKind] = useState<AudioKind | null>(null);
    const [downloadingTarget, setDownloadingTarget] = useState<'pdf' | AudioKind | null>(null);

    const soundRef = useRef<Audio.Sound | null>(null);
    const loadedAudioPathRef = useRef<string | null>(null);
    const preparingAudioPathRef = useRef<string | null>(null);
    const prepareAudioPromiseRef = useRef<Promise<boolean> | null>(null);
    const progressTrackWidthRef = useRef(1);
    const readingScrollRef = useRef<ScrollView | null>(null);
    const chapterOffsetsRef = useRef<Record<number, number>>({});
    const textArtifact = useMemo(() => getFirstTextArtifact(artifacts), [artifacts]);
    const narrationArtifact = useMemo(() => getFirstNarrationArtifact(artifacts), [artifacts]);
    const songArtifact = useMemo(() => getFirstSongArtifact(artifacts), [artifacts]);
    const pdfArtifact = useMemo(() => getFirstPdfArtifact(artifacts), [artifacts]);

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
            prewarmArtifactSignedUrls(
                rows
                    .filter(
                        (artifact) =>
                            (isNarrationArtifact(artifact) || isSongArtifact(artifact) || artifact.artifact_type === 'pdf') &&
                            Boolean(artifact.storage_path)
                    )
                    .map((artifact) => artifact.storage_path)
            ).catch(() => { });
        } catch (error: any) {
            setErrorText(error?.message || 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        return () => {
            prepareAudioPromiseRef.current = null;
            preparingAudioPathRef.current = null;
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

    useEffect(() => {
        if (!textArtifact?.storage_path || textBody.trim().length > 0) return;
        let cancelled = false;
        downloadTextContent(textArtifact.storage_path)
            .then((body) => {
                if (cancelled) return;
                if (body) setTextBody(body);
            })
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, [textArtifact?.storage_path, textBody]);

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

    const prepareAudio = useCallback(async (artifact: JobArtifact, shouldPlay: boolean, kind: AudioKind): Promise<boolean> => {
        if (!artifact?.storage_path) return false;
        setActiveAudioKind(kind);

        if (soundRef.current && loadedAudioPathRef.current === artifact.storage_path) {
            if (shouldPlay) {
                await soundRef.current.playAsync();
                setIsAudioPlaying(true);
            }
            return true;
        }

        if (
            prepareAudioPromiseRef.current &&
            preparingAudioPathRef.current === artifact.storage_path
        ) {
            const alreadyPrepared = await prepareAudioPromiseRef.current;
            if (alreadyPrepared && shouldPlay && soundRef.current) {
                await soundRef.current.playAsync();
                setIsAudioPlaying(true);
            }
            return alreadyPrepared;
        }

        setIsAudioLoading(true);
        preparingAudioPathRef.current = artifact.storage_path;

        const request = (async () => {
            try {
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                });

                const signedUrl = await getCachedArtifactSignedUrl(artifact.storage_path, 60 * 60);
                if (!signedUrl) {
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
                    onPlaybackStatusUpdate,
                    false
                );

                soundRef.current = sound;
                loadedAudioPathRef.current = artifact.storage_path;

                if (status.isLoaded) {
                    setAudioPositionSec((status.positionMillis || 0) / 1000);
                    setAudioDurationSec((status.durationMillis || 0) / 1000);
                    setIsAudioPlaying(Boolean(status.isPlaying));
                }

                return true;
            } catch {
                return false;
            } finally {
                setIsAudioLoading(false);
            }
        })();

        prepareAudioPromiseRef.current = request;
        try {
            return await request;
        } finally {
            prepareAudioPromiseRef.current = null;
            preparingAudioPathRef.current = null;
        }
    }, [onPlaybackStatusUpdate]);

    useEffect(() => {
        const firstAvailable = narrationArtifact || songArtifact;
        if (!firstAvailable?.storage_path) return;
        if (loadedAudioPathRef.current === firstAvailable.storage_path && soundRef.current) return;
        const kind: AudioKind = narrationArtifact ? 'narration' : 'song';
        prepareAudio(firstAvailable, false, kind).catch(() => { });
    }, [narrationArtifact, songArtifact, prepareAudio]);

    const handleToggleAudio = useCallback(async (kind: AudioKind) => {
        const targetArtifact = kind === 'narration' ? narrationArtifact : songArtifact;
        if (!targetArtifact) {
            return;
        }

        if (!soundRef.current || loadedAudioPathRef.current !== targetArtifact.storage_path) {
            await prepareAudio(targetArtifact, true, kind);
            return;
        }

        try {
            const status = await soundRef.current.getStatusAsync();
            if (!status.isLoaded) return;
            setActiveAudioKind(kind);
            if (status.isPlaying) {
                await soundRef.current.pauseAsync();
                setIsAudioPlaying(false);
            } else {
                await soundRef.current.playAsync();
                setIsAudioPlaying(true);
            }
        } catch { }
    }, [narrationArtifact, songArtifact, prepareAudio]);

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

    const handleDownloadArtifact = useCallback(async (target: AudioKind | 'pdf') => {
        const artifact =
            target === 'pdf'
                ? pdfArtifact
                : target === 'narration'
                    ? narrationArtifact
                    : songArtifact;
        if (!artifact?.storage_path) {
            const label = target === 'pdf' ? 'PDF' : target === 'narration' ? 'narration audio' : 'song audio';
            Alert.alert('Not Ready', `This ${label} is not ready yet.`);
            return;
        }

        try {
            setDownloadingTarget(target);
            const signedUrl = await getCachedArtifactSignedUrl(artifact.storage_path, 60 * 60);
            if (!signedUrl) {
                Alert.alert('Error', 'Could not prepare download link.');
                return;
            }
            await Linking.openURL(signedUrl);
        } catch (error: any) {
            setErrorText(error?.message || 'Failed to open download link');
        } finally {
            setDownloadingTarget(null);
        }
    }, [narrationArtifact, songArtifact, pdfArtifact]);

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
                    <TouchableOpacity style={styles.actionButton} onPress={load}>
                        <Text style={styles.actionText}>Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDownloadArtifact('pdf')}
                        disabled={!pdfArtifact || downloadingTarget !== null}
                    >
                        <Text style={styles.actionText}>
                            {!pdfArtifact ? 'PDF unavailable' : downloadingTarget === 'pdf' ? 'Opening...' : 'Download PDF'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {(narrationArtifact || songArtifact) ? (
                    <View style={styles.playerCard}>
                        <View style={styles.trackRow}>
                            <Text style={styles.trackLabel}>Narration</Text>
                            <View style={styles.trackActions}>
                                <TouchableOpacity
                                    style={[styles.playerButton, !narrationArtifact && styles.playerButtonDisabled]}
                                    onPress={() => handleToggleAudio('narration')}
                                    disabled={!narrationArtifact}
                                >
                                    <Text style={[styles.playerButtonText, !narrationArtifact && styles.playerButtonTextDisabled]}>
                                        {narrationArtifact &&
                                            activeAudioKind === 'narration' &&
                                            loadedAudioPathRef.current === narrationArtifact.storage_path &&
                                            isAudioPlaying
                                            ? 'Pause'
                                            : isAudioLoading && preparingAudioPathRef.current === narrationArtifact?.storage_path
                                                ? '...'
                                                : 'Play'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.downloadButton, !narrationArtifact && styles.playerButtonDisabled]}
                                    onPress={() => handleDownloadArtifact('narration')}
                                    disabled={!narrationArtifact || downloadingTarget !== null}
                                >
                                    <Text style={[styles.downloadButtonText, !narrationArtifact && styles.playerButtonTextDisabled]}>
                                        {downloadingTarget === 'narration' ? '...' : '↓'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.trackRow}>
                            <Text style={styles.trackLabel}>Song</Text>
                            <View style={styles.trackActions}>
                                <TouchableOpacity
                                    style={[styles.playerButton, !songArtifact && styles.playerButtonDisabled]}
                                    onPress={() => handleToggleAudio('song')}
                                    disabled={!songArtifact}
                                >
                                    <Text style={[styles.playerButtonText, !songArtifact && styles.playerButtonTextDisabled]}>
                                        {songArtifact &&
                                            activeAudioKind === 'song' &&
                                            loadedAudioPathRef.current === songArtifact.storage_path &&
                                            isAudioPlaying
                                            ? 'Pause'
                                            : isAudioLoading && preparingAudioPathRef.current === songArtifact?.storage_path
                                                ? '...'
                                                : 'Play'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.downloadButton, !songArtifact && styles.playerButtonDisabled]}
                                    onPress={() => handleDownloadArtifact('song')}
                                    disabled={!songArtifact || downloadingTarget !== null}
                                >
                                    <Text style={[styles.downloadButtonText, !songArtifact && styles.playerButtonTextDisabled]}>
                                        {downloadingTarget === 'song' ? '...' : '↓'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

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
                        <Text style={styles.playerMeta}>
                            {isAudioLoading
                                ? `Preparing ${activeAudioKind === 'song' ? 'song' : 'narration'}...`
                                : audioSignedUrl
                                    ? `${activeAudioKind === 'song' ? 'Song' : 'Narration'} ready (tap bar to seek)`
                                    : 'Select narration or song'}
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
                    <Text style={styles.cardTitle}>Reading Text</Text>
                    {blocks.length === 0 ? (
                        <Text style={styles.readingText} selectable>
                            {textBody || 'Text unavailable for this job.'}
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
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    trackLabel: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.text,
    },
    trackActions: {
        flexDirection: 'row',
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
    playerButtonDisabled: {
        borderColor: colors.border,
        backgroundColor: '#f3f4f6',
    },
    playerButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.primary,
    },
    playerButtonTextDisabled: {
        color: colors.mutedText,
    },
    downloadButton: {
        minWidth: 44,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f8f8',
    },
    downloadButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
    },
    playerProgressWrap: {
        flex: 1,
        marginTop: spacing.xs,
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
