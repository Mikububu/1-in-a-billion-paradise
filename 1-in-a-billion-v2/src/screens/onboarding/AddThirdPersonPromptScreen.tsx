import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { BackButton } from '@/components/BackButton';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { CityOption } from '@/types/forms';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AddThirdPersonPrompt'>;

export const AddThirdPersonPromptScreen = ({ navigation }: Props) => {
  // HARD LOCK: only allow one free "third person" hook set. If it exists, reuse it.
  const existingPartner = useProfileStore((s) =>
    s.people.find((p) => !p.isUser && p.hookReadings && p.hookReadings.length === 3)
  );

  const existingPartnerCity = useMemo<CityOption | null>(() => {
    if (!existingPartner?.birthData) return null;
    return {
      id: `saved-${existingPartner.id}`,
      name: existingPartner.birthData.birthCity || 'Unknown',
      country: '',
      region: '',
      latitude: typeof existingPartner.birthData.latitude === 'number' ? existingPartner.birthData.latitude : 0,
      longitude: typeof existingPartner.birthData.longitude === 'number' ? existingPartner.birthData.longitude : 0,
      timezone: existingPartner.birthData.timezone || 'UTC',
    };
  }, [existingPartner]);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton
        onPress={() => {
          // Always go back to user's own hook readings (Rising sign page)
          navigation.navigate('HookSequence', { initialReading: 'rising' } as any);
        }}
      />
      <View style={styles.content}>
        <View style={styles.textCard}>
          <Text style={styles.title} selectable>
            {t('addThirdPerson.title')}
          </Text>
          <Text style={styles.subtitle} selectable>
            {t('addThirdPerson.subtitle')}
          </Text>
        </View>

        <Image
          source={require('../../../assets/images/heart2heart.png')}
          style={styles.inlineImage}
          resizeMode="contain"
        />

        <View style={{ flex: 1 }} />

        <View style={styles.buttonContainer}>
          <Button
            label={t('addThirdPerson.yes')}
            onPress={() => {
              if (existingPartner && existingPartnerCity) {
                // Reuse existing free partner hook reading; do not create a new one.
                navigation.replace('Onboarding_PartnerReadings' as any, {
                  partnerName: existingPartner.name,
                  partnerBirthDate: existingPartner.birthData?.birthDate,
                  partnerBirthTime: existingPartner.birthData?.birthTime,
                  partnerBirthCity: existingPartnerCity,
                  partnerId: existingPartner.id,
                  mode: 'onboarding_hook',
                });
                return;
              }
              // IMPORTANT: replace, don't navigate.
              // This removes AddThirdPersonPrompt from history so users can't land on it again when swiping/clicking back.
              navigation.replace('Onboarding_PartnerInfo', { mode: 'onboarding_hook' } as any);
            }}
            variant="primary"
            style={styles.button}
          />

          <Button
            label={t('addThirdPerson.no')}
            onPress={() => navigation.navigate('Pricing')}
            variant="secondary"
            style={styles.button}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    padding: spacing.page,
    paddingTop: 60,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  textCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(236, 234, 230, 0.5)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  inlineImage: {
    width: '80%',
    maxWidth: 300,
    height: undefined,
    aspectRatio: 1,
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: spacing.lg,
  },
  button: { width: '100%', marginTop: spacing.md },
});
