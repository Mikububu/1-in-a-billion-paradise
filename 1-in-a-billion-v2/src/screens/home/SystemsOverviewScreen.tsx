import { useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Animated, Easing, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';
import { checkIncludedReadingEligible, fetchReadingQuota, type ReadingQuota } from '@/services/api';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { PRODUCTS } from '@/config/products';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemsOverview'>;

type SystemInfo = {
    id: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';
    icon: string;
};

const SYSTEMS_CONFIG: SystemInfo[] = [
    { id: 'western', icon: '☉' },
    { id: 'vedic', icon: 'ॐ' },
    { id: 'human_design', icon: '◬' },
    { id: 'gene_keys', icon: '❋' },
    { id: 'kabbalah', icon: '✧' },
];

// Helper to get system name and tagline using t()
const getSystemName = (id: SystemInfo['id']) => {
    switch (id) {
        case 'western': return t('systemsOverview.western');
        case 'vedic': return t('systemsOverview.vedic');
        case 'human_design': return t('systemsOverview.humanDesign');
        case 'gene_keys': return t('systemsOverview.geneKeys');
        case 'kabbalah': return t('systemsOverview.kabbalah');
    }
};

const getSystemTagline = (id: SystemInfo['id']) => {
    switch (id) {
        case 'western': return t('systemsOverview.westernTagline');
        case 'vedic': return t('systemsOverview.vedicTagline');
        case 'human_design': return t('systemsOverview.humanDesignTagline');
        case 'gene_keys': return t('systemsOverview.geneKeysTagline');
        case 'kabbalah': return t('systemsOverview.kabbalahTagline');
    }
};

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
    const isOverlay = actualReadingType === 'overlay';
    const singlePrice = isOverlay ? PRODUCTS.compatibility_overlay.priceUSD : PRODUCTS.single_system.priceUSD;
    const bundlePrice = isOverlay ? PRODUCTS.nuclear_package.priceUSD : PRODUCTS.complete_reading.priceUSD;
    const bundleFullPrice = isOverlay ? PRODUCTS.nuclear_package.fullPriceUSD : PRODUCTS.complete_reading.fullPriceUSD;

    // ── Reading quota state ──
    const [freeReadingEligible, setFreeReadingEligible] = useState(false);
    const [quota, setQuota] = useState<ReadingQuota | null>(null);
    const pulseAnim = useRef(new Animated.Value(0.4)).current;

    const getUser = useProfileStore((s) => s.getUser);
    const getPerson = useProfileStore((s) => s.getPerson);
    const user = useAuthStore((s) => s.user);
    const unlimitedReadings = useAuthStore((s) => s.unlimitedReadings);

    // Check eligibility and quota on mount
    useEffect(() => {
        let cancelled = false;
        // Billionaire tier always eligible — skip the network call
        if (unlimitedReadings) {
            setFreeReadingEligible(true);
            return;
        }
        fetchReadingQuota().then((q) => {
            if (cancelled) return;
            setQuota(q);
            setFreeReadingEligible(q?.canStartReading ?? false);
        });
        return () => { cancelled = true; };
    }, [unlimitedReadings]);

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
        // Check quota for synastry (needs 3 slots)
        if (freeReadingEligible && actualReadingType === 'overlay' && quota && !quota.canStartSynastry) {
            Alert.alert(
                t('systemsOverview.notEnoughSlots'),
                t('systemsOverview.slotsMessage', { remaining: quota.remaining }),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('systemsOverview.buyReading'),
                        onPress: () => navigateToExplainer(system.id),
                    },
                ]
            );
            return;
        }
        if (freeReadingEligible) {
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
                t('systemsOverview.uploadPhotoFirst'),
                t('systemsOverview.uploadPhotoMessage'),
                [
                    {
                        text: t('systemsOverview.uploadPhoto'),
                        onPress: () => {
                            navigation.navigate('PersonPhotoUpload', { personId: targetPerson.id });
                        },
                    },
                    {
                        text: t('systemsOverview.skip'),
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
        if (unlimitedReadings) {
            // Billionaire — no confirmation needed, go straight to reading
            navigateToExplainer(system.id, true);
            return;
        }

        Alert.alert(
            t('systemsOverview.claimFree'),
            t('systemsOverview.claimMessage', { system: getSystemName(system.id) }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('systemsOverview.claim'),
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
            forPurchase: !unlimitedReadings, // Billionaire skips purchase flow
            readingType: actualReadingType,
            forPartner,
            partnerName,
            partnerBirthDate,
            partnerBirthTime,
            partnerBirthCity,
            personId,
            targetPersonName,
            useIncludedReading: unlimitedReadings, // Billionaire uses included reading flag
        });
    };

    const title = targetPersonName
        ? t('systemsOverview.exploreTarget', { name: targetPersonName })
        : (forPartner ? t('systemsOverview.explorePartner', { name: partnerName || 'Partner' }) : t('systemsOverview.exploreMyself'));

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                    {freeReadingEligible
                        ? quota
                            ? t('systemsOverview.readingsLeft', { remaining: quota.remaining, limit: quota.monthlyLimit })
                            : t('systemsOverview.pickAny')
                        : t('systemsOverview.chooseLens')}
                </Text>
            </View>

            <View style={styles.list}>
                {SYSTEMS_CONFIG.map((system) => (
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
                            <Text style={styles.systemName}>{getSystemName(system.id)}</Text>
                            <Text style={styles.systemTagline}>{getSystemTagline(system.id)}</Text>
                        </View>

                        {freeReadingEligible ? (
                            <Animated.View style={[styles.freeBadge, { opacity: pulseAnim }]}>
                                <Text style={styles.freeBadgeText}>{quota ? quota.remaining + ' ' + t('systemsOverview.left') : t('systemsOverview.free')}</Text>
                            </Animated.View>
                        ) : (
                            <View style={styles.priceGroup}>
                                <Text style={styles.systemPrice}>${singlePrice}</Text>
                                <Text style={styles.arrow}>→</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.bestChoiceCard} onPress={handleComplete} activeOpacity={0.75}>
                    <View style={styles.bestCardRow}>
                        <View style={styles.bestCardLeft}>
                            <Text style={styles.bestBadge}>{t('systemsOverview.bestChoice')}</Text>
                            <Text style={styles.bestTitle}>{t('systemsOverview.allSystems')}</Text>
                            <Text style={styles.bestSubtitle}>{t('systemsOverview.completeBundle')}</Text>
                        </View>
                        {!freeReadingEligible && (
                            <View style={styles.bundlePriceRight}>
                                <Text style={styles.bundleOldPrice}>${bundleFullPrice}</Text>
                                <Text style={styles.bundlePrice}>${bundlePrice}</Text>
                            </View>
                        )}
                    </View>
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
    priceGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    systemPrice: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.primary,
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
    bestCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bestCardLeft: {
        flex: 1,
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
        overflow: 'hidden',
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
    bundlePriceRight: {
        alignItems: 'flex-end',
        marginLeft: spacing.md,
    },
    bundleOldPrice: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textDecorationLine: 'line-through' as const,
    },
    bundlePrice: {
        fontFamily: typography.sansBold,
        fontSize: 22,
        color: '#fff',
    },
});
