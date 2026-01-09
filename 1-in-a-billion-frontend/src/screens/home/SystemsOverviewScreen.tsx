import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemsOverview'>;

type SystemInfo = {
  id: 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';
  name: string;
  icon: string;
  tagline: string;
  description: string;
};

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              MEANINGFUL SYMBOLS FOR EACH SYSTEM                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  ☉ WESTERN    - The Sun: ego, identity, what you're becoming             ║
 * ║  ॐ VEDIC      - Om: the sacred sound, primordial vibration of cosmos    ║
 * ║  ◬ HUMAN DESIGN - Triangle: Head Center at top of Bodygraph             ║
 * ║  ❋ GENE KEYS  - 6-petal flower: hexagram geometry, blooming Siddhi      ║
 * ║  ✧ KABBALAH   - Four-pointed star: divine light (Or) descending          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
const SYSTEMS: SystemInfo[] = [
  {
    id: 'western',
    name: 'Western Astrology',
    icon: '☉',
    tagline: 'The Psychology of Your Soul',
    description: 'Sun reveals identity. Pluto shows obsession. Saturn your fears. Moon your emotional needs.',
  },
  {
    id: 'vedic',
    name: 'Jyotish (Vedic)',
    icon: 'ॐ',
    tagline: 'The Light of Karma',
    description: 'Chandra rules your Nakshatra. Rahu shows obsessive desires. Ketu your past-life wounds.',
  },
  {
    id: 'human_design',
    name: 'Human Design',
    icon: '◬',
    tagline: 'Your Bodygraph Blueprint',
    description: 'Nine Centers, defined or open. Your Type, Strategy, and Authority for making decisions.',
  },
  {
    id: 'gene_keys',
    name: 'Gene Keys',
    icon: '❋',
    tagline: 'Shadow → Gift → Siddhi',
    description: '64 Gene Keys in your DNA. Each Shadow contains a Gift waiting to bloom into Siddhi.',
  },
  {
    id: 'kabbalah',
    name: 'Kabbalah',
    icon: '✧',
    tagline: 'The Tree of Life',
    description: 'Ten Sephiroth, 22 paths. Discover your Tikkun (soul correction) and how divine light flows.',
  },
];

export const SystemsOverviewScreen = ({ navigation, route }: Props) => {
  const { forPartner, partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } = route.params || {};

  const handleSystemPress = (system: SystemInfo) => {
    navigation.navigate('SystemExplainer', {
      system: system.id,
      forPurchase: true,
      readingType: forPartner ? 'overlay' : 'individual',
      forPartner,
      partnerName,
      partnerBirthDate,
      partnerBirthTime,
      partnerBirthCity,
    });
  };

  const handleCompleteReading = () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SystemsOverviewScreen.tsx:82',message:'Complete Reading button clicked',data:{forPartner,partnerName,hasPersonId:!!(route.params as any)?.personId,routeParams:route.params},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'BTN'})}).catch(()=>{});
    // #endregion
    
    // Navigate to the Complete Reading explainer & purchase screen
    navigation.navigate('CompleteReading', {
      ...(route.params || {}), // Pass through all params including personId
      partnerName,
      partnerBirthDate,
      partnerBirthTime,
      partnerBirthCity,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenId}>12</Text>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {forPartner ? `Explore ${partnerName}` : 'Explore Yourself'}
        </Text>
        <Text style={styles.subtitle}>
          {forPartner ? `Five lenses into ${partnerName}` : 'Five lenses into who you are'}
        </Text>
      </View>

      {/* Compact Systems List - all visible without scrolling */}
      <View style={styles.systemsList}>
        {SYSTEMS.map((system) => (
          <TouchableOpacity
            key={system.id}
            style={styles.systemRow}
            onPress={() => handleSystemPress(system)}
            activeOpacity={0.7}
          >
            <Text style={styles.systemIcon}>{system.icon}</Text>
            <View style={styles.systemInfo}>
              <Text style={styles.systemName}>{system.name}</Text>
              <Text style={styles.systemTagline}>{system.tagline}</Text>
            </View>
            <Text style={styles.systemArrow}>→</Text>
          </TouchableOpacity>
        ))}

        {/* Divider */}
        <View style={styles.divider} />

        {/* All 5 Systems option with Best Value badge - NO PRICE */}
        <TouchableOpacity
          style={styles.completeRow}
          onPress={handleCompleteReading}
          activeOpacity={0.7}
        >
          <Text style={styles.completeIcon}>✦</Text>
          <View style={styles.systemInfo}>
            <View style={styles.completeNameRow}>
              <Text style={styles.completeName}>Complete Reading</Text>
            </View>
            <Text style={styles.completeTagline}>All 5 systems combined</Text>
          </View>
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.page,
  },
  screenId: {
    position: 'absolute',
    top: 55,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  backButton: {
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
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
  systemsList: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  systemIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  systemInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  systemName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  systemTagline: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.primary,
    marginTop: 1,
  },
  systemArrow: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  completeIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
    color: colors.primary,
  },
  completeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeName: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  bestValueBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    marginLeft: spacing.sm,
  },
  bestValueText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.background,
    letterSpacing: 1,
  },
  completeTagline: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
});
