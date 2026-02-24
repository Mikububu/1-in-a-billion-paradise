import { useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Animated, Easing, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';
import { checkIncludedReadingEligible } from '@/services/api';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemsOverview'>;

type SystemInfo = {
    id: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';
    name: string;
    icon: string;
    tagline: string;
};

const SYSTEMS: SystemInfo[] = [
    { id: 'western', name: 'Western Astrology', icon: '☉', tagline: 'Psychological map' },
    { id: 'vedic', name: 'Jyotish (Vedic)', icon: 'ॐ', tagline: 'Karmic timing' },
    { id: 'human_design', name: 'Human Design', icon: '◬', tagline: 'Energy strategy' },
    { id: 'gene_keys', name: 'Gene Keys', icon: '❋', tagline: 'Shadow to gift' },
    { id: 'kabbalah', name: 'Kabbalah', icon: '✧', tagline: 'Soul correction' },
];

export const SystemsOverviewScreen = ({ navigation, route }: Props) => {
    const {
        forPartner,
        partnerName,
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
        personId,
        targetPersonName,
        readingType,
    } = route.params || {};

    const actualReadingType = readingType || (forPartner ? 'overlay' : 'individual');

    // ── Free included reading state ──
    const [freeReadingEligible, setFreeReadingEligible] = useState(false);
    const pulseAnim = useRef(new Animated.Value(0.4)).current;

    const getUser = useProfileStore((s) => s.getUser);
    const getPerson = useProfileStore((s) => s.getPerson);
    const user = useAuthStore((s) => s.user);

    // Check eligibility on mount
    useEffect(() => {
        let cancelled = false;
        checkIncludedReadingEligible().then((eligible) => {
            if (!cancelled) setFreeReadingEligible(eligible);
        });
        return () => { cancelled = true; };
    }, []);

    // Pulsing animation for FREE badge
    useEffect(() => {
        if (!freeReadingEligible) return;
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [freeReadingEligible, pulseAnim]);

    // ── Handlers ──

    const handleSystemPress = (system: SystemInfo) => {
        if (freeReadingEligible && actualReadingType === 'individual') {
            handleFreeReadingClaim(system);
        } else {
            navigateToExplainer(system.id);
        }
    };

    const handleFreeReadingClaim = (system: SystemInfo) => {
        // Check if user has uploaded a photo
        const self = getUser();
        const targetPerson = personId ? getPerson(personId) : self;
        const hasPhoto = !!(targetPerson?.portraitUrl || targetPerson?.originalPhotoUrl);

        if (!hasPhoto && targetPerson) {
            Alert.alert(
                'Upload a photo first?',
                'Your reading includes a personalized AI portrait. Upload a photo for the best experience.',
                [
                    {
                        text: 'Upload Photo',
                        onPress: () => {
                            navigation.navigate('PersonPhotoUpload', { personId: targetPerson.id });
                        },
                    },
                    {
                        text: 'Skip',
                        style: 'cancel',
                        onPress: () => showFreeReadingConfirmation(system),
                    },
                ]
            );
        } else {
            showFreeReadingConfirmation(system);
        }
    };

    const showFreeReadingConfirmation = (system: SystemInfo) => {
        Alert.alert(
            'Claim your free reading',
            `Your subscription includes one free personal reading. Claim "${system.name}" now?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Claim',
                    onPress: () => {
                        // Navigate into the normal flow with useIncludedReading flag
                        navigateToExplainer(system.id, true);
                    },
                },
            ]
        );
    };

    const navigateToExplainer = (systemId: SystemInfo['id'] | 'all', useIncludedReading: boolean = false) => {
        navigation.navigate('SystemExplainer', {
            system: systemId,
            forPurchase: true,
            readingType: actualReadingType,
            forPartner,
            partnerName,
            partnerBirthDate,
            partnerBirthTime,
            partnerBirthCity,
            personId,
            targetPersonName,
            useIncludedReading,
        });
    };

    const handleComplete = () => {
        navigation.navigate('SystemExplainer', {
            system: 'all',
            forPurchase: true,
            readingType: actualReadingType,
            forPartner,
            partnerName,
            partnerBirthDate,
            partnerBirthTime,
            partnerBirthCity,
            personId,
            targetPersonName,
        });
    };

    const title = targetPersonName
        ? `Explore ${targetPersonName}`
        : (forPartner ? `Explore ${partnerName || 'Partner'}` : 'Explore Myself');

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                    {freeReadingEligible
                        ? 'Pick any system — one free reading is included!'
                        : 'Choose a lens for the next deep reading.'}
                </Text>
            </View>

            <View style={styles.list}>
                {SYSTEMS.map((system) => (
                    <TouchableOpacity
                        key={system.id}
                        style={[
                            styles.systemRow,
                            freeReadingEligible && styles.systemRowFreeHighlight,
                        ]}
                        onPress={() => handleSystemPress(system)}
                        activeOpacity={0.75}
                    >
                        <AnimatedSystemIcon icon={system.icon} size={28} />
                        <View style={styles.systemInfo}>
                            <Text style={styles.systemName}>{system.name}</Text>
                            <Text style={styles.systemTagline}>{system.tagline}</Text>
                        </View>

                        {freeReadingEligible ? (
                            <Animated.View style={[styles.freeBadge, { opacity: pulseAnim }]}>
                                <Text style={styles.freeBadgeText}>FREE</Text>
                            </Animated.View>
                        ) : (
                            <Text style={styles.arrow}>→</Text>
                        )}
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.bestChoiceCard} onPress={handleComplete} activeOpacity={0.75}>
                    <Text style={styles.bestBadge}>★ BEST CHOICE</Text>
                    <Text style={styles.bestTitle}>All 5 Systems</Text>
                    <Text style={styles.bestSubtitle}>Complete reading bundle</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        paddingHorizontal: spacing.page,
    },
    topSpacer: {
        height: 72,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    list: {
        flex: 1,
        gap: spacing.sm,
    },
    systemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    systemRowFreeHighlight: {
        borderColor: colors.primary,
        borderWidth: 1.5,
    },
    systemInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    systemName: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    systemTagline: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.primary,
        marginTop: 2,
    },
    arrow: {
        fontFamily: typography.sansBold,
        fontSize: 18,
        color: colors.primary,
    },
    freeBadge: {
        backgroundColor: colors.primary,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    freeBadgeText: {
        fontFamily: typography.sansBold,
        fontSize: 11,
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    bestChoiceCard: {
        backgroundColor: colors.primary,
        borderRadius: radii.card,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    bestBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.background,
        borderRadius: 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        fontFamily: typography.sansBold,
        fontSize: 10,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    bestTitle: {
        fontFamily: typography.sansBold,
        fontSize: 18,
        color: colors.background,
    },
    bestSubtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.background,
        opacity: 0.9,
        marginTop: 2,
    },
});
