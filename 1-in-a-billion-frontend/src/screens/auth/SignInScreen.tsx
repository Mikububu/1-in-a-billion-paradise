/**
 * SIGN IN SCREEN
 * 
 * Production-ready authentication with Google, Apple, and Email/Password Sign-In.
 * 
 * Per AUTH_FLOW_CONTRACT.md:
 * - Initial "Log In" (allowSignUp=false): Sign-in ONLY for returning users
 * - Post-onboarding (allowSignUp=true): Sign-up allowed for new users
 */

import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Video, ResizeMode } from 'expo-av';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { BackButton } from '@/components/BackButton';

// Required for OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = 'oneinabillion://auth/callback';

type EmailAuthState = 'idle' | 'loading' | 'error';

interface SignInScreenProps {
  route?: {
    params?: {
      allowSignUp?: boolean; // If true, show sign-up option. If false, sign-in only.
    };
  };
}

export const SignInScreen = ({ route }: SignInScreenProps) => {
  const allowSignUp = route?.params?.allowSignUp ?? false; // Default: sign-in only (returning users)
  const navigation = useNavigation<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const { isPlaying } = useMusicStore();

  // Email authentication state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailAuthState, setEmailAuthState] = useState<EmailAuthState>('idle');
  // Mode is determined by allowSignUp param - no toggle needed
  const isSigningUp = allowSignUp;
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isPlaying) {
        AmbientMusic.play();
      }
    }, [isPlaying])
  );

  const handleDeepLink = useCallback(async (event: { url: string }) => {
    if (!isSupabaseConfigured) return;

    const url = event.url;
    console.log('🔗 Deep link received:', url);

    // Handle password reset confirmation
    if (url.includes('auth/reset-password') || url.includes('type=recovery')) {
      try {
        const normalizedUrl = url.replace('#', '?');
        const params = new URL(normalizedUrl).searchParams;

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (type === 'recovery' && accessToken && refreshToken) {
          console.log('✅ Password reset link confirmed, setting session...');
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            Alert.alert('Error', 'Failed to verify reset link. Please request a new one.');
            return;
          }

          // Navigate to password reset screen (user needs to set new password)
          Alert.alert(
            'Reset Password',
            'Please set your new password.',
            [
              {
                text: 'Set Password',
                onPress: () => {
                  // User will be prompted to set new password via Supabase
                  // Or we can navigate to a password reset screen
                  navigation.navigate('Home');
                },
              },
            ]
          );
          setIsLoading(false);
          return;
        }
      } catch (error: any) {
        console.error('❌ Password reset link error:', error.message);
        Alert.alert('Error', 'Failed to process password reset link');
      }
    }

    // Email confirmation is now automatic - no deep link handling needed

    // Handle OAuth callbacks (Google, Apple)
    if (url.includes('auth/callback') || url.includes('access_token=') || url.includes('code=')) {
      try {
        const normalizedUrl = url.replace('#', '?');
        const params = new URL(normalizedUrl).searchParams;

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');

        if (errorCode) {
          setIsLoading(false);
          navigation.navigate('Intro');
          Alert.alert('Auth Error', errorDescription || 'Failed to sign in');
          return;
        }

        if (accessToken && refreshToken) {
          console.log('✅ Found tokens, setting session...');

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('❌ Session error:', sessionError.message);
            setIsLoading(false);
            navigation.navigate('Intro');
            Alert.alert('Session Error', sessionError.message);
            return;
          }

          console.log('✅ Session set successfully');
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('❌ Deep link error:', error.message);
        setIsLoading(false);
        navigation.navigate('Intro');
        Alert.alert('Auth Error', 'Failed to process authentication');
      }
    }
  }, [navigation]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, [handleDeepLink]);

  const handleSupabaseExchange = async (idToken: string, provider: 'apple' | 'google') => {
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider,
        token: idToken,
      });

      if (error) throw error;
      setIsLoading(false);
    } catch (error: any) {
      console.error(`❌ ${provider.toUpperCase()} EXCHANGE ERROR:`, error.message);
      setIsLoading(false);
      navigation.navigate('Intro');
      Alert.alert('Sign In Error', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    try {
      console.log('🚀 GOOGLE AUTH: Starting Google sign-in flow');
      setIsLoading(true);
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

      if (data?.url) {
        console.log('🌐 GOOGLE AUTH: Opening browser with URL');
        const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
        console.log('🔙 GOOGLE AUTH: Browser returned, type:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('✅ GOOGLE AUTH: Success! Processing redirect URL');
          handleDeepLink({ url: result.url });
        } else {
          console.log('❌ GOOGLE AUTH: Flow interrupted');
          setIsLoading(false);
          navigation.navigate('Intro');
          if (result.type !== 'cancel') {
            Alert.alert('Sign In Error', 'Authentication was interrupted. Please try again.');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ GOOGLE AUTH: Error:', error.message);
      setIsLoading(false);
      navigation.navigate('Intro');
      Alert.alert('Sign In Error', error.message || 'Failed to open Google Sign-In');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        handleSupabaseExchange(credential.identityToken, 'apple');
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Error', e.message);
      }
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password || password.length === 0) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    try {
      setEmailAuthState('loading');
      // Use centralized env config (same as other services)
      const backendUrl = process.env.EXPO_PUBLIC_CORE_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://1-in-a-billion-backend.fly.dev';
      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please set EXPO_PUBLIC_CORE_API_URL in your .env file.');
      }

      // Mode is determined by allowSignUp param - no toggle needed
      const isCreatingAccount = isSigningUp;

      const endpoint = isCreatingAccount ? '/api/auth/signup' : '/api/auth/signin';
      console.log(`📧 ${isCreatingAccount ? 'Signing up' : 'Signing in'}:`, email);

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isCreatingAccount ? 'sign up' : 'sign in'}`);
      }

      console.log(`✅ ${isCreatingAccount ? 'Sign up' : 'Sign in'} successful`);

      // Email confirmation is now automatic - no need to check for requiresConfirmation

      if (data.session) {
        // CRITICAL: For new signups, create profile BEFORE setting session
        // This prevents the race condition where onAuthStateChange checks
        // for profile existence before we create it
        if (isCreatingAccount && data.user) {
          console.log('📝 Creating profile BEFORE setting session...');
          const { upsertSelfProfileToSupabase } = await import('@/services/profileUpsert');
          const displayName = data.user.email?.split('@')?.[0] || 'User';
          const result = await upsertSelfProfileToSupabase({
            userId: data.user.id,
            email: data.user.email || '',
            displayName,
          });
          if (!result.success) {
            console.warn('Profile upsert failed:', result.error);
          } else {
            console.log('✅ Profile created for new user');
          }
        }

        // NOW set the session - profile already exists
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        // Navigate to BirthInfo for new signups to collect birth data
        if (isCreatingAccount) {
          console.log('📍 Navigating to BirthInfo to collect birth data...');
          AmbientMusic.fadeOut(); // Fade out music after successful login
          navigation.navigate('BirthInfo');
        } else {
          // For existing users, verify profile exists before allowing sign-in
          console.log('🔍 Verifying profile exists for existing user...');
          const { checkProfileExists } = await import('@/services/profileUpsert');
          const profileExists = await checkProfileExists(data.user.id);
          
          if (!profileExists) {
            // Profile was deleted - sign out and show error
            console.error('❌ No profile found - account deleted');
            await supabase.auth.signOut();
            setEmailAuthState('error');
            Alert.alert(
              'No Account Found',
              'Your account data has been deleted. Please sign up to create a new account.',
              [{ text: 'OK', onPress: () => navigation.navigate('Intro') }]
            );
            return;
          }
          
          // Profile exists - continue to dashboard
          AmbientMusic.fadeOut();
          console.log('✅ Existing user sign-in successful - navigating to Dashboard');
          useOnboardingStore.getState().setShowDashboard(true);
        }

        setEmailAuthState('idle');
        setShowEmailInput(false);
        setEmail('');
        setPassword('');
      }
    } catch (error: any) {
      console.error(`❌ ${isSigningUp ? 'SIGNUP' : 'SIGNIN'} ERROR:`, error.message);
      setEmailAuthState('error');
      Alert.alert(
        isSigningUp ? 'Sign Up Error' : 'Sign In Error',
        error.message || `Failed to ${isSigningUp ? 'create account' : 'sign in'}`
      );
      setTimeout(() => setEmailAuthState('idle'), 2000);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      setEmailAuthState('loading');
      // Use centralized env config (same as other services)
      const backendUrl = process.env.EXPO_PUBLIC_CORE_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://1-in-a-billion-backend.fly.dev';
      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please set EXPO_PUBLIC_CORE_API_URL in your .env file.');
      }

      const response = await fetch(`${backendUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send password reset email');
      }

      Alert.alert(
        'Email Sent',
        'If an account exists with this email, a password reset link has been sent. Please check your inbox and follow the instructions.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowForgotPassword(false);
              setEmailAuthState('idle');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Forgot password error:', error.message);
      setEmailAuthState('error');
      Alert.alert('Error', error.message || 'Failed to send password reset email');
      setTimeout(() => setEmailAuthState('idle'), 2000);
    }
  };

  return (
    <View style={styles.container}>
      <BackButton onPress={() => navigation.navigate('Intro')} />

      {/* Background Video + Poster */}
      {!videoReady && (
        <Image
          source={require('../../../assets/images/signin-poster.jpg')}
          style={styles.backgroundVideo}
          resizeMode="cover"
        />
      )}

      <Video
        key="signin-video-v2" // Cache-busting key - update this when video file changes
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
          {!showEmailInput ? (
            <>
              <TouchableOpacity
                style={[styles.authButton, styles.emailButton]}
                onPress={() => setShowEmailInput(true)}
                disabled={isLoading}
              >
                <Text style={styles.emailButtonText}>Login with Email</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.authButton, styles.appleButton]}
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                >
                  <Text style={styles.appleText}>Login with Apple</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.authButton, styles.googleButton]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.googleText}>Login with Google</Text>
                )}
              </TouchableOpacity>
            </>
          ) : showForgotPassword ? (
            <>
              <Text style={styles.forgotPasswordTitle}>Reset Password</Text>
              <Text style={styles.forgotPasswordSubtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <TextInput
                style={styles.emailInput}
                placeholder="Email"
                placeholderTextColor={colors.mutedText}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={emailAuthState !== 'loading'}
                autoFocus
              />

              <View style={styles.emailActions}>
                <TouchableOpacity
                  style={[styles.authButton, styles.emailSubmitButton]}
                  onPress={handleForgotPassword}
                  disabled={emailAuthState === 'loading'}
                >
                  {emailAuthState === 'loading' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.emailSubmitText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowForgotPassword(false);
                    setEmailAuthState('idle');
                  }}
                  disabled={emailAuthState === 'loading'}
                >
                  <Text style={styles.cancelButtonText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TextInput
                style={styles.emailInput}
                placeholder="Email"
                placeholderTextColor={colors.mutedText}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={emailAuthState !== 'loading'}
              />

              <TextInput
                style={styles.emailInput}
                placeholder="Password"
                placeholderTextColor={colors.mutedText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={emailAuthState !== 'loading'}
              />

              <View style={styles.emailActions}>
                <TouchableOpacity
                  style={[styles.authButton, styles.emailSubmitButton]}
                  onPress={handleEmailAuth}
                  disabled={emailAuthState === 'loading'}
                >
                  {emailAuthState === 'loading' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.emailSubmitText}>
                      {isSigningUp ? 'Sign Up' : 'Sign In'}
                    </Text>
                  )}
                </TouchableOpacity>

                {!isSigningUp && (
                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => setShowForgotPassword(true)}
                    disabled={emailAuthState === 'loading'}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

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
    backgroundColor: colors.background, // Solid background since assets don't exist
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: typography.sansMedium,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  authSection: {
    gap: spacing.sm,
    paddingTop: 140, // Position below Back button (top: 60) without overlap
  },
  authButton: {
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  googleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // White with 50% opacity
    borderWidth: 2,
    borderColor: '#000',
  },
  googleText: {
    color: '#000',
    fontSize: 16,
    fontFamily: typography.sansBold,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  appleText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: typography.sansMedium,
  },
  emailButton: {
    backgroundColor: colors.primary,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: typography.sansMedium,
  },
  devButton: {
    backgroundColor: '#666',
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 56,
  },
  devButtonText: {
    fontSize: 14,
    fontFamily: typography.sansMedium,
    color: '#fff',
  },
  emailInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputStroke,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    fontSize: 16,
    fontFamily: typography.sansRegular,
    color: colors.text,
    minHeight: 56,
  },
  emailActions: {
    gap: spacing.sm,
  },
  emailSubmitButton: {
    backgroundColor: colors.primary,
  },
  emailSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: typography.sansMedium,
  },
  switchModeButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  switchModeText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontFamily: typography.sansRegular,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontFamily: typography.sansRegular,
  },
  forgotPasswordTitle: {
    color: '#fff',
    fontSize: 24,
    fontFamily: typography.headline,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  forgotPasswordSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontFamily: typography.sansRegular,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  forgotPasswordButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontFamily: typography.sansRegular,
    textDecorationLine: 'underline',
  },
});
