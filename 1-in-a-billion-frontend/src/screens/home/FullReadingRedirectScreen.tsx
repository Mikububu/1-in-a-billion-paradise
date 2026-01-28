import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography } from '@/theme/tokens';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'FullReading'>;

/**
 * FullReading (legacy route name) — Redirect-only
 *
 * Requirement: the old "ALMOST READY / zodiac" FullReading UI should not exist anymore.
 * This screen starts an "extended" job for the selected system and immediately routes into
 * the unified Generating UI (`GeneratingReadingScreen`).
 */
export const FullReadingRedirectScreen = ({ navigation, route }: Props) => {
  const { system = 'western', forPartner, partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } =
    route.params || {};

  const authDisplayName = useAuthStore((s) => s.displayName);
  const meName = useOnboardingStore((s) => s.name) || authDisplayName || 'You';
  const meBirthDate = useOnboardingStore((s) => s.birthDate);
  const meBirthTime = useOnboardingStore((s) => s.birthTime);
  const meCity = useOnboardingStore((s) => s.birthCity);

  useEffect(() => {
    // Redirect to PersonalContext screen for proper flow
    // This ensures users go through: PersonalContext → SystemSelection → Voice Selection
    const targetPersonName = forPartner ? partnerName : meName;
    const targetBirthDate = forPartner ? partnerBirthDate : meBirthDate;
    const targetBirthTime = forPartner ? partnerBirthTime : meBirthTime;
    const targetBirthCity = forPartner ? partnerBirthCity : meCity;

    // Validate required birth data
    if (!targetBirthDate || !targetBirthTime || !targetBirthCity) {
      Alert.alert('Birth data required', 'Please complete birth date, time, and city before starting a reading.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    navigation.replace('PersonalContext', {
      personName: targetPersonName || 'You',
      readingType: forPartner ? 'other' : 'self',
      personBirthDate: targetBirthDate,
      personBirthTime: targetBirthTime,
      personBirthCity: targetBirthCity,
      // Pass through the system preference (will be pre-selected in SystemSelection)
      preselectedSystem: system,
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Redirecting…</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: { fontFamily: typography.sansRegular, color: colors.mutedText },
});
