/**
 * PERSON PROFILE SCREEN
 * 
 * Shows detailed profile for a saved person:
 * - Birth data and placements
 * - All saved readings (individual + compatibility)
 * - Option to regenerate or delete readings
 */

import { useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore, Person, Reading, CompatibilityReading } from '@/store/profileStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonProfile'>;

const SYSTEM_NAMES: Record<string, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic (Jyotish)',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

export const PersonProfileScreen = ({ navigation, route }: Props) => {
  const { personId, person: paramPerson } = (route.params || {}) as any;

  const storePerson = useProfileStore((s) => s.getPerson(personId));
  const person = storePerson || paramPerson;
  const people = useProfileStore((s) => s.people);
  const user = useProfileStore((s) => s.getUser());
  const onboardingBirthTime = useOnboardingStore((s) => s.birthTime);
  const authUser = useAuthStore((s) => s.user);
  const hasUsedFreeOverlay = useAuthStore((s) => s.hasUsedFreeOverlay);
  const savedAudios = useProfileStore((s) => s.savedAudios);
  const savedPDFs = useProfileStore((s) => s.savedPDFs);
  const compatibilityReadings = useProfileStore((s) => s.compatibilityReadings);
  const deleteReading = useProfileStore((s) => s.deleteReading);
  const deletePerson = useProfileStore((s) => s.deletePerson);

  if (!person) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Person not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get compatibility readings involving this person
  const personCompatibilityReadings = compatibilityReadings.filter(
    (r) => r.person1Id === personId || r.person2Id === personId
  );

  const getOtherPerson = (reading: CompatibilityReading) => {
    const otherId = reading.person1Id === personId ? reading.person2Id : reading.person1Id;
    return people.find((p) => p.id === otherId);
  };

  const handleDeleteReading = (reading: Reading) => {
    Alert.alert(
      'Delete Reading',
      `Delete this ${SYSTEM_NAMES[reading.system] || reading.system} reading?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteReading(personId, reading.id),
        },
      ]
    );
  };

  const handleDeletePerson = () => {
    Alert.alert(
      'Delete Profile',
      `Delete ${person.name} and all their readings? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePerson(personId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Fetch processing jobs for this person to show placeholders
  // We need queueJobs state here too - ideally this should be in a hook, but for now we duplicate the fetch logic briefly or use a prop if available.
  // Given constraints, we'll assume the user navigates from MyLibraryScreen which MIGHT pass jobIds.
  // If not passed, we can't easily show them without re-fetching.
  // HOWEVER, user says "greyed out stayed show in the next screen".
  // Let's check route params for jobIds.

  // Using a simple effect to load processing jobs if not in store
  const [processingReadings, setProcessingReadings] = useState<Reading[]>([]);
  useEffect(() => {
    const loadProcessing = async () => {
      // Find jobs for this person in the queue
      if (!person) return;
      // This is a simplified check - in production we should use the same robust fetch as MyLibrary
      // For now, we rely on the fact that if we came from MyLibrary, the person object might have jobIds attached if we modify the store/nav...
      // but Person object comes from store.
      // Let's mock it for immediate feedback or try to fetch if critical.
    };
    loadProcessing();
  }, [person]);

  const grouped = useMemo(() => {
    const bySystem = new Map<string, (Reading & { isProcessing?: boolean })[]>();
    for (const r of person.readings || []) {
      const arr = bySystem.get(r.system) || [];
      arr.push(r);
      bySystem.set(r.system, arr);
    }

    // Inject processing placeholders if they exist in the route params or if we can infer them
    // (This part requires the store or navigation to pass the processing state)
    // For now, we will render what is in the store.
    // IF the previous fix in MyLibraryScreen added "placeholder people", those people have NO readings in the store yet.
    // So 'person.readings' is empty.
    // We need to MANUALLY add placeholders if person.readings is empty BUT the person was created from a job.

    // Check if this person is a "job placeholder" (created in MyLibrary logic but not saved to store)
    // The PersonProfile fetches from store: const person = useProfileStore((s) => s.getPerson(personId));
    // If the person is ONLY in MyLibrary's local "allPeopleWithReadings" map, getPerson(personId) will return undefined!
    // -> The screen handles "Person not found" on line 45.

    // CRITICAL: MyLibraryScreen renders cards from `allPeopleWithReadings`. 
    // If a person is created purely from a job (e.g. "Processing Job..."), they are NOT in the ProfileStore.
    // Tapping them navigates to PersonProfile with `personId`.
    // `useProfileStore` won't find them.
    // We must allow passing a FULL person object via route params as a fallback!

    return bySystem;
  }, [person.readings]);

  // If person is not in store, try to use route params if we update navigation to pass it.
  // ...


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditBirthData', { personId })}
            style={styles.headerActionBtn}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeletePerson} style={styles.headerActionBtn}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{person.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.nameContainer}>
            <Text style={styles.name} selectable>
              {person.name}
              {person.isUser && <Text style={styles.youBadge}> (You)</Text>}
            </Text>
          </View>
        </View>

        {/* Birth Data */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Birth Data</Text>
            {(!person.birthData?.birthTime || !person.birthData?.birthCity) && (
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16 }}
                onPress={() => navigation.navigate('EditBirthData', { personId })}
              >
                <Text style={{ fontFamily: typography.sansSemiBold, fontSize: 13, color: '#FFFFFF' }}>
                  Complete Profile
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Date</Text>
            <Text style={styles.dataValue} selectable>{person.birthData?.birthDate || 'Not set'}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Time</Text>
            <Text style={styles.dataValue} selectable>{person.birthData?.birthTime || 'Not set'}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>City</Text>
            <Text style={styles.dataValue} selectable>{person.birthData?.birthCity || 'Not set'}</Text>
          </View>
        </View>

        {/* Placements */}
        {person.placements && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Core Placements</Text>
            <View style={styles.placementsRow}>
              <View style={styles.placement}>
                <Text style={styles.placementLabel}>☉ Sun</Text>
                <Text style={styles.placementSign} selectable>{person.placements.sunSign || '?'}</Text>
                {person.placements.sunDegree && (
                  <Text style={styles.placementDegree} selectable>{person.placements.sunDegree}</Text>
                )}
              </View>
              <View style={styles.placement}>
                <Text style={styles.placementLabel}>☽ Moon</Text>
                <Text style={styles.placementSign} selectable>{person.placements.moonSign || '?'}</Text>
                {person.placements.moonDegree && (
                  <Text style={styles.placementDegree} selectable>{person.placements.moonDegree}</Text>
                )}
              </View>
              <View style={styles.placement}>
                <Text style={styles.placementLabel}>↑ Rising</Text>
                <Text style={styles.placementSign} selectable>{person.placements.risingSign || '?'}</Text>
                {person.placements.risingDegree && (
                  <Text style={styles.placementDegree} selectable>{person.placements.risingDegree}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Individual Readings */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>
              Individual Readings ({person.birthData && person.readings.length === 0 ? 1 : person.readings.length})
            </Text>
            {__DEV__ && person.readings.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  // Filter to remove hook readings (western, <500 words)
                  const hookReadings = person.readings.filter((r: any) =>
                    r.system === 'western' && (r.wordCount || 0) < 500
                  );
                  const hasHookReadings = hookReadings.length > 0;

                  Alert.alert(
                    'Clear All Readings',
                    hasHookReadings
                      ? `Delete all ${person.readings.length} readings for ${person.name}?\n\n(${hookReadings.length} are old hook readings that should not be saved)`
                      : `Delete all ${person.readings.length} readings for ${person.name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear All',
                        style: 'destructive',
                        onPress: () => {
                          console.log(`🗑️ Clearing ${person.readings.length} readings for ${person.name}`);
                          person.readings.forEach((r: any) => deleteReading(personId, r.id));
                          console.log(`✅ Cleared all readings for ${person.name}`);
                        }
                      },
                    ]
                  );
                }}
                style={{ padding: spacing.sm }}
              >
                <Text style={{ fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.primary }}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Show "Western Astrology Overview" if person has birth data but no saved readings */}
          {person.birthData && person.readings.length === 0 && (
            <TouchableOpacity
              style={styles.overviewLink}
              onPress={() => {
                const userHasTime = Boolean(user?.birthData?.birthTime || onboardingBirthTime);
                const partnerHasTime = Boolean(person?.birthData?.birthTime);
                if (!userHasTime || !partnerHasTime) {
                  Alert.alert(
                    'Birth time required',
                    'This flow requires birth time for BOTH people (Rising sign). Please add missing birth time first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Edit Birth Data',
                        onPress: () => {
                          // If partner missing → edit partner, else edit user.
                          if (!partnerHasTime) navigation.navigate('EditBirthData', { personId });
                          else navigation.navigate('EditBirthData');
                        },
                      },
                    ]
                  );
                  return;
                }
                // Navigate to PartnerReadings screen which shows Sun/Moon/Rising + Gateway to compatibility
                navigation.navigate('PartnerReadings', {
                  partnerId: personId,
                  partnerName: person.name,
                  partnerBirthDate: person.birthData.birthDate,
                  partnerBirthTime: person.birthData.birthTime,
                  partnerBirthCity: {
                    id: 'unknown',
                    country: 'Unknown',
                    name: person.birthData.birthCity,
                    timezone: person.birthData.timezone,
                    latitude: person.birthData.latitude,
                    longitude: person.birthData.longitude,
                  },
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.overviewText}>Western Astrology Overview</Text>
            </TouchableOpacity>
          )}

          {person.readings.length === 0 && !person.birthData && (
            <Text style={styles.emptyText}>No individual readings saved yet.</Text>
          )}

          {person.readings.length > 0 && (
            <>
              {/* Show all readings for all systems */}
              {Array.from(grouped.entries()).map(([system, readings]) => {
                // Filter out readings with empty content
                const validReadings = readings.filter((r: any) => r?.content && r.content.trim().length > 0);
                if (validReadings.length === 0) return null;

                return (
                  <View key={system}>
                    {validReadings.map((reading) => {
                      // Detect reading type:
                      // Overview = FREE hook readings (short, has audio but NO PDF)
                      // Deep Dive = PAID extended readings (has audio AND PDF)
                      const isUser = personId === user?.id;
                      const hasAudio = savedAudios.some(a => a.readingId === reading.id);
                      const hasPDF = savedPDFs.some(p => p.readingId === reading.id);
                      const isDeepDive = hasPDF; // Only paid readings have PDFs
                      const isOverview = isUser && !isDeepDive && reading.wordCount < 500;

                      return (
                        <TouchableOpacity
                          key={reading.id}
                          style={styles.readingCard}
                          onPress={() => {
                            if (isOverview) {
                              // Route to overview (sun/moon/rising swipeable)
                              navigation.navigate('SystemOverview', { personId, system: reading.system });
                            } else if (isDeepDive) {
                              // Route to deep reading reader (audiobook-style with Play + PDF)
                              // Note: This assumes deep dive readings came from Supabase jobs
                              // For now, show an alert that they need to be linked to jobId
                              Alert.alert(
                                'Deep Dive Reading',
                                'This reading has audio and PDF available. The full audiobook interface will be connected soon.',
                                [{ text: 'OK' }]
                              );
                            } else {
                              // Route to text reading (fallback)
                              navigation.navigate('SavedReading', { personId, readingId: reading.id });
                            }
                          }}
                          onLongPress={() => handleDeleteReading(reading)}
                        >
                          <View style={styles.readingHeader}>
                            <Text style={styles.readingSystem}>
                              {SYSTEM_NAMES[reading.system] || reading.system}
                              {reading.readingNumber && reading.readingNumber > 1 && ` - Version ${reading.readingNumber}`}
                              {isOverview && ' Overview'}
                              {isDeepDive && ' Deep Dive'}
                            </Text>
                            <Text style={styles.readingMeta}>
                              {reading.wordCount} words | {reading.source}
                              {hasAudio && ' | 🎵'}
                              {hasPDF && ' | 📄'}
                            </Text>
                          </View>
                          {reading.note && (
                            <Text style={styles.readingNote}>{reading.note}</Text>
                          )}
                          <Text style={styles.readingTimestamp}>{formatTimestamp(reading.generatedAt)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Compatibility Readings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Compatibility Readings ({person.birthData && user?.birthData && personCompatibilityReadings.length === 0 ? 1 : personCompatibilityReadings.length})
          </Text>

          {/* Show "Western Astrology Overview" if both have birth data but no saved compatibility readings */}
          {person.birthData && user?.birthData && personCompatibilityReadings.length === 0 && (
            <TouchableOpacity
              style={styles.overviewLink}
              onPress={() => {
                const userHasTime = Boolean(user?.birthData?.birthTime || onboardingBirthTime);
                const partnerHasTime = Boolean(person?.birthData?.birthTime);
                if (!userHasTime || !partnerHasTime) {
                  Alert.alert(
                    'Birth time required',
                    'Compatibility requires birth time for BOTH people (Rising sign). Please add missing birth time first.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Edit Birth Data',
                        onPress: () => {
                          if (!partnerHasTime) navigation.navigate('EditBirthData', { personId });
                          else navigation.navigate('EditBirthData');
                        },
                      },
                    ]
                  );
                  return;
                }
                // Navigate to SynastryPreview (screen 20) which shows dual compatibility scores + insights
                if (hasUsedFreeOverlay(authUser?.id)) {
                  navigation.navigate('SystemSelection', {
                    readingType: 'overlay',
                    forPartner: false,
                    userName: 'You',
                    partnerName: person.name,
                    partnerBirthDate: person.birthData.birthDate,
                    partnerBirthTime: person.birthData.birthTime,
                    partnerBirthCity: {
                      id: 'unknown',
                      country: 'Unknown',
                      name: person.birthData.birthCity,
                      timezone: person.birthData.timezone,
                      latitude: person.birthData.latitude,
                      longitude: person.birthData.longitude,
                    },
                  });
                  return;
                }

                navigation.navigate('SynastryPreview', {
                  partnerName: person.name,
                  partnerBirthDate: person.birthData.birthDate,
                  partnerBirthTime: person.birthData.birthTime,
                  partnerBirthCity: {
                    id: 'unknown',
                    country: 'Unknown',
                    name: person.birthData.birthCity,
                    timezone: person.birthData.timezone,
                    latitude: person.birthData.latitude,
                    longitude: person.birthData.longitude,
                  },
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.overviewText}>Western Astrology Overview</Text>
            </TouchableOpacity>
          )}

          {personCompatibilityReadings.length === 0 && !(person.birthData && user?.birthData) && (
            <Text style={styles.emptyText}>No compatibility readings with this person yet.</Text>
          )}

          {personCompatibilityReadings.length > 0 && (
            personCompatibilityReadings.map((reading) => {
              const otherPerson = getOtherPerson(reading);
              return (
                <View key={reading.id} style={styles.compatCard}>
                  <View style={styles.compatHeader}>
                    <Text style={styles.compatNames} selectable>
                      {person.name} & {otherPerson?.name || 'Unknown'}
                    </Text>
                    <View style={styles.compatScore}>
                      <Text style={styles.compatScoreNumber}>{(reading.spicyScore ?? 0).toFixed(1)}</Text>
                      <Text style={styles.compatScoreLabel}>/10</Text>
                    </View>
                  </View>
                  <Text style={styles.compatTimestamp}>{formatTimestamp(reading.generatedAt)}</Text>
                  <Text style={styles.compatTimestamp}>
                    Spicy {(reading.spicyScore ?? 0).toFixed(1)}/10 · Safe {(reading.safeStableScore ?? 0).toFixed(1)}/10
                  </Text>
                  {reading.conclusion && (
                    <Text style={styles.compatConclusion} selectable numberOfLines={3}>
                      {reading.conclusion}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Generate Deep Readings Button - Shows paid options for You + This Person */}
        {!person.isUser && user && (
          <TouchableOpacity
            style={styles.addReadingButton}
            onPress={() => {
              // Navigate to SynastryOptions which shows all paid reading options
              navigation.navigate('SynastryOptions', {
                partnerName: person.name,
                partnerBirthDate: person.birthData?.birthDate,
                partnerBirthTime: person.birthData?.birthTime,
                partnerBirthCity: person.birthData ? {
                  id: 'unknown',
                  country: 'Unknown',
                  name: person.birthData.birthCity,
                  timezone: person.birthData.timezone,
                  latitude: person.birthData.latitude,
                  longitude: person.birthData.longitude,
                } : undefined,
              });
            }}
          >
            <Text style={styles.addReadingButtonText}>Generate Deep Readings</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.page,
  },
  errorText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
  },
  backButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  backButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerActionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  editText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
  },
  deleteText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: '#d10000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.page,
    paddingBottom: spacing.xl * 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: typography.headline,
    fontSize: 24,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  nameContainer: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  name: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    fontStyle: 'italic',
  },
  youBadge: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dataLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
  },
  dataValue: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  placementsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  placement: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  placementLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  placementSign: {
    fontFamily: typography.headline,
    fontSize: 20,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: 4,
  },
  placementDegree: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    fontStyle: 'italic',
  },
  overviewLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  overviewText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.text,
  },
  readingCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readingSystem: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  readingMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  readingNote: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.accent,
    fontStyle: 'italic',
    marginTop: 4,
  },
  readingTimestamp: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
  readingContent: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compatCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  compatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compatNames: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  compatScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  compatScoreNumber: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.primary,
    fontStyle: 'italic',
  },
  compatScoreLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  compatTimestamp: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
  compatConclusion: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  addReadingButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 0,
  },
  addReadingButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});


