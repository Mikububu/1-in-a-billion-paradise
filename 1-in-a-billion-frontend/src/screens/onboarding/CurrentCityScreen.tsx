/**
 * Current City Screen
 * 
 * Asks user for their current city (for local matching).
 * This is a simple pass-through screen that can be expanded later.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { AutocompleteInput } from '@/components/AutocompleteInput';
import { CityOption } from '@/types/forms';
import { cities } from '@/data/cities';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CurrentCity'>;

export const CurrentCityScreen = ({ navigation }: Props) => {
  const [currentCity, setCurrentCity] = useState<CityOption | null>(null);
  const setStoreCurrentCity = useOnboardingStore((state) => state.setCurrentCity);

  const handleContinue = () => {
    if (currentCity) {
      setStoreCurrentCity(currentCity);
    }
    navigation.navigate('Account');
  };

  const handleSkip = () => {
    navigation.navigate('Account');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Where do you live now?</Text>
        <Text style={styles.subtitle}>
          This helps us find compatible matches near you
        </Text>

        <View style={styles.inputContainer}>
          <AutocompleteInput
            label="Current City"
            placeholder="Search your city..."
            options={cities.map(c => ({ id: c.id, primary: c.name, secondary: c.country, value: c }))}
            onSelect={(city) => setCurrentCity(city || null)}
            selectedLabel={currentCity?.name}
            optional={false}
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={!currentCity}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            onPress={handleSkip}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl * 2,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
});

