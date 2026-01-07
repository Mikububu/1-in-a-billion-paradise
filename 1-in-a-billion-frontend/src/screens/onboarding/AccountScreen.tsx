/**
 * ACCOUNT SCREEN (Screen 6 - Post-Onboarding Sign-Up)
 * 
 * Per AUTH_FLOW_CONTRACT.md:
 * - This is "State Two" → "Sign up with Google screen"
 * - User has completed onboarding
 * - Sign-up IS allowed here (allowSignUp=true equivalent)
 * - Creates Supabase account and attaches local onboarding data
 */

import { useState, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useMusicStore } from '@/store/musicStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { AmbientMusic } from '@/services/ambientMusic';
import { env } from '@/config/env';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = 'oneinabillion://auth/callback';

type EmailAuthState = 'idle' | 'loading' | 'error';
type Props = NativeStackScreenProps<OnboardingStackParamList, 'Account'>;

export const AccountScreen = ({ navigation }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const { isPlaying } = useMusicStore();

  // Email authentication state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailAuthState, setEmailAuthState] = useState<EmailAuthState>('idle');
  const [isSigningUp, setIsSigningUp] = useState(true); // Default to sign-up mode
  const [showEmailInput, setShowEmailInput] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isPlaying) {
        AmbientMusic.play();
      }
    }, [isPlaying])
  );

  const handleSupabaseExchange = async (idToken: string, provider: 'apple' | 'google') => {
    try {
      const { setFlowType } = useAuthStore.getState();
      setFlowType('onboarding'); // FLAG: Allow local data validation

      const { error } = await supabase.auth.signInWithIdToken({
        provider,
        token: idToken,
      });

      if (error) throw error;
      setIsLoading(false);
      // Bootstrap will detect session and handle onboarding continuation
    } catch (error: any) {
      console.error(`❌ ${provider.toUpperCase()} EXCHANGE ERROR:`, error.message);
      setIsLoading(false);
      Alert.alert('Sign In Error', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    try {
      console.log('🚀 GOOGLE AUTH: Starting Google sign-in flow');
      setIsLoading(true);

      const { setFlowType } = useAuthStore.getState();
      setFlowType('onboarding');

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
        console.log('🌐 GOOGLE AUTH: Opening browser');
        const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);

        if (result.type === 'success' && result.url) {
          console.log('✅ GOOGLE AUTH: Success!');
          // Deep link handler will process the session
        } else {
          setIsLoading(false);
          if (result.type !== 'cancel') {
            Alert.alert('Sign In Error', 'Authentication was interrupted. Please try again.');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ GOOGLE AUTH: Error:', error.message);
      setIsLoading(false);
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
    // Validate inputs
    if (isSigningUp && !name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setEmailAuthState('loading');
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      const { setFlowType } = useAuthStore.getState();
      setFlowType('onboarding');

      const endpoint = isSigningUp ? '/api/auth/signup' : '/api/auth/signin';
      console.log(`📧 ${isSigningUp ? 'Signing up' : 'Signing in'}:`, email);

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
        throw new Error(data.error || `Failed to ${isSigningUp ? 'sign up' : 'sign in'}`);
      }

      console.log(`✅ ${isSigningUp ? 'Sign up' : 'Sign in'} successful`);

      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        // Save name to onboarding store for PostHookOfferScreen to use
        if (isSigningUp && name.trim()) {
          useOnboardingStore.getState().setName(name.trim());
        }

        // Profile will be created by PostHookOfferScreen (same flow as Google OAuth)
        setEmailAuthState('idle');
        setShowEmailInput(false);
        setName('');
        setEmail('');
        setPassword('');
      } // RootNavigator will detect session and continue to HookSequence
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

  return (
    <View style={styles.container}>
      {/* Background Video + Poster */}
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

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        disabled={isLoading}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        {/* Email button at top */}
        <View style={styles.topSection}>
          {!showEmailInput && (
            <TouchableOpacity
              style={[styles.authButton, styles.emailButton]}
              onPress={() => setShowEmailInput(true)}
              disabled={isLoading}
            >
              <Text style={styles.emailButtonText}>Continue with Email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Auth Section at bottom */}
        <View style={styles.authSection}>
          {!showEmailInput ? (
            <>
              <TouchableOpacity
                style={[styles.authButton, styles.googleButton]}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.googleText}>Continue with Google</Text>
                )}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.authButton, styles.appleButton]}
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                >
                  <Text style={styles.appleText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {isSigningUp && (
                <TextInput
                  style={styles.emailInput}
                  placeholder="Name (how should we call you?)"
                  placeholderTextColor={colors.mutedText}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={emailAuthState !== 'loading'}
                />
              )}

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
                placeholder="Password (min 6 characters)"
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

                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => setIsSigningUp(!isSigningUp)}
                  disabled={emailAuthState === 'loading'}
                >
                  <Text style={styles.switchModeText}>
                    {isSigningUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowEmailInput(false);
                    setName('');
                    setEmail('');
                    setPassword('');
                    setEmailAuthState('idle');
                  }}
                  disabled={emailAuthState === 'loading'}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
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
    backgroundColor: colors.background,
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
    justifyContent: 'space-between',
  },
  topSection: {
    paddingTop: 120,
  },
  titleContainer: {
    paddingTop: 120,
    paddingBottom: spacing.xl,
  },
  titleBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.button,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: typography.sansBold,
    color: colors.text,
    textAlign: 'center',
  },
  authSection: {
    gap: spacing.sm,
  },
  authButton: {
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  googleText: {
    color: '#000',
    fontSize: 16,
    fontFamily: typography.sansMedium,
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
  emailInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
});
