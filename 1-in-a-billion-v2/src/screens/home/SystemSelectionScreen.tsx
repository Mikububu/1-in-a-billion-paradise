import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';
import { useProfileStore } from '@/store/profileStore';
import { PRODUCTS } from '@/config/products';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemSelection'>;

const SYSTEMS: Array<{ id: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah'; label: string; icon: string }> = [
    { id: 'western', label: 'Western Astrology', icon: '☉' },
    { id: 'vedic', label: 'Vedic (Jyotish)', icon: 'ॐ' },
    { id: 'human_design', label: 'Human Design', icon: '◬' },
    { id: 'gene_keys', label: 'Gene Keys', icon: '❋' },
    { id: 'kabbalah', label: 'Kabbalah', icon: '✧' },
];

export const SystemSelectionScreen = ({ navigation, route }: Props) => {
    const {
        readingType = 'individual',
        forPartner,
        preselectedSystem,
        userName,
        partnerName,
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
        person1Override,
        person2Override,
        personId,
        targetPersonName,
    } = (route.params || {}) as any;

    const getPerson = useProfileStore((s) => s.getPerson);
    const getUser = useProfileStore((s) => s.getUser);

    const isOverlay = readingType === 'overlay';
    const title = isOverlay ? 'Choose Compatibility Systems' : 'Choose Reading Systems';
    const singlePrice = isOverlay ? PRODUCTS.compatibility_overlay.priceUSD : PRODUCTS.single_system.priceUSD;
    const bundlePrice = isOverlay ? PRODUCTS.nuclear_package.priceUSD : PRODUCTS.complete_reading.priceUSD;
    const bundleFullPrice = isOverlay ? PRODUCTS.nuclear_package.fullPriceUSD : PRODUCTS.complete_reading.fullPriceUSD;

    const navigateWithSystems = (chosenSystems: string[], isFullBundle: boolean) => {
        const self = getUser();
        const targetPerson = personId ? getPerson(personId) : null;

        const person1 = person1Override
            ? person1Override
            : forPartner && partnerName && partnerBirthDate && partnerBirthTime && partnerBirthCity
                ? {
                    name: partnerName,
                    birthDate: partnerBirthDate,
                    birthTime: partnerBirthTime,
                    birthPlace: partnerBirthCity.name,
                    timezone: partnerBirthCity.timezone,
                    latitude: partnerBirthCity.latitude,
                    longitude: partnerBirthCity.longitude,
                }
            : targetPerson
                ? {
                    id: targetPerson.id,
                    name: targetPerson.name,
                    birthDate: targetPerson.birthData?.birthDate,
                    birthTime: targetPerson.birthData?.birthTime,
                    birthPlace: targetPerson.birthData?.birthCity,
                    timezone: targetPerson.birthData?.timezone,
                    latitude: targetPerson.birthData?.latitude,
                    longitude: targetPerson.birthData?.longitude,
                    placements: targetPerson.placements,
                }
                : self
                    ? {
                        id: self.id,
                        name: self.name,
                        birthDate: self.birthData?.birthDate,
                        birthTime: self.birthData?.birthTime,
                        birthPlace: self.birthData?.birthCity,
                        timezone: self.birthData?.timezone,
                        latitude: self.birthData?.latitude,
                        longitude: self.birthData?.longitude,
                        placements: self.placements,
                    }
                    : null;

        const person2 = person2Override
            ? person2Override
            : isOverlay && partnerName && partnerBirthDate && partnerBirthTime && partnerBirthCity
                ? {
                    name: partnerName,
                    birthDate: partnerBirthDate,
                    birthTime: partnerBirthTime,
                    birthPlace: partnerBirthCity.name,
                    timezone: partnerBirthCity.timezone,
                    latitude: partnerBirthCity.latitude,
                    longitude: partnerBirthCity.longitude,
                }
                : null;

        if (!person1?.birthDate || !person1?.birthTime || !person1?.timezone) {
            Alert.alert('Missing birth data', 'Person 1 must have complete birth data.');
            return;
        }

        if (isOverlay && (!person2?.birthDate || !person2?.birthTime || !person2?.timezone)) {
            Alert.alert('Missing birth data', 'Person 2 must have complete birth data for compatibility readings.');
            return;
        }

        // Route through SystemExplainer for education + pricing before purchase
        navigation.navigate('SystemExplainer', {
            system: isFullBundle ? 'all' : chosenSystems[0],
            forPurchase: true,
            readingType: isOverlay ? 'overlay' : 'individual',
            forPartner,
            userName,
            partnerName,
            partnerBirthDate,
            partnerBirthTime,
            partnerBirthCity,
            person1Override: person1,
            person2Override: person2,
            personId,
            targetPersonName,
        } as any);
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{title}</Text>

                {SYSTEMS.map((system) => (
                    <TouchableOpacity
                        key={system.id}
                        style={styles.systemRow}
                        onPress={() => navigateWithSystems([system.id], false)}
                        activeOpacity={0.75}
                    >
                        <AnimatedSystemIcon icon={system.icon} size={26} />
                        <Text style={styles.systemLabel}>{system.label}</Text>
                        <Text style={styles.systemPrice}>${singlePrice}</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                ))}

                {/* ── ALL Systems + Final Verdict Bundle ── */}
                <TouchableOpacity
                    style={styles.bundleCard}
                    onPress={() => navigateWithSystems(SYSTEMS.map((s) => s.id), true)}
                    activeOpacity={0.75}
                >
                    <View style={styles.bundleBadge}>
                        <Text style={styles.bundleBadgeText}>★ BEST VALUE</Text>
                    </View>
                    <Text style={styles.bundleTitle}>All 5 Systems + Final Verdict</Text>
                    <Text style={styles.bundleDesc}>
                        16 in-depth readings across every system{'\n'}with a comprehensive final verdict
                    </Text>
                    <View style={styles.bundlePriceRow}>
                        <Text style={styles.bundleOldPrice}>${bundleFullPrice}</Text>
                        <Text style={styles.bundlePrice}>${bundlePrice}</Text>
                    </View>
                    <View style={styles.bundleStats}>
                        <Text style={styles.bundleStat}>☉ ॐ ◬ ❋ ✧</Text>
                    </View>
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
        height: 64,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.md,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 28,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    systemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        marginBottom: 8,
    },
    systemLabel: {
        flex: 1,
        marginLeft: spacing.sm,
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    systemPrice: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.primary,
        marginRight: spacing.xs,
    },
    chevron: {
        fontFamily: typography.sansRegular,
        fontSize: 22,
        color: colors.mutedText,
    },
    /* ── Bundle Card ── */
    bundleCard: {
        backgroundColor: colors.primary,
        borderRadius: radii.card,
        borderWidth: 1.5,
        borderColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingTop: 26,
        paddingBottom: 14,
        marginTop: 16,
        alignItems: 'center',
        position: 'relative' as const,
        overflow: 'hidden' as const,
    },
    bundleBadge: {
        position: 'absolute' as const,
        top: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderBottomLeftRadius: 10,
    },
    bundleBadgeText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 11,
        color: '#fff',
        letterSpacing: 0.5,
    },
    bundleTitle: {
        fontFamily: typography.serifBold,
        fontSize: 20,
        color: '#fff',
        textAlign: 'center',
    },
    bundleDesc: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 19,
    },
    bundlePriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.sm,
        gap: spacing.sm,
    },
    bundleOldPrice: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: 'rgba(255,255,255,0.55)',
        textDecorationLine: 'line-through',
    },
    bundlePrice: {
        fontFamily: typography.sansBold,
        fontSize: 22,
        color: '#fff',
    },
    bundleStats: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 6,
    },
    bundleStat: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: '#fff',
        letterSpacing: 5,
    },
});
