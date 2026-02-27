/**
 * SIGN IN SCREEN
 * 
 * Authentication with Google, Apple, and Email/Password Sign-In.
 * 
 * App architecture:
 * - Sign-in only on this screen
 * - Music: CONTINUOUS playback from IntroScreen (explicitly plays on focus)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
// import { SafeAreaView } from 'react-native-safe-area-context'; // Not used in layout, BackButton handles insets
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { Video, ResizeMode } from 'expo-av';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { AmbientMusic } from '@/services/ambientMusic';
import { useMusicStore } from '@/store/musicStore';
import { BackButton } from '@/components/BackButton';
import { verifyEntitlementWithBackend } from '@/services/payments';
import { env } from '@/config/env';

// Required for OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

// const REDIRECT_URI = 'oneinabillion://auth/callback'; // Adjust based on app.json scheme
const REDIRECT_URI = ExpoLinking.createURL('/auth/callback');

type EmailAuthState = 'idle' | 'loading' | 'error';

export const SignInScreen = () => {
    const navigation = useNavigation<any>();
    const setShowDashboard = useOnboardingStore((state) => state.setShowDashboard);
    const setHasCompletedOnboarding = useOnboardingStore((state) => state.setHasCompletedOnboarding);
    const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
    const hasPassedLanguages = useOnboardingStore((state) => state.hasPassedLanguages);
    const setEntitlementState = useAuthStore((state) => state.setEntitlementState);
    const [isLoading, setIsLoading] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const { isPlaying } = useMusicStore();

    // Email authentication state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailAuthState, setEmailAuthState] = useState<EmailAuthState>('idle');
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const processedOAuthUrlsRef = useRef<Set<string>>(new Set());
    const oauthInFlightRef = useRef(false);

    const finalizeSignInAccess = useCallback(async () => {
        if (!isSupabaseConfigured) {
            Alert.alert('Auth unavailable', 'Supabase is not configured in this build.');
            return false;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
            throw error;
        }

        const userId = data.session?.user?.id;
        if (!userId) {
            throw new Error('No authenticated session found after sign in.');
        }

        if (env.ALLOW_PAYMENT_BYPASS) {
            setEntitlementState('active');
            setHasCompletedOnboarding(true);
            setShowDashboard(true);
            return true;
        }

        const verification = await verifyEntitlementWithBackend({ appUserId: userId });
        if (verification.success && verification.active) {
            setEntitlementState('active');
            setHasCompletedOnboarding(true);
            setShowDashboard(true);
            return true;
        }

        if (verification.success && !verification.active) {
            setEntitlementState('inactive');
            if (hasCompletedOnboarding) {
                setHasCompletedOnboarding(true);
                setShowDashboard(true);
                return true;
            }

            setHasCompletedOnboarding(false);
            setShowDashboard(false);
            navigation.reset({
                index: 0,
                routes: [{ name: hasPassedLanguages ? 'CoreIdentities' : 'Relationship' }],
            });
            return true;
        }

        setEntitlementState('unknown');
        setHasCompletedOnboarding(false);
        setShowDashboard(false);
        navigation.reset({
            index: 0,
            routes: [{ name: hasPassedLanguages ? 'CoreIdentities' : 'Relationship' }],
        });
        return true;
    }, [
        hasCompletedOnboarding,
        hasPassedLanguages,
        navigation,
        setEntitlementState,
        setHasCompletedOnboarding,
        setShowDashboard,
    ]);

    // 🎵 MUSIC CONTINUITY LOGIC
    // Explicitly ensure music is playing when this screen is focused.
    // This bridges the fade-out from IntroScreen to create a seamless experience.
    useFocusEffect(
        useCallback(() => {
            if (isPlaying) {
                AmbientMusic.play();
            }
        }, [isPlaying])
    );

    const applySessionTokens = useCallback(async (accessToken: string, refreshToken: string) => {
        const { data: existingData } = await supabase.auth.getSession();
        const existing = existingData.session;

        if (existing?.access_token === accessToken) {
            return;
        }

        // Clear any stale local session first so rotated refresh tokens do not collide.
        await supabase.auth.signOut({ scope: 'local' });

        const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        if (error) throw error;
    }, []);

    const handleDeepLink = useCallback(async (event: { url: string }) => {
        if (!isSupabaseConfigured) return;

        const url = event.url;
        console.log('🔗 Deep link received:', url);

        // Handle password reset confirmation
        if (url.includes('auth/reset-password') || url.includes('type=recovery')) {
            // ... (Reset password logic to be refined/migrated fully when ResetPasswordScreen exists)
            // For now, simple alert or navigation home
            console.log('✅ Password reset link detected');
        }

        // Handle OAuth callbacks (Google, Apple)
        if (url.includes('auth/callback') || url.includes('access_token=') || url.includes('code=')) {
            if (processedOAuthUrlsRef.current.has(url) || oauthInFlightRef.current) {
                return;
            }
            processedOAuthUrlsRef.current.add(url);
            oauthInFlightRef.current = true;

            try {
                const normalizedUrl = url.replace('#', '?');
                const params = new URL(normalizedUrl).searchParams;

                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const code = params.get('code');
                const errorCode = params.get('error_code');
                const errorDescription = params.get('error_description');

                if (errorCode) {
                    setIsLoading(false);
                    // navigation.navigate('Intro'); // Stay on screen to show error?
                    Alert.alert('Auth Error', errorDescription || 'Failed to sign in');
                    return;
                }

                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) {
                        throw exchangeError;
                    }
                    await finalizeSignInAccess();
                    setIsLoading(false);
                    return;
                }

                if (accessToken && refreshToken) {
                    console.log('✅ Found tokens, setting session...');
                    await applySessionTokens(accessToken, refreshToken);
                    await finalizeSignInAccess();
                    setIsLoading(false);
                    return;
                }

                setIsLoading(false);
            } catch (error: any) {
                console.error('❌ Deep link error:', error.message);
                setIsLoading(false);
                Alert.alert('Auth Error', 'Failed to process authentication');
            } finally {
                oauthInFlightRef.current = false;
            }
        }
    }, [applySessionTokens, finalizeSignInAccess]);

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
            await finalizeSignInAccess();
            setIsLoading(false);
            // Bootstrapping hook will handle navigation
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
                        await handleDeepLink({ url: result.url });
                } else {
                    console.log('❌ GOOGLE AUTH: Flow interrupted');
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
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        try {
            setEmailAuthState('loading');
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim(),
            });

            if (error) throw error;

            console.log('✅ Sign in successful');
            const allowed = await finalizeSignInAccess();
            if (!allowed) {
                setEmailAuthState('idle');
                return;
            }
            AmbientMusic.fadeOut();

            setEmailAuthState('idle');
            setShowEmailInput(false);
            setEmail('');
            setPassword('');

        } catch (error: any) {
            console.error('❌ SIGNIN ERROR:', error.message);
            setEmailAuthState('error');
            Alert.alert(
                'Sign In Error',
                error.message || 'Failed to sign in'
            );
            setTimeout(() => setEmailAuthState('idle'), 2000);
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        try {
            setEmailAuthState('loading');
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${REDIRECT_URI}?type=recovery`,
            });

            if (error) throw error;

            Alert.alert(
                'Email Sent',
                'If an account exists with this email, a password reset link has been sent.',
                [{ text: 'OK', onPress: () => { setShowForgotPassword(false); setEmailAuthState('idle'); } }]
            );
        } catch (error: any) {
            console.error('❌ Forgot password error:', error.message);
            setEmailAuthState('error');
            Alert.alert('Error', error.message);
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
                key="signin-video-v2" // Cache-busting key
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
                                            Sign In
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.forgotPasswordButton}
                                    onPress={() => setShowForgotPassword(true)}
                                    disabled={emailAuthState === 'loading'}
                                >
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: colors.background, // Solid background since assets don't exist
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
