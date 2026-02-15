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
type AudioStateMap<T> = { narration: T; song: T };
const AUDIO_KINDS: readonly AudioKind[] = ['narration', 'song'] as const;

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
    const [isAudioLoadingByKind, setIsAudioLoadingByKind] = useState<AudioStateMap<boolean>>({
        narration: false,
        song: false,
    });
    const [isAudioPlayingByKind, setIsAudioPlayingByKind] = useState<AudioStateMap<boolean>>({
        narration: false,
        song: false,
    });
    const [audioDurationSecByKind, setAudioDurationSecByKind] = useState<AudioStateMap<number>>({
        narration: 0,
        song: 0,
    });
    const [audioPositionSecByKind, setAudioPositionSecByKind] = useState<AudioStateMap<number>>({
        narration: 0,
        song: 0,
    });
    const [audioSignedUrlByKind, setAudioSignedUrlByKind] = useState<AudioStateMap<string | null>>({
        narration: null,
        song: null,
    });
    const [errorText, setErrorText] = useState<string | null>(null);
    const [activeChapterIndex, setActiveChapterIndex] = useState(0);
    const [activeAudioKind, setActiveAudioKind] = useState<AudioKind | null>(null);
    const [downloadingTarget, setDownloadingTarget] = useState<'pdf' | AudioKind | null>(null);

    const soundsRef = useRef<Partial<Record<AudioKind, Audio.Sound>>>({});
    const loadedAudioPathRef = useRef<AudioStateMap<string | null>>({
        narration: null,
        song: null,
    });
    const preparingAudioPathRef = useRef<AudioStateMap<string | null>>({
        narration: null,
        song: null,
    });
    const prepareAudioPromiseRef = useRef<Partial<Record<AudioKind, Promise<boolean> | null>>>({});
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
            for (const kind of AUDIO_KINDS) {
                prepareAudioPromiseRef.current[kind] = null;
                preparingAudioPathRef.current[kind] = null;
                loadedAudioPathRef.current[kind] = null;
                soundsRef.current[kind]?.unloadAsync().catch(() => { });
                delete soundsRef.current[kind];
            }
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

    const onPlaybackStatusUpdate = useCallback((kind: AudioKind, status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setAudioPositionSecByKind((prev) => ({ ...prev, [kind]: (status.positionMillis || 0) / 1000 }));
        const durationMillis = status.durationMillis;
        if (typeof durationMillis === 'number') {
            setAudioDurationSecByKind((prev) => ({ ...prev, [kind]: durationMillis / 1000 }));
        }
        setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: Boolean(status.isPlaying) }));
        if (status.didJustFinish) {
            setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: false }));
            setAudioPositionSecByKind((prev) => ({ ...prev, [kind]: 0 }));
        }
    }, []);

    const pauseOtherAudio = useCallback(async (kind: AudioKind) => {
        const otherKind: AudioKind = kind === 'narration' ? 'song' : 'narration';
        const otherSound = soundsRef.current[otherKind];
        if (!otherSound) return;

        try {
            const otherStatus = await otherSound.getStatusAsync();
            if (!otherStatus.isLoaded || !otherStatus.isPlaying) return;
            await otherSound.pauseAsync();
            setIsAudioPlayingByKind((prev) => ({ ...prev, [otherKind]: false }));
        } catch {
            // ignore playback race
        }
    }, []);

    const prepareAudio = useCallback(async (artifact: JobArtifact, shouldPlay: boolean, kind: AudioKind): Promise<boolean> => {
        if (!artifact?.storage_path) return false;
        if (shouldPlay) {
            setActiveAudioKind(kind);
        }

        const currentSound = soundsRef.current[kind];
        if (currentSound && loadedAudioPathRef.current[kind] === artifact.storage_path) {
            if (shouldPlay) {
                await pauseOtherAudio(kind);
                await currentSound.playAsync();
                setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: true }));
            }
            return true;
        }

        if (prepareAudioPromiseRef.current[kind] && preparingAudioPathRef.current[kind] === artifact.storage_path) {
            const alreadyPrepared = await (prepareAudioPromiseRef.current[kind] as Promise<boolean>);
            if (alreadyPrepared && shouldPlay && soundsRef.current[kind]) {
                await pauseOtherAudio(kind);
                await (soundsRef.current[kind] as Audio.Sound).playAsync();
                setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: true }));
            }
            return alreadyPrepared;
        }

        setIsAudioLoadingByKind((prev) => ({ ...prev, [kind]: true }));
        preparingAudioPathRef.current[kind] = artifact.storage_path;

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

                setAudioSignedUrlByKind((prev) => ({ ...prev, [kind]: signedUrl }));

                if (soundsRef.current[kind]) {
                    await (soundsRef.current[kind] as Audio.Sound).unloadAsync().catch(() => { });
                    delete soundsRef.current[kind];
                }

                const { sound, status } = await Audio.Sound.createAsync(
                    { uri: signedUrl },
                    { shouldPlay: false, progressUpdateIntervalMillis: 250 },
                    (status) => onPlaybackStatusUpdate(kind, status),
                    false
                );

                soundsRef.current[kind] = sound;
                loadedAudioPathRef.current[kind] = artifact.storage_path;

                if (status.isLoaded) {
                    setAudioPositionSecByKind((prev) => ({ ...prev, [kind]: (status.positionMillis || 0) / 1000 }));
                    setAudioDurationSecByKind((prev) => ({ ...prev, [kind]: (status.durationMillis || 0) / 1000 }));
                    setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: false }));
                }

                if (shouldPlay) {
                    await pauseOtherAudio(kind);
                    await sound.playAsync();
                    setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: true }));
                }

                return true;
            } catch {
                return false;
            } finally {
                setIsAudioLoadingByKind((prev) => ({ ...prev, [kind]: false }));
            }
        })();

        prepareAudioPromiseRef.current[kind] = request;
        try {
            return await request;
        } finally {
            prepareAudioPromiseRef.current[kind] = null;
            preparingAudioPathRef.current[kind] = null;
        }
    }, [onPlaybackStatusUpdate, pauseOtherAudio]);

    useEffect(() => {
        if (narrationArtifact?.storage_path) {
            const alreadyLoaded = loadedAudioPathRef.current.narration === narrationArtifact.storage_path;
            if (!alreadyLoaded) {
                prepareAudio(narrationArtifact, false, 'narration').catch(() => { });
            }
        }
        if (songArtifact?.storage_path) {
            const alreadyLoaded = loadedAudioPathRef.current.song === songArtifact.storage_path;
            if (!alreadyLoaded) {
                prepareAudio(songArtifact, false, 'song').catch(() => { });
            }
        }
    }, [narrationArtifact, songArtifact, prepareAudio]);

    const handleToggleAudio = useCallback(async (kind: AudioKind) => {
        const targetArtifact = kind === 'narration' ? narrationArtifact : songArtifact;
        if (!targetArtifact) {
            return;
        }

        if (!soundsRef.current[kind] || loadedAudioPathRef.current[kind] !== targetArtifact.storage_path) {
            await prepareAudio(targetArtifact, true, kind);
            return;
        }

        try {
            const sound = soundsRef.current[kind] as Audio.Sound;
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) return;
            setActiveAudioKind(kind);
            if (status.isPlaying) {
                await sound.pauseAsync();
                setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: false }));
            } else {
                await pauseOtherAudio(kind);
                await sound.playAsync();
                setIsAudioPlayingByKind((prev) => ({ ...prev, [kind]: true }));
            }
        } catch { }
    }, [narrationArtifact, songArtifact, pauseOtherAudio, prepareAudio]);

    const handleSeekPress = useCallback(async (locationX: number) => {
        const currentKind = activeAudioKind ?? (narrationArtifact ? 'narration' : songArtifact ? 'song' : null);
        if (!currentKind) return;
        const sound = soundsRef.current[currentKind];
        const durationSec = audioDurationSecByKind[currentKind];
        if (!sound || durationSec <= 0) return;
        const trackWidth = Math.max(1, progressTrackWidthRef.current);
        const ratio = Math.min(1, Math.max(0, locationX / trackWidth));
        const positionMillis = Math.round(ratio * durationSec * 1000);
        try {
            await sound.setPositionAsync(positionMillis);
            setAudioPositionSecByKind((prev) => ({ ...prev, [currentKind]: positionMillis / 1000 }));
        } catch { }
    }, [activeAudioKind, audioDurationSecByKind, narrationArtifact, songArtifact]);

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

    const activePositionSec = activeAudioKind ? audioPositionSecByKind[activeAudioKind] : 0;
    const activeDurationSec = activeAudioKind ? audioDurationSecByKind[activeAudioKind] : 0;
    const activeLoading = activeAudioKind ? isAudioLoadingByKind[activeAudioKind] : false;
    const activeSignedUrl = activeAudioKind ? audioSignedUrlByKind[activeAudioKind] : null;

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
                                            isAudioPlayingByKind.narration
                                            ? 'Pause'
                                            : isAudioLoadingByKind.narration && preparingAudioPathRef.current.narration === narrationArtifact?.storage_path
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
                                            isAudioPlayingByKind.song
                                            ? 'Pause'
                                            : isAudioLoadingByKind.song && preparingAudioPathRef.current.song === songArtifact?.storage_path
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
                                            width: `${activeDurationSec > 0
                                                ? Math.min(100, Math.max(0, (activePositionSec / activeDurationSec) * 100))
                                                : 0}%`,
                                        },
                                    ]}
                                />
                            </Pressable>
                            <Text style={styles.playerTime}>
                                {formatClock(activePositionSec)} / {formatClock(activeDurationSec)}
                            </Text>
                        </View>
                        <Text style={styles.playerMeta}>
                            {activeLoading
                                ? `Preparing ${activeAudioKind === 'song' ? 'song' : 'narration'}...`
                                : activeSignedUrl
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
