import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackButton } from '@/components/BackButton';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { fetchJobArtifacts, type JobArtifact } from '@/services/jobArtifacts';
import { prewarmArtifactSignedUrls } from '@/services/artifactSignedUrlCache';

type Props = NativeStackScreenProps<MainStackParamList, 'JobDetail'>;

export const JobDetailScreen = ({ navigation, route }: Props) => {
    const { jobId, docNum, personName, system } = route.params;
    const [job, setJob] = useState<any>(null);
    const [artifacts, setArtifacts] = useState<JobArtifact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const hasAutoNavigatedRef = useRef(false);

    const loadJob = useCallback(async () => {
        if (!jobId) return;

        try {
            setErrorText(null);

            const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}`;
            let accessToken: string | undefined;

            if (isSupabaseConfigured) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    accessToken = session?.access_token;
                } catch {
                    // Ignore and retry unauthenticated below.
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

            const nextArtifacts = await fetchJobArtifacts(jobId);
            setArtifacts(nextArtifacts);
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
                await loadJob();
            }
        };

        run();
        const timer = setInterval(run, 10000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [loadJob]);

    const relevantArtifacts = useMemo(() => {
        if (typeof docNum !== 'number') return artifacts;
        return artifacts.filter(a => a.doc_num === docNum);
    }, [artifacts, docNum]);

    const hasText = useMemo(
        () => relevantArtifacts.some((a) => a.artifact_type === 'text' && Boolean(a.storage_path)),
        [relevantArtifacts]
    );
    const hasAudio = useMemo(
        () =>
            relevantArtifacts.some(
                (a) =>
                    (a.artifact_type === 'audio' || a.artifact_type === 'audio_mp3' || a.artifact_type === 'audio_m4a') &&
                    Boolean(a.storage_path)
            ),
        [relevantArtifacts]
    );
    const hasSong = useMemo(
        () => relevantArtifacts.some((a) => a.artifact_type === 'audio_song' && (Boolean(a.storage_path) || (a.metadata as any)?.error === true)),
        [relevantArtifacts]
    );

    useEffect(() => {
        const pathsToPrewarm = artifacts
            .filter(
                (a) =>
                    Boolean(a.storage_path) &&
                    (a.artifact_type === 'pdf' ||
                        a.artifact_type === 'audio' ||
                        a.artifact_type === 'audio_mp3' ||
                        a.artifact_type === 'audio_m4a' ||
                        a.artifact_type === 'audio_song')
            )
            .map((a) => a.storage_path);

        if (pathsToPrewarm.length === 0) return;
        prewarmArtifactSignedUrls(pathsToPrewarm).catch((e) => console.warn('Prewarm error:', e));
    }, [artifacts]);
    const hasPdf = useMemo(
        () => relevantArtifacts.some((a) => a.artifact_type === 'pdf' && Boolean(a.storage_path)),
        [relevantArtifacts]
    );

    const taskProgress = useMemo(() => {
        const totalFromProgress = Number(job?.progress?.tasksTotal ?? job?.progress?.totalTasks);
        const doneFromProgress = Number(job?.progress?.tasksComplete ?? job?.progress?.completedTasks);
        if (Number.isFinite(totalFromProgress) && totalFromProgress > 0 && Number.isFinite(doneFromProgress) && doneFromProgress >= 0) {
            return {
                done: Math.max(0, Math.min(totalFromProgress, doneFromProgress)),
                total: totalFromProgress,
                source: 'progress' as const,
            };
        }

        const allTasks = Array.isArray(job?.tasks)
            ? job.tasks
            : (Array.isArray(job?.progress?.tasks) ? job.progress.tasks : []);
        if (allTasks.length > 0) {
            const done = allTasks.filter((t: any) => {
                const status = String(t?.status || '').toLowerCase();
                return status === 'completed' || status === 'done' || status === 'success';
            }).length;
            return {
                done,
                total: allTasks.length,
                source: 'tasks' as const,
            };
        }

        return null;
    }, [job]);

    const progressPercent = useMemo(() => {
        if (!taskProgress) return null;
        const pctRaw = (taskProgress.done / taskProgress.total) * 100;
        return Math.max(0, Math.min(100, Math.round(pctRaw || 0)));
    }, [taskProgress]);

    const statusLine = useMemo(() => {
        const status = String(job?.status || 'unknown').toUpperCase();
        const message = job?.progress?.message || job?.error;
        const taskInfo = taskProgress ? `${taskProgress.done}/${taskProgress.total}` : null;

        return [status, taskInfo, message].filter(Boolean).join(' · ');
    }, [job, taskProgress]);

    const subjects = useMemo(() => {
        if (personName) return personName;
        const params = job?.params || job?.input || {};
        const p1 = params.person1?.name || params.person?.name;
        const p2 = params.person2?.name;
        if (p1 && p2) return `${p1} & ${p2}`;
        return p1 || 'Reading';
    }, [job, personName]);

    const systemsLabel = useMemo(() => {
        if (system) return system.charAt(0).toUpperCase() + system.slice(1);
        const params = job?.params || job?.input || {};
        const systems = Array.isArray(params.systems) ? params.systems : [];
        if (systems.length === 0) return 'No systems listed';
        return systems.join(', ');
    }, [job, system]);

    const updatedAt = useMemo(() => {
        const value = job?.updatedAt || job?.updated_at || job?.createdAt || job?.created_at;
        if (!value) return 'Unknown';
        try {
            return new Date(value).toLocaleString();
        } catch {
            return String(value);
        }
    }, [job]);
    const isStrictReady = hasText && hasAudio && hasSong && hasPdf;
    const readinessSummary = `${Number(hasText) + Number(hasAudio) + Number(hasSong) + Number(hasPdf)}/4 ready`;

    useEffect(() => {
        if (!isStrictReady || hasAutoNavigatedRef.current) return;
        hasAutoNavigatedRef.current = true;
        const timer = setTimeout(() => {
            navigation.replace('ReadingContent', { jobId, docNum, personName, system });
        }, 500);
        return () => clearTimeout(timer);
    }, [isStrictReady, jobId, docNum, personName, system, navigation]);

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Preparing Your Reading</Text>
                <Text style={styles.jobId}>Job ID: {jobId}</Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{subjects}</Text>
                    <Text style={styles.cardMeta}>Systems: {systemsLabel}</Text>
                    <Text style={styles.cardMeta}>Type: {job?.type || 'unknown'}</Text>
                    <Text style={styles.cardMeta}>Updated: {updatedAt}</Text>
                </View>

                <View style={styles.progressCard}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressPercent ?? 0}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{progressPercent == null ? '—' : `${progressPercent}%`}</Text>
                    {taskProgress == null ? (
                        <Text style={styles.progressHint}>Waiting for backend task counts...</Text>
                    ) : null}
                    <Text style={styles.statusText}>{statusLine}</Text>
                    <Text style={styles.readinessTitle}>Readiness: {readinessSummary}</Text>

                    <View style={styles.readinessRow}>
                        <Text style={styles.readinessItemRow}>
                            {hasText ? '✓' : '○'} Text
                        </Text>
                        <Text style={styles.readinessItemRow}>
                            {hasAudio ? '✓' : '○'} Audio
                        </Text>
                        <Text style={styles.readinessItemRow}>
                            {hasSong ? '✓' : '○'} Song
                        </Text>
                        <Text style={styles.readinessItemRow}>
                            {hasPdf ? '✓' : '○'} PDF
                        </Text>
                    </View>

                    {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
                </View>

                {isLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingText}>Loading status...</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[styles.actionButton, !isStrictReady && styles.actionButtonDisabled]}
                    onPress={() => navigation.navigate('ReadingContent', { jobId, docNum, personName, system })}
                    disabled={!isStrictReady}
                >
                    <Text style={[styles.actionButtonText, !isStrictReady && styles.actionButtonTextDisabled]}>
                        {isStrictReady ? 'Open Reading Content' : 'Waiting for Text + Audio + Song + PDF'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyLibrary')}>
                    <Text style={styles.actionButtonText}>Open My Library</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.actionButtonText}>My Secret Life Dashboard</Text>
                </TouchableOpacity>
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
    jobId: {
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
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
        fontFamily: typography.sansBold,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    cardMeta: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 2,
    },
    progressCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    progressTrack: {
        height: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: 'hidden',
    },
    progressFill: {
        height: 8,
        borderRadius: 999,
        backgroundColor: colors.primary,
    },
    progressText: {
        marginTop: spacing.xs,
        textAlign: 'center',
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.text,
    },
    progressHint: {
        marginTop: 2,
        textAlign: 'center',
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    statusText: {
        marginTop: spacing.sm,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.text,
        textAlign: 'center',
    },
    readinessTitle: {
        marginTop: spacing.md,
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.text,
        textAlign: 'center',
    },
    readinessRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    readinessItemRow: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.text,
    },
    errorText: {
        marginTop: spacing.sm,
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.error,
        textAlign: 'center',
    },
    loadingWrap: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    loadingText: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
    },
    actionButton: {
        marginTop: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.text,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    actionButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.text,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonTextDisabled: {
        color: colors.mutedText,
    },
});
