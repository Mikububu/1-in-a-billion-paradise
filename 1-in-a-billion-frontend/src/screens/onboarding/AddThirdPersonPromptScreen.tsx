import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';
import { CityOption } from '@/types/forms';
import { Video, ResizeMode } from 'expo-av';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AddThirdPersonPrompt'>;

export const AddThirdPersonPromptScreen = ({ navigation }: Props) => {
  // HARD LOCK: only allow one free “third person” hook set. If it exists, reuse it.
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
      <Video
        source={require('@/../assets/videos/reverse_video_finding.mp4')}
        style={styles.bgVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        rate={0.5}
        isMuted
      />
      <View style={styles.content}>
        <View style={styles.textCard}>
          <Text style={styles.title} selectable>
            Would you like to do a free hook reading for another person?
          </Text>
          <Text style={styles.subtitle} selectable>
            You can add one person and receive their Sun, Moon, and Rising previews, plus the compatibility preview between you both.
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />

        <Button
          label="YES, ADD A PERSON"
          onPress={() => {
            if (existingPartner && existingPartnerCity) {
              // Reuse existing free partner hook reading; do not create a new one.
              navigation.navigate('PartnerReadings' as any, {
                partnerName: existingPartner.name,
                partnerBirthDate: existingPartner.birthData?.birthDate,
                partnerBirthTime: existingPartner.birthData?.birthTime,
                partnerBirthCity: existingPartnerCity,
                partnerId: existingPartner.id,
                mode: 'onboarding_hook',
              });
              return;
            }
            navigation.navigate('PartnerInfo', { mode: 'onboarding_hook' } as any);
          }}
          variant="primary"
          style={styles.button}
        />

        <Button
          label="NO, CONTINUE"
          onPress={() => navigation.navigate('PostHookOffer')}
          variant="secondary"
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  bgVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1, // explicit: no transparency
  },
  content: {
    flex: 1,
    padding: spacing.page,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(236, 234, 230, 0.5)', // broken white @ 50% opacity
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
    color: colors.text, // keep text black
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },
  button: { width: '100%', marginTop: spacing.md },
});

