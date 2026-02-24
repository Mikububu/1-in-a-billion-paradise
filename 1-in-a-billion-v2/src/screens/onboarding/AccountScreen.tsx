import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Video, ResizeMode } from 'expo-av';
import { BackButton } from '@/components/BackButton';
import { env } from '@/config/env';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import {
  linkRevenueCatAppUser,
  logInRevenueCat,
  verifyEntitlementWithBackend,
} from '@/services/payments';
import { saveHookReadings } from '@/services/userReadings';
import { syncPeopleToSupabase } from '@/services/peopleCloud';
import { syncCompatibilityReadingsToSupabase } from '@/services/compatibilityCloud';
import {
  getMatchNotificationPreferences,
  updateMatchNotificationPreferences,
} from '@/services/matchNotifications';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = Linking.createURL('/auth/callback');

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Account'>;

const PASSWORD_CHARSETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digits: '23456789',
  symbols: '@#$%&*!?+-_=',
};

const pickRandomChar = (chars: string) => {
  const cryptoObj = (globalThis as any)?.crypto;
  if (cryptoObj?.getRandomValues) {
    const array = new Uint32Array(1);
    cryptoObj.getRandomValues(array);
    return chars[array[0] % chars.length];
  }
  return chars[Math.floor(Math.random() * chars.length)];
};

const generateStrongPassword = (length = 16) => {
  const baseLength = Math.max(length, 12);
  const required = [
    pickRandomChar(PASSWORD_CHARSETS.upper),
    pickRandomChar(PASSWORD_CHARSETS.lower),
    pickRandomChar(PASSWORD_CHARSETS.digits),
    pickRandomChar(PASSWORD_CHARSETS.symbols),
  ];

  const allChars =
    PASSWORD_CHARSETS.upper +
    PASSWORD_CHARSETS.lower +
    PASSWORD_CHARSETS.digits +
    PASSWORD_CHARSETS.symbols;

  while (required.length < baseLength) {
    required.push(pickRandomChar(allChars));
  }

  // Fisher-Yates shuffle
  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
};

