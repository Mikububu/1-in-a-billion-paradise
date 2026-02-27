import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Image, Dimensions, Alert, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { verifyEntitlementWithBackend } from '@/services/payments';
import { env } from '@/config/env';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Intro'>;

const { width, height } = Dimensions.get('window');
const womanHappyImage = require('../../../assets/images/woman-happy.png');

export const IntroScreen = ({ navigation }: Props) => {
  const reset = useOnboardingStore((state: any) => state.reset);
  const setShowDashboard = useOnboardingStore((state: any) => state.setShowDashboard);
  const hasCompletedOnboarding = useOnboardingStore((state: any) => state.hasCompletedOnboarding);
  const resetProfile = useProfileStore((state: any) => state.reset);
  const user = useAuthStore((state: any) => state.user);
  const signOut = useAuthStore((state: any) => state.signOut);
  const setEntitlementState = useAuthStore((state: any) => state.setEntitlementState);
  const isLoggedIn = !!user;

  const { isPlaying } = useMusicStore();

  // Animations for the big "1"
  const zoomAnim = useRef(new Animated.Value(1)).current;

  // 5-tap reset feature on the big "1"
  const [tapCount, setTapCount] = useState(0);
  const tapTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleBigOneTap = () => {
    // Clear previous timeout
    if (tapTimeout.current) {
      clearTimeout(tapTimeout.current);
    }

    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= 5) {
      // Reset everything - full purge like Sign Out
      Alert.alert(
        'Reset App',
        'This will delete ALL your data (readings, people, account) and reset the app. Continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setTapCount(0) },
          {
            text: 'Reset Everything',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete ALL user data from backend (same as Sign Out)
                const backendUrl = env.CORE_API_URL || 'https://1-in-a-billion-backend.fly.dev';

                if (isSupabaseConfigured) {
                  const { data: { session } } = await supabase.auth.getSession();

                  if (session?.user?.id) {
                    try {
                      const response = await fetch(`${backendUrl}/api/account/purge`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                        },
                      });

                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.warn('Backend purge failed, but continuing local reset:', errorData.error);
                      }
                    } catch (fetchErr) {
                      console.warn('Network error during purge, continuing local reset:', fetchErr);
                    }
                  }
                }

                // Clear ALL local data
                reset(); // Clears onboarding store
                resetProfile(); // Clears all people (person 1 and 3)
                setShowDashboard(false);

                // Sign out (clears auth session)
                await signOut();

                setTapCount(0);
                Alert.alert('Done', 'All data has been deleted and app reset.');
              } catch (error: any) {
                console.error('Error resetting app:', error);
                setTapCount(0);
                Alert.alert('Error', error.message || 'Failed to reset. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      // Reset tap count after 2 seconds of no taps
      tapTimeout.current = setTimeout(() => {
        setTapCount(0);
      }, 2000);
    }
  };

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

  const handleAuthButton = async () => {
    if (isLoggedIn) {
      Alert.alert(
        'Sign Out',
        'By signing out you would delete all your user data and history. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete ALL user data before signing out
                const backendUrl = env.CORE_API_URL || 'https://1-in-a-billion-backend.fly.dev';

                if (isSupabaseConfigured) {
                  const { data: { session } } = await supabase.auth.getSession();

                  if (session?.user?.id) {
                    try {
                      const response = await fetch(`${backendUrl}/api/account/purge`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                        },
                      });

                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.warn('Backend purge failed, but continuing local signout:', errorData.error);
                      }
                    } catch (fetchErr) {
                      console.warn('Network error during purge, continuing local signout:', fetchErr);
                    }
                  }
                }

                // Clear ALL local data (onboarding + profile + auth)
                reset(); // Clears onboarding store
                resetProfile(); // CRITICAL: Clears all people including person 3

                // Reset showDashboard flag
                setShowDashboard(false);

                // Sign out (clears auth session)
                await signOut();
              } catch (error: any) {
                console.error('Error deleting account:', error);
                Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
              }
            }
          },
        ]
      );
    } else {
      navigation.navigate('SignIn' as any, { allowSignUp: false });
    }
  };

  const canEnterDashboard = useCallback(async () => {
    if (env.ALLOW_PAYMENT_BYPASS) {
      setEntitlementState('active');
      return true;
    }

    const appUserId = user?.id?.trim();
    if (!appUserId) {
      return false;
    }

    const verification = await verifyEntitlementWithBackend({ appUserId });
    if (verification.success && verification.active) {
      setEntitlementState('active');
      return true;
    }

    // Allow inactive entitlement only for users who have already completed paid onboarding.
    if (verification.success && !verification.active) {
      if (hasCompletedOnboarding) {
        setEntitlementState('inactive');
        return true;
      }
      Alert.alert(
        'Continue onboarding',
        'Finish onboarding and subscription to unlock dashboard access.',
        [{ text: 'OK', onPress: () => navigation.navigate('CoreIdentitiesIntro' as any) }]
      );
      return false;
    }

    setEntitlementState('unknown');
    Alert.alert('Access check failed', 'Could not verify your subscription right now.');
    return false;
  }, [hasCompletedOnboarding, setEntitlementState, user?.id]);

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
            <TouchableOpacity onPress={handleBigOneTap} activeOpacity={0.9}>
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
            </TouchableOpacity>
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
              label={isLoggedIn ? "Sign Out" : "Log In"}
              variant="secondary"
              onPress={handleAuthButton}
            />
            <Button
              label={isLoggedIn ? "My Secret Life" : "Get Started"}
              onPress={async () => {
                if (isLoggedIn) {
                  // Fade out music when going to Dashboard
                  const accessAllowed = await canEnterDashboard();
                  if (!accessAllowed) return;
                  // Prevent focus handlers on next screens from immediately restarting intro music.
                  useMusicStore.getState().setIsPlaying(false);
                  AmbientMusic.fadeOut();
                  setShowDashboard(true);
                } else {
                  // Keep intro music running through onboarding flow.
                  // Reset onboarding completion flag when starting fresh
                  useOnboardingStore.getState().setHasCompletedOnboarding(false);
                  navigation.navigate('Relationship');
                }
              }}
            />
          </View>

          {/* Spacer to push content up from the background image */}
          <View style={styles.bottomSpacer} />

        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    lineHeight: Platform.OS === 'android' ? 120 : 140,
    color: colors.text,
    marginBottom: Platform.OS === 'android' ? 10 : 0,
  },
  brand: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    marginTop: Platform.OS === 'android' ? spacing.sm : -spacing.sm,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  wordActive: {
    backgroundColor: colors.highlightYellow,
  },
  wordText: {
    fontFamily: typography.sansRegular,
    fontSize: 18,
    lineHeight: 24,
    color: colors.mutedText,
  },
  wordTextActive: {
    color: colors.text,
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
  headerControls: {
    position: 'absolute',
    top: Platform.OS === 'android' ? height * 0.07 : height * 0.58,
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
