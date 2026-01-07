import { SimpleSlider } from '@/components/SimpleSlider';
import { useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Button } from '@/components/Button';
import { AutocompleteInput, AutocompleteOption } from '@/components/AutocompleteInput';
import { languages } from '@/data/languages';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { LanguageOption } from '@/types/forms';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Languages'>;

export const LanguagesScreen = ({ navigation }: Props) => {
  const primaryLanguage = useOnboardingStore((state) => state.primaryLanguage);
  const secondaryLanguage = useOnboardingStore((state) => state.secondaryLanguage);
  const setPrimaryLanguage = useOnboardingStore((state) => state.setPrimaryLanguage);
  const setSecondaryLanguage = useOnboardingStore((state) => state.setSecondaryLanguage);
  const languageImportance = useOnboardingStore((state) => state.languageImportance);
  const setLanguageImportance = useOnboardingStore((state) => state.setLanguageImportance);
  const { isPlaying } = useMusicStore();

  // Keep ambient music playing
  useFocusEffect(
    useCallback(() => {
      if (isPlaying) {
        AmbientMusic.play();
      }
    }, [isPlaying])
  );

  const options = useMemo<AutocompleteOption<LanguageOption>[]>(() => {
    return languages.map((lang) => ({
      id: lang.code,
      primary: lang.label,
      value: lang,
    }));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Video at bottom - fills edges (Background Layer) */}
      <Video
        source={require('../../../assets/videos/mouth.mp4')}
        style={styles.bottomVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        rate={0.5}
      />
      />

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* Screen ID */}
      <Text style={styles.screenId}>4</Text>

      {/* Content at top */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Languages</Text>
        <Text style={styles.subtitle}>
          Which languages do you feel most comfortable with? Secondary is optional.
        </Text>

        <View style={styles.body}>
          <AutocompleteInput
            label="Primary language"
            placeholder="English"
            options={options}
            onSelect={(lang) => lang && setPrimaryLanguage(lang)}
            selectedLabel={primaryLanguage?.label}
          />

          <AutocompleteInput
            label="Secondary language"
            placeholder="Add another"
            options={options}
            onSelect={(lang) => lang && setSecondaryLanguage(lang)}
            selectedLabel={secondaryLanguage?.label}
            optional
          />

          <View style={styles.sliderCard}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderTitle} selectable>Language importance</Text>
              <Text style={styles.sliderValue} selectable>{Math.round(languageImportance)}/10</Text>
            </View>
            <SimpleSlider
              minimumValue={0}
              maximumValue={10}
              value={languageImportance}
              onValueChange={(val) => setLanguageImportance(Math.round(val))}
            />
            {/* Labels removed as requested */}
          </View>
        </View>

        {/* Footer (Button) Moved Inside ScrollView */}
        <View style={styles.footer}>
          <Button
            label="Continue"
            onPress={() => navigation.navigate('CoreIdentities')}
            disabled={!primaryLanguage}
          />
        </View>
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
    position: 'absolute',
    top: 60,
    left: spacing.page,
    zIndex: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  screenId: {
    position: 'absolute',
    top: 95,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: 60, // Aligned with previous screens
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.mutedText,
    textAlign: 'center',
  },
  body: {
    gap: spacing.lg,
    marginTop: 32,
  },
  footer: {
    marginTop: spacing.sm, // Reduced to move button higher
    marginBottom: spacing.xl,
  },
  bottomVideo: {
    position: 'absolute',
    bottom: -30, // Moved up significantly
    left: 0,
    right: 0,
    height: '40%', // Smaller height
    zIndex: 0,
  },
  sliderCard: {
    // Transparent & Simplified
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    // Removed borders and horizontal padding/background
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderTitle: {
    fontFamily: typography.sansSemiBold,
    color: colors.text,
  },
  sliderValue: {
    fontFamily: typography.sansMedium,
    color: colors.primary,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontFamily: typography.sansRegular,
    color: colors.mutedText,
    fontSize: 13,
  },
});
