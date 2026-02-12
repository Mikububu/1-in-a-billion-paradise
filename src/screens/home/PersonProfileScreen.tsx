import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { deletePersonFromSupabase } from '@/services/peopleService';
import { BackButton } from '@/components/BackButton';
import { colors, spacing, typography, radii } from '@/theme/tokens';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonProfile'>;

const SYSTEM_LABELS: Record<string, string> = {
    western: 'Western',
    vedic: 'Vedic',
    human_design: 'Human Design',
    gene_keys: 'Gene Keys',
    kabbalah: 'Kabbalah',
};

export const PersonProfileScreen = ({ navigation, route }: Props) => {
    const { personId } = route.params;
    const person = useProfileStore((s) => s.getPerson(personId));
    const user = useProfileStore((s) => s.getUser());
    const compatibilityReadings = useProfileStore((s) => s.compatibilityReadings);
    const deletePerson = useProfileStore((s) => s.deletePerson);
    const authUser = useAuthStore((s) => s.user);

    const readingsBySystem = useMemo(() => {
        const grouped = new Map<string, number>();
        for (const reading of person?.readings || []) {
            grouped.set(reading.system, (grouped.get(reading.system) || 0) + 1);
        }
        return Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
    }, [person?.readings]);

    const linkedJobIds = useMemo(() => {
        const fromPerson = person?.jobIds || [];
        const fromReadings = (person?.readings || [])
            .map((r) => r.jobId)
            .filter((value): value is string => Boolean(value));
        return Array.from(new Set([...fromPerson, ...fromReadings]));
    }, [person?.jobIds, person?.readings]);

    const compatibilityCount = useMemo(() => {
        if (!person) return 0;
        return compatibilityReadings.filter((r) => r.person1Id === person.id || r.person2Id === person.id).length;
    }, [compatibilityReadings, person]);

    const canOpenSynastry = useMemo(() => {
        if (!person || person.isUser) return false;
        if (!user?.birthData?.birthDate || !user?.birthData?.birthTime) return false;
        if (!person.birthData?.birthDate || !person.birthData?.birthTime) return false;
        return true;
    }, [person, user?.birthData]);

    const handleDeletePerson = () => {
        if (!person) return;
        if (person.isUser) {
            Alert.alert('Cannot delete', 'You cannot delete your own profile.');
            return;
        }

        Alert.alert(
            'Delete person',
            `Delete ${person.name} and related local readings?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (authUser?.id) {
                            const result = await deletePersonFromSupabase(authUser.id, person.id);
                            if (!result.success) {
                                Alert.alert('Delete failed', result.error || 'Could not delete person.');
                                return;
                            }
                        }
                        deletePerson(person.id);
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    if (!person) {
        return (
            <SafeAreaView style={styles.container}>
                <BackButton onPress={() => navigation.goBack()} />
                <View style={styles.notFoundWrap}>
                    <Text style={styles.notFoundTitle}>Person Not Found</Text>
                    <Text style={styles.notFoundText}>This profile no longer exists in local data.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{person.name}{person.isUser ? ' (You)' : ''}</Text>
                <Text style={styles.subtitle}>Profile, readings, and job history</Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Birth Data</Text>
                    <Text style={styles.cardMeta}>Date: {person.birthData?.birthDate || 'Not set'}</Text>
                    <Text style={styles.cardMeta}>Time: {person.birthData?.birthTime || 'Not set'}</Text>
                    <Text style={styles.cardMeta}>City: {person.birthData?.birthCity || 'Not set'}</Text>
                    <TouchableOpacity
                        style={styles.secondaryAction}
                        onPress={() => navigation.navigate('EditBirthData', { personId: person.id })}
                    >
                        <Text style={styles.secondaryActionText}>Edit Birth Data</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Core Placements</Text>
                    <Text style={styles.cardMeta}>Sun: {person.placements?.sunSign || '?'}</Text>
                    <Text style={styles.cardMeta}>Moon: {person.placements?.moonSign || '?'}</Text>
                    <Text style={styles.cardMeta}>Rising: {person.placements?.risingSign || '?'}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Readings Summary</Text>
                    <Text style={styles.cardMeta}>Individual readings: {person.readings.length}</Text>
                    <Text style={styles.cardMeta}>Compatibility readings: {compatibilityCount}</Text>
                    <Text style={styles.cardMeta}>Tracked jobs: {linkedJobIds.length}</Text>

                    {readingsBySystem.length > 0 ? (
                        <View style={styles.tagWrap}>
                            {readingsBySystem.map(([system, count]) => (
                                <View key={system} style={styles.tag}>
                                    <Text style={styles.tagText}>{SYSTEM_LABELS[system] || system} · {count}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.cardMeta}>No stored reading blocks yet.</Text>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() => navigation.navigate('PersonPhotoUpload', { personId: person.id })}
                >
                    <Text style={styles.primaryActionText}>Upload Portrait</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() =>
                        navigation.navigate('PersonReadings', {
                            personId: person.id,
                            personName: person.name,
                            personType: 'individual',
                        })
                    }
                >
                    <Text style={styles.primaryActionText}>Open Person Readings</Text>
                </TouchableOpacity>

                {!person.isUser ? (
                    <TouchableOpacity
                        style={styles.primaryAction}
                        onPress={() =>
                            navigation.navigate('SynastryOptions', {
                                partnerName: person.name,
                                partnerBirthDate: person.birthData?.birthDate,
                                partnerBirthTime: person.birthData?.birthTime,
                                partnerBirthCity: person.birthData
                                    ? {
                                        id: 'profile-city',
                                        name: person.birthData.birthCity,
                                        country: 'Unknown',
                                        timezone: person.birthData.timezone,
                                        latitude: person.birthData.latitude,
                                        longitude: person.birthData.longitude,
                                    }
                                    : undefined,
                            })
                        }
                    >
                        <Text style={styles.primaryActionText}>Generate Deep Readings</Text>
                    </TouchableOpacity>
                ) : null}

                {!person.isUser ? (
                    <TouchableOpacity
                        style={styles.primaryAction}
                        onPress={() => {
                            if (!canOpenSynastry) {
                                Alert.alert(
                                    'Birth time required',
                                    'Compatibility requires complete birth data (date + time) for both people.'
                                );
                                return;
                            }
                            navigation.navigate('SynastryPreview', {
                                partnerName: person.name,
                                partnerBirthDate: person.birthData.birthDate,
                                partnerBirthTime: person.birthData.birthTime,
                                partnerId: person.id,
                                partnerBirthCity: {
                                    id: 'profile-city',
                                    name: person.birthData.birthCity,
                                    country: 'Unknown',
                                    timezone: person.birthData.timezone,
                                    latitude: person.birthData.latitude,
                                    longitude: person.birthData.longitude,
                                },
                            } as any);
                        }}
                    >
                        <Text style={styles.primaryActionText}>Open Compatibility Preview</Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.dangerAction} onPress={handleDeletePerson}>
                    <Text style={styles.dangerActionText}>Delete Person</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryActionWide} onPress={() => navigation.navigate('PeopleList')}>
                    <Text style={styles.secondaryActionText}>Back To People List</Text>
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
    tagWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    tag: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
    },
    tagText: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.text,
    },
    primaryAction: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.text,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    primaryActionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.text,
    },
    secondaryAction: {
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 999,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    secondaryActionWide: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    secondaryActionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 13,
        color: colors.primary,
    },
    dangerAction: {
        borderWidth: 1,
        borderColor: colors.error,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    dangerActionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.error,
    },
    notFoundWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.page,
    },
    notFoundTitle: {
        fontFamily: typography.headline,
        fontSize: 28,
        color: colors.text,
    },
    notFoundText: {
        marginTop: spacing.sm,
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
    },
});
