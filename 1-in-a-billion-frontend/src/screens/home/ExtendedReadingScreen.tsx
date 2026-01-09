import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { PRODUCTS } from '@/config/products';

type Props = NativeStackScreenProps<MainStackParamList, 'ExtendedReading'>;

type ReadingSystem = {
  id: string;
  name: string;
  price: number;
};

const SINGLE_PRICE = PRODUCTS.single_system.priceUSD;
const BUNDLE_PRICE = PRODUCTS.complete_reading.priceUSD;

const READING_SYSTEMS: ReadingSystem[] = [
  { id: 'western', name: 'Western Astrology', price: SINGLE_PRICE },
  { id: 'vedic', name: 'Vedic Astrology', price: SINGLE_PRICE },
  { id: 'human_design', name: 'Human Design', price: SINGLE_PRICE },
  { id: 'gene_keys', name: 'Gene Keys', price: SINGLE_PRICE },
  { id: 'kabbalah', name: 'Kabbalah', price: SINGLE_PRICE },
];

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

        {/* All 5 Systems option with Best Choice badge - matching Screen 22 design */}
        <TouchableOpacity
          style={styles.bestChoiceCard}
          onPress={handleSelectBundle}
          activeOpacity={0.7}
        >
          <View style={styles.bestChoiceLeft}>
            <View style={styles.bestChoiceBadge}>
              <Text style={styles.bestChoiceBadgeText}>★ BEST CHOICE</Text>
            </View>
            <Text style={styles.bestChoiceTitle}>All 5 Systems</Text>
            <Text style={styles.bestChoiceDescription}>Complete reading with all systems</Text>
          </View>
          <View style={styles.bestChoiceRight}>
            <Text style={styles.bestChoicePrice}>${BUNDLE_PRICE}</Text>
            <Text style={styles.savingsText}>Save ${(READING_SYSTEMS.length * SINGLE_PRICE) - BUNDLE_PRICE}</Text>
          </View>
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
    backgroundColor: colors.surface,
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
  
  // Best Choice Card (matching Screen 22)
  bestChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  bestChoiceLeft: {
    flex: 1,
  },
  bestChoiceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  bestChoiceBadgeText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 1,
  },
  bestChoiceTitle: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.background,
  },
  bestChoiceDescription: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  bestChoiceRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  bestChoicePrice: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.background,
  },
  savingsText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.background,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
  },
});

