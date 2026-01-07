import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Image, Dimensions, Alert, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Intro'>;

const { width, height } = Dimensions.get('window');
const womanHappyImage = require('../../../assets/images/woman-happy.png');

export const IntroScreen = ({ navigation }: Props) => {
  const reset = useOnboardingStore((state: any) => state.reset);
  const user = useAuthStore((state: any) => state.user);
  const displayName = useAuthStore((state: any) => state.displayName);
  const signOut = useAuthStore((state: any) => state.signOut);
  const isLoggedIn = !!user || !!displayName;

  const { isPlaying } = useMusicStore();

  // Animations for the big "1"
  const zoomAnim = useRef(new Animated.Value(1)).current;

  // Word highlight animation
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const words = "Find rare compatibility through deep matching across multiple spiritual systems.".split(' ');

  useEffect(() => {
    // Load music once
    AmbientMusic.load();

    // Word highlight animation - Random word selection instead of sequential
    const wordInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * words.length);
      setActiveWordIndex(randomIndex);
    }, 24000 / words.length);

    return () => clearInterval(wordInterval);
  }, []);

  // Use focus effect to ensure music is playing when focused and restart zoom animation on focus
  useFocusEffect(
    useCallback(() => {
      if (isPlaying) {
        AmbientMusic.play();
      }
      // Start zoom animation on focus - works for both native and web
      const zoomLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(zoomAnim, {
            toValue: 1.3,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web', // native driver not supported on web
          }),
          Animated.timing(zoomAnim, {
            toValue: 1.0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      zoomLoop.start();
      return () => {
        // Cleanup zoom animation on blur
        zoomLoop.stop();
        // Music persists on blur
      };
    }, [isPlaying, zoomAnim])
  );

  const toggleSound = () => {
    if (isPlaying) {
      AmbientMusic.pause();
    } else {
      AmbientMusic.play();
    }
  };

  const handleAuthButton = () => {
    if (isLoggedIn) {
      Alert.alert(
        'Log Out',
        `Are you sure you want to log out${displayName ? `, ${displayName}` : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: async () => await signOut() },
        ]
      );
    } else {
      navigation.navigate('SignIn' as any, { allowSignUp: false });
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Image - bottom area */}
      <Image
        source={womanHappyImage}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wrapper}>
          {/* Audio Control - Floating */}
          <View style={styles.headerControls}>
            <TouchableOpacity onPress={toggleSound} style={styles.pauseButton}>
              <Text style={styles.pauseText}>{isPlaying ? 'Pause Music' : 'Play Music'}</Text>
            </TouchableOpacity>
          </View>

          {/* TOP: Branding and Animated Copy */}
          <View style={styles.topText}>
            <View>
              <Animated.Text
                style={[
                  styles.number,
                  {
                    color: colors.text,
                    transform: [{ scale: zoomAnim }]
                  }
                ]}
              >
                1
              </Animated.Text>
            </View>
            <Text style={styles.brand}>In A Billion</Text>

            <View style={styles.copyContainer}>
              {words.map((word, index) => (
                <View
                  key={index}
                  style={[
                    styles.wordWrapper,
                    activeWordIndex === index && styles.wordActive
                  ]}
                >
                  <Text
                    style={[
                      styles.wordText,
                      activeWordIndex === index && styles.wordTextActive
                    ]}
                  >
                    {word}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* MIDDLE: Primary Actions */}
          <View style={styles.middleButtons}>
            <Button
              label={isLoggedIn ? "Log Out" : "Log In"}
              variant="secondary"
              onPress={handleAuthButton}
            />
            <Button
              label={isLoggedIn ? "My Secret Life" : "Get Started"}
              onPress={() => {
                if (isLoggedIn) {
                  // Handled by global session store
                } else {
                  // Reset onboarding completion flag when starting fresh
                  useOnboardingStore.getState().setHasCompletedOnboarding(false);
                  navigation.navigate('Relationship');
                }
              }}
            />
          </View>

          {/* RESET (Beta Control) */}
          <Pressable
            onPress={() => {
              Alert.alert('Reset App (Beta)', 'This will wipe all local data. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Nuclear Reset',
                  style: 'destructive',
                  onPress: async () => {
                    reset();
                    await signOut();
                    Alert.alert('Reset Complete', 'App data has been wiped.');
                  }
                }
              ]);
            }}
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>RESET</Text>
          </Pressable>

          {/* Spacer to push content up from the background image */}
          <View style={styles.bottomSpacer} />

          {/* Debug Screen index */}
          <Text style={styles.screenId}>1</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundImage: {
    position: 'absolute',
    bottom: -height * 0.1,
    left: 0,
    width: width,
    height: height * 0.5,
  },
  safeArea: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: spacing.page,
  },
  topText: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  number: {
    fontFamily: typography.headline,
    fontSize: 140,
    lineHeight: 140,
    color: colors.text,
  },
  brand: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    marginTop: -spacing.sm,
  },
  copyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  wordWrapper: {
    paddingHorizontal: 1,
    paddingVertical: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  wordActive: {
    backgroundColor: 'rgba(230, 0, 0, 0.5)',
  },
  wordText: {
    fontFamily: typography.sansRegular,
    fontSize: 18,
    lineHeight: 24,
    color: colors.mutedText,
  },
  wordTextActive: {
    color: '#FFFFFF',
    fontFamily: typography.sansMedium,
  },
  middleButtons: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: -height * 0.1,
  },
  bottomSpacer: {
    height: height * 0.25,
  },
  screenId: {
    position: 'absolute',
    top: 95,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
  },
  resetButton: {
    position: 'absolute',
    top: 10,
    left: 20,
    zIndex: 100,
    padding: 10,
  },
  resetText: {
    fontFamily: typography.sansMedium,
    fontSize: 10,
    color: colors.mutedText,
    opacity: 0.5,
  },
  headerControls: {
    position: 'absolute',
    top: height * 0.58,
    left: width * 0.12,
    zIndex: 100,
  },
  pauseButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pauseText: {
    color: colors.text,
    fontFamily: typography.sansMedium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
});
