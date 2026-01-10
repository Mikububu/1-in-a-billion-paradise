import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'SynastryOptions'>;

const screenId = '21';

export const SynastryOptionsScreen = ({ navigation, route }: Props) => {
  console.log(`📱 Screen ${screenId}: SynastryOptionsScreen`);
  const { partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } = route.params || { partnerName: 'Them' };
  const partner = partnerName || 'Partner';

  const handleYourReading = () => {
    navigation.navigate('PersonalContext', {
      personName: 'You',
      readingType: 'self',
      forPartner: false,
      userName: 'You',
    });
  };

  const handlePartnerReading = () => {
    navigation.navigate('PersonalContext', {
      personName: partner,
      readingType: 'other',
      forPartner: true,
      userName: partner,
      partnerName: partner,
      personBirthDate: partnerBirthDate,
      personBirthTime: partnerBirthTime,
      personBirthCity: partnerBirthCity,
    });
  };

  const handleOverlayReadings = () => {
    navigation.navigate('RelationshipContext', {
      readingType: 'overlay',
      forPartner: false,
      userName: 'You',
      partnerName: partner,
      partnerBirthDate,
      partnerBirthTime,
      partnerBirthCity,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen ID */}
      {/** Screen numbers temporarily removed */}

      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.controlRoomText}>My Secret Life</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>What would you like?</Text>
        <Text style={styles.subtitle}>
          Choose a deep reading for yourself, {partner}, or both together
        </Text>

        {/* Option 1: Your Reading */}
        <TouchableOpacity style={styles.optionCard} onPress={handleYourReading}>
          <Text style={styles.optionIcon}>○</Text>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitle}>Your Reading</Text>
            <Text style={styles.optionDescription}>
              Deep dive into your charts across 5 systems
            </Text>
          </View>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        {/* Option 2: Partner's Reading */}
        <TouchableOpacity style={styles.optionCard} onPress={handlePartnerReading}>
          <Text style={styles.optionIcon}>○</Text>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitle}>{partner}'s Reading</Text>
            <Text style={styles.optionDescription}>
              Deep dive into {partner}'s charts across 5 systems
            </Text>
          </View>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        {/* Option 3: Overlay Readings */}
        <TouchableOpacity style={styles.optionCard} onPress={handleOverlayReadings}>
          <Text style={styles.optionIcon}>◇</Text>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitle}>Overlay Readings</Text>
            <Text style={styles.optionDescription}>
              You & {partner} compatibility analysis
            </Text>
          </View>
          <Text style={styles.optionArrow}>→</Text>
        </TouchableOpacity>

        {/* Add Another Person */}
        <TouchableOpacity style={styles.addPersonButton} onPress={() => navigation.navigate('PartnerInfo')}>
          <Text style={styles.addPersonIcon}>+</Text>
          <Text style={styles.addPersonText}>Do you want to compare {partner} with another person?</Text>
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
  screenId: {
    position: 'absolute',
    top: 50,
    left: 16,
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.mutedText,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  controlRoomText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
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
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  optionIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  optionDescription: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 2,
  },
  optionArrow: {
    fontSize: 24,
    color: colors.mutedText,
  },
  addPersonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 999,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  addPersonIcon: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.primary,
    marginRight: spacing.sm,
  },
  addPersonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 15,
    color: colors.primary,
  },
});

