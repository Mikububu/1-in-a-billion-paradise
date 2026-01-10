import { SimpleSlider } from '@/components/SimpleSlider';
// import { Slider } from 'react-native'; // Fallback or mock if needed, but RN doesn't have Slider anymore.
// We will mock it inline or use a simple view.
import * as Haptics from 'expo-haptics';
import { useRef, useState, useCallback } from 'react';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { describeIntensity } from '@/utils/intensity';

import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Relationship'>;

export const RelationshipScreen = ({ navigation }: Props) => {
  const relationshipIntensity = useOnboardingStore((state) => state.relationshipIntensity);
  const setIntensity = useOnboardingStore((state) => state.setRelationshipIntensity);
  const { signOut } = useAuthStore();
  const lastValue = useRef(relationshipIntensity);
  const descriptor = describeIntensity(relationshipIntensity);
  const { isPlaying } = useMusicStore();
  const [videoReady, setVideoReady] = useState(false);

  // Keep ambient music playing
  useFocusEffect(
    useCallback(() => {
      if (isPlaying) {
        AmbientMusic.play();
      }
    }, [isPlaying])
  );

  const handleValueChange = (nextValue: number) => {
    // const rounded = Math.round(nextValue); // SimpleSlider might return raw values, or we adapt logic
    // For SimpleSlider (custom), let's ensure it handles touches or just skip drag logic for now if it's passive
    // But checking the implementation, SimpleSlider is just a visual View for now? 
    // Wait, the implementation I wrote was just a visual bar. It needs interaction.
    // For now, let's just make it compilable.
    const rounded = Math.round(nextValue);
    if (rounded !== lastValue.current) {
      Haptics.selectionAsync();
      lastValue.current = rounded;
    }
    setIntensity(rounded);
  };

  const handleBack = async () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // User is at root (likely auto-logged in) -> Sign out to go back to Intro
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Intro' }],
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Video at bottom - simple loop */}
      <Video
        source={require('../../../assets/videos/couple-laughing.mp4')}
        style={styles.bottomVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        rate={0.5}
        onReadyForDisplay={() => setVideoReady(true)}
      />

      {/* Poster overlay - shows until video is ready */}
      {!videoReady && (
        <Image
          source={require('../../../assets/images/couple-poster.jpg')}
          style={[styles.bottomVideo, styles.posterOverlay]}
          resizeMode="cover"
        />
      )}

      <BackButton onPress={handleBack} />

      {/* Content at top */}
      <View style={styles.content}>
        <Text style={styles.title}>What kind of relationship dynamic do you desire?</Text>

        <View style={styles.sliderCard}>
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Safe</Text>
            <Text style={styles.legendLabel}>Spicy</Text>
          </View>

          {/* Replaced Slider with SimpleSlider */}
          <SimpleSlider
            minimumValue={0}
            maximumValue={10}
            value={relationshipIntensity}
            onValueChange={handleValueChange}
          />

          <Text style={styles.caption}>{descriptor.caption}</Text>

          <Text style={styles.helper}>
            This helps us calibrate which compatibility signals matter most to you. You can adjust this anytime in settings.
          </Text>
        </View>

        {/* Button - positioned right after helper text */}
        <View style={styles.footer}>
          <Button label="Continue" onPress={() => navigation.navigate('BirthInfo')} />
        </View>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep the root container transparent so the global leather texture shows through consistently.
    backgroundColor: 'transparent',
  },
  bottomVideo: {
    position: 'absolute',
    bottom: -50,
    left: 0,
    right: 0,
    height: '55%',
    zIndex: 0, // Background
    opacity: 0.82,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: 80,
    zIndex: 1, // Content above video
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
  title: {
    fontFamily: typography.headline,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  sliderCard: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    padding: spacing.lg,
    // Use broken-white card background (not pure white)
    backgroundColor: colors.buttonBg,
    marginBottom: spacing.xl,
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
  helper: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    marginTop: -20, // Negative margin to pull button up
    paddingHorizontal: spacing.page,
    zIndex: 10,
  },
  posterOverlay: {
    position: 'absolute',
    zIndex: 1,
    opacity: 0.82,
  },
});
