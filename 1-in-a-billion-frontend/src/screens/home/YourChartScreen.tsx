/**
 * YOUR CHART SCREEN
 * 
 * User's personal profile showing their chart, placements, and readings.
 * Accessible from Home - their "astrology ID card".
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SimpleSlider } from '@/components/SimpleSlider';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { describeIntensity } from '@/utils/intensity';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'YourChart'>;

export const YourChartScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const onboardingBirthDate = useOnboardingStore((s) => s.birthDate);
  const onboardingBirthTime = useOnboardingStore((s) => s.birthTime);
  const onboardingBirthCity = useOnboardingStore((s) => s.birthCity);
  const hookReadings = useOnboardingStore((s) => s.hookReadings);
  const relationshipIntensity = useOnboardingStore((s) => s.relationshipIntensity);
  const setRelationshipIntensity = useOnboardingStore((s) => s.setRelationshipIntensity);
  const lastValue = useRef(relationshipIntensity);
  const descriptor = describeIntensity(relationshipIntensity);

  const handleValueChange = (nextValue: number) => {
    const rounded = Math.round(nextValue);
    if (rounded !== lastValue.current) {
      Haptics.selectionAsync();
      lastValue.current = rounded;
    }
    setRelationshipIntensity(rounded);
  };

  const user = useProfileStore((s) => s.getUser());
  const userName = user?.name || useOnboardingStore((s) => s.getMainUser()?.name) || 'You';
  const birthDate = user?.birthData?.birthDate?.trim() ? user.birthData.birthDate : onboardingBirthDate;
  const birthTime = user?.birthData?.birthTime?.trim() ? user.birthData.birthTime : onboardingBirthTime;
  const birthCityLabel = user?.birthData?.birthCity?.trim()
    ? user.birthData.birthCity
    : (onboardingBirthCity?.name || 'Location unknown');

  // TRY to get placements from user profile first, then fallback to onboarding hook readings
  const corePlacements = {
    sun: {
      sign: user?.placements?.sunSign || hookReadings.sun?.sign || '?',
      degree: user?.placements?.sunDegree || hookReadings.sun?.degree,
    },
    moon: {
      sign: user?.placements?.moonSign || hookReadings.moon?.sign || '?',
      degree: user?.placements?.moonDegree || hookReadings.moon?.degree,
    },
    rising: {
      sign: user?.placements?.risingSign || hookReadings.rising?.sign || '?',
      degree: user?.placements?.risingDegree || hookReadings.rising?.degree,
    },
  };

  // Debug log to see what data we have
  console.log('🔍 YourChartScreen - User placements:', user?.placements);
  console.log('🔍 YourChartScreen - Hook readings:', {
    sun: hookReadings.sun,
    moon: hookReadings.moon,
    rising: hookReadings.rising,
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Not set';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          // Ensure bottom actions are NEVER hidden behind the home indicator / safe area.
          { paddingBottom: spacing.xl * 2 + insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title} selectable>{userName}'s Chart</Text>

        {/* Birth Data Card */}
        <View style={styles.birthCard}>
          <Text style={styles.birthLabel}>Born</Text>
          <Text style={styles.birthDate} selectable>{formatDate(birthDate)}</Text>
          <Text style={styles.birthTime} selectable>
            {birthTime || 'Time unknown'} in {birthCityLabel}
          </Text>
        </View>

        {/* Core Three */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The Big Three</Text>
          <View style={styles.coreRow}>
            <View style={styles.coreCard}>
              <Text style={styles.coreIcon}>☉</Text>
              <Text style={styles.coreLabel}>Sun</Text>
              <Text style={styles.coreSign} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {corePlacements.sun.sign}
              </Text>
              {!!corePlacements.sun.degree && (
                <Text style={styles.coreDegree} selectable>{corePlacements.sun.degree}</Text>
              )}
            </View>
            <View style={styles.coreCard}>
              <Text style={styles.coreIcon}>☽</Text>
              <Text style={styles.coreLabel}>Moon</Text>
              <Text style={styles.coreSign} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {corePlacements.moon.sign}
              </Text>
              {!!corePlacements.moon.degree && (
                <Text style={styles.coreDegree} selectable>{corePlacements.moon.degree}</Text>
              )}
            </View>
            <View style={styles.coreCard}>
              <Text style={styles.coreIcon}>↑</Text>
              <Text style={styles.coreLabel}>Rising</Text>
              <Text style={styles.coreSign} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {corePlacements.rising.sign}
              </Text>
              {!!corePlacements.rising.degree && (
                <Text style={styles.coreDegree} selectable>{corePlacements.rising.degree}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Preferences</Text>

          {/* Intensity Slider (match onboarding RelationshipScreen design) */}
          <View style={styles.sliderCard}>
            <View style={styles.legend}>
              <Text style={styles.legendLabel}>Safe</Text>
              <Text style={styles.legendLabel}>Spicy</Text>
            </View>

            <SimpleSlider
              minimumValue={0}
              maximumValue={10}
              value={relationshipIntensity}
              // minimumTrackTintColor={colors.primary}
              // maximumTrackTintColor={colors.primarySoft}
              // thumbTintColor={colors.primary}
              onValueChange={handleValueChange}
            />

            <Text style={styles.caption}>{descriptor.caption}</Text>
          </View>

        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.editAction}
            onPress={() => navigation.navigate('EditBirthData', { personId: user?.id })}
          >
            <Text style={styles.editActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('PeopleList')}
          >
            <Text style={styles.secondaryActionText}>View All Saved People</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
  editText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
  },
  scrollView: {
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
    fontStyle: 'italic',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  birthCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  birthLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  birthDate: {
    fontFamily: typography.headline,
    fontSize: 24,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: 4,
  },
  birthTime: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  coreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coreCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  coreIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  coreLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
  },
  coreSign: {
    fontFamily: typography.headline,
    fontSize: 18,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: 4,
  },
  coreDegree: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  planetList: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  planetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  planetIcon: {
    fontSize: 18,
    width: 30,
  },
  planetName: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  planetSign: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.sm,
  },
  planetDegree: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    width: 50,
    textAlign: 'right',
  },
  prefSection: {
    marginBottom: spacing.md,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  prefLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginBottom: spacing.xs,
  },
  prefValue: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  sliderCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  legendLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
  slider: {
    width: '100%',
    height: 44,
  },
  caption: {
    textAlign: 'center',
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
    marginTop: spacing.sm,
  },
  actionsSection: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  editAction: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  editActionText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  secondaryAction: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  secondaryActionText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});


