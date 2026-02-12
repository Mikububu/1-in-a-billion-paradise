import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { useProfileStore } from '@/store/profileStore';

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

    const [selectedSystems, setSelectedSystems] = useState<string[]>(
        preselectedSystem ? [preselectedSystem] : []
    );

    const getPerson = useProfileStore((s) => s.getPerson);
    const getUser = useProfileStore((s) => s.getUser);

    const isOverlay = readingType === 'overlay';
    const title = isOverlay ? 'Choose Compatibility Systems' : 'Choose Reading Systems';

    const toggleSystem = (id: string) => {
        setSelectedSystems((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            return [...prev, id];
        });
    };

    const canContinue = selectedSystems.length > 0;

    const summaryText = useMemo(
        () => selectedSystems.length === 0
            ? 'No system selected'
            : `${selectedSystems.length} selected: ${selectedSystems.join(', ')}`,
        [selectedSystems]
    );

    const handleContinue = () => {
        if (!canContinue) return;

        const self = getUser();
        const targetPerson = personId ? getPerson(personId) : null;

        const person1 = person1Override
            ? person1Override
            : targetPerson
                ? {
                    id: targetPerson.id,
                    name: targetPerson.name,
                    birthDate: targetPerson.birthData?.birthDate,
                    birthTime: targetPerson.birthData?.birthTime,
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

        const isBundle = selectedSystems.length > 1;
        const productType = isOverlay
            ? (isBundle ? 'nuclear_package' : 'compatibility_overlay')
            : (isBundle ? 'complete_reading' : 'single_system');
        const flowParams: any = {
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
            productType,
            systems: selectedSystems,
        };

        if (isOverlay) {
            navigation.navigate('RelationshipContext', flowParams);
        } else {
            navigation.navigate('PersonalContext', {
                ...flowParams,
                personName: person1.name || targetPersonName || userName || 'You',
            });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>Pick one or multiple systems.</Text>

                {SYSTEMS.map((system) => {
                    const selected = selectedSystems.includes(system.id);
                    return (
                        <TouchableOpacity
                            key={system.id}
                            style={[styles.systemRow, selected && styles.systemRowSelected]}
                            onPress={() => toggleSystem(system.id)}
                            activeOpacity={0.75}
                        >
                            <AnimatedSystemIcon icon={system.icon} size={26} />
                            <Text style={styles.systemLabel}>{system.label}</Text>
                            <Text style={[styles.checkmark, selected && styles.checkmarkSelected]}>
                                {selected ? '✓' : '○'}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryText}>{summaryText}</Text>
                </View>

                <Button
                    label="Continue"
                    onPress={handleContinue}
                    disabled={!canContinue}
                />
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
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    systemRowSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    systemLabel: {
        flex: 1,
        marginLeft: spacing.sm,
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    checkmark: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.mutedText,
    },
    checkmarkSelected: {
        color: colors.primary,
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    summaryText: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.text,
        textAlign: 'center',
    },
});
