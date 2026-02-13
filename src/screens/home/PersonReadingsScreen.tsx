import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';
import { fetchJobSnapshot, type JobSnapshot } from '@/services/jobStatus';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonReadings'>;

type ReadingJob = {
    jobId: string;
    timestamp: number;
    systems: string[];
    readingCount: number;
};

const toEpoch = (value?: string) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const PersonReadingsScreen = ({ navigation, route }: Props) => {
    const { personId, personName, personType, jobId } = route.params;
    const people = useProfileStore((s) => s.people);

    const person = useMemo(() => {
        if (personId) {
            const byId = people.find((p) => p.id === personId);
            if (byId) return byId;
        }
        return people.find((p) => p.name === personName);
    }, [people, personId, personName]);

    const jobs = useMemo<ReadingJob[]>(() => {
        if (!person) return [];
        const readings = person.readings || [];
        const byJob = new Map<string, ReadingJob>();

        for (const reading of readings) {
            if (!reading.jobId) continue;
            const current = byJob.get(reading.jobId) || {
                jobId: reading.jobId,
                timestamp: 0,
                systems: [],
                readingCount: 0,
            };
            current.readingCount += 1;
            if (reading.system && !current.systems.includes(reading.system)) current.systems.push(reading.system);
            current.timestamp = Math.max(
                current.timestamp,
                toEpoch(reading.generatedAt),
                toEpoch(reading.createdAt)
            );
            byJob.set(reading.jobId, current);
        }

        for (const linkedId of person.jobIds || []) {
            if (!byJob.has(linkedId)) {
                byJob.set(linkedId, {
                    jobId: linkedId,
                    timestamp: toEpoch(person.updatedAt) || toEpoch(person.createdAt),
                    systems: [],
                    readingCount: 0,
                });
            }
        }

        if (jobId && !byJob.has(jobId)) {
            byJob.set(jobId, {
                jobId,
                timestamp: Date.now(),
                systems: [],
                readingCount: 0,
            });
        }

        return Array.from(byJob.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [person, jobId]);

    const [isLoading, setIsLoading] = useState(false);
    const [snapshotByJobId, setSnapshotByJobId] = useState<Record<string, JobSnapshot>>({});

    useEffect(() => {
        let cancelled = false;

        const poll = async () => {
            if (jobs.length === 0) {
                if (!cancelled) {
                    setSnapshotByJobId({});
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);
            const targets = jobs.slice(0, 12);
            const results = await Promise.all(
                targets.map(async (j) => [j.jobId, await fetchJobSnapshot(j.jobId)] as const)
            );
            if (cancelled) return;

            const next: Record<string, JobSnapshot> = {};
            for (const [key, snapshot] of results) {
                if (snapshot) next[key] = snapshot;
            }
            setSnapshotByJobId(next);
            setIsLoading(false);
        };

        poll();
        const timer = setInterval(poll, 15000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [jobs]);

    const readingCount = person?.readings.length || 0;

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{person?.name || personName}</Text>
                <Text style={styles.subtitle}>Reading receipts and generation status</Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Snapshot</Text>
                    <Text style={styles.cardMeta}>Person type: {personType}</Text>
                    <Text style={styles.cardMeta}>Stored readings: {readingCount}</Text>
                    <Text style={styles.cardMeta}>Tracked jobs: {jobs.length}</Text>
                </View>

                {isLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingText}>Refreshing jobs...</Text>
                    </View>
                ) : null}

                {jobs.length === 0 ? (
                    <View style={styles.card}>
                        <Text style={styles.emptyTitle}>No Jobs Yet</Text>
                        <Text style={styles.cardMeta}>
                            This person has no tracked job receipts yet. Start a new reading flow to generate one.
                        </Text>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() =>
                                navigation.navigate('SystemsOverview', {
                                    personId: person?.id,
                                    targetPersonName: person?.name || personName,
                                    readingType: 'individual',
                                    forPartner: !!person && !person.isUser,
                                    partnerName: person && !person.isUser ? person.name : undefined,
                                    partnerBirthDate: person && !person.isUser ? person.birthData?.birthDate : undefined,
                                    partnerBirthTime: person && !person.isUser ? person.birthData?.birthTime : undefined,
                                    partnerBirthCity:
                                        person && !person.isUser
                                            ? {
                                                id: 'person-readings',
                                                name: person.birthData?.birthCity || '',
                                                country: 'Unknown',
                                                timezone: person.birthData?.timezone || '',
                                                latitude: person.birthData?.latitude || 0,
                                                longitude: person.birthData?.longitude || 0,
                                            }
                                            : undefined,
                                } as any)
                            }
                        >
                            <Text style={styles.actionText}>Start New Reading</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.jobsWrap}>
                        {jobs.map((readingJob) => {
                            const snapshot = snapshotByJobId[readingJob.jobId];
                            const status = snapshot
                                ? `${snapshot.status.toUpperCase()} · ${snapshot.percent}%`
                                : 'Status unavailable';
                            const isComplete = String(snapshot?.status || '').toLowerCase() === 'complete' || String(snapshot?.status || '').toLowerCase() === 'completed';
                            const systems =
                                readingJob.systems.length > 0 ? readingJob.systems.join(', ') : 'Systems pending';
                            const updatedAt = snapshot?.updatedAt || (readingJob.timestamp ? new Date(readingJob.timestamp).toISOString() : '');

                            return (
                                <TouchableOpacity
                                    key={readingJob.jobId}
                                    style={styles.jobCard}
                                    onPress={() =>
                                        navigation.navigate(isComplete ? 'ReadingContent' : 'JobDetail', {
                                            jobId: readingJob.jobId,
                                        })
                                    }
                                >
                                    <Text style={styles.jobTitle} numberOfLines={1}>Job {readingJob.jobId}</Text>
                                    <Text style={styles.jobMeta} numberOfLines={1}>{systems}</Text>
                                    <Text style={styles.jobMeta}>{status}</Text>
                                    {snapshot?.message ? <Text style={styles.jobMeta} numberOfLines={1}>{snapshot.message}</Text> : null}
                                    <Text style={styles.jobMeta}>{isComplete ? 'Open Reading' : 'Open Status'}</Text>
                                    {updatedAt ? (
                                        <Text style={styles.jobTimestamp}>
                                            Updated {new Date(updatedAt).toLocaleString()}
                                        </Text>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                        const targetPersonId = person?.id || personId;
                        if (targetPersonId) {
                            navigation.navigate('PersonProfile', { personId: targetPersonId });
                            return;
                        }
                        navigation.navigate('PeopleList');
                    }}
                >
                    <Text style={styles.actionText}>Back To Profile</Text>
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
        textAlign: 'center',
        fontFamily: typography.headline,
        fontSize: 34,
        color: colors.text,
    },
    subtitle: {
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
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
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: spacing.xs,
    },
    cardMeta: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 2,
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
    jobsWrap: {
        gap: spacing.sm,
    },
    jobCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
    },
    jobTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.text,
    },
    jobMeta: {
        marginTop: 3,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    jobTimestamp: {
        marginTop: spacing.xs,
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
    },
    actionButton: {
        marginTop: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.text,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    actionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.text,
    },
    emptyTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.xs,
    },
});
