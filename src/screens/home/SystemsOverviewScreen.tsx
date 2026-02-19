import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';

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

    const handleSystemPress = (system: SystemInfo) => {
        navigation.navigate('SystemExplainer', {
            system: system.id,
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
                <Text style={styles.subtitle}>Choose a lens for the next deep reading.</Text>
            </View>

            <View style={styles.list}>
                {SYSTEMS.map((system) => (
                    <TouchableOpacity
                        key={system.id}
                        style={styles.systemRow}
                        onPress={() => handleSystemPress(system)}
                        activeOpacity={0.75}
                    >
                        <AnimatedSystemIcon icon={system.icon} size={28} />
                        <View style={styles.systemInfo}>
                            <Text style={styles.systemName}>{system.name}</Text>
                            <Text style={styles.systemTagline}>{system.tagline}</Text>
                        </View>
                        <Text style={styles.arrow}>→</Text>
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

