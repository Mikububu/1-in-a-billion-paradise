import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/Button';
import { importPeople } from '@/scripts/importPeopleToStore';
import { fetchPeopleFromSupabase } from '@/services/peopleService';

type Props = NativeStackScreenProps<MainStackParamList, 'ComparePeople'>;

const screenId = '11b';

export const ComparePeopleScreen = ({ navigation }: Props) => {
  const people = useProfileStore((s) => s.people);
  const updatePerson = useProfileStore((s) => s.updatePerson);
  const addPerson = useProfileStore((s) => s.addPerson);
  const userId = useAuthStore((s) => s.userId);
  
  // Blinking animation for "CHOOSE ONE OR TWO PEOPLE" text
  const blinkAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Blinking loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  
  // Auto-import 9 people (will update existing people with new data like gender)
  useEffect(() => {
    console.log('🚀 Auto-importing/updating 9 test people...');
    const result = importPeople();
    console.log(`✅ Imported/Updated ${result.successCount} people`);
  }, []);

  // Fetch people from Supabase and sync to local store
  useEffect(() => {
    if (!userId) {
      console.log('⚠️ No userId - skipping Supabase fetch');
      return;
    }

    console.log('📥 Fetching people from Supabase...');
    fetchPeopleFromSupabase(userId).then(supabasePeople => {
      if (supabasePeople.length === 0) {
        console.log('📭 No people in Supabase');
        return;
      }

      console.log(`✅ Fetched ${supabasePeople.length} people from Supabase`);
      
      // Merge with local store (update if exists, add if new)
      supabasePeople.forEach(person => {
        const existing = people.find(p => p.id === person.id);
        if (existing) {
          // Update existing with Supabase data
          updatePerson(person.id, person);
          console.log(`🔄 Updated "${person.name}" from Supabase`);
        } else {
          // Add new person from Supabase
          addPerson(person);
          console.log(`➕ Added "${person.name}" from Supabase`);
        }
      });
    });
  }, [userId]);

  const candidates = useMemo(() => {
    return (people || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)); // Stable alphabetical sort for selection
  }, [people]);

  const [personAId, setPersonAId] = useState<string | null>(null);
  const [personBId, setPersonBId] = useState<string | null>(null);

  const personA = useMemo(() => candidates.find((p) => p.id === personAId), [candidates, personAId]);
  const personB = useMemo(() => candidates.find((p) => p.id === personBId), [candidates, personBId]);

  const canContinue = Boolean(personA); // Enable after selecting just 1 person (can analyze 1 or 2 people)

  const clearSelection = useCallback(() => {
    setPersonAId(null);
    setPersonBId(null);
  }, []);

  const handlePick = useCallback(
    (id: string) => {
      // Tap again to unselect
      if (personAId === id) {
        // If you clear A, also clear B (keeps flow simple & obvious)
        setPersonAId(null);
        setPersonBId(null);
        return;
      }
      if (personBId === id) {
        setPersonBId(null);
        return;
      }

      // First tap selects A, second tap selects B
      if (!personAId) {
        setPersonAId(id);
        return;
      }
      if (!personBId) {
        if (id === personAId) return;
        setPersonBId(id);
        return;
      }

      // If both are already selected, start over with new A
      setPersonAId(id);
      setPersonBId(null);
    },
    [personAId, personBId]
  );

  const handleContinue = useCallback(() => {
    if (!personA) return;

    // Validate personA birth data
    if (!personA.birthData?.birthDate || !personA.birthData?.birthTime || !personA.birthData?.timezone) {
      Alert.alert('Missing birth data', `Please complete ${personA.name}'s birth data first.`);
      return;
    }

    // Case 1: Only ONE person selected -> Single person reading
    if (!personB) {
      navigation.navigate('SystemSelection', {
        readingType: 'individual',
        forPartner: false,
        userName: personA.name,
        person1Override: {
          name: personA.name,
          birthDate: personA.birthData.birthDate,
          birthTime: personA.birthData.birthTime,
          timezone: personA.birthData.timezone,
          latitude: personA.birthData.latitude,
          longitude: personA.birthData.longitude,
          placements: personA.placements,
        },
      } as any);
      return;
    }

    // Case 2: TWO people selected -> Overlay/comparison reading
    if (personA.id === personB.id) {
      Alert.alert('Choose two people', 'Please select two different people.');
      return;
    }
    
    if (!personB.birthData?.birthDate || !personB.birthData?.birthTime || !personB.birthData?.timezone) {
      Alert.alert('Missing birth data', `Please complete ${personB.name}'s birth data first.`);
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
        name: personB.birthData.birthCity,
        timezone: personB.birthData.timezone,
        latitude: personB.birthData.latitude,
        longitude: personB.birthData.longitude,
      } as any,
      person1Override: {
        name: personA.name,
        birthDate: personA.birthData.birthDate,
        birthTime: personA.birthData.birthTime,
        timezone: personA.birthData.timezone,
        latitude: personA.birthData.latitude,
        longitude: personA.birthData.longitude,
        placements: personA.placements,
      },
      person2Override: {
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenId}>{screenId}</Text>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.controlRoomText}>My Secret Life</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>My Karmic Zoo</Text>
        <Text style={styles.subtitle}>Deep analyses of one or two souls</Text>
        <Animated.Text style={[styles.boldSubheadline, { opacity: blinkAnim }]}>
          CHOOSE ONE OR TWO PEOPLE{'\n'}FOR DEEP READINGS
        </Animated.Text>

        {candidates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Not enough people yet</Text>
            <Text style={styles.emptyText}>Add at least two people first.</Text>
            <Button
              label="Add a person"
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
              return (
                <TouchableOpacity
                  key={`p-${p.id}`}
                  style={[styles.row, (isA || isB) && styles.rowSelected]}
                  onPress={() => handlePick(p.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.avatar, {
                    backgroundColor: p.gender === 'male' ? '#E8F4E4' : p.gender === 'female' ? '#FFE4E4' : colors.primary + '20'
                  }]}>
                    <Text style={[styles.avatarText, {
                      color: p.gender === 'male' ? '#2E7D32' : p.gender === 'female' ? colors.primary : colors.primary
                    }]}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{p.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {p.birthData?.birthDate ? `Born ${(() => {
                        try {
                          const date = new Date(p.birthData.birthDate);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        } catch {
                          return p.birthData.birthDate;
                        }
                      })()}` : ''}
                      {p.birthData?.birthTime ? ` at ${p.birthData.birthTime}` : ''}
                    </Text>
                    {p.birthData?.birthCity && (
                      <Text style={styles.rowMeta} numberOfLines={1}>{p.birthData.birthCity}</Text>
                    )}
                    <View style={styles.rowSigns}>
                      <Text style={styles.rowSignBadge}>☉ {p.placements?.sunSign || 'Libra'}</Text>
                      <Text style={styles.rowSignBadge}>☽ {p.placements?.moonSign || 'Libra'}</Text>
                      <Text style={styles.rowSignBadge}>↑ {p.placements?.risingSign || 'Libra'}</Text>
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
      </View>

      <View style={styles.footer}>
        <Button label="Continue to Packages" onPress={handleContinue} disabled={!canContinue} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  screenId: {
    position: 'absolute',
    top: 55,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  controlRoomText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.primary },
  content: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  boldSubheadline: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  list: { flex: 1 },
  sectionLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  helperText: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  clearText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.primary,
  },
  selectedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectedCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pickBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  pickBadgeA: { backgroundColor: colors.primary },
  pickBadgeB: { backgroundColor: colors.text },
  pickBadgeText: { fontFamily: typography.sansBold, fontSize: 12, color: '#FFFFFF' },
  selectedName: { flex: 1, fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowSelected: { borderColor: colors.primary },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  avatarText: {
    fontFamily: typography.headline,
    fontSize: 22,
    color: '#FFFFFF',
  },
  rowName: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  rowMeta: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText },
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
  chevron: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.mutedText, marginLeft: spacing.md },
  pickChip: {
    minWidth: 34,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  pickChipA: { backgroundColor: colors.primary },
  pickChipB: { backgroundColor: colors.text },
  pickChipText: { fontFamily: typography.sansBold, fontSize: 13, color: '#FFFFFF' },
  addPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 22,
    padding: spacing.md,
    marginTop: spacing.md,
    borderStyle: 'dashed',
  },
  addPersonAvatar: {
    backgroundColor: colors.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  addPersonIcon: {
    fontFamily: typography.sansBold,
    fontSize: 28,
    color: '#FFFFFF',
  },
  addPersonText: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyTitle: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  emptyText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, marginTop: spacing.sm, marginBottom: spacing.lg },
  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
});