export const AccountScreen = ({ navigation, route }: Props) => {
  const fromPayment = Boolean(route.params?.fromPayment);
  const captureOnly = !fromPayment;
  const revenueCatAppUserId = route.params?.revenueCatAppUserId?.trim() || '';
  const paymentBypassEnabled = env.ALLOW_PAYMENT_BYPASS;
  const authUser = useAuthStore((s) => s.user);

  const [isLoading, setIsLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const isFormValid = name.trim().length > 0 && email.trim().length > 0 && password.trim().length > 0;

  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const setHasCompletedOnboarding = useOnboardingStore((s) => s.setHasCompletedOnboarding);
  const setShowDashboard = useOnboardingStore((s) => s.setShowDashboard);
  const hasPassedLanguages = useOnboardingStore((s) => s.hasPassedLanguages);
  const setHasPassedLanguages = useOnboardingStore((s) => s.setHasPassedLanguages);
  const setRedirectAfterOnboarding = useOnboardingStore((s) => s.setRedirectAfterOnboarding);
  const setOnboardingName = useOnboardingStore((s) => s.setName);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);

  const finalizeRef = useRef(false);

  useEffect(() => {
    if (captureOnly) {
      setHasPassedLanguages(true);
    }
  }, [captureOnly, setHasPassedLanguages]);

  const assertEntitlementStillActive = useCallback(async () => {
    if (!revenueCatAppUserId) {
      if (paymentBypassEnabled) return true;
      Alert.alert('Payment verification failed', 'Missing purchase identity. Please return and purchase again.');
      return false;
    }

    const verification = await verifyEntitlementWithBackend({ appUserId: revenueCatAppUserId });
    if (verification.success && verification.active) return true;

    if (paymentBypassEnabled) {
      return true;
    }

    Alert.alert(
      'Payment required',
      verification.error || 'Subscription could not be verified. Please complete payment first.'
    );
    return false;
  }, [paymentBypassEnabled, revenueCatAppUserId]);

  const finalizePrePaymentSignup = useCallback(
    async (userId: string) => {
      const trimmed = name.trim();
      const onboarding = useOnboardingStore.getState();
      const profile = useProfileStore.getState();
      if (trimmed) {
        const first = trimmed.split(' ')[0];
        setDisplayName(first);
        setOnboardingName(first);
      }

      const profileName = trimmed || 'You';
      const birthCity = onboarding.birthCity;
      const hasBirthData = Boolean(onboarding.birthDate && onboarding.birthTime && birthCity);

      if (hasBirthData && birthCity) {
        const self = profile.getUser();
        const birthData = {
          birthDate: onboarding.birthDate!,
          birthTime: onboarding.birthTime!,
          birthCity: birthCity.name,
          timezone: birthCity.timezone,
          latitude: birthCity.latitude,
          longitude: birthCity.longitude,
        };

        if (self) {
          profile.updatePerson(self.id, {
            name: profileName,
            isUser: true,
            birthData: {
              ...self.birthData,
              ...birthData,
            },
          } as any);
        } else {
          profile.addPerson({
            name: profileName,
            isUser: true,
            birthData,
          } as any);
        }

        const people = useProfileStore.getState().people || [];
        if (people.length > 0) {
          const syncRes = await syncPeopleToSupabase(userId, people as any);
          if (!syncRes.success) {
            console.warn('⚠️ Failed to sync pre-payment profile data:', syncRes.error);
          } else if ('people' in syncRes && syncRes.people && syncRes.people.length > 0) {
            useProfileStore.getState().replacePeople(syncRes.people as any);
          }
        }
      }

      setHasCompletedOnboarding(false);
      setShowDashboard(false);
      setRedirectAfterOnboarding(null);

      navigation.reset({
        index: 0,
        routes: [{ name: 'CoreIdentitiesIntro' }],
      });
    },
    [
      name,
      navigation,
      setDisplayName,
      setHasCompletedOnboarding,
      setOnboardingName,
      setRedirectAfterOnboarding,
      setShowDashboard,
    ]
  );

  const finalizePaidSignup = useCallback(
    async (userId: string) => {
      if (finalizeRef.current) return;
      finalizeRef.current = true;

      try {
        const onboarding = useOnboardingStore.getState();
        const profile = useProfileStore.getState();

        const trimmed = name.trim();
        if (trimmed) {
          const first = trimmed.split(' ')[0];
          setDisplayName(first);
          setOnboardingName(first);
        }

        const hookReadings = onboarding.hookReadings as any;
        const hasHooks = Boolean(hookReadings?.sun || hookReadings?.moon || hookReadings?.rising);
        if (hasHooks) {
          const saveRes = await saveHookReadings(userId, hookReadings, onboarding.hookAudio as any);
          if (!saveRes.success) {
            console.warn('⚠️ Failed to save hook readings after payment:', saveRes.error);
          }
        }

        const people = profile.people || [];
        if (people.length > 0) {
          const syncRes = await syncPeopleToSupabase(userId, people as any);
          if (!syncRes.success) {
            console.warn('⚠️ Failed to sync people after payment:', syncRes.error);
          } else if ('people' in syncRes && syncRes.people && syncRes.people.length > 0) {
            useProfileStore.getState().replacePeople(syncRes.people as any);
          }
        }

        const compatibilityReadings = profile.compatibilityReadings || [];
        if (compatibilityReadings.length > 0) {
          const compatibilitySyncRes = await syncCompatibilityReadingsToSupabase(
            userId,
            compatibilityReadings as any
          );

          if (!compatibilitySyncRes.success) {
            console.warn(
              '⚠️ Failed to sync compatibility previews after payment:',
              compatibilitySyncRes.error
            );
          } else if (!compatibilitySyncRes.skipped && compatibilitySyncRes.readings) {
            useProfileStore.getState().replaceCompatibilityReadings(compatibilitySyncRes.readings as any);
          }
        }

        if (revenueCatAppUserId) {
          const linked = await logInRevenueCat(userId);
          if (!linked && !paymentBypassEnabled) {
            throw new Error('Could not link RevenueCat purchase to your account.');
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) {
            if (!paymentBypassEnabled) {
              throw new Error('Missing session token to link purchase.');
            }
          } else {
            const linkRes = await linkRevenueCatAppUser({
              accessToken,
              previousAppUserId: revenueCatAppUserId,
            });
            if (!linkRes.success && !paymentBypassEnabled) {
              throw new Error(linkRes.error || 'Could not link subscription to your account.');
            }
          }
        } else if (!paymentBypassEnabled) {
          throw new Error('Missing RevenueCat purchase identity.');
        }

        // Ask once after paid signup. If user chooses "Not now", they still proceed immediately.
        const currentPreferences = await getMatchNotificationPreferences(userId);
        const hasBeenAsked = Boolean(currentPreferences.consentAskedAt);

        if (!hasBeenAsked) {
          await new Promise<void>((resolve) => {
            Alert.alert(
              'Match Alerts',
              'Allow push + email alerts when your first match appears?',
              [
                {
                  text: 'Allow',
                  onPress: () => {
                    void updateMatchNotificationPreferences({
                      userId,
                      enabled: true,
                      source: 'post_signup_prompt',
                    }).finally(resolve);
                  },
                },
                {
                  text: 'Not now',
                  style: 'cancel',
                  onPress: () => {
                    void updateMatchNotificationPreferences({
                      userId,
                      enabled: false,
                      source: 'post_signup_prompt',
                    }).finally(resolve);
                  },
                },
              ],
              { cancelable: false }
            );
          });
        }

        setRedirectAfterOnboarding('Home');
        completeOnboarding();
      } catch (e: any) {
        finalizeRef.current = false;
        Alert.alert('Account setup failed', e?.message || 'Could not finish account setup.');
      }
    },
    [
      completeOnboarding,
      name,
      paymentBypassEnabled,
      revenueCatAppUserId,
      setDisplayName,
      setOnboardingName,
      setRedirectAfterOnboarding,
    ]
  );

  const handleEmailSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }

    if (fromPayment && !(await assertEntitlementStillActive())) return;

    if (!isSupabaseConfigured) {
      Alert.alert('Auth unavailable', 'Supabase is not configured in this build.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      if (data.session) {
        // Email confirmation disabled — signed in immediately
        const userId = data.user?.id;
        if (!userId) throw new Error('Could not establish session after sign-up.');
        if (fromPayment) {
          await finalizePaidSignup(userId);
        } else {
          await finalizePrePaymentSignup(userId);
        }
      } else {
        // Email confirmation enabled — show OTP pin code input
        setShowOtpInput(true);
        setOtpCode('');
      }
    } catch (e: any) {
      Alert.alert('Sign-up failed', e?.message || 'Could not create account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length < 6) {
      Alert.alert('Enter code', 'Please enter the 6-digit code from your email.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'signup',
      });

      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('Verification succeeded but no user session.');

      if (fromPayment) {
        await finalizePaidSignup(userId);
      } else {
        await finalizePrePaymentSignup(userId);
      }
    } catch (e: any) {
      Alert.alert('Verification failed', e?.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
      Alert.alert('Code resent', 'A new code has been sent to your email.');
    } catch (e: any) {
      Alert.alert('Resend failed', e?.message || 'Could not resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateStrongPassword(16);
    setPassword(generated);
  };

  const processOAuthResult = useCallback(
    async (url: string) => {
      const normalizedUrl = url.replace('#', '?');
      const params = new URL(normalizedUrl).searchParams;
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        throw new Error('Missing OAuth tokens.');
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;

      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) throw new Error('No authenticated user after OAuth.');

      if (fromPayment) {
        await finalizePaidSignup(userId);
      } else {
        await finalizePrePaymentSignup(userId);
      }
    },
    [finalizePaidSignup, finalizePrePaymentSignup, fromPayment]
  );

  const handleGoogleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }

    if (fromPayment && !(await assertEntitlementStillActive())) return;

    if (!isSupabaseConfigured) {
      Alert.alert('Auth unavailable', 'Supabase is not configured in this build.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URI,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Missing Google OAuth URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
      if (result.type === 'success' && result.url) {
        await processOAuthResult(result.url);
      }
    } catch (e: any) {
      Alert.alert('Google sign-up failed', e?.message || 'Could not authenticate with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }

    if (fromPayment && !(await assertEntitlementStillActive())) return;

    if (!isSupabaseConfigured) {
      Alert.alert('Auth unavailable', 'Supabase is not configured in this build.');
      return;
    }

    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Missing Apple identity token.');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error('No authenticated user after Apple sign-up.');

      if (fromPayment) {
        await finalizePaidSignup(userId);
      } else {
        await finalizePrePaymentSignup(userId);
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-up failed', e?.message || 'Could not authenticate with Apple.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!fromPayment) return;
    const userId = authUser?.id;
    if (!userId) return;
    if (finalizeRef.current) return;

    let active = true;
    setIsLoading(true);
    (async () => {
      try {
        if (!(await assertEntitlementStillActive())) return;
        if (!active) return;
        await finalizePaidSignup(userId);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [assertEntitlementStillActive, authUser?.id, finalizePaidSignup, fromPayment]);

  return (
    <View style={styles.container}>
      <BackButton
        onPress={() => {
          if (fromPayment) {
            navigation.goBack();
            return;
          }
          if (hasPassedLanguages && !authUser?.id) {
            // User hasn't signed up yet — let them go back freely
            navigation.goBack();
            return;
          }
          if (hasPassedLanguages && authUser?.id) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'CoreIdentitiesIntro' }],
            });
            return;
          }
          if (authUser?.id) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'CoreIdentitiesIntro' }],
            });
            return;
          }
          navigation.reset({
            index: 0,
            routes: [{ name: 'Intro' }],
          });
        }}
      />

      {!videoReady && (
        <Image
          source={require('../../../assets/images/signin-poster.jpg')}
          style={styles.backgroundVideo}
          resizeMode="cover"
        />
      )}

      <Video
        source={require('../../../assets/videos/signin-background.mp4')}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onReadyForDisplay={() => setVideoReady(true)}
      />

      <View style={styles.contentContainer}>
        <View style={styles.authSection}>
          <View style={styles.headlineCard}>
            <Text style={styles.title}>{showOtpInput ? 'Verify Email' : 'Create Account'}</Text>
            <Text style={styles.subtitle}>
              {showOtpInput
                ? 'Enter the 6-digit code we sent to your email.'
                : fromPayment
                  ? 'Payment complete. Create your account to enter your dashboard.'
                  : 'Create your account to save your readings while you continue onboarding.'}
            </Text>
          </View>

          {fromPayment && authUser?.id ? (
            <View style={styles.input}>
              <Text style={styles.subtitle}>Finalizing your subscription and syncing your data...</Text>
            </View>
          ) : showOtpInput ? (
            <>
              <Text style={styles.otpPrompt}>
                We sent a 6-digit code to{'\n'}
                <Text style={styles.otpEmail}>{email.trim()}</Text>
              </Text>

              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor={colors.mutedText}
                value={otpCode}
                onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                autoFocus
                editable={!isLoading}
              />

              <TouchableOpacity
                style={[styles.authButton, styles.primaryBtn, (otpCode.length < 6 && !isLoading) && styles.primaryBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={isLoading || otpCode.length < 6}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify & Continue</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendOtp}
                disabled={isLoading}
              >
                <Text style={styles.resendText}>Didn't get the code? Resend</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={() => { setShowOtpInput(false); setOtpCode(''); }}
              >
                <Text style={styles.resendText}>← Back to sign up</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={colors.mutedText}
                value={name}
                onChangeText={setName}
                editable={!isLoading}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.mutedText}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.mutedText} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.passwordGenerator}
                onPress={handleGeneratePassword}
                disabled={isLoading}
              >
                <Text style={styles.passwordGeneratorText}>Generate strong password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authButton, styles.primaryBtn, (!isFormValid && !isLoading) && styles.primaryBtnDisabled]}
                onPress={handleEmailSignUp}
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create with Email</Text>}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity style={[styles.authButton, styles.appleBtn]} onPress={handleAppleSignUp} disabled={isLoading}>
                  <Text style={styles.appleText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.authButton, styles.googleBtn]} onPress={handleGoogleSignUp} disabled={isLoading}>
                <Text style={styles.googleText}>Continue with Google</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 120,
    paddingBottom: spacing.xl,
  },
  authSection: {
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  headlineCard: {
    backgroundColor: 'rgba(245,243,240,0.7)',
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline,
    color: colors.text,
    fontSize: 30,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: colors.inputStroke,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    fontSize: 16,
    fontFamily: typography.sansRegular,
    color: colors.text,
    minHeight: 54,
  },
  passwordContainer: {
    position: 'relative' as const,
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeToggle: {
    position: 'absolute' as const,
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
  },
  passwordGenerator: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  passwordGeneratorText: {
    fontFamily: typography.sansMedium,
    color: colors.text,
    fontSize: 13,
  },
  authButton: {
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryText: {
    color: '#fff',
    fontFamily: typography.sansBold,
    fontSize: 16,
  },
  appleBtn: {
    backgroundColor: '#000',
  },
  appleText: {
    color: '#fff',
    fontFamily: typography.sansMedium,
    fontSize: 16,
  },
  googleBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#000',
  },
  googleText: {
    color: '#000',
    fontFamily: typography.sansBold,
    fontSize: 16,
  },
  otpPrompt: {
    fontFamily: typography.sansRegular,
    color: colors.text,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  otpEmail: {
    fontFamily: typography.sansBold,
    color: colors.text,
  },
  otpInput: {
    fontSize: 28,
    letterSpacing: 12,
    fontFamily: typography.sansBold,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  resendBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  resendText: {
    fontFamily: typography.sansMedium,
    color: colors.mutedText,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
