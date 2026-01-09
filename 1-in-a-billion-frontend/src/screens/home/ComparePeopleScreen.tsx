import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { Button } from '@/components/Button';
import { importPeople } from '@/scripts/importPeopleToStore';

type Props = NativeStackScreenProps<MainStackParamList, 'ComparePeople'>;

const screenId = '11b';

export const ComparePeopleScreen = ({ navigation }: Props) => {
  const people = useProfileStore((s) => s.people);
  
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
    if (!personA || !personB) return;
    if (personA.id === personB.id) {
      Alert.alert('Choose two people', 'Please select two different people.');
      return;
    }
    if (!personA.birthData?.birthDate || !personA.birthData?.birthTime || !personA.birthData?.timezone) {
      Alert.alert('Missing birth data', `Please complete ${personA.name}'s birth data first.`);
      return;
    }
    if (!personB.birthData?.birthDate || !personB.birthData?.birthTime || !personB.birthData?.timezone) {
      Alert.alert('Missing birth data', `Please complete ${personB.name}'s birth data first.`);
      return;
    }

    // Route to overview menu (SystemSelection) with explicit person overrides.
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
      // Custom overrides consumed by SystemSelection
      person1Override: {
        name: personA.name,
        birthDate: personA.birthData.birthDate,
        birthTime: personA.birthData.birthTime,
        timezone: personA.birthData.timezone,
        latitude: personA.birthData.latitude,
        longitude: personA.birthData.longitude,
        placements: personA.placements, // Include cached placements (skip Swiss Eph!)
      },
      person2Override: {
        name: personB.name,
        birthDate: personB.birthData.birthDate,
        birthTime: personB.birthData.birthTime,
        timezone: personB.birthData.timezone,
        latitude: personB.birthData.latitude,
        longitude: personB.birthData.longitude,
        placements: personB.placements, // Include cached placements
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
        <Text style={styles.title}>My Zoo Experiments</Text>
        <Text style={styles.subtitle}>Deep analyses of one or two souls</Text>
        <Animated.Text style={[styles.boldSubheadline, { opacity: blinkAnim }]}>CHOOSE ONE OR TWO PEOPLE FOR DEEP READINGS</Animated.Text>

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
                  <View style={[styles.avatar, p.gender === 'male' ? { backgroundColor: '#E8F4E4' } : p.gender === 'female' ? { backgroundColor: '#FFE4E4' } : {}]}>
                    <Text style={[styles.avatarText, p.gender === 'male' ? { color: '#2E7D32' } : p.gender === 'female' ? { color: colors.primary } : {}]}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, p.gender === 'male' ? { color: '#2E7D32' } : p.gender === 'female' ? { color: colors.primary } : {}]}>{p.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {p.birthData?.birthDate || '—'} · {p.birthData?.birthTime || '—'} · {p.birthData?.birthCity || '—'}
                    </Text>
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
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.lg },
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
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
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
    borderRadius: radii.card,
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
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  rowSelected: { borderColor: colors.primary },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: typography.headline,
    fontSize: 18,
    color: colors.text,
    fontStyle: 'italic',
  },
  rowName: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  rowMeta: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, marginTop: 2 },
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
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.md,
    borderStyle: 'dashed',
  },
  addPersonAvatar: {
    backgroundColor: colors.primary,
  },
  addPersonIcon: {
    fontFamily: typography.sansBold,
    fontSize: 24,
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
