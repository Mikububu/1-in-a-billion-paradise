import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'ExtendedReading'>;

type ReadingSystem = {
  id: string;
  name: string;
  price: number;
};

const READING_SYSTEMS: ReadingSystem[] = [
  { id: 'western', name: 'Western Astrology', price: 30 },
  { id: 'vedic', name: 'Vedic Astrology', price: 30 },
  { id: 'human_design', name: 'Human Design', price: 30 },
  { id: 'gene_keys', name: 'Gene Keys', price: 30 },
  { id: 'kabbalah', name: 'Kabbalah', price: 30 },
];

const BUNDLE_PRICE = 100;

export const ExtendedReadingScreen = ({ navigation }: Props) => {
  // Get user's name from store or use default
  const birthCity = useOnboardingStore((state) => state.birthCity);
  const userName = 'You'; // Could be fetched from auth

  const handleSelectSystem = (system: ReadingSystem) => {
    // Navigate to purchase/reading flow
    navigation.navigate('Purchase', {
      userId: 'user-1',
      preselectedProduct: system.id as any,
    });
  };

  const handleSelectBundle = () => {
    navigation.navigate('Purchase', {
      userId: 'user-1',
      preselectedProduct: 'all_systems_bundle' as any,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title} selectable>Extended Reading Options</Text>
        <Text style={styles.subtitle} selectable>
          Deep dive into your cosmic blueprint
        </Text>

        <Text style={styles.sectionTitle} selectable>Choose Your System</Text>
        
        {READING_SYSTEMS.map((system) => (
          <TouchableOpacity
            key={system.id}
            style={styles.systemButton}
            onPress={() => handleSelectSystem(system)}
          >
            <Text style={styles.systemText}>
              {system.name} - ${system.price}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle} selectable>All Systems Together</Text>
        
        <TouchableOpacity
          style={styles.bundleButton}
          onPress={handleSelectBundle}
        >
          <Text style={styles.bundleText}>
            All 5 Systems - ${BUNDLE_PRICE}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  systemButton: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    alignItems: 'center',
  },
  systemText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
  },
  bundleButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  bundleText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});

