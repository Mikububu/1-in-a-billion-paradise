import { useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Image, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { deletePersonFromSupabase } from '@/services/peopleService';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';

type Props = NativeStackScreenProps<MainStackParamList, 'ComparePeople'>;

export const ComparePeopleScreen = ({ navigation }: Props) => {
    const people = useProfileStore((s) => s.people);
    const deletePerson = useProfileStore((s) => s.deletePerson);
    const authUser = useAuthStore((s) => s.user);

    const candidates = useMemo(
        () => [...(people || [])].sort((a, b) => a.name.localeCompare(b.name)),
        [people]
    );

    const [personAId, setPersonAId] = useState<string | null>(null);
    const [personBId, setPersonBId] = useState<string | null>(null);
    const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string>('');

    const personA = useMemo(() => candidates.find((p) => p.id === personAId), [candidates, personAId]);
    const personB = useMemo(() => candidates.find((p) => p.id === personBId), [candidates, personBId]);

    const canContinue = Boolean(personA);

    const handlePick = useCallback((id: string) => {
        if (personAId === id) {
            setPersonAId(null);
            setPersonBId(null);
            return;
        }
        if (personBId === id) {
            setPersonBId(null);
            return;
        }
        if (!personAId) {
            setPersonAId(id);
            return;
        }
        if (!personBId) {
            setPersonBId(id);
            return;
        }
        setPersonAId(id);
        setPersonBId(null);
    }, [personAId, personBId]);

    const handleContinue = useCallback(() => {
        if (!personA) return;

        if (!personA.birthData?.birthDate || !personA.birthData?.birthTime || !personA.birthData?.timezone) {
            Alert.alert('Missing birth data', `Please complete ${personA.name}'s birth data first.`);
            navigation.navigate('EditBirthData', { personId: personA.id });
            return;
        }

        if (!personB) {
            navigation.navigate('SystemsOverview', {
                personId: personA.id,
                targetPersonName: personA.name,
                readingType: 'individual',
            });
            return;
        }

        if (!personB.birthData?.birthDate || !personB.birthData?.birthTime || !personB.birthData?.timezone) {
            Alert.alert('Missing birth data', `Please complete ${personB.name}'s birth data first.`);
            navigation.navigate('EditBirthData', { personId: personB.id });
            return;
        }

        navigation.navigate('SystemSelection', {
            readingType: 'overlay',
            forPartner: false,
            userName: personA.name,
            partnerName: personB.name,
            partnerBirthDate: personB.birthData.birthDate,
            partnerBirthTime: personB.birthData.birthTime,
            partnerBirthCity: {
                id: `city-${personB.id}`,
                name: personB.birthData.birthCity,
                country: '',
                latitude: personB.birthData.latitude,
                longitude: personB.birthData.longitude,
                timezone: personB.birthData.timezone,
            },
            person1Override: {
                id: personA.id,
                name: personA.name,
                birthDate: personA.birthData.birthDate,
                birthTime: personA.birthData.birthTime,
                timezone: personA.birthData.timezone,
                latitude: personA.birthData.latitude,
                longitude: personA.birthData.longitude,
                placements: personA.placements,
            },
            person2Override: {
                id: personB.id,
                name: personB.name,
                birthDate: personB.birthData.birthDate,
                birthTime: personB.birthData.birthTime,
                timezone: personB.birthData.timezone,
                latitude: personB.birthData.latitude,
                longitude: personB.birthData.longitude,
                placements: personB.placements,
            },
        } as any);
    }, [navigation, personA, personB]);

    const handleDeletePerson = useCallback((person: any) => {
        if (person.isUser) {
            Alert.alert('Cannot delete', 'You cannot delete your own profile.');
            return;
        }

        Alert.alert(
            'Delete person',
            `Delete ${person.name} and all local readings for this person?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (personAId === person.id) {
                            setPersonAId(null);
                            setPersonBId(null);
                        } else if (personBId === person.id) {
                            setPersonBId(null);
                        }

                        if (authUser?.id) {
                            await deletePersonFromSupabase(authUser.id, person.id);
                        }
                        deletePerson(person.id);
                    },
                },
            ]
        );
    }, [authUser?.id, deletePerson, personAId, personBId]);

    const handleAvatarPress = useCallback((person: any) => {
        if (person?.portraitUrl) {
            setPreviewImageUri(person.portraitUrl);
            setPreviewName(person.name || 'Portrait');
            return;
        }
        navigation.navigate('PersonPhotoUpload', { personId: person.id });
    }, [navigation]);

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.topSpacer} />

            <View style={styles.content}>
                <Text style={styles.title}>My Karmic Zoo</Text>
                <Text style={styles.subtitle}>Choose one or two people for deeper readings.</Text>
                <Text style={styles.helper}>Tap to select. Long press to delete.</Text>

                {candidates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No people yet</Text>
                        <Text style={styles.emptyText}>Add someone first to compare charts.</Text>
                        <Button
                            label="Add a Person"
                            variant="secondary"
                            fitContent
                            onPress={() => navigation.navigate('PartnerInfo', { mode: 'add_person_only', returnTo: 'ComparePeople' })}
                        />
                    </View>
                ) : (
                    <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.xl }}>
                        {candidates.map((p) => {
                            const isA = personAId === p.id;
                            const isB = personBId === p.id;
                            const hasPortrait = Boolean(p.portraitUrl);
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[styles.personCard, (isA || isB) && styles.personCardSelected]}
                                    onPress={() => handlePick(p.id)}
                                    onLongPress={() => handleDeletePerson(p)}
                                >
                                    <View style={styles.personRow}>
                                        <TouchableOpacity
                                            style={styles.avatarWrap}
                                            onPress={() => handleAvatarPress(p)}
                                            activeOpacity={0.75}
                                        >
                                            {hasPortrait ? (
                                                <Image source={{ uri: p.portraitUrl }} style={styles.avatarImage} />
                                            ) : (
                                                <View style={styles.avatarPlaceholder}>
                                                    <Text style={styles.avatarInitial}>{p.name.charAt(0).toUpperCase()}</Text>
                                                </View>
                                            )}
                                            {!hasPortrait ? <Text style={styles.avatarPlus}>+</Text> : null}
                                        </TouchableOpacity>

                                        <View style={styles.personInfo}>
                                            <Text style={styles.personName}>
                                                {p.name} {isA ? '• A' : ''}{isB ? '• B' : ''}
                                            </Text>
                                            <Text style={styles.personMeta}>
                                                {p.birthData?.birthDate || 'No birth date'} · {p.birthData?.birthTime || 'No birth time'}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                <Button label="Continue" onPress={handleContinue} disabled={!canContinue} />
            </View>

            <Modal
                visible={Boolean(previewImageUri)}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewImageUri(null)}
            >
                <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImageUri(null)}>
                    <View style={styles.previewCard}>
                        <Text style={styles.previewTitle}>{previewName}</Text>
                        {previewImageUri ? (
                            <Image source={{ uri: previewImageUri }} style={styles.previewImage} resizeMode="contain" />
                        ) : null}
                        <Text style={styles.previewHint}>Tap anywhere to close</Text>
                    </View>
                </Pressable>
            </Modal>
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
    content: {
        flex: 1,
        paddingHorizontal: spacing.page,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    helper: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.md,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
    },
    emptyTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.text,
    },
    emptyText: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
    },
    list: {
        flex: 1,
    },
    personCard: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    personCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    personName: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    personMeta: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 2,
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarWrap: {
        width: 56,
        height: 56,
        borderRadius: 12,
        marginRight: spacing.sm,
        position: 'relative',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontFamily: typography.sansBold,
        fontSize: 20,
        color: colors.primary,
    },
    avatarPlus: {
        position: 'absolute',
        right: 4,
        bottom: 2,
        fontFamily: typography.sansBold,
        fontSize: 14,
        color: colors.primary,
        backgroundColor: colors.surface,
        borderRadius: 999,
        width: 16,
        height: 16,
        textAlign: 'center',
        lineHeight: 15,
    },
    personInfo: {
        flex: 1,
    },
    previewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.page,
    },
    previewCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        alignItems: 'center',
    },
    previewTitle: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    previewImage: {
        width: '100%',
        height: 420,
        borderRadius: 14,
        backgroundColor: colors.background,
    },
    previewHint: {
        marginTop: spacing.sm,
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
});
