import { useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography } from '@/theme/tokens';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { describeIntensity } from '@/utils/intensity';
import { SimpleSlider } from '@/components/SimpleSlider';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'YourChart'>;

export const YourChartScreen = ({ navigation }: Props) => {
    const insets = useSafeAreaInsets();

    const onboardingBirthDate = useOnboardingStore((s) => s.birthDate);
    const onboardingBirthTime = useOnboardingStore((s) => s.birthTime);
    const onboardingBirthCity = useOnboardingStore((s) => s.birthCity);
    const hookReadings = useOnboardingStore((s) => s.hookReadings);
    const relationshipPreferenceScale = useOnboardingStore((s) => s.relationshipPreferenceScale);
    const setRelationshipPreferenceScale = useOnboardingStore((s) => s.setRelationshipPreferenceScale);
    const descriptor = describeIntensity(relationshipPreferenceScale);
    const lastValue = useRef(relationshipPreferenceScale);

    const user = useProfileStore((s) => s.getUser());
    const userName = user?.name || 'You';

    const birthDate = user?.birthData?.birthDate?.trim() ? user.birthData.birthDate : onboardingBirthDate;
    const birthTime = user?.birthData?.birthTime?.trim() ? user.birthData.birthTime : onboardingBirthTime;
    const birthCity = user?.birthData?.birthCity?.trim()
        ? user.birthData.birthCity
        : (onboardingBirthCity?.name || 'Location unknown');

    const corePlacements = {
        sun: user?.placements?.sunSign || hookReadings.sun?.sign || '?',
        moon: user?.placements?.moonSign || hookReadings.moon?.sign || '?',
        rising: user?.placements?.risingSign || hookReadings.rising?.sign || '?',
    };

    const handleValueChange = (nextValue: number) => {
        const rounded = Math.round(nextValue);
        if (rounded !== lastValue.current) {
            Haptics.selectionAsync();
            lastValue.current = rounded;
        }
        setRelationshipPreferenceScale(rounded);
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: spacing.xl * 2 + insets.bottom + spacing.lg },
                ]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{userName}'s Chart</Text>

                <View style={styles.birthCard}>
                    <Text style={styles.birthLabel}>Born</Text>
                    <Text style={styles.birthDate}>{birthDate || 'Not set'}</Text>
                    <Text style={styles.birthMeta}>{birthTime || 'Time unknown'} in {birthCity}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>The Big Three</Text>
                    <View style={styles.coreRow}>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreIcon}>☉</Text>
                            <Text style={styles.coreLabel}>Sun</Text>
                            <Text style={styles.coreSign}>{corePlacements.sun}</Text>
                        </View>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreIcon}>☽</Text>
                            <Text style={styles.coreLabel}>Moon</Text>
                            <Text style={styles.coreSign}>{corePlacements.moon}</Text>
                        </View>
                        <View style={styles.coreCard}>
                            <Text style={styles.coreIcon}>↑</Text>
                            <Text style={styles.coreLabel}>Rising</Text>
                            <Text style={styles.coreSign}>{corePlacements.rising}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Safe ↔ Spicy</Text>
                    <View style={styles.sliderCard}>
                        <View style={styles.legend}>
                            <Text style={styles.legendLabel}>Safe</Text>
                            <Text style={styles.legendLabel}>Spicy</Text>
                        </View>
                        <SimpleSlider
                            minimumValue={0}
                            maximumValue={10}
                            value={relationshipPreferenceScale}
                            onValueChange={handleValueChange}
                        />
                        <Text style={styles.caption}>{descriptor.caption}</Text>
                    </View>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.action}
                        onPress={() => navigation.navigate('EditBirthData', { personId: user?.id })}
                    >
                        <Text style={styles.actionText}>Edit Birth Data</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.action}
                        onPress={() => navigation.navigate('PeopleList')}
                    >
                        <Text style={styles.actionText}>View All Saved People</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.xl * 2,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
        marginTop: 72,
        marginBottom: spacing.lg,
    },
    birthCard: {
        backgroundColor: colors.primarySoft,
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    birthLabel: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    birthDate: {
        fontFamily: typography.headline,
        fontSize: 24,
        color: colors.text,
        marginTop: 4,
    },
    birthMeta: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        marginTop: 4,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    coreRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    coreCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    coreIcon: {
        fontSize: 22,
        color: colors.text,
    },
    coreLabel: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    coreSign: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.text,
        marginTop: 4,
    },
    sliderCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    legendLabel: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    caption: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.text,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    actions: {
        gap: spacing.sm,
    },
    action: {
        backgroundColor: colors.surface,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    actionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.text,
    },
});
