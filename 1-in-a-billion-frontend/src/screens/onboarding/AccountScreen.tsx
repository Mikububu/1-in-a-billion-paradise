/**
 * ACCOUNT SCREEN (Screen 6 - Post-Onboarding Sign-Up)
 * 
 * Per AUTH_FLOW_CONTRACT.md:
 * - This is "State Two" → "Sign up with Google screen"
 * - User has completed onboarding
 * - Sign-up IS allowed here (allowSignUp=true equivalent)
 * - Creates Supabase account and attaches local onboarding data
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
import { logAuthIssue } from '@/utils/authDebug';
import { BackButton } from '@/components/BackButton';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = 'oneinabillion://auth/callback';

type EmailAuthState = 'idle' | 'loading' | 'error';
type Props = NativeStackScreenProps<OnboardingStackParamList, 'Account'>;

export const AccountScreen = ({ navigation, route }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false); // Full-screen loading overlay
  const [videoReady, setVideoReady] = useState(false);
  const { isPlaying } = useMusicStore();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const hasCheckedExistingAccountRef = useRef<Set<string>>(new Set()); // Track checked user IDs to avoid duplicate checks

  // Email authentication state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailAuthState, setEmailAuthState] = useState<EmailAuthState>('idle');
  // AccountScreen is always sign-up mode (post-onboarding account creation)
  const isSigningUp = true;
  const [showEmailInput, setShowEmailInput] = useState(false);
  const isPostPurchase = !!route?.params?.postPurchase;

  useFocusEffect(
    useCallback(() => {
      if (isPlaying) {
        AmbientMusic.play();
      }
    }, [isPlaying])
  );

  // Check if user already has account (for Google OAuth flow which uses deep link)
  useEffect(() => {
    const checkExistingAccount = async () => {
      if (!user?.id || !isSupabaseConfigured) return;
      if (hasCheckedExistingAccountRef.current.has(user.id)) return; // Already checked this user
      hasCheckedExistingAccountRef.current.add(user.id);

      try {
        console.log('🔍 AccountScreen: Checking if user already has profile:', user.id);
        const { data: profiles, error } = await supabase
          .from('library_people')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('is_user', true)
          .limit(1);

        if (error) {
          console.error('❌ AccountScreen: Profile check error:', error);
          return;
        }

        if (profiles && profiles.length > 0) {
          console.log('🚫 AccountScreen: User already has account - rejecting sign-up');
          // User already has account - reject and redirect
          await signOut();
          Alert.alert('Account Already Exists', 'You already have an account. Please sign in from the Sign In screen.', [
            { text: 'OK', onPress: () => navigation.replace('Intro') },
          ]);
        }
      } catch (err) {
        console.error('❌ AccountScreen: Error checking existing account:', err);
      }
    };

    checkExistingAccount();
  }, [user?.id, signOut, navigation]);

  const handleSupabaseExchange = async (idToken: string, provider: 'apple' | 'google') => {
    try {
      setIsCreatingAccount(true); // Show loading overlay
      const { setFlowType, displayName } = useAuthStore.getState();
      setFlowType('onboarding'); // FLAG: Allow local data validation

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider,
        token: idToken,
      });

      if (error) throw error;
      if (!data?.user?.id) throw new Error('No user ID returned from authentication');
      
      // Use displayName from NameInputScreen if available (for OAuth signups)
      if (displayName) {
        useOnboardingStore.getState().setName(displayName);
        console.log(`✅ Using displayName from NameInputScreen: ${displayName}`);
      }

      // Check if user already has account (before navigating)
      if (isSupabaseConfigured) {
        const { data: profiles, error: profileError } = await supabase
          .from('library_people')
          .select('user_id')
          .eq('user_id', data.user.id)
          .eq('is_user', true)
          .limit(1);

        if (!profileError && profiles && profiles.length > 0) {
          console.log('🚫 AccountScreen: User already has account - rejecting sign-up');
          await signOut();
          setIsLoading(false);
          setIsCreatingAccount(false);
          Alert.alert('Account Already Exists', 'You already have an account. Please sign in from the Sign In screen.', [
            { text: 'OK', onPress: () => navigation.replace('Intro') },
          ]);
          return;
        }
      }

      setIsLoading(false);
      
      // ⚠️ CRITICAL FIX: User just signed up via OAuth, onboarding is complete
      // Mark onboarding as complete and show dashboard
      const onboarding = useOnboardingStore.getState();
      onboarding.completeOnboarding(); // Set hasCompletedOnboarding = true
      onboarding.setShowDashboard(true); // Switch to MainNavigator
      
      if (isPostPurchase) {
        // After subscription purchase, let user choose their included reading
        onboarding.setRedirectAfterOnboarding('MyLibrary');
        setIsCreatingAccount(false);
        navigation.replace('FreeReadingSelection');
        return;
      }
      
      setIsCreatingAccount(false);
      // RootNavigator will automatically switch to MainNavigator (dashboard) now
    } catch (error: any) {
      console.error(`❌ ${provider.toUpperCase()} EXCHANGE ERROR:`, error.message);
      logAuthIssue({
        provider,
        outcome: 'error',
        detail: error?.message,
        context: 'AccountScreen:handleSupabaseExchange',
      });
      setIsLoading(false);
      setIsCreatingAccount(false);
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
          setIsCreatingAccount(true); // Show loading overlay
          // Deep link handler will process the session and navigate
          // Navigation handled by deep link callback
        } else {
          setIsLoading(false);
          if (result.type === 'cancel') {
            logAuthIssue({ provider: 'google', outcome: 'cancel', context: 'AccountScreen:handleGoogleSignIn' });
          } else {
            logAuthIssue({
              provider: 'google',
              outcome: 'error',
              detail: `result.type=${result.type}`,
              context: 'AccountScreen:handleGoogleSignIn',
            });
            Alert.alert('Sign In Error', 'Authentication was interrupted. Please try again.');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ GOOGLE AUTH: Error:', error.message);
      logAuthIssue({
        provider: 'google',
        outcome: 'error',
        detail: error?.message,
        context: 'AccountScreen:handleGoogleSignIn:catch',
      });
      setIsLoading(false);
      setIsCreatingAccount(false);
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
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        logAuthIssue({ provider: 'apple', outcome: 'cancel', context: 'AccountScreen:handleAppleSignIn' });
      } else {
        logAuthIssue({ provider: 'apple', outcome: 'error', detail: e?.message, context: 'AccountScreen:handleAppleSignIn' });
        Alert.alert('Sign In Error', e.message);
      }
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    // Get displayName from NameInputScreen (set in authStore)
    const { displayName } = useAuthStore.getState();
    if (!displayName) {
      Alert.alert('Error', 'Name not found. Please restart the sign-up process.');
      return;
    }
    
    // ========================================================================
    // MODERN EMAIL SIGNUP VALIDATION (REQUIREMENT #11)
    // ========================================================================
    // Simple, secure, user-friendly - no overly complex rules
    // State-of-the-art standards that users expect today
    // ========================================================================
    
    // Email validation
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Password validation - modern, simple rules
    if (!password || password.length === 0) {
      Alert.alert('Password Required', 'Please enter a password');
      return;
    }

    // Minimum 8 characters (industry standard, not overly complex)
    if (password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters');
      return;
    }

    // Maximum 128 characters (prevent abuse, standard practice)
    if (password.length > 128) {
      Alert.alert('Password Too Long', 'Password must be less than 128 characters');
      return;
    }

    // Must contain at least 1 letter and 1 number (simple, secure)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasLetter || !hasNumber) {
      Alert.alert(
        'Weak Password', 
        'Password must contain at least 1 letter and 1 number'
      );
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
          name: displayName, // Use name from NameInputScreen (same as OAuth)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Deterministic "account exists" handling (prevents accidental "double accounts")
        if (response.status === 409 || data?.code === 'ACCOUNT_EXISTS') {
          Alert.alert(
            'Account Already Exists',
            'You already have an account. Please sign in instead.',
            [
              {
                text: 'Go to Sign In',
                onPress: () => {
                  setShowEmailInput(false);
                  setEmailAuthState('idle');
                  setIsCreatingAccount(false);
                  navigation.replace('Intro');
                  // Intro → Log In → SignIn screen (existing flow)
                },
              },
              { text: 'OK' },
            ]
          );
          return;
        }
        throw new Error(data.error || 'Failed to sign up');
      }

      console.log(`✅ Sign up successful`);

      if (data.session) {
        setIsCreatingAccount(true); // Show loading overlay
        
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        // Get user ID after session is set
        const { data: { user: currentUser }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError || !currentUser?.id) {
          throw new Error('Failed to get user after sign-up');
        }

        // Check if user already has account (before navigating)
        if (isSupabaseConfigured) {
          const { data: profiles, error: profileError } = await supabase
            .from('library_people')
            .select('user_id')
            .eq('user_id', currentUser.id)
            .eq('is_user', true)
            .limit(1);

          if (!profileError && profiles && profiles.length > 0) {
            console.log('🚫 AccountScreen: User already has account - rejecting email sign-up');
            await signOut();
            setEmailAuthState('idle');
            setIsCreatingAccount(false);
            Alert.alert('Account Already Exists', 'You already have an account. Please sign in from the Sign In screen.', [
              { text: 'OK', onPress: () => navigation.replace('Intro') },
            ]);
            return;
          }
        }

        // Save name to onboarding store (using displayName from NameInputScreen)
        if (displayName) {
          useOnboardingStore.getState().setName(displayName);
        }

        // Profile will be created by PostHookOfferScreen (same flow as Google OAuth)
        setEmailAuthState('idle');
        setShowEmailInput(false);
        setEmail('');
        setPassword('');

        // ⚠️ CRITICAL FIX: User just signed up, onboarding is complete
        // Mark onboarding as complete and show dashboard
        const onboarding = useOnboardingStore.getState();
        onboarding.completeOnboarding(); // Set hasCompletedOnboarding = true
        onboarding.setShowDashboard(true); // Switch to MainNavigator
        
        if (isPostPurchase) {
          onboarding.setRedirectAfterOnboarding('MyLibrary');
        }
        
        setIsCreatingAccount(false);
        // RootNavigator will automatically switch to MainNavigator (dashboard) now
      }
    } catch (error: any) {
      console.error(`❌ SIGNUP ERROR:`, error.message);
      logAuthIssue({ provider: 'email', outcome: 'error', detail: error?.message, context: 'AccountScreen:handleEmailAuth' });
      setEmailAuthState('error');
      setIsCreatingAccount(false);
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
        key="signin-video-v2" // Cache-busting key - update this when video file changes
        source={require('../../../assets/videos/signin-background.mp4')}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onReadyForDisplay={() => setVideoReady(true)}
      />

      <BackButton onPress={() => navigation.goBack()} />

      <View style={styles.contentContainer}>
        <View style={styles.authSection}>
          {!showEmailInput ? (
            <>
              <TouchableOpacity
                style={[styles.authButton, styles.emailButton]}
                onPress={() => setShowEmailInput(true)}
                disabled={isLoading}
              >
                <Text style={styles.emailButtonText}>Sign up with Email</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.authButton, styles.appleButton]}
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                >
                  <Text style={styles.appleText}>Sign up with Apple</Text>
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
                  <Text style={styles.googleText}>Sign up with Google</Text>
                )}
              </TouchableOpacity>
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
                placeholder="Password (min 8 characters, 1 letter, 1 number)"
                placeholderTextColor={colors.mutedText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={emailAuthState !== 'loading'}
              />
              
              {/* Password strength indicator - simple, modern UX */}
              {password.length > 0 && (
                <View style={styles.passwordHints}>
                  <Text style={[
                    styles.passwordHint,
                    password.length >= 8 && styles.passwordHintValid
                  ]}>
                    {password.length >= 8 ? '✓' : '○'} At least 8 characters
                  </Text>
                  <Text style={[
                    styles.passwordHint,
                    /[a-zA-Z]/.test(password) && styles.passwordHintValid
                  ]}>
                    {/[a-zA-Z]/.test(password) ? '✓' : '○'} Contains a letter
                  </Text>
                  <Text style={[
                    styles.passwordHint,
                    /[0-9]/.test(password) && styles.passwordHintValid
                  ]}>
                    {/[0-9]/.test(password) ? '✓' : '○'} Contains a number
                  </Text>
                </View>
              )}

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

      {/* Full-Screen Loading Overlay */}
      {isCreatingAccount && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              We create your account{'\n'}this may take a few seconds
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep root transparent so leather texture always shows through.
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
  topSection: {
    paddingTop: 120,
  },
  titleContainer: {
    paddingTop: 120,
    paddingBottom: spacing.xl,
  },
  titleBackground: {
    backgroundColor: colors.surface,
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
  // Modern password strength indicator styles
  passwordHints: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  passwordHint: {
    fontSize: 13,
    fontFamily: typography.sansRegular,
    color: colors.mutedText,
  },
  passwordHintValid: {
    color: '#10B981', // Green for valid
    fontFamily: typography.sansMedium,
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radii.card,
    alignItems: 'center',
    gap: spacing.lg,
    maxWidth: '80%',
  },
  loadingText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
});
