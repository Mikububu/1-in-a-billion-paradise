import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<MainStackParamList, 'MyLibrary'>;

type JobSnapshot = {
    status: string;
    percent: number;
    message: string;
    type: string;
    updatedAt?: string;
};

type TrackedJob = {
    jobId: string;
    personNames: string[];
    systems: string[];
    lastTimestamp: number;
};

const toEpoch = (value?: string) => {
    if (!value) return 0;
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
};

export const MyLibraryScreen = ({ navigation }: Props) => {
    const people = useProfileStore((s) => s.people);
    const compatibilityReadings = useProfileStore((s) => s.compatibilityReadings);
    const savedAudios = useProfileStore((s) => s.savedAudios);
    const savedPDFs = useProfileStore((s) => s.savedPDFs);

    const [jobSnapshotById, setJobSnapshotById] = useState<Record<string, JobSnapshot>>({});
    const [isJobsLoading, setIsJobsLoading] = useState(false);
    const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState<string>('Portrait');

    const user = useMemo(() => people.find((p) => p.isUser), [people]);
    const partners = useMemo(() => people.filter((p) => !p.isUser), [people]);
    const totalReadings = useMemo(
        () => people.reduce((acc, p) => acc + (p.readings?.length || 0), 0),
        [people]
    );

    const trackedJobs = useMemo<TrackedJob[]>(() => {
        const map = new Map<string, { names: Set<string>; systems: Set<string>; lastTimestamp: number }>();

        for (const person of people) {
            const readingJobIds = (person.readings || []).map((r) => r.jobId).filter(Boolean) as string[];
            const allJobIds = Array.from(new Set([...(person.jobIds || []), ...readingJobIds]));

            for (const jobId of allJobIds) {
                const existing = map.get(jobId) || {
                    names: new Set<string>(),
                    systems: new Set<string>(),
                    lastTimestamp: 0,
                };

                existing.names.add(person.name);

                for (const reading of person.readings || []) {
                    if (reading.jobId !== jobId) continue;
                    if (reading.system) existing.systems.add(reading.system);
                    const ts = Math.max(toEpoch(reading.createdAt), toEpoch(reading.generatedAt));
                    if (ts > existing.lastTimestamp) existing.lastTimestamp = ts;
                }

                const personTs = Math.max(toEpoch(person.updatedAt), toEpoch(person.createdAt));
                if (existing.lastTimestamp === 0 && personTs > 0) {
                    existing.lastTimestamp = personTs;
                }

                map.set(jobId, existing);
            }
        }

        return Array.from(map.entries())
            .map(([jobId, value]) => ({
                jobId,
                personNames: Array.from(value.names),
                systems: Array.from(value.systems),
                lastTimestamp: value.lastTimestamp,
            }))
            .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    }, [people]);

    const fetchJobSnapshot = useCallback(async (jobId: string): Promise<JobSnapshot | null> => {
        try {
            const url = `${env.CORE_API_URL}/api/jobs/v2/${jobId}`;
            let accessToken: string | undefined;

            if (isSupabaseConfigured) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    accessToken = session?.access_token;
                } catch {
                    // Ignore and retry unauthenticated.
                }
            }

            let response = await fetch(url, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });

            if (response.status === 401 || response.status === 403) {
                response = await fetch(url);
            }

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const job = data?.job;
            if (!job) return null;

            const total = job.progress?.totalTasks;
            const done = job.progress?.completedTasks;
            const pctRaw = typeof job.progress?.percent === 'number'
                ? job.progress.percent
                : typeof total === 'number' && total > 0
                    ? (Number(done || 0) / total) * 100
                    : 0;

            return {
                status: String(job.status || 'unknown'),
                percent: Math.max(0, Math.min(100, Math.round(pctRaw || 0))),
                message: String(job.progress?.message || ''),
                type: String(job.type || ''),
                updatedAt: String(job.updatedAt || job.updated_at || ''),
            };
        } catch {
            return null;
        }
    }, []);

    const handleOpenPortrait = useCallback(() => {
        if (user?.portraitUrl || user?.originalPhotoUrl) {
            setPreviewImageUri(user.portraitUrl || user.originalPhotoUrl || null);
            setPreviewTitle(`${user.name || 'Your'} portrait`);
            return;
        }

        if (user?.id) {
            navigation.navigate('PersonPhotoUpload', { personId: user.id });
        }
    }, [navigation, user?.id, user?.name, user?.originalPhotoUrl, user?.portraitUrl]);

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            if (trackedJobs.length === 0) {
                if (!cancelled) {
                    setJobSnapshotById({});
                    setIsJobsLoading(false);
                }
                return;
            }

            setIsJobsLoading(true);
            const jobsToFetch = trackedJobs.slice(0, 12);
            const results = await Promise.all(
                jobsToFetch.map(async (j) => [j.jobId, await fetchJobSnapshot(j.jobId)] as const)
            );

            if (cancelled) return;

            const next: Record<string, JobSnapshot> = {};
            for (const [jobId, snapshot] of results) {
                if (snapshot) next[jobId] = snapshot;
            }

            setJobSnapshotById(next);
            setIsJobsLoading(false);
        };

        poll();
        const timer = setInterval(poll, 15000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [fetchJobSnapshot, trackedJobs]);

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>My Library</Text>
                <Text style={styles.subtitle}>Your people, readings, and next actions.</Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{user?.name || 'You'}</Text>
                    <Text style={styles.cardMeta}>
                        {user?.placements?.sunSign || '?'} Sun | {user?.placements?.moonSign || '?'} Moon | {user?.placements?.risingSign || '?'} Rising
                    </Text>
                    {user?.id ? (
                        <TouchableOpacity
                            style={styles.portraitSquare}
                            onPress={handleOpenPortrait}
                            activeOpacity={0.8}
                        >
                            {user.portraitUrl || user.originalPhotoUrl ? (
                                <Image source={{ uri: user.portraitUrl || user.originalPhotoUrl }} style={styles.portraitImage} />
                            ) : (
                                <View style={styles.portraitPlaceholder}>
                                    <Text style={styles.portraitInitial}>{(user.name || 'Y').charAt(0).toUpperCase()}</Text>
                                    <Text style={styles.portraitHint}>Tap to upload</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ) : null}
                    <View style={styles.linkRow}>
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => navigation.navigate('YourChart')}
                        >
                            <Text style={styles.linkText}>Open Your Chart</Text>
                        </TouchableOpacity>
                        {user?.id ? (
                            <TouchableOpacity
                                style={styles.linkButton}
                                onPress={() => navigation.navigate('PersonPhotoUpload', { personId: user.id })}
                            >
                                <Text style={styles.linkText}>Upload Portrait</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{partners.length}</Text>
                        <Text style={styles.statLabel}>People</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{totalReadings}</Text>
                        <Text style={styles.statLabel}>Readings</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{compatibilityReadings.length}</Text>
                        <Text style={styles.statLabel}>Compatibility</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{savedAudios.length}</Text>
                        <Text style={styles.statLabel}>Audio</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{savedPDFs.length}</Text>
                        <Text style={styles.statLabel}>PDF</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{people.length}</Text>
                        <Text style={styles.statLabel}>Profiles</Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Jobs</Text>
                    {isJobsLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
                </View>

                {trackedJobs.length === 0 ? (
                    <View style={styles.emptyJobCard}>
                        <Text style={styles.emptyJobText}>No tracked jobs yet. Start a deep reading to see live status here.</Text>
                    </View>
                ) : (
                    <View style={styles.jobsList}>
                        {trackedJobs.slice(0, 8).map((job) => {
                            const snapshot = jobSnapshotById[job.jobId];
                            const names = job.personNames.length > 0 ? job.personNames.join(' & ') : 'Reading';
                            const systems = job.systems.length > 0 ? job.systems.join(', ') : 'Systems pending';
                            const status = snapshot
                                ? `${snapshot.status.toUpperCase()}${typeof snapshot.percent === 'number' ? ` · ${snapshot.percent}%` : ''}`
                                : 'Status unavailable';

                            return (
                                <TouchableOpacity
                                    key={job.jobId}
                                    style={styles.jobCard}
                                    onPress={() => navigation.navigate('JobDetail', { jobId: job.jobId })}
                                >
                                    <View style={styles.jobMain}>
                                        <Text style={styles.jobTitle} numberOfLines={1}>{names}</Text>
                                        <Text style={styles.jobMeta} numberOfLines={1}>{systems}</Text>
                                        <Text style={styles.jobIdText} numberOfLines={1}>Job: {job.jobId}</Text>
                                    </View>
                                    <View style={styles.jobStatusWrap}>
                                        <Text style={styles.jobStatus}>{status}</Text>
                                        <Text style={styles.jobOpen}>Open</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('PeopleList')}
                    >
                        <Text style={styles.actionText}>Manage People</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('ComparePeople')}
                    >
                        <Text style={styles.actionText}>Compare People</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('SystemsOverview')}
                    >
                        <Text style={styles.actionText}>Deep Reading Systems</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal
                visible={Boolean(previewImageUri)}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewImageUri(null)}
            >
                <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImageUri(null)}>
                    <View style={styles.previewCard}>
                        <Text style={styles.previewTitle}>{previewTitle}</Text>
                        {previewImageUri ? (
                            <Image source={{ uri: previewImageUri }} style={styles.previewImage} resizeMode="contain" />
                        ) : null}
                        <Text style={styles.previewHint}>Tap anywhere to close</Text>
                    </View>
                </Pressable>
            </Modal>
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
        fontSize: 34,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    cardTitle: {
        fontFamily: typography.sansBold,
        fontSize: 20,
        color: colors.text,
    },
    cardMeta: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        marginTop: spacing.xs,
    },
    linkButton: {
        alignSelf: 'flex-start',
        marginTop: spacing.sm,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    portraitSquare: {
        width: 116,
        height: 116,
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    portraitImage: {
        width: '100%',
        height: '100%',
    },
    portraitPlaceholder: {
        width: '100%',
        height: '100%',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primarySoft,
        paddingHorizontal: spacing.xs,
    },
    portraitInitial: {
        fontFamily: typography.headline,
        fontSize: 34,
        color: colors.primary,
    },
    portraitHint: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 10,
        color: colors.primary,
    },
    linkText: {
        fontFamily: typography.sansSemiBold,
        color: colors.primary,
        fontSize: 13,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    statValue: {
        fontFamily: typography.sansBold,
        fontSize: 24,
        color: colors.text,
    },
    statLabel: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    sectionHeader: {
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    emptyJobCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    emptyJobText: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        lineHeight: 20,
    },
    jobsList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    jobCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    jobMain: {
        flex: 1,
        marginRight: spacing.sm,
    },
    jobTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    jobMeta: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    jobIdText: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
    },
    jobStatusWrap: {
        alignItems: 'flex-end',
    },
    jobStatus: {
        fontFamily: typography.sansSemiBold,
        fontSize: 11,
        color: colors.primary,
        textAlign: 'right',
    },
    jobOpen: {
        marginTop: 4,
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
    },
    actions: {
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    actionButton: {
        backgroundColor: colors.surface,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    actionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    previewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.page,
    },
    previewCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        alignItems: 'center',
    },
    previewTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    previewImage: {
        width: '100%',
        height: 420,
        borderRadius: 14,
        backgroundColor: colors.background,
    },
    previewHint: {
        marginTop: spacing.sm,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
});
