import { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';
import { initiatePurchaseFlow } from '@/utils/purchaseFlow';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemExplainer'>;

type SystemType = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah' | 'all';
const ALL_SYSTEMS = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'] as const;

const CONTENT: Record<SystemType, {
    icon: string;
    name: string;
    tagline: string;
    intro: string;
    bullets: string[];
}> = {
    western: {
        icon: '☉',
        name: 'Western Astrology',
        tagline: 'Psychological map of your inner pattern',
        intro: 'Western astrology frames your identity, emotional needs, and relational patterns through chart geometry.',
        bullets: [
            'Core motivations and identity pattern',
            'Emotional wiring and attachment style',
            'Key relationship tensions and growth edges',
        ],
    },
    vedic: {
        icon: 'ॐ',
        name: 'Jyotish (Vedic)',
        tagline: 'Karmic timing and life chapters',
        intro: 'Vedic astrology focuses on karmic momentum and timing windows, especially for relationship and purpose.',
        bullets: [
            'Current life chapter and timing cycle',
            'Karmic themes repeating in relationships',
            'Best timing windows for major moves',
        ],
    },
    human_design: {
        icon: '◬',
        name: 'Human Design',
        tagline: 'Energetic decision architecture',
        intro: 'Human Design explains how your energy system works and how to make aligned decisions.',
        bullets: [
            'Decision authority and strategy',
            'Where energy is stable vs open',
            'Relational friction and alignment points',
        ],
    },
    gene_keys: {
        icon: '❋',
        name: 'Gene Keys',
        tagline: 'Shadow to gift transformation path',
        intro: 'Gene Keys maps emotional and behavioral patterns into a contemplative growth path.',
        bullets: [
            'Recurring shadow pattern',
            'Gift layer hidden in the same pattern',
            'Practical reframing for daily use',
        ],
    },
    kabbalah: {
        icon: '✧',
        name: 'Kabbalah',
        tagline: 'Soul correction and meaning structure',
        intro: 'Kabbalah frames your development as a soul-correction path, highlighting meaning and responsibility.',
        bullets: [
            'Core soul-correction theme',
            'Where growth keeps repeating',
            'How to turn friction into purpose',
        ],
    },
    all: {
        icon: '★',
        name: 'All 5 Systems',
        tagline: 'Unified, full-spectrum reading',
        intro: 'Combines all five systems into one integrated view to avoid blind spots from any single model.',
        bullets: [
            'Cross-system pattern validation',
            'Contradiction resolution between models',
            'One integrated action map',
        ],
    },
};

export const SystemExplainerScreen = ({ navigation, route }: Props) => {
    const {
        system = 'western',
        forPurchase = true,
        readingType,
        forPartner,
        partnerName,
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
        userName,
        person1Override,
        person2Override,
        personId,
        targetPersonName,
    } = (route.params || {}) as any;

    const content = useMemo(
        () => CONTENT[(system as SystemType) || 'western'] || CONTENT.western,
        [system]
    );

    const handleContinue = () => {
        const resolvedReadingType = readingType === 'overlay' ? 'overlay' : 'individual';
        const isBundle = system === 'all';
        const systems = isBundle ? [...ALL_SYSTEMS] : [system];
        const productType = resolvedReadingType === 'overlay'
            ? (isBundle ? 'nuclear_package' : 'compatibility_overlay')
            : (isBundle ? 'complete_reading' : 'single_system');

        if (!forPurchase) {
            navigation.navigate('SystemSelection', {
                readingType: resolvedReadingType,
                forPartner,
                partnerName,
                partnerBirthDate,
                partnerBirthTime,
                partnerBirthCity,
                userName,
                person1Override,
                person2Override,
                personId,
                targetPersonName,
                preselectedSystem: system === 'all' ? undefined : system,
            } as any);
            return;
        }

        initiatePurchaseFlow({
            navigation,
            productType,
            readingType: resolvedReadingType,
            systems,
            personName: targetPersonName || userName || partnerName || 'You',
            userName,
            partnerName,
            partnerBirthDate,
            partnerBirthTime,
            partnerBirthCity,
            person1Override,
            person2Override,
            personId,
            targetPersonName,
            forPartner,
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.icon}>{content.icon}</Text>
                <Text style={styles.title}>{content.name}</Text>
                <Text style={styles.tagline}>{content.tagline}</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionText}>{content.intro}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What You Get</Text>
                    {content.bullets.map((item) => (
                        <View key={item} style={styles.bulletRow}>
                            <Text style={styles.bulletDot}>•</Text>
                            <Text style={styles.bulletText}>{item}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.8}>
                    <Text style={styles.ctaTitle}>Continue</Text>
                    <Text style={styles.ctaSubtitle}>Add context, choose speaker, then Tree of Life</Text>
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
    icon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 30,
        color: colors.text,
        textAlign: 'center',
    },
    tagline: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    section: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sectionText: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.text,
        lineHeight: 22,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.xs,
    },
    bulletDot: {
        fontFamily: typography.sansBold,
        color: colors.primary,
        marginRight: spacing.xs,
    },
    bulletText: {
        flex: 1,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    cta: {
        backgroundColor: colors.primary,
        borderRadius: radii.card,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
    },
    ctaTitle: {
        fontFamily: typography.sansBold,
        fontSize: 18,
        color: colors.background,
    },
    ctaSubtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.background,
        opacity: 0.92,
        marginTop: spacing.xs,
    },
});
