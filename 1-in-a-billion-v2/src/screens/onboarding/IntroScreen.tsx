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
import { isSupabaseConfigured } from '@/services/supabase';
import { verifyEntitlementWithBackend } from '@/services/payments';
import { fetchPeopleFromSupabase } from '@/services/peopleCloud';
import { env } from '@/config/env';
import { t, getLanguage, setLanguage, onLanguageChange, LANGUAGE_META, type LanguageCode } from '@/i18n';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  // Language selector state
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(getLanguage());
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // Rotating language pill animation
  const [displayLangIndex, setDisplayLangIndex] = useState(0);
  const langFadeAnim = useRef(new Animated.Value(1)).current;
  const langBorderAnim = useRef(new Animated.Value(0)).current;
  // Only show languages that are actually ready — add more here when translations are complete
  const LANG_NAMES = ['English'];

  useEffect(() => {
    return onLanguageChange(setCurrentLanguage);
  }, []);

  // Auto-rotate language names every 2.5s with fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.timing(langFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== 'web',
        easing: Easing.out(Easing.ease),
      }).start(() => {
        // Switch to next language
        setDisplayLangIndex((prev) => (prev + 1) % LANG_NAMES.length);
        // Fade in
        Animated.timing(langFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
          easing: Easing.in(Easing.ease),
        }).start();
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [langFadeAnim]);

  // "Marching ants" border glow — continuous pulse draws attention to the language pill
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(langBorderAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // color interpolation needs JS driver
        }),
        Animated.timing(langBorderAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [langBorderAnim]);

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
        t('intro.resetAlert.title'),
        t('intro.resetAlert.message'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setTapCount(0) },
          {
            text: t('intro.resetAlert.button'),
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete ALL user data from backend (same as Sign Out)
                const backendUrl = env.CORE_API_URL || 'https://1-in-a-billion-backend.fly.dev';

                if (isSupabaseConfigured) {
                  const { supabase } = await import('@/services/supabase');
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
                Alert.alert(t('common.done'), t('intro.resetAlert.success'));
              } catch (error: any) {
                console.error('Error resetting app:', error);
                setTapCount(0);
                Alert.alert(t('common.error'), error.message || t('error.generic'));
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
  const words = t('intro.tagline').split(' ');

  useEffect(() => {
    // Load music and auto-play on first screen
    (async () => {
      await AmbientMusic.load();
      // Auto-play immediately after loading (no play button needed)
      AmbientMusic.play();
    })();

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
        t('intro.authAlert.title'),
        t('intro.authAlert.message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('intro.authAlert.button'),
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete ALL user data before signing out
                const backendUrl = env.CORE_API_URL || 'https://1-in-a-billion-backend.fly.dev';

                if (isSupabaseConfigured) {
                  const { supabase } = await import('@/services/supabase');
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
                Alert.alert(t('common.error'), error.message || t('error.generic'));
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

      // Attempt to pre-fetch cloud readings so HookSequence doesn't regenerate them
      let customReadings = undefined;
      try {
        const cloudProfile = await fetchPeopleFromSupabase(appUserId);
        if (cloudProfile.success) {
          const selfProfile = cloudProfile.people.find(p => p.isUser);
          if (selfProfile?.hookReadings && selfProfile.hookReadings.length > 0) {
            customReadings = selfProfile.hookReadings.filter(Boolean);
          }
        }
      } catch (err) {
        console.warn('Failed to pre-fetch profile on IntroScreen', err);
      }

      if (customReadings && customReadings.length > 0) {
        Alert.alert(
          t('intro.entitlement.title'),
          t('intro.entitlement.message'),
          [{ text: t('common.ok'), onPress: () => navigation.navigate('HookSequence' as any, { customReadings }) }]
        );
      } else {
        Alert.alert(
          t('intro.entitlement.title'),
          t('intro.entitlement.message'),
          [{ text: t('common.ok'), onPress: () => navigation.navigate('CoreIdentities' as any) }]
        );
      }
      return false;
    }

    setEntitlementState('unknown');
    Alert.alert(t('intro.access.failed.title'), t('intro.access.failed.message'));
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

      {/* Language pill — hidden until multiple translations are ready */}
      {/* TODO: Uncomment when Deutsch, Español, etc. translations are complete
      <TouchableOpacity
        onPress={() => setLangPickerVisible(true)}
        activeOpacity={0.7}
        style={{ position: 'absolute', left: spacing.page, top: insets.top + spacing.sm, zIndex: 50 }}
      >
        <Animated.View
          style={[
            styles.langPill,
            {
              borderColor: langBorderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, colors.primary],
              }),
            },
          ]}
        >
          <Animated.Text style={[styles.langPillText, { opacity: langFadeAnim }]}>
            {LANG_NAMES[displayLangIndex]}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
      <LanguagePicker visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />
      */}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wrapper}>
          {/* Audio Control - Floating */}
          <View style={styles.headerControls}>
            <TouchableOpacity onPress={toggleSound} style={styles.pauseButton}>
              <Text style={styles.pauseText}>{isPlaying ? t('intro.music.pause') : t('intro.music.play')}</Text>
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
              label={isLoggedIn ? t('intro.button.signOut') : t('intro.button.logIn')}
              variant="secondary"
              onPress={handleAuthButton}
            />
            <Button
              label={isLoggedIn ? t('intro.button.dashboard') : t('intro.button.getStarted')}
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
  langPill: {
    minWidth: 90,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  langPillText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
