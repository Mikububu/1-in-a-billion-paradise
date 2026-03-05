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
import { addJobToBuffer } from '@/services/jobBuffer';
import { useProfileStore, type ReadingSystem } from '@/store/profileStore';
import { fetchJobSnapshot } from '@/services/jobStatus';
import { t, getSystemDisplayName } from '@/i18n';

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
    const [currentStep, setCurrentStep] = useState(t('generatingReading.status.initializing'));
    const [generationComplete, setGenerationComplete] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [progressPercent, setProgressPercent] = useState(0);
    const [libraryLineIndex, setLibraryLineIndex] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const linkedJobsRef = useRef<Set<string>>(new Set());

    const linkJobToPerson = useProfileStore((s) => s.linkJobToPerson);
    const linkJobToPersonByName = useProfileStore((s) => s.linkJobToPersonByName);
    const createPlaceholderReadings = useProfileStore((s) => s.createPlaceholderReadings);
    const getReadingsByJobId = useProfileStore((s) => s.getReadingsByJobId);

    useEffect(() => {
        if (jobId) setActiveJobId(jobId);
    }, [jobId]);

    // Alternate library button text every 3s while generating
    useEffect(() => {
        if (generationComplete) return;
        const id = setInterval(() => setLibraryLineIndex((i) => (i + 1) % 2), 3000);
        return () => clearInterval(id);
    }, [generationComplete]);

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

        const now = new Date().toISOString();
        const isOverlay = readingType === 'overlay';

        if (isOverlay && personId && normalizedSystems.length > 0) {
            // Backend assigns docNums in interleaved pattern per system:
            //   system[0]: person1=1, person2=2, overlay=3
            //   system[1]: person1=4, person2=5, overlay=6
            //   ...
            //   verdict = numSystems * 3 + 1
            const numSys = normalizedSystems.length;
            const p1DocNums = normalizedSystems.map((_, i) => i * 3 + 1);   // [1, 4, 7, 10, 13]
            const p2DocNums = normalizedSystems.map((_, i) => i * 3 + 2);   // [2, 5, 8, 11, 14]
            const overlayDocNums = normalizedSystems.map((_, i) => i * 3 + 3); // [3, 6, 9, 12, 15]

            // Person1 individual
            linkJobToPerson(personId, activeJobId);
            if (getReadingsByJobId(personId, activeJobId).length === 0) {
                createPlaceholderReadings(personId, activeJobId, normalizedSystems, now, 'individual', undefined, p1DocNums);
            }

            // Person2 individual
            if (partnerId) {
                linkJobToPerson(partnerId, activeJobId);
                if (getReadingsByJobId(partnerId, activeJobId).length === 0) {
                    createPlaceholderReadings(partnerId, activeJobId, normalizedSystems, now, 'individual', undefined, p2DocNums);
                }
            } else if (partnerName) {
                linkJobToPersonByName(partnerName, activeJobId);
            }

            // Overlay reading (stored under person1, same jobId, with overlay type)
            const existingPerson1Readings = getReadingsByJobId(personId, activeJobId);
            const hasOverlayPlaceholders = existingPerson1Readings.some((r: any) => r.readingType === 'overlay');
            if (!hasOverlayPlaceholders) {
                createPlaceholderReadings(personId, activeJobId, normalizedSystems, now, 'overlay', partnerName || 'Partner', overlayDocNums);
            }

            // Final Verdict (last reading - only for bundle_verdict / nuclear jobs)
            if (productType === 'nuclear_package' || productType === 'bundle_verdict') {
                const refreshedReadings = getReadingsByJobId(personId, activeJobId);
                const hasVerdictPlaceholder = refreshedReadings.some((r: any) => r.readingType === 'verdict');
                if (!hasVerdictPlaceholder) {
                    const addReading = useProfileStore.getState().addReading;
                    addReading(personId, {
                        system: 'western' as any,
                        content: '',
                        generatedAt: now,
                        jobId: activeJobId,
                        docNum: numSys * 3 + 1, // 16 for 5 systems
                        createdAt: now,
                        note: 'Processing...',
                        readingType: 'verdict',
                        partnerName: partnerName || 'Partner',
                    });
                }
            }
        } else if (personId) {
            linkJobToPerson(personId, activeJobId);
            if (normalizedSystems.length > 0 && getReadingsByJobId(personId, activeJobId).length === 0) {
                createPlaceholderReadings(personId, activeJobId, normalizedSystems, now, 'individual');
            }
        } else if (personName) {
            linkJobToPersonByName(personName, activeJobId);
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
                const snapshot = await fetchJobSnapshot(activeJobId);
                if (!snapshot) throw new Error('Job fetch failed');
                if (cancelled) return;

                const status = String(snapshot.status || '').toLowerCase();
                setProgressPercent(snapshot.percent);
                setCurrentStep(snapshot.message || `Status: ${status || 'unknown'}`);

                const isDone = status === 'complete' || status === 'completed';
                if (isDone) {
                    setGenerationComplete(true);
                    setCurrentStep(t('generatingReading.status.complete'));
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
            setGenerationError(t('generatingReading.error.missingJobId'));
            setCurrentStep(t('generatingReading.error.missingJobMessage'));
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
    const systemLabel = (systems || []).map(s => getSystemDisplayName(s)).join(', ') || (productName || productType || 'Deep Reading');

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.productTitle}>{t('generatingReading.title.prefix')}</Text>
                <Text style={styles.subjectNames}>{readingSubject}</Text>
                <Text style={styles.systemSubheadline}>{systemLabel}</Text>

                <View style={styles.messageBox}>
                    <Text style={styles.messageTitle}>{t('generatingReading.message.title')}</Text>
                    <Text style={styles.messageText}>
                        {t('generatingReading.message.text')}
                    </Text>
                </View>

                <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: progressWidth }]} />
                    </View>
                    <Text style={styles.progressText}>{progressPercent}%</Text>
                </View>

                <View style={styles.statusCard}>
                    <Text style={styles.statusLabel}>{t('generatingReading.status.label')}</Text>
                    <Text style={styles.statusText}>{currentStep}</Text>
                    <Text style={styles.jobIdText}>Job ID: {activeJobId || 'N/A'}</Text>
                    {generationError ? <Text style={styles.errorText}>{generationError}</Text> : null}
                </View>

                <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('MyLibrary')}>
                    <Text style={styles.libraryButtonText}>
                        {generationComplete ? t('generatingReading.button.openLibrary') : (libraryLineIndex === 0 ? t('generatingReading.button.libraryLine1') : t('generatingReading.button.libraryLine2'))}
                    </Text>
                    <Text style={styles.buttonDesc}>{t('generatingReading.button.library.desc')}</Text>
                </TouchableOpacity>

                {activeJobId ? (
                    <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('JobDetail', { jobId: activeJobId })}>
                        <Text style={styles.libraryButtonText}>{t('generatingReading.button.jobStatus')}</Text>
                        <Text style={styles.buttonDesc}>{t('generatingReading.button.jobStatus.desc')}</Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('ComparePeople')}>
                    <Text style={styles.libraryButtonText}>{t('generatingReading.button.peopleList')}</Text>
                    <Text style={styles.buttonDesc}>{t('generatingReading.button.peopleList.desc')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.libraryButton} onPress={() => navigation.navigate('Home')}>
                    <Text style={styles.libraryButtonText}>{t('generatingReading.button.dashboard')}</Text>
                    <Text style={styles.buttonDesc}>{t('generatingReading.button.dashboard.desc')}</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Video removed - screen uses textured background only */}
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
        paddingVertical: 10,
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
    buttonDesc: {
        fontFamily: typography.sans,
        fontSize: 12,
        color: '#999',
        marginTop: 1,
        letterSpacing: 0.2,
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
