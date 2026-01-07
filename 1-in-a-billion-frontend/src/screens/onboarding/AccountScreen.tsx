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
  // AccountScreen is always sign-up mode (post-onboarding account creation)
  const isSigningUp = true;
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
    if (!name.trim()) {
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

    if (!password || password.length === 0) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    try {
      setEmailAuthState('loading');
      // Use centralized env config (same as other services)
      const backendUrl = process.env.EXPO_PUBLIC_CORE_API_URL || process.env.EXPO_PUBLIC_API_URL || env.CORE_API_URL;
      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please set EXPO_PUBLIC_CORE_API_URL in your .env file.');
      }

      const { setFlowType } = useAuthStore.getState();
      setFlowType('onboarding');

      const endpoint = '/api/auth/signup';
      console.log(`📧 Signing up:`, email);

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
        throw new Error(data.error || 'Failed to sign up');
      }

      console.log(`✅ Sign up successful`);

      // #region agent log
      // H10: Confirm signup completed and session payload exists (no PII)
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountScreen.tsx:212',message:'Email signup success',data:{hasSessionPayload:!!data.session,hasSupabaseConfigured:isSupabaseConfigured},timestamp:Date.now(),sessionId:'debug-session',runId:(__DEV__&&(globalThis as any).__DEBUG_RUN_MARKER__)||'run4',hypothesisId:'AUTH1'})}).catch(()=>{});
      // #endregion

      if (data.session) {
        // #region agent log
        // AUTH_SESS_PRE: validate token presence without logging secrets
        const at = typeof data.session?.access_token === 'string' ? data.session.access_token : '';
        const rt = typeof data.session?.refresh_token === 'string' ? data.session.refresh_token : '';
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountScreen.tsx:214',message:'Preparing to set Supabase session',data:{hasAccessToken:!!at,accessTokenLen:at.length,hasRefreshToken:!!rt,refreshTokenLen:rt.length},timestamp:Date.now(),sessionId:'debug-session',runId:(__DEV__&&(globalThis as any).__DEBUG_RUN_MARKER__)||'run4',hypothesisId:'AUTH_SESS_PRE'})}).catch(()=>{});
        // #endregion

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountScreen.tsx:220',message:'Supabase setSession error',data:{message:sessionError.message},timestamp:Date.now(),sessionId:'debug-session',runId:(__DEV__&&(globalThis as any).__DEBUG_RUN_MARKER__)||'run4',hypothesisId:'AUTH_SESS_ERR'})}).catch(()=>{});
          // #endregion
          throw new Error(sessionError.message);
        }

        // #region agent log
        // H11: Confirm Supabase session was set
        fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountScreen.tsx:223',message:'Supabase session set from backend session',data:{ok:true},timestamp:Date.now(),sessionId:'debug-session',runId:(__DEV__&&(globalThis as any).__DEBUG_RUN_MARKER__)||'run4',hypothesisId:'AUTH2'})}).catch(()=>{});
        // #endregion

        // Save name to onboarding store for PostHookOfferScreen to use
        if (name.trim()) {
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
      console.error(`❌ SIGNUP ERROR:`, error.message);
      setEmailAuthState('error');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AccountScreen.tsx:catch',message:'Email signup flow failed',data:{message:error?.message||String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:(__DEV__&&(globalThis as any).__DEBUG_RUN_MARKER__)||'run4',hypothesisId:'AUTH_CATCH'})}).catch(()=>{});
      // #endregion
      Alert.alert(
        'Sign Up Error',
        error.message || 'Failed to create account'
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
                    <Text style={styles.emailSubmitText}>Sign Up</Text>
                  )}
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
