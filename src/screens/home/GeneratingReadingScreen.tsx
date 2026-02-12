import { useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { addJobToBuffer } from '@/services/jobBuffer';
import { useProfileStore, type ReadingSystem } from '@/store/profileStore';

type Props = NativeStackScreenProps<MainStackParamList, 'GeneratingReading'>;

export const GeneratingReadingScreen = ({ navigation, route }: Props) => {
    const {
        productType,
        productName,
        personName,
        partnerName,
        systems,
        readingType,
        jobId,
        personId,
        partnerId,
    } = route.params || {};

    const [activeJobId, setActiveJobId] = useState<string | null>(jobId || null);
    const [currentStep, setCurrentStep] = useState('Initializing...');
    const [generationComplete, setGenerationComplete] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [progressPercent, setProgressPercent] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const linkedJobsRef = useRef<Set<string>>(new Set());

    const linkJobToPerson = useProfileStore((s) => s.linkJobToPerson);
    const linkJobToPersonByName = useProfileStore((s) => s.linkJobToPersonByName);
    const createPlaceholderReadings = useProfileStore((s) => s.createPlaceholderReadings);
    const getReadingsByJobId = useProfileStore((s) => s.getReadingsByJobId);

    useEffect(() => {
        if (jobId) setActiveJobId(jobId);
    }, [jobId]);

    useEffect(() => {
        if (!activeJobId || linkedJobsRef.current.has(activeJobId)) {
            return;
        }

        const normalizedSystems = (Array.isArray(systems) ? systems : [])
            .filter((s): s is ReadingSystem =>
                s === 'western' ||
                s === 'vedic' ||
                s === 'human_design' ||
                s === 'gene_keys' ||
                s === 'kabbalah'
            );

        if (personId) {
            linkJobToPerson(personId, activeJobId);
            if (normalizedSystems.length > 0 && getReadingsByJobId(personId, activeJobId).length === 0) {
                createPlaceholderReadings(personId, activeJobId, normalizedSystems, new Date().toISOString());
            }
        } else if (personName) {
            linkJobToPersonByName(personName, activeJobId);
        }

        if (readingType === 'overlay' && partnerId) {
            linkJobToPerson(partnerId, activeJobId);
        } else if (readingType === 'overlay' && partnerName) {
            linkJobToPersonByName(partnerName, activeJobId);
        }

        addJobToBuffer({
            jobId: activeJobId,
            productType,
            productName,
            personName: personName || 'You',
            partnerName,
            readingType,
            createdAt: new Date().toISOString(),
        }).catch((error) => {
            console.warn('⚠️ Could not register job receipt', error);
        });

        linkedJobsRef.current.add(activeJobId);
    }, [
        activeJobId,
        createPlaceholderReadings,
        getReadingsByJobId,
        linkJobToPerson,
        linkJobToPersonByName,
        partnerName,
        partnerId,
        personName,
        productName,
        productType,
        personId,
        readingType,
        systems,
    ]);

    useEffect(() => {
        let cancelled = false;

        const tick = async () => {
            if (!activeJobId) return;
            try {
                const url = `${env.CORE_API_URL}/api/jobs/v2/${activeJobId}`;
                let accessToken: string | undefined;

                if (isSupabaseConfigured) {
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        accessToken = session?.access_token;
                    } catch {
                        // ignore
                    }
                }

                let resp = await fetch(url, {
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                });
                if (resp.status === 401 || resp.status === 403) {
                    resp = await fetch(url);
                }
                if (!resp.ok) {
                    const t = await resp.text().catch(() => '');
                    throw new Error(t || `Job fetch failed (${resp.status})`);
                }

                const data = await resp.json();
                const job = data?.job;
                if (!job) throw new Error('Invalid job response');
                if (cancelled) return;

                const status = String(job.status || '').toLowerCase();
                const total = job.progress?.totalTasks;
                const done = job.progress?.completedTasks;
                const pctRaw =
                    typeof job.progress?.percent === 'number'
                        ? job.progress.percent
                        : typeof total === 'number' && total > 0
                            ? (Number(done || 0) / total) * 100
                            : 0;
                const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));
                setProgressPercent(pct);
                setCurrentStep(job.progress?.message || `Status: ${status || 'unknown'}`);

                const isDone = status === 'complete' || status === 'completed';
                if (isDone) {
                    setGenerationComplete(true);
                    setCurrentStep('Complete - view it in My Library');
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                }
            } catch (e: any) {
                if (cancelled) return;
                setGenerationError(e?.message || 'Unknown error');
                setCurrentStep(`Error: ${e?.message || 'Unknown error'}`);
            }
        };

        if (!activeJobId) {
            setGenerationError('Missing jobId.');
            setCurrentStep('Missing job receipt. Please start the reading again.');
            return;
        }

        tick();
        intervalRef.current = setInterval(tick, 6000);

        return () => {
            cancelled = true;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [activeJobId]);

    const readingSubject = useMemo(() => {
        if (partnerName) return `${personName || 'You'} & ${partnerName}`;
        return personName || 'Your Reading';
    }, [partnerName, personName]);

    const progressWidth = `${progressPercent}%` as `${number}%`;
    const systemLabel = (systems || []).join(', ') || (productName || productType || 'Deep Reading');

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.productTitle}>The Soul Journey of</Text>
                <Text style={styles.subjectNames}>{readingSubject}</Text>
                <Text style={styles.systemSubheadline}>{systemLabel}</Text>

                <View style={styles.messageBox}>
                    <Text style={styles.messageTitle}>Deep Dive Readings Take Time</Text>
                    <Text style={styles.messageText}>
                        You can leave this screen. Your job keeps running in the background.
                    </Text>
                </View>

                <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: progressWidth }]} />
                    </View>
                    <Text style={styles.progressText}>{progressPercent}%</Text>
                </View>

                <View style={styles.statusCard}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={styles.statusText}>{currentStep}</Text>
                    <Text style={styles.jobIdText}>Job ID: {activeJobId || 'N/A'}</Text>
                    {generationError ? <Text style={styles.errorText}>{generationError}</Text> : null}
                </View>

                <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('MyLibrary')}>
                    <Text style={styles.libraryButtonText}>
                        {generationComplete ? 'Open My Library' : 'My Library (Generating in Background)'}
                    </Text>
                </TouchableOpacity>

                {activeJobId ? (
                    <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('JobDetail', { jobId: activeJobId })}>
                        <Text style={styles.libraryButtonText}>Open Live Job Status</Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('ComparePeople')}>
                    <Text style={styles.libraryButtonText}>My People's Zoo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.libraryButtonText}>My Secret Life Dashboard</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.videoContainer}>
                <Video
                    source={require('../../../assets/videos/plastilin_pingpong.mp4')}
                    style={styles.video}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingTop: 84,
        paddingBottom: spacing.xl,
    },
    productTitle: {
        fontFamily: typography.headline,
        fontSize: 28,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subjectNames: {
        fontFamily: typography.sansBold,
        fontSize: 18,
        color: colors.primary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    systemSubheadline: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    messageBox: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    messageTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    messageText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        lineHeight: 17,
    },
    progressWrap: {
        marginBottom: spacing.md,
    },
    progressTrack: {
        height: 8,
        backgroundColor: colors.surface,
        borderRadius: 999,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    progressFill: {
        height: 8,
        backgroundColor: colors.primary,
        borderRadius: 999,
    },
    progressText: {
        marginTop: spacing.xs,
        textAlign: 'center',
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.text,
    },
    statusCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    statusLabel: {
        fontFamily: typography.sansSemiBold,
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    statusText: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.text,
        marginTop: spacing.xs,
    },
    jobIdText: {
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
        marginTop: spacing.sm,
    },
    errorText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.error,
        marginTop: spacing.sm,
    },
    libraryButton: {
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        width: '100%',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: colors.text,
    },
    libraryButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
        textAlign: 'center',
    },
    videoContainer: {
        width: '100%',
        height: 140,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    video: {
        width: '100%',
        height: '100%',
    },
});
