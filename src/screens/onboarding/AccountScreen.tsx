import { useCallback, useRef, useState } from 'react';
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

export const AccountScreen = ({ navigation, route }: Props) => {
  const fromPayment = Boolean(route.params?.fromPayment);
  const revenueCatAppUserId = route.params?.revenueCatAppUserId?.trim() || '';
  const paymentBypassEnabled = env.ALLOW_PAYMENT_BYPASS;

  const [isLoading, setIsLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const setRedirectAfterOnboarding = useOnboardingStore((s) => s.setRedirectAfterOnboarding);
  const setOnboardingName = useOnboardingStore((s) => s.setName);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);

  const finalizeRef = useRef(false);

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

  if (!fromPayment) {
    return (
      <View style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.contentContainer}>
          <View style={styles.authSection}>
            <Text style={styles.title}>Payment Required</Text>
            <Text style={styles.subtitle}>
              Complete yearly subscription first, then create your account.
            </Text>
          </View>
        </View>
      </View>
    );
  }

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
    if (!fromPayment) {
      Alert.alert('Payment required', 'Please complete payment first.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }

    if (!(await assertEntitlementStillActive())) return;

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

      let userId = data.user?.id || null;

      if (!data.session) {
        const login = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (login.error) throw login.error;
        userId = login.data.user?.id || userId;
      }

      if (!userId) {
        throw new Error('Could not establish session after sign-up.');
      }

      await finalizePaidSignup(userId);
    } catch (e: any) {
      Alert.alert('Sign-up failed', e?.message || 'Could not create account.');
    } finally {
      setIsLoading(false);
    }
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

      await finalizePaidSignup(userId);
    },
    [finalizePaidSignup]
  );

  const handleGoogleSignUp = async () => {
    if (!fromPayment) {
      Alert.alert('Payment required', 'Please complete payment first.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }

    if (!(await assertEntitlementStillActive())) return;

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
    if (!fromPayment) {
      Alert.alert('Payment required', 'Please complete payment first.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your first name.');
      return;
    }

    if (!(await assertEntitlementStillActive())) return;

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

      await finalizePaidSignup(userId);
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-up failed', e?.message || 'Could not authenticate with Apple.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Payment complete. Create your account to enter your dashboard.</Text>

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

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.mutedText}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!isLoading}
          />

          <TouchableOpacity style={[styles.authButton, styles.primaryBtn]} onPress={handleEmailSignUp} disabled={isLoading}>
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
});
