/**
 * PEOPLE LIST SCREEN
 * 
 * Shows all saved people (the user + partners/friends they've analyzed).
 * Tap a person to see their profile and all readings.
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore, Person, selectAllPeople } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { deletePersonFromSupabase } from '@/services/peopleService';
import { useEffect } from 'react';

type Props = NativeStackScreenProps<MainStackParamList, 'PeopleList'>;

export const PeopleListScreen = ({ navigation, route }: Props) => {
  const { mode = 'view', returnTo } = route.params || {};
  const people = useProfileStore(selectAllPeople);
  const deletePerson = useProfileStore((s) => s.deletePerson);
  const reset = useProfileStore((s) => s.reset);
  const authUser = useAuthStore((s) => s.user);
  const userPerson = people.find(p => p.isUser); // Find the user for combine option

  const handlePersonPress = (person: Person) => {
    if (mode === 'select' && returnTo) {
      if (person.isUser) {
        // If selecting self, just proceed to individual
        // @ts-ignore
        navigation.navigate(returnTo, { personId: person.id });
        return;
      }

      // If selecting another person, offer choice
      Alert.alert(
        `Reading for ${person.name}`,
        'Select the type of reading you want:',
        [
          {
            text: 'Extended Reading (All 5 Systems)',
            onPress: () => {
              // Navigate to SystemsOverview which handles extended reading with all 5 systems
              // @ts-ignore
              navigation.navigate('SystemsOverview', {
                personId: person.id,
                targetPersonName: person.name,
                forPartner: false,
              });
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      navigation.navigate('PersonProfile', { personId: person.id });
    }
  };

  const handleDeletePerson = (person: Person) => {
    Alert.alert(
      'Delete Person',
      `Are you sure you want to delete ${person.name} and all their readings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete locally
            deletePerson(person.id);
            
            // Delete from Supabase if user is authenticated
            if (authUser?.id) {
              const result = await deletePersonFromSupabase(authUser.id, person.id);
              if (result.success) {
                console.log(`✅ Deleted "${person.name}" from Supabase`);
              } else {
                console.warn(`⚠️ Failed to delete from Supabase: ${result.error}`);
              }
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all saved people and readings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: reset,
        },
      ]
    );
  };

  const formatPlacements = (placements: any) => {
    // Check if placements exists AND has actual sign data
    if (!placements || !placements.sunSign) {
      return 'Birth data saved (signs calculating...)';
    }
    const sun = placements.sunSign || '?';
    const moon = placements.moonSign || '?';
    const rising = placements.risingSign || '?';
    return `${sun} Sun | ${moon} Moon | ${rising} Rising`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { textAlign: 'center' }]} selectable>My Karmic Zoo</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]} selectable>
          {people.length === 0
            ? 'No people saved yet. Generate a reading to save profiles.'
            : `${people.length} ${people.length === 1 ? 'person' : 'people'} saved`}
        </Text>

        {people.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>♡</Text>
            <Text style={styles.emptyText} selectable>
              When you generate compatibility readings, people and their data will be saved here.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('PartnerInfo')}
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
                <View style={styles.personAvatar}>
                  <Text style={styles.personInitial}>
                    {person.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName} selectable>
                    {person.name}
                    {person.isUser && <Text style={styles.youBadge}> (You)</Text>}
                  </Text>
                  <Text style={styles.personMeta} selectable>
                    {formatPlacements(person.placements)}
                  </Text>
                  <Text style={styles.personReadings}>
                    {person.readings.length} {person.readings.length === 1 ? 'reading' : 'readings'} saved
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Add Another Person Button */}
            <TouchableOpacity
              style={styles.addPersonButton}
              onPress={() => navigation.navigate('PartnerInfo')}
            >
              <Text style={styles.addPersonIcon}>+</Text>
              <Text style={styles.addPersonText}>Add Another Person</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  clearText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.page,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    fontStyle: 'italic',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
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
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
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
    fontSize: 16,
    color: '#FFFFFF',
  },
  peopleList: {
    gap: spacing.sm,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  personAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personInitial: {
    fontFamily: typography.headline,
    fontSize: 24,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  personInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  personName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  youBadge: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
  },
  personMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  personReadings: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  chevron: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.mutedText,
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





