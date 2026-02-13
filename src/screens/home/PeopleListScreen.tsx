import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import type { Person } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { deletePersonFromSupabase } from '@/services/peopleService';
import { colors, spacing, typography } from '@/theme/tokens';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'PeopleList'>;

export const PeopleListScreen = ({ navigation }: Props) => {
    const people = useProfileStore((s) => s.people);
    const deletePerson = useProfileStore((s) => s.deletePerson);
    const reset = useProfileStore((s) => s.reset);
    const authUser = useAuthStore((s) => s.user);

    const handlePersonPress = (person: Person) => {
        navigation.navigate('PersonProfile', { personId: person.id });
    };

    const handleDeletePerson = (person: Person) => {
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
                            await deletePersonFromSupabase(authUser.id, person.id);
                        }
                        deletePerson(person.id);
                    },
                },
            ]
        );
    };

    const handleClearAll = () => {
        Alert.alert(
            'Clear all data',
            'This deletes local people, readings, audios, and PDFs from the device.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: reset },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleClearAll}>
                    <Text style={styles.clearText}>Clear All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.title}>My Karmic Zoo</Text>
                <Text style={styles.subtitle}>
                    {people.length === 0
                        ? 'No people saved yet.'
                        : `${people.length} ${people.length === 1 ? 'person' : 'people'} saved`}
                </Text>

                {people.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>♡</Text>
                        <Text style={styles.emptyText}>
                            Add people in the partner flow to build your relationship library.
                        </Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => navigation.navigate('PartnerInfo', { mode: 'add_person_only' })}
                        >
                            <Text style={styles.addButtonText}>Add Someone New</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.peopleList}>
                        {people.map((person) => (
                            <TouchableOpacity
                                key={person.id}
                                style={styles.personCard}
                                onPress={() => handlePersonPress(person)}
                                onLongPress={() => handleDeletePerson(person)}
                            >
                                <View style={styles.avatar}>
                                    <Text style={styles.initial}>{person.name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={styles.info}>
                                    <Text style={styles.name}>
                                        {person.name}{person.isUser ? ' (You)' : ''}
                                    </Text>
                                    <Text style={styles.meta}>
                                        {person.placements?.sunSign || '?'} Sun | {person.placements?.moonSign || '?'} Moon | {person.placements?.risingSign || '?'} Rising
                                    </Text>
                                    <Text style={styles.readingCount}>
                                        {person.readings.length} {person.readings.length === 1 ? 'reading' : 'readings'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={styles.addPersonButton}
                            onPress={() => navigation.navigate('PartnerInfo', { mode: 'add_person_only' })}
                        >
                            <Text style={styles.addPersonIcon}>+</Text>
                            <Text style={styles.addPersonText}>Add Another Person</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    headerActions: {
        marginTop: 72,
        paddingHorizontal: spacing.page,
        alignItems: 'flex-end',
    },
    clearText: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.primary,
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
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyText: {
        fontFamily: typography.sansRegular,
        fontSize: 15,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 22,
    },
    addButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        borderRadius: 999,
        marginTop: spacing.xl,
    },
    addButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: '#FFFFFF',
    },
    peopleList: {
        gap: spacing.sm,
    },
    personCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: spacing.md,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initial: {
        fontFamily: typography.sansBold,
        fontSize: 20,
        color: '#FFFFFF',
    },
    info: {
        flex: 1,
        marginLeft: spacing.md,
    },
    name: {
        fontFamily: typography.sansSemiBold,
        fontSize: 17,
        color: colors.text,
    },
    meta: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
        marginTop: 2,
    },
    readingCount: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    addPersonButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 999,
        borderStyle: 'dashed',
    },
    addPersonIcon: {
        fontFamily: typography.sansBold,
        fontSize: 20,
        color: colors.primary,
        marginRight: spacing.xs,
    },
    addPersonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 15,
        color: colors.primary,
    },
});
