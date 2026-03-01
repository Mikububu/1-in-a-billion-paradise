import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';
import { fetchJobSnapshot, type JobSnapshot } from '@/services/jobStatus';
import { recoverReadingsFromCloud } from '@/services/libraryRecovery';

type Props = NativeStackScreenProps<MainStackParamList, 'MyLibrary'>;

type TrackedReading = {
    id: string;
    jobId: string;
    docNum: number | undefined;
    personName: string;
    system: string;
    lastTimestamp: number;
    readingType?: 'individual' | 'overlay';
    partnerName?: string;
    personImageUrl?: string;
    partnerImageUrl?: string;
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

    const userId = useAuthStore((s) => s.user?.id || null);

    const [jobSnapshotById, setJobSnapshotById] = useState<Record<string, JobSnapshot>>({});
    const [isJobsLoading, setIsJobsLoading] = useState(false);
    const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState<string>('Portrait');
    const [isRecovering, setIsRecovering] = useState(false);

    // AUTO-RECOVERY: If user has 0 readings but might have cloud jobs,
    // attempt to rebuild reading placeholders from backend data.
    const recoveryAttemptedRef = useRef(false);
    useEffect(() => {
        if (recoveryAttemptedRef.current || !userId || totalReadings > 0) return;
        recoveryAttemptedRef.current = true;

        (async () => {
            setIsRecovering(true);
            try {
                const result = await recoverReadingsFromCloud(userId);
                if (result.recovered > 0) {
                    console.log(`🔄 Library auto-recovery: ${result.recovered} readings restored`);
                }
            } catch (err) {
                console.warn('⚠️ Library recovery failed', err);
            } finally {
                setIsRecovering(false);
            }
        })();
    }, [userId, totalReadings]);

    const user = useMemo(() => people.find((p) => p.isUser), [people]);
    const partners = useMemo(() => people.filter((p) => !p.isUser), [people]);
    const totalReadings = useMemo(
        () => people.reduce((acc, p) => acc + (p.readings?.length || 0), 0),
        [people]
    );
    // Count individual vs overlay readings from actual placeholder data
    const individualReadingsCount = useMemo(
        () => people.reduce((acc, p) => acc + (p.readings?.filter((r: any) => r.readingType !== 'overlay').length || 0), 0),
        [people]
    );
    const overlayReadingsCount = useMemo(
        () => people.reduce((acc, p) => acc + (p.readings?.filter((r: any) => r.readingType === 'overlay').length || 0), 0),
        [people]
    );

    const trackedReadings = useMemo<TrackedReading[]>(() => {
        const readings: TrackedReading[] = [];

        for (const person of people) {
            // Find partner image if this person has overlay readings
            const findPartnerImage = (partnerName?: string) => {
                if (!partnerName) return undefined;
                const partner = people.find((p) => p.name === partnerName);
                return partner?.portraitUrl || partner?.originalPhotoUrl || undefined;
            };

            for (const reading of person.readings || []) {
                if (!reading.jobId) continue;

                const ts = Math.max(toEpoch(reading.createdAt), toEpoch(reading.generatedAt));

                readings.push({
                    id: reading.id,
                    jobId: reading.jobId,
                    docNum: reading.docNum,
                    personName: person.name,
                    system: reading.system,
                    lastTimestamp: ts > 0 ? ts : Math.max(toEpoch(person.updatedAt), toEpoch(person.createdAt)),
                    readingType: reading.readingType,
                    partnerName: reading.partnerName,
                    personImageUrl: person.portraitUrl || person.originalPhotoUrl || undefined,
                    partnerImageUrl: findPartnerImage(reading.partnerName),
                });
            }
        }

        return readings.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    }, [people]);

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

    // Poll job status, but pause when app is in the background to save battery
    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setInterval> | null = null;

        const poll = async () => {
            if (trackedReadings.length === 0) {
                if (!cancelled) {
                    setJobSnapshotById({});
                    setIsJobsLoading(false);
                }
                return;
            }

            setIsJobsLoading(true);
            const jobsToFetch = trackedReadings.slice(0, 16);
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

        const startPolling = () => {
            poll();
            if (timer) clearInterval(timer);
            timer = setInterval(poll, 15000);
        };

        const stopPolling = () => {
            if (timer) { clearInterval(timer); timer = null; }
        };

        startPolling();

        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') startPolling();
            else stopPolling();
        });

        return () => {
            cancelled = true;
            stopPolling();
            sub.remove();
        };
    }, [trackedReadings]);

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer}>
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.settingsButtonText}>⚙</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>My Souls Library</Text>
                <Text style={styles.subtitle}>Your people, readings, and next actions.</Text>



                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{people.length}</Text>
                        <Text style={styles.statLabel}>Souls</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{individualReadingsCount}</Text>
                        <Text style={styles.statLabel}>Readings</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{overlayReadingsCount}</Text>
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

                {(isJobsLoading || isRecovering) ? <ActivityIndicator color={colors.primary} size="small" style={{ marginBottom: spacing.sm }} /> : null}

                {trackedReadings.length === 0 && !isRecovering ? (
                    <View style={styles.emptyJobCard}>
                        <Text style={styles.emptyJobText}>No tracked readings yet. Start a deep reading to see live status here.</Text>
                    </View>
                ) : (
                    <View style={styles.jobsList}>
                        {trackedReadings.slice(0, 16).map((reading) => {
                            const snapshot = jobSnapshotById[reading.jobId];
                            const readingDate = reading.lastTimestamp
                                ? new Date(reading.lastTimestamp).toLocaleString()
                                : '';
                            const systemName = reading.system
                                ? reading.system.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                                : 'Reading';
                            const statusRaw = String(snapshot?.status || '').toLowerCase();
                            const isComplete = statusRaw === 'complete' || statusRaw === 'completed';
                            const status = snapshot
                                ? (isComplete ? 'DONE' : `${typeof snapshot.percent === 'number' ? `${snapshot.percent}%` : '...'}`)
                                : '...';

                            const isOverlayReading = reading.readingType === 'overlay';
                            const displayTitle = isOverlayReading && reading.partnerName
                                ? `${reading.personName} & ${reading.partnerName}`
                                : reading.personName;

                            return (
                                <TouchableOpacity
                                    key={`${reading.jobId}-${reading.id}`}
                                    style={styles.jobCard}
                                    onPress={() => navigation.navigate('JobDetail', {
                                        jobId: reading.jobId,
                                        docNum: reading.docNum,
                                        personName: reading.personName,
                                        system: reading.system
                                    })}
                                >
                                    {isOverlayReading ? (
                                        <View style={styles.dualBadgeWrap}>
                                            {reading.personImageUrl ? (
                                                <Image source={{ uri: reading.personImageUrl }} style={styles.badgeImageLeft} />
                                            ) : (
                                                <View style={[styles.readingBadgeSmall, styles.badgeRed]}>
                                                    <Text style={styles.readingBadgeSmallText}>{reading.personName.charAt(0)}</Text>
                                                </View>
                                            )}
                                            {reading.partnerImageUrl ? (
                                                <Image source={{ uri: reading.partnerImageUrl }} style={styles.badgeImageRight} />
                                            ) : (
                                                <View style={[styles.readingBadgeSmall, styles.badgeGreen]}>
                                                    <Text style={styles.readingBadgeSmallTextGreen}>{(reading.partnerName || 'P').charAt(0)}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        reading.personImageUrl ? (
                                            <Image source={{ uri: reading.personImageUrl }} style={styles.badgeImageSingle} />
                                        ) : (
                                            <View style={styles.readingBadge}>
                                                <Text style={styles.readingBadgeText}>{reading.personName.charAt(0)}</Text>
                                            </View>
                                        )
                                    )}
                                    <View style={styles.jobMain}>
                                        <Text style={styles.jobTitle} numberOfLines={1}>{displayTitle}</Text>
                                        {readingDate ? (
                                            <Text style={styles.jobDate} numberOfLines={1}>
                                                From {readingDate}
                                            </Text>
                                        ) : null}
                                        <Text style={styles.jobMeta} numberOfLines={1}>
                                            {systemName}
                                        </Text>
                                    </View>
                                    <View style={styles.jobStatusWrap}>
                                        <Text style={styles.jobStatus}>{status}</Text>
                                        <Text style={styles.jobOpen}>{isComplete ? 'Open Reading' : 'Open Status'}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}


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
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingHorizontal: spacing.page,
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
    settingsButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsButtonText: {
        fontFamily: typography.sansBold,
        color: colors.text,
        fontSize: 17,
        lineHeight: 20,
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
    readingBadge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f8dada',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    readingBadgeText: {
        fontFamily: typography.serifBold,
        fontSize: 26,
        color: colors.primary,
    },
    /* ── Dual badge for overlay/synastry ── */
    dualBadgeWrap: {
        flexDirection: 'row',
        marginRight: spacing.md,
        width: 62,
    },
    readingBadgeSmall: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    badgeRed: {
        backgroundColor: '#f8dada',
        zIndex: 2,
    },
    badgeGreen: {
        backgroundColor: '#d4edda',
        marginLeft: -10,
        zIndex: 1,
    },
    readingBadgeSmallText: {
        fontFamily: typography.serifBold,
        fontSize: 17,
        color: colors.primary,
    },
    readingBadgeSmallTextGreen: {
        fontFamily: typography.serifBold,
        fontSize: 17,
        color: '#28a745',
    },
    /* ── Image badges ── */
    badgeImageSingle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: spacing.md,
        backgroundColor: '#f8dada',
    },
    badgeImageLeft: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: '#f8dada',
        zIndex: 2,
    },
    badgeImageRight: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: '#d4edda',
        marginLeft: -10,
        zIndex: 1,
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
    jobDate: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.primary,
    },
    jobMeta: {
        marginTop: 2,
        fontFamily: typography.sansRegular,
        fontSize: 12,
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
