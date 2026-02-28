import { useMemo, useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Image, Modal, Pressable, Animated } from 'react-native';
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

    const badgeBlinkAnim = useMemo(() => new Animated.Value(0.4), []);
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(badgeBlinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(badgeBlinkAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    }, [badgeBlinkAnim]);

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

                            // Example astrology logic for background colors based on gender
                            // If neither, fallback to a neutral color
                            const isMale = p.gender === 'male';
                            const isFemale = p.gender === 'female';
                            const fallbackBg = '#E5E7EB';

                            // Let's make females slightly warmer, males slightly cooler
                            const avatarBgColor = hasPortrait ? 'transparent' : (isFemale ? '#FDF2F8' : isMale ? '#EFF6FF' : fallbackBg);
                            const avatarTextColor = isFemale ? '#DB2777' : isMale ? '#2563EB' : '#4B5563';

                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[styles.row, (isA || isB) && styles.rowSelected]}
                                    onPress={() => handlePick(p.id)}
                                    onLongPress={() => handleDeletePerson(p)}
                                >
                                    <TouchableOpacity
                                        style={styles.avatarContainer}
                                        onPress={() => handleAvatarPress(p)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.avatar, { backgroundColor: avatarBgColor }]}>
                                            {hasPortrait ? (
                                                <Image source={{ uri: p.portraitUrl }} style={styles.avatarImage} />
                                            ) : (
                                                <Text style={[styles.avatarText, { color: avatarTextColor }]}>
                                                    {p.name.charAt(0).toUpperCase()}
                                                </Text>
                                            )}
                                        </View>
                                        {!hasPortrait && (
                                            <Animated.View style={[styles.cameraIconHint, { opacity: badgeBlinkAnim }]}>
                                                <Text style={styles.cameraIcon}>+</Text>
                                            </Animated.View>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.personInfo}>
                                        <Text style={styles.rowName}>{p.name}</Text>
                                        <Text style={styles.rowMeta} numberOfLines={1}>
                                            {p.birthData?.birthDate || 'No birth date'} · {p.birthData?.birthTime || 'No birth time'}
                                        </Text>
                                        {p.birthData?.birthCity && (
                                            <Text style={styles.rowMeta} numberOfLines={1}>{p.birthData.birthCity}</Text>
                                        )}
                                        <View style={styles.rowSigns}>
                                            <Text style={styles.rowSignBadge}>☉ {p.placements?.sunSign || '…'}</Text>
                                            <Text style={styles.rowSignBadge}>☽ {p.placements?.moonSign || '…'}</Text>
                                            <Text style={styles.rowSignBadge}>↑ {p.placements?.risingSign || '…'}</Text>
                                        </View>
                                    </View>

                                    {isA && (
                                        <View style={[styles.pickChip, styles.pickChipA]}>
                                            <Text style={styles.pickChipText}>A</Text>
                                        </View>
                                    )}
                                    {isB && (
                                        <View style={[styles.pickChip, styles.pickChipB]}>
                                            <Text style={styles.pickChipText}>B</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        <TouchableOpacity
                            style={styles.addPersonRow}
                            onPress={() => navigation.navigate('PartnerInfo', { mode: 'add_person_only', returnTo: 'ComparePeople' })}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.avatar, styles.addPersonAvatar]}>
                                <Text style={styles.addPersonIcon}>+</Text>
                            </View>
                            <Text style={styles.addPersonText}>Add another person</Text>
                        </TouchableOpacity>
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
    boldSubheadline: {
        fontFamily: typography.sansBold,
        fontSize: 14,
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
        lineHeight: 20,
    },
    helper: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'center',
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
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    rowSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.surface,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: spacing.md,
        marginTop: 2,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontFamily: typography.headline,
        fontSize: 22,
    },
    cameraIconHint: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
    },
    cameraIcon: {
        fontSize: 18,
        fontWeight: '300',
        color: '#FFFFFF',
        marginTop: -2,
    },
    rowName: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    rowMeta: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 2,
    },
    rowSigns: {
        flexDirection: 'row',
        marginTop: spacing.xs,
        gap: spacing.xs,
    },
    rowSignBadge: {
        fontFamily: typography.sansRegular,
        fontSize: 11,
        color: colors.mutedText,
        backgroundColor: colors.background,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 8,
    },
    pickChip: {
        minWidth: 34,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.md,
        paddingHorizontal: spacing.sm,
        marginTop: 2,
    },
    pickChipA: { backgroundColor: colors.primary },
    pickChipB: { backgroundColor: colors.text },
    pickChipText: {
        fontFamily: typography.sansBold,
        fontSize: 13,
        color: '#FFFFFF'
    },
    addPersonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: radii.card,
        padding: spacing.md,
        marginTop: spacing.sm,
        borderStyle: 'dashed',
    },
    addPersonAvatar: {
        backgroundColor: colors.primarySoft,
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPersonIcon: {
        fontFamily: typography.sansBold,
        fontSize: 28,
        color: colors.primary,
        lineHeight: 28,
        marginTop: -2,
    },
    addPersonText: {
        fontFamily: typography.sansMedium,
        fontSize: 16,
        color: colors.primary,
        marginLeft: spacing.md,
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
