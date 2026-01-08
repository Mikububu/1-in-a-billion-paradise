import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Animated, Alert, Easing, Platform, TextInput } from 'react-native';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { getDocumentDirectory, EncodingType } from '@/utils/fileSystem';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Audio } from 'expo-av';
import { useHookReadings } from '@/hooks/useHookReadings';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { HookReading } from '@/types/forms';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { FEATURES } from '@/config/features';
import { generateCoreIdentitiesPdfFilename } from '@/utils/fileNames';
import { audioApi } from '@/services/api';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { AUDIO_CONFIG, SIGN_LABELS } from '@/config/readingConfig';
import { uploadHookAudioBase64 } from '@/services/hookAudioCloud';
import { saveHookReadings } from '@/services/userReadings';
import { saveAudioToFile, getAudioDirectory, ensureAudioDirectory } from '@/services/audioDownload';

// Required for OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'oneinabillion',
  path: 'auth/callback',
});

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HookSequence'> | NativeStackScreenProps<any, 'HookSequence'>;

const { width: PAGE_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive scaling for smaller phones (iPhone SE = 667)
const isSmallScreen = SCREEN_HEIGHT < 700;
const fontScale = isSmallScreen ? 0.9 : 1;

const NEXT_LABELS: Record<string, string> = {
  sun: 'Discover Your Moon',
  moon: 'Discover Your Rising',
  rising: 'Continue',
  gateway: 'Enter Dashboard',
};

// Extended page type to include the gateway/sign-in page
type PageItem = HookReading | { type: 'gateway'; sign: ''; intro: ''; main: '' };

type LLMProvider = 'deepseek' | 'claude' | 'gpt' | 'deepthink';

export const HookSequenceScreen = ({ navigation, route }: Props) => {
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const birthDate = useOnboardingStore((state) => state.birthDate);
  const birthTime = useOnboardingStore((state) => state.birthTime);
  const birthCity = useOnboardingStore((state) => state.birthCity);
  const relationshipIntensity = useOnboardingStore((state) => state.relationshipIntensity);
  const relationshipMode = useOnboardingStore((state) => state.relationshipMode);
  const primaryLanguage = useOnboardingStore((state) => state.primaryLanguage);

  // Use readings from store (already loaded by CoreIdentitiesScreen)
  const hookReadings = useOnboardingStore((state) => state.hookReadings);
  const hookAudio = useOnboardingStore((state) => state.hookAudio); // Pre-loaded audio
  const setHookReading = useOnboardingStore((state) => state.setHookReading);
  const sun = hookReadings.sun;
  const moon = hookReadings.moon;
  const rising = hookReadings.rising;

  // Determine initial page based on route params
  const initialReading = route?.params?.initialReading;
  const customReadingsFromRoute = route?.params?.customReadings as HookReading[] | undefined;
  const [customReadings, setCustomReadings] = useState<HookReading[] | null>(
    customReadingsFromRoute || null
  );

  const getInitialPage = () => {
    if (!initialReading) return 0;
    // Use customReadings if available, otherwise use hookReadings
    const readingsToUse = customReadings || [sun, moon, rising].filter(Boolean);
    // Assuming setReadings and setCurrentReadingIndex are defined elsewhere or will be added.
    // For now, we'll keep the original logic's intent of returning an index.
    // The instruction was to add optional chaining for r?.type.
    if (initialReading === 'sun') {
      const sunIndex = readingsToUse.findIndex(r => r?.type === 'sun');
      return sunIndex >= 0 ? sunIndex : 0;
    }
    if (initialReading === 'moon') {
      const moonIndex = readingsToUse.findIndex(r => r?.type === 'moon');
      return moonIndex >= 0 ? moonIndex : 0;
    }
    if (initialReading === 'rising') {
      const risingIndex = readingsToUse.findIndex(r => r?.type === 'rising');
      return risingIndex >= 0 ? risingIndex : 0;
    }
    return 0;
  };
  const [page, setPage] = useState(getInitialPage());
  const [activeProvider, setActiveProvider] = useState<LLMProvider>('deepseek');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const listRef = useRef<FlatList<PageItem>>(null);

  // Audio state
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
  const [audioPlaying, setAudioPlaying] = useState<Record<string, boolean>>({});
  const [audioCache, setAudioCache] = useState<Record<string, string>>({}); // base64 audio cache
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentPlayingType = useRef<string | null>(null);

  // Sign-in state (for 4th page gateway)
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devName, setDevName] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auth state
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setSession = useAuthStore((state) => state.setSession);
  const setDisplayName = useAuthStore((state) => state.setDisplayName);
  const isSignedIn = !!user;

  // Profile store user (to persist hook audio storage paths for cloud reuse)
  const getUserProfile = useProfileStore((s) => s.getUser);
  const updatePerson = useProfileStore((s) => s.updatePerson);
  const inFlightUpload = useRef<Partial<Record<HookReading['type'], Promise<void>>>>({});

  // Blink animation ref
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Rising arrow animation - beautiful upward motion
  const risingAnim = useRef(new Animated.Value(0)).current;

  // Auto-regenerate readings if missing but placements exist
  // NOTE: This should rarely trigger since CoreIdentitiesScreen generates readings before navigation
  const hasInitiatedRegen = useRef(false);
  useEffect(() => {
    const hasAnyReading = !!(sun || moon || rising);
    const userProfile = useProfileStore.getState().getUser();
    const hasPlacements = !!(
      (sun?.sign || userProfile?.placements?.sunSign) &&
      (moon?.sign || userProfile?.placements?.moonSign) &&
      (rising?.sign || userProfile?.placements?.risingSign)
    );

    // Only auto-regenerate if:
    // 1. No readings exist
    // 2. Placements exist (chart was calculated)
    // 3. Haven't already initiated regeneration
    // 4. Not currently regenerating
    // 5. This is not a custom readings route (which means readings are provided)
    if (!hasAnyReading && hasPlacements && !hasInitiatedRegen.current && !isRegenerating && !customReadings) {
      console.log('🔄 No readings found but placements exist - auto-regenerating...');
      hasInitiatedRegen.current = true;
      regenerateWithProvider('deepseek');
    }
  }, [sun, moon, rising, isRegenerating, customReadings]);

  // Readings array - 3 hook readings + 4th gateway page (signup/login/transition)
  const readings = useMemo((): PageItem[] => {
    let baseReadings: HookReading[];
    if (customReadings && customReadings.length === 3) {
      baseReadings = customReadings;
    } else {
      const apiReadings: HookReading[] = [];
      if (sun) apiReadings.push(sun);
      if (moon) apiReadings.push(moon);
      if (rising) apiReadings.push(rising);
      baseReadings = apiReadings;
    }
    // Add the gateway page after the 3 readings
    if (baseReadings.length === 3) {
      return [...baseReadings, { type: 'gateway', sign: '', intro: '', main: '' }];
    }
    return baseReadings;
  }, [sun, moon, rising, customReadings]);

  // Scroll to correct page when customReadings load or initialReading changes
  useEffect(() => {
    if (readings.length > 0 && initialReading) {
      const readingsToUse = customReadings || [sun, moon, rising].filter(Boolean);
      let targetIndex = 0;
      if (initialReading === 'sun') {
        targetIndex = readingsToUse.findIndex(r => r?.type === 'sun');
        if (targetIndex < 0) targetIndex = 0;
      } else if (initialReading === 'moon') {
        targetIndex = readingsToUse.findIndex(r => r?.type === 'moon');
        if (targetIndex < 0) targetIndex = 0;
      } else if (initialReading === 'rising') {
        targetIndex = readingsToUse.findIndex(r => r?.type === 'rising');
        if (targetIndex < 0) targetIndex = 0;
      }
      if (targetIndex >= 0 && targetIndex < readings.length) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: targetIndex, animated: false });
          setPage(targetIndex);
        }, 100);
      }
    }
  }, [customReadings, initialReading, readings.length, sun, moon, rising]);

  // VISIBLE blink animation when regenerating
  useEffect(() => {
    if (isRegenerating) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.2, duration: 300, useNativeDriver: false }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        ])
      );
      blink.start();
      return () => blink.stop();
    } else {
      blinkAnim.setValue(1);
    }
  }, [isRegenerating, blinkAnim]);

  // Rising arrow animation - beautiful upward motion (THE BEAUTIFUL ARROW!)
  useEffect(() => {
    const rising = Animated.loop(
      Animated.sequence([
        Animated.timing(risingAnim, { toValue: -20, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(risingAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    rising.start();
    return () => rising.stop();
  }, [risingAnim]);

  // CRITICAL: Stop audio when screen loses focus (useFocusEffect runs cleanup BEFORE blur)
  useFocusEffect(
    useCallback(() => {
      // Screen focused - nothing to do
      return () => {
        // Screen losing focus - STOP ALL AUDIO IMMEDIATELY
        console.log('🛑 HookSequenceScreen LOSING FOCUS - stopping audio immediately');
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => { });
          soundRef.current.unloadAsync().catch(() => { });
          soundRef.current = null;
        }
        setAudioPlaying({});
        currentPlayingType.current = null;
      };
    }, [])
  );

  // Also cleanup on component unmount (belt + suspenders)
  useEffect(() => {
    return () => {
      console.log('🛑 HookSequenceScreen unmounting - final cleanup');
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
      currentPlayingType.current = null;
    };
  }, []);

  // STOP AUDIO ON PAGE SWIPE - prevents audio interference between pages
  useEffect(() => {
    if (soundRef.current) {
      console.log(`🛑 Page changed to ${page} - stopping audio`);
      soundRef.current.stopAsync().catch(() => { });
      soundRef.current.unloadAsync().catch(() => { });
      soundRef.current = null;
      setAudioPlaying({});
      currentPlayingType.current = null;
    }
  }, [page]);

  // HARD STOP: if user lands on the gateway (page 4), audio must never keep playing.
  useEffect(() => {
    const current = readings[page];
    if (current?.type === 'gateway') {
      console.log('🛑 Gateway page active - forcing audio stop');
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
      setAudioPlaying({});
      currentPlayingType.current = null;
      setAudioLoading({});
    }
  }, [page, readings]);

  // Get setHookAudio from store for background generation
  const setHookAudio = useOnboardingStore((state) => state.setHookAudio);

  // Track if we're currently generating to prevent duplicates
  const isGeneratingMoonAudio = useRef(false);
  const isGeneratingRisingAudio = useRef(false);
  // Track in-flight generation so swipe-preload and tap-to-play share the same work
  const inFlightAudio = useRef<Partial<Record<HookReading['type'], Promise<string | null>>>>({});



  // ... existing imports ...

  // ... inside HookSequenceScreen ...

  const startHookAudioGeneration = useCallback(
    (type: HookReading['type'], reading: HookReading) => {
      // Already have audio → nothing to do
      if (hookAudio[type]) return Promise.resolve(hookAudio[type] || null);
      // Already generating → return same promise
      const existing = inFlightAudio.current[type];
      if (existing) return existing;

      const textToSpeak = `${reading.intro}\n\n${reading.main}`;
      const p = audioApi
        .generateTTS(textToSpeak, { exaggeration: AUDIO_CONFIG.exaggeration })
        .then(async (result) => {
          if (result.success && result.audioBase64) {
            // SAVE TO FILE instead of storing Base64 (restore last-known-good behavior)
            try {
              const filename = `hook_${type}_${Date.now()}`; // saveAudioToFile adds extension
              await saveAudioToFile(result.audioBase64, filename);
              const filenameHub = `${filename}.mp3`;

              console.log(`💾 Saved ${type} audio to file: ${filenameHub}`);
              setHookAudio(type, filenameHub);

              // Cloud Sync (legacy): upload base64 (cloud service expects base64)
              try {
                const uid = user?.id;
                const userPerson = getUserProfile();
                if (uid && userPerson?.id && isSupabaseConfigured && env.ENABLE_SUPABASE_LIBRARY_SYNC) {
                  uploadHookAudioBase64({
                    userId: uid,
                    personId: userPerson.id,
                    type,
                    audioBase64: result.audioBase64,
                  }).then((res) => {
                    if (!res.success) return;
                    updatePerson(userPerson.id, {
                      hookAudioPaths: {
                        ...(userPerson.hookAudioPaths || {}),
                        [type]: res.path, // Cloud path
                      },
                    } as any);
                  });
                }
              } catch { /* ignore */ }

              return filenameHub; // Return filename now, not base64
            } catch (err) {
              console.error('Failed to save audio file:', err);
              // Fallback: store base64 if file save fails (e.g. no space)
              // This keeps playback working rather than failing silently.
              setHookAudio(type, result.audioBase64);
              return result.audioBase64;
            }
          }
          return null;
        })
        .catch(() => null)
        .finally(() => {
          inFlightAudio.current[type] = undefined;
          if (type === 'moon') isGeneratingMoonAudio.current = false;
          if (type === 'rising') isGeneratingRisingAudio.current = false;
        });

      inFlightAudio.current[type] = p;
      return p;
    },
    [hookAudio, setHookAudio, user?.id, getUserProfile, updatePerson]
  );

  // ... (Upload existing hook audio effect can stay mostly same, but needs to read file if it's a filename) ...
  // Skipping update to that effect for now to minimize risk, assuming mostly fresh gens.

  // ... 

  // Handle audio playback
  const handlePlayAudio = useCallback(async (reading: HookReading) => {
    const type = reading.type;

    // Stop logic ... (same as before)
    if (currentPlayingType.current === type && soundRef.current) {
      // ... stop ...
      // (copy existing stop logic)
      console.log(`⏹️ Stopping audio for ${type}`);
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setAudioPlaying(prev => ({ ...prev, [type]: false }));
      currentPlayingType.current = null;
      return;
    }

    // Stop any currently playing ... (same as before)
    if (soundRef.current) {
      // ...
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      if (currentPlayingType.current) {
        setAudioPlaying(prev => ({ ...prev, [currentPlayingType.current!]: false }));
      }
      currentPlayingType.current = null;
    }

    setAudioLoading(prev => ({ ...prev, [type]: true }));

    // RESOLVE AUDIO SOURCE
    let audioSource: string | null = hookAudio[type] || null;

    // Check in-flight
    if (!audioSource) {
      const inFlight = inFlightAudio.current[type];
      if (inFlight) {
        audioSource = (await inFlight) || null;
      }
    }

    // Generate if missing
    if (!audioSource) {
      const res = await startHookAudioGeneration(type, reading);
      audioSource = res;
    }

    if (!audioSource) {
      setAudioLoading(prev => ({ ...prev, [type]: false }));
      return;
    }

    setAudioLoading(prev => ({ ...prev, [type]: false }));

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      let soundObj;

      // Check if it's a file path (ends in .mp3)
      const isFile = audioSource.endsWith('.mp3');

      if (isFile) {
        // Reconstruct full path
        const dir = getAudioDirectory();
        const uri = dir + audioSource;
        console.log(`🎵 Playing file: ${uri}`);

        // Verify existence? Audio.Sound.createAsync handles failures gracefully usually
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, isLooping: false, progressUpdateIntervalMillis: 500 },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setAudioPlaying(prev => ({ ...prev, [type]: false }));
              currentPlayingType.current = null;
            }
          }
        );
        soundObj = sound;
      } else {
        // Base64 legacy
        console.log('🎵 Playing legacy Base64');
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mpeg;base64,${audioSource}` },
          { shouldPlay: true, isLooping: false, progressUpdateIntervalMillis: 500 },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setAudioPlaying(prev => ({ ...prev, [type]: false }));
              currentPlayingType.current = null;
            }
          }
        );
        soundObj = sound;
      }

      soundRef.current = soundObj;
      currentPlayingType.current = type;
      setAudioPlaying(prev => ({ ...prev, [type]: true }));

    } catch (error) {
      console.error('Audio playback error:', error);
      setAudioLoading(prev => ({ ...prev, [type]: false })); // Ensure loading state is cleared on error
    }

  }, [hookAudio, startHookAudioGeneration]);
  // If audio already exists (e.g., SUN was pre-rendered earlier), upload it once to Supabase Storage.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (!env.ENABLE_SUPABASE_LIBRARY_SYNC || !isSupabaseConfigured) return;

    const userPerson = getUserProfile();
    if (!userPerson?.id) return;

    const types: HookReading['type'][] = ['sun', 'moon', 'rising'];
    for (const type of types) {
      const b64 = hookAudio?.[type];
      if (!b64) continue;
      const latestUser = useProfileStore.getState().getUser();
      if (latestUser?.hookAudioPaths?.[type]) continue;
      if (inFlightUpload.current[type]) continue;

      inFlightUpload.current[type] = uploadHookAudioBase64({
        userId: uid,
        personId: userPerson.id,
        type,
        audioBase64: b64,
      })
        .then((res) => {
          if (!res.success) return;
          const latest = useProfileStore.getState().getUser();
          if (!latest?.id) return;
          updatePerson(latest.id, {
            hookAudioPaths: {
              ...(latest.hookAudioPaths || {}),
              [type]: res.path,
            },
          } as any);
        })
        .finally(() => {
          inFlightUpload.current[type] = undefined;
        });
    }
  }, [user?.id, hookAudio.sun, hookAudio.moon, hookAudio.rising, getUserProfile, updatePerson]);

  // STAGGERED AUDIO PRELOADING: Generate NEXT audio while viewing current page
  // SUN page → generate MOON audio | MOON page → generate RISING audio
  useEffect(() => {
    const currentReading = readings[page];
    console.log(`🎯 Preload check: page=${page}, type=${currentReading?.type}, moon=${!!moon}, moonAudio=${!!hookAudio.moon}`);

    // On SUN page → background generate MOON audio
    if (currentReading?.type === 'sun' && moon && !hookAudio.moon && !isGeneratingMoonAudio.current) {
      isGeneratingMoonAudio.current = true;
      console.log('🎵 SUN page: Starting MOON audio generation...');

      startHookAudioGeneration('moon', moon).then((b64) => {
        if (b64) console.log('✅ MOON audio ready!');
        else console.log('❌ MOON audio failed');
      });
    }

    // On MOON page → background generate RISING audio
    if (currentReading?.type === 'moon' && rising && !hookAudio.rising && !isGeneratingRisingAudio.current) {
      isGeneratingRisingAudio.current = true;
      console.log('🎵 MOON page: Starting RISING audio generation...');

      startHookAudioGeneration('rising', rising).then((b64) => {
        if (b64) console.log('✅ RISING audio ready!');
        else console.log('❌ RISING audio failed');
      });
    }
  }, [page, readings, moon, rising, hookAudio.moon, hookAudio.rising, startHookAudioGeneration]);



  // Auto-transition when user lands on gateway page and is already signed in
  useEffect(() => {
    if (page === 3 && isSignedIn && !isTransitioning) {
      setIsTransitioning(true);
      console.log('🚀 User already signed in - transitioning to Partner Offer...');
      // Navigate immediately to prevent Dashboard flash
      // @ts-ignore
      navigation.navigate('PostHookOffer');
    }
  }, [page, isSignedIn, isTransitioning, navigation]);

  // Sign-in handlers
  // Handle deep link for OAuth callback (Onboarding specific)
  useEffect(() => {
    let isProcessing = false;

    const handleDeepLink = async (event: { url: string }) => {
      if (!isSupabaseConfigured || isProcessing) return;

      const url = event.url;
      console.log('🔗 Onboarding Deep link received:', url);

      if (url.includes('auth/callback') || url.includes('access_token=') || url.includes('code=')) {
        isProcessing = true;
        setIsSigningIn(true);

        try {
          const normalizedUrl = url.replace('#', '?');
          const params = new URL(normalizedUrl).searchParams;

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('✅ Found tokens in onboarding, setting session...');
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('❌ Error setting onboarding session:', error.message);
              Alert.alert('Auth Error', error.message);
            }
          }
        } catch (e: any) {
          console.error('❌ Exception in onboarding deep link handler:', e.message);
        } finally {
          setIsSigningIn(false);
          isProcessing = false;
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      console.log('🚀 ONBOARDING GOOGLE AUTH: Starting Google sign-in flow');
      console.log('🔗 ONBOARDING GOOGLE AUTH: Redirect URI:', REDIRECT_URI);

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

      // CRITICAL FIX: Set flow to 'onboarding' so new users aren't blocked by the
      // strict profile check in useSupabaseAuthBootstrap used for direct logins.
      useAuthStore.getState().setFlowType('onboarding');

      if (error) throw error;

      if (data?.url) {
        console.log('🌐 ONBOARDING GOOGLE AUTH: Opening browser with URL');
        const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
        console.log('🔙 ONBOARDING GOOGLE AUTH: Browser returned, type:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('✅ ONBOARDING GOOGLE AUTH: Success! Processing redirect URL manually');

          // CRITICAL: Manually process the redirect URL to extract tokens
          try {
            const normalizedUrl = result.url.replace('#', '?');
            const params = new URL(normalizedUrl).searchParams;
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              console.log('🔑 ONBOARDING GOOGLE AUTH: Found tokens, setting session...');
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (sessionError) {
                console.error('❌ ONBOARDING GOOGLE AUTH: Error setting session:', sessionError.message);
                Alert.alert('Auth Error', sessionError.message);
                setIsSigningIn(false);
              } else {
                console.log('✅ ONBOARDING GOOGLE AUTH: Session set successfully');
                // Don't clear spinner - auth state listener will handle it
              }
            } else {
              console.log('⚠️ ONBOARDING GOOGLE AUTH: No tokens found in URL');
              setIsSigningIn(false);
            }
          } catch (e: any) {
            console.error('❌ ONBOARDING GOOGLE AUTH: Error processing redirect:', e.message);
            setIsSigningIn(false);
          }
        } else if (result.type === 'cancel') {
          console.log('❌ ONBOARDING GOOGLE AUTH: User cancelled');
          setIsSigningIn(false);
        } else {
          console.log('⚠️ ONBOARDING GOOGLE AUTH: Unexpected result type:', result.type);
          setIsSigningIn(false);
        }
      } else {
        console.log('⚠️ ONBOARDING GOOGLE AUTH: No URL returned');
        setIsSigningIn(false);
      }
    } catch (error: any) {
      console.error('❌ ONBOARDING GOOGLE AUTH: Error:', error.message);
      Alert.alert('Sign In Error', error.message || 'Failed to open Google Sign-In');
      setIsSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Not Configured',
        'Apple Sign-In requires Supabase configuration.\n\nUse Dev Mode for simulator testing.',
        [{ text: 'Use Dev Mode', onPress: () => setShowDevMode(true) }]
      );
      return;
    }

    setIsSigningIn(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          Alert.alert('Sign In Error', error.message);
          setIsSigningIn(false);
          return;
        }

        console.log('✅ Apple Sign-In successful');
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Error', e.message || 'Failed to sign in with Apple');
      }
      setIsSigningIn(false);
    }
  };

  const handleDevSignIn = async () => {
    if (!devName.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }

    const fakeUser = {
      id: `dev-${Date.now()}`,
      email: `${devName.toLowerCase().replace(/\s/g, '')}@dev.local`,
      user_metadata: { full_name: devName, avatar_url: null },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    console.log('🔧 Dev sign-in:', devName);
    // 4. Save to store
    setUser(fakeUser as any);
    completeOnboarding();
    setDisplayName(devName);

    // Save hook readings to Supabase (if configured)
    if (isSupabaseConfigured && (sun || moon || rising)) {
      console.log('💾 Saving hook readings to Supabase...');
      const hookReadingsToSave = {
        ...(sun ? { sun } : {}),
        ...(moon ? { moon } : {}),
        ...(rising ? { rising } : {}),
      };
      const audioDataToSave = {
        ...(audioCache.sun ? { sun: audioCache.sun } : {}),
        ...(audioCache.moon ? { moon: audioCache.moon } : {}),
        ...(audioCache.rising ? { rising: audioCache.rising } : {}),
      };
      const result = await saveHookReadings(fakeUser.id, hookReadingsToSave, audioDataToSave);
      if (result.success) {
        console.log('✅ Hook readings saved to Supabase');
      } else {
        console.log('⚠️ Failed to save hook readings:', result.error);
      }
    }

    // Transition to dashboard
    console.log('⏱️ Transitioning to dashboard...');
    setIsTransitioning(true);
    setTimeout(() => {
      console.log('✅ Timer done - calling completeOnboarding()');
      completeOnboarding();
    }, 1000);

    // Failsafe - force it if still stuck after 3 seconds
    setTimeout(() => {
      console.log('🚨 Failsafe triggered - forcing completeOnboarding()');
      completeOnboarding();
    }, 3000);
  };

  // Listen for auth state changes (for OAuth callbacks)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event);

        if (event === 'SIGNED_IN' && session) {
          console.log('✅ ONBOARDING AUTH STATE: SIGNED_IN event - clearing spinner');
          setIsSigningIn(false); // Clear the Google sign-in spinner

          setSession(session);
          setUser(session.user);
          setDisplayName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User');

          // Save hook readings to Supabase before completing onboarding
          if (sun || moon || rising) {
            console.log('💾 Saving hook readings to Supabase...');
            const hookReadingsToSave = {
              ...(sun ? { sun } : {}),
              ...(moon ? { moon } : {}),
              ...(rising ? { rising } : {}),
            };
            const audioDataToSave = {
              ...(audioCache.sun ? { sun: audioCache.sun } : {}),
              ...(audioCache.moon ? { moon: audioCache.moon } : {}),
              ...(audioCache.rising ? { rising: audioCache.rising } : {}),
            };
            const result = await saveHookReadings(session.user.id, hookReadingsToSave, audioDataToSave);
            if (result.success) {
              console.log('✅ Hook readings saved to Supabase');
            } else {
              console.log('⚠️ Failed to save hook readings:', result.error);
            }
          }

          // Auto-transition to dashboard
          console.log('✅ Signed in! Transitioning to dashboard...');
          setIsTransitioning(true);
          setTimeout(() => {
            console.log('🚀 Timer 1s - completing onboarding now!');
            completeOnboarding();
          }, 1000);

          // Failsafe
          setTimeout(() => {
            console.log('🚨 Failsafe 3s - forcing completeOnboarding()');
            completeOnboarding();
          }, 3000);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [completeOnboarding, sun, moon, rising, audioCache]);

  const regenerateWithProvider = async (provider: LLMProvider) => {
    console.log(`🔄 Starting ${provider} regeneration...`);
    // Set state FIRST to show spinner immediately
    setActiveProvider(provider);
    setIsRegenerating(true);

    // Minimum spinner time so user sees feedback (even if API fails fast)
    const minSpinnerTime = new Promise(resolve => setTimeout(resolve, 800));


    try {
      const types: HookReading['type'][] = ['sun', 'moon', 'rising'];
      const newReadings: HookReading[] = [];

      // All providers use local backend (which now has all API keys)
      for (const type of types) {
        console.log(`  Fetching ${type} from local backend with ${provider}...`);

        const response = await fetch(`${env.CORE_API_URL}/api/reading/${type}?provider=${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            birthDate: birthDate || '',
            birthTime: birthTime || '',
            timezone: birthCity?.timezone || 'UTC',
            latitude: birthCity?.latitude || 0,
            longitude: birthCity?.longitude || 0,
            relationshipIntensity: relationshipIntensity || 5,
            relationshipMode: relationshipMode || 'sensual',
            primaryLanguage: primaryLanguage?.code || 'en',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`  ✓ Got ${type} from ${data.metadata?.source || provider}`);
          newReadings.push(data.reading);
        } else {
          const errorText = await response.text();
          console.log(`  ✗ Failed ${type}: ${response.status} - ${errorText}`);
        }
      }

      if (newReadings.length === 3) {
        // CRITICAL: Save readings to store so they persist and prevent loops
        newReadings.forEach(reading => {
          setHookReading(reading);
        });
        
        setCustomReadings(newReadings);
        // IMPORTANT: Clear old audio cache since text changed!
        setHookAudio('sun', '');
        setHookAudio('moon', '');
        setHookAudio('rising', '');
        setAudioCache({}); // Clear local cache too
        listRef.current?.scrollToIndex({ index: 0, animated: true });
        setPage(0);
        console.log(`✓ All 3 readings regenerated with ${provider} and saved to store - audio cache cleared`);

        // Start generating new SUN audio immediately
        const sunReading = newReadings[0];
        audioApi.generateTTS(`${sunReading.intro}\n\n${sunReading.main}`, { exaggeration: AUDIO_CONFIG.exaggeration })
          .then(result => {
            if (result.success && result.audioBase64) {
              setHookAudio('sun', result.audioBase64);
              console.log('✅ New SUN audio ready');
            }
          });
      }
    } catch (error) {
      console.log(`✗ Error with ${provider}:`, error);
    } finally {
      // Wait for minimum spinner time before hiding
      await minSpinnerTime;
      setIsRegenerating(false);
    }
  };

  const isLoadingInitial = readings.length === 0;

  // Audio is pre-rendered in CoreIdentitiesScreen - no auto-generation here

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const index = Math.round(contentOffset.x / layoutMeasurement.width);
    setPage(index);
  };

  // No longer need swipe detection - we have a real 4th page now

  const addSavedPDF = useProfileStore((state) => state.addSavedPDF);
  const displayName = useAuthStore((state) => state.displayName);

  const handleNext = async () => {
    if (page < readings.length - 1) {
      listRef.current?.scrollToIndex({ index: page + 1, animated: true });
    } else {
      // Skip PDF generation during onboarding - can be done later from library
      // Complete onboarding and go directly to the main app (Home/Control Room)
      console.log('🏠 COMPLETING ONBOARDING - Should go to Home (Screen 10)');
      completeOnboarding();
    }
  };

  // Generate a beautiful PDF from the 3 hook readings

  const saveReadingsToPDF = async () => {
    if (!sun || !moon || !rising) return;

    // Combine all 3 readings into one content
    const content = `YOUR SUN SIGN: ${sun.sign}

${sun.intro}

${sun.main}

---

YOUR MOON SIGN: ${moon.sign}

${moon.intro}

${moon.main}

---

YOUR RISING SIGN: ${rising.sign}

${rising.intro}

${rising.main}`;

    const personName = displayName || 'You';
    const today = new Date().toISOString().split('T')[0];

    try {
      // Call backend to generate PDF
      const response = await fetch(`${env.CORE_API_URL}/pdf/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName,
          system: 'core_identities',
          content,
          birthDate: birthDate || today,
        }),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const data = await response.json();

      if (data.success && data.pdfBase64) {
        // Save PDF to local file system - use centralized filename generator
        const fileName = generateCoreIdentitiesPdfFilename(personName);
        const docDir = getDocumentDirectory() || '';
        const filePath = `${docDir}pdfs/${fileName}`;

        // Ensure directory exists
        const dirPath = `${docDir}pdfs/`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        }

        // Write PDF file
        await FileSystem.writeAsStringAsync(filePath, data.pdfBase64, {
          encoding: EncodingType.Base64,
        });

        // Save to profile store
        addSavedPDF({
          fileName,
          filePath,
          pageCount: 1,
          fileSizeMB: Number(((data.pdfBase64.length * 0.75) / (1024 * 1024)).toFixed(2)),
          createdAt: new Date().toISOString(),
          title: 'Your Core Identities (Sun, Moon, Rising)',
          system: 'western',
          type: 'individual',
        });

        console.log('✅ Core Identities PDF saved to library');
      }
    } catch (error) {
      // Silently fail - PDF is optional
      console.log('PDF save skipped:', error);
    }
  };

  // Get background color for active button (animated)
  const getButtonStyle = (provider: LLMProvider) => {
    if (isRegenerating && activeProvider === provider) {
      return {
        backgroundColor: blinkAnim.interpolate({
          inputRange: [0.2, 1],
          outputRange: [colors.primary, colors.text],
        }),
      };
    }
    return activeProvider === provider ? { backgroundColor: colors.text } : {};
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        {/* Content */}
        <View style={styles.content}>
          {isLoadingInitial ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {isRegenerating ? 'Generating your readings...' : 'Calculating your birth chart...'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={readings}
              keyExtractor={(item) => item.type}
              pagingEnabled
              horizontal
              showsHorizontalScrollIndicator={false}
              ref={listRef}
              onMomentumScrollEnd={handleScroll}
              renderItem={({ item }) => {
                // 4th page: Gateway (Sign-up or Transition)
                if (item.type === 'gateway') {
                  return (
                    <View style={styles.page}>
                      <View style={styles.gatewayContainer}>
                        {isTransitioning ? (
                          // Transitioning to Dashboard
                          <>
                            <Text style={styles.gatewayIcon}>✧</Text>
                            <Text style={styles.gatewayTitle}>
                              Entering your{'\n'}Secret Life Dashboard
                            </Text>
                            <ActivityIndicator
                              size="large"
                              color={colors.primary}
                              style={{ marginTop: spacing.xl }}
                            />
                          </>
                        ) : isSignedIn ? (
                          // Already signed in - auto transition
                          <>
                            <Text style={styles.gatewayIcon}>✧</Text>
                            <Text style={styles.gatewayTitle}>
                              Welcome back
                            </Text>
                            <Text style={styles.gatewaySubtitle}>
                              Entering your Dashboard...
                            </Text>
                            <ActivityIndicator
                              size="large"
                              color={colors.primary}
                              style={{ marginTop: spacing.xl }}
                            />
                          </>
                        ) : (
                          // Sign up options
                          <>
                            {/* 5 Systems Image */}
                            {/* 5 Systems Image */}
                            <Image
                              source={require('@/../assets/images/5_systems.png')}
                              style={styles.systemsImage}
                              resizeMode="contain"
                            />
                            <Text style={styles.gatewayTitle}>
                              Sign up to continue
                            </Text>
                            <Text style={styles.gatewaySubtitle}>
                              Save your readings and{'\n'}unlock your full chart
                            </Text>

                            <View style={styles.buttonsContainer}>
                              {/* Google Sign In */}
                              <TouchableOpacity
                                style={styles.googleButton}
                                onPress={handleGoogleSignIn}
                                disabled={isSigningIn}
                              >
                                {isSigningIn ? (
                                  <ActivityIndicator color="#fff" />
                                ) : (
                                  <>
                                    <Text style={styles.googleIcon}>G</Text>
                                    <Text style={styles.googleText}>Continue with Google</Text>
                                  </>
                                )}
                              </TouchableOpacity>

                              {/* Apple Sign In - iOS only */}
                              {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                  style={styles.appleButton}
                                  onPress={handleAppleSignIn}
                                  disabled={isSigningIn}
                                >
                                  <Text style={styles.appleIcon}></Text>
                                  <Text style={styles.appleText}>Continue with Apple</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  );
                }

                // Regular reading pages (Sun, Moon, Rising)
                return (
                  <View style={styles.page}>
                    {/* Header - centered */}
                    <View style={styles.headerCenter}>
                      <Text style={styles.badgeText} selectable>{SIGN_LABELS[item.type]}</Text>
                      <Text style={styles.signName} selectable>{item.sign}</Text>

                      {/* Audio button */}
                      <TouchableOpacity
                        style={[
                          styles.audioBtn,
                          audioPlaying[item.type] && styles.audioBtnActive,
                        ]}
                        onPress={() => {
                          console.log('🔊 Audio button pressed for:', item.type);
                          handlePlayAudio(item as HookReading);
                        }}
                        disabled={audioLoading[item.type]}
                        activeOpacity={0.7}
                      >
                        {audioLoading[item.type] ? (
                          <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                          <Text style={styles.audioBtnText}>
                            {audioPlaying[item.type] ? '■ Stop' : '▶ Audio'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Reading text - justified with word break */}
                    <ScrollView
                      style={styles.textScroll}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.textScrollContent}
                    >
                      <Text
                        style={styles.preamble}
                        selectable
                        textBreakStrategy="highQuality"
                        android_hyphenationFrequency="full"
                      >
                        {item.intro}
                      </Text>
                      <Text
                        style={styles.analysis}
                        selectable
                        textBreakStrategy="highQuality"
                        android_hyphenationFrequency="full"
                      >
                        {item.main}
                      </Text>
                    </ScrollView>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* Footer - Pagination dots for all 4 pages */}
        {!isLoadingInitial && (
          <View style={styles.footer}>
            <View style={styles.pagination}>
              {readings.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.dot, index === page && styles.dotActive]}
                  onPress={() => {
                    listRef.current?.scrollToIndex({ index, animated: true });
                    setPage(index);
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Match IntroScreen layout
  wrapper: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    marginTop: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Provider buttons
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  providerBtn: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  providerBtnInner: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  providerBtnActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  providerBtnDisabled: {
    opacity: 0.4,
  },
  providerBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.mutedText,
  },
  providerBtnTextActive: {
    color: colors.background,
  },
  // Page content - MUST be bounded to prevent overflow into footer
  page: {
    width: PAGE_WIDTH - (spacing.page * 2),
    paddingHorizontal: 8,
    flex: 1,
  },
  headerCenter: {
    alignItems: 'center',
    width: '100%',
  },
  badgeText: {
    fontFamily: typography.sansBold,
    fontSize: 24 * fontScale, // Bigger but not too big
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  risingArrow: {
    fontFamily: typography.headline,
    fontSize: 80 * fontScale,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  signName: {
    fontFamily: typography.headline,
    fontSize: 44 * fontScale,
    color: colors.text,
    lineHeight: 52 * fontScale,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 24,
    marginTop: spacing.md,
    marginBottom: 4, // Tight spacing - hint text is right below
  },
  audioBtnActive: {
    backgroundColor: colors.text,
  },
  audioBtnText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.background,
    letterSpacing: 0.5,
  },
  audioHint: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.lg, // More space before text
  },
  preamble: {
    fontFamily: typography.sansRegular,
    fontSize: 14 * fontScale,
    color: colors.mutedText,
    lineHeight: 20 * fontScale,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textAlign: 'justify', // BLOCK - justified on both edges
  },
  analysis: {
    fontFamily: typography.sansRegular,
    fontSize: 15 * fontScale,
    color: colors.text,
    lineHeight: 22 * fontScale,
    textAlign: 'justify', // BLOCK - justified on both edges
  },
  textScroll: {
    flex: 1,
    width: '100%',
  },
  textScrollContent: {
    paddingBottom: spacing.xl * 2, // Extra padding before footer
    paddingHorizontal: spacing.sm,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg, // Breathing room above dots
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.divider,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 36,
  },
  // Gateway page styles (4th page - sign up / transition)
  gatewayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  gatewayIcon: {
    fontSize: 64,
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  gatewayTitle: {
    fontFamily: typography.headline,
    fontSize: 32 * fontScale,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    marginTop: 30, // Increased from 20 to move down further
  },
  gatewaySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  systemsImage: {
    width: '100%',
    height: '60%', // Keep the bigger size
    top: 40, // Relative position: Moves image transparently without pushing text
    marginBottom: spacing.md,
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 20,
    top: -20, // Move buttons up visually without reflow
    paddingBottom: spacing.xxl,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary, // Our RED
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    width: '100%',
  },
  googleIcon: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.background,
    marginRight: spacing.sm,
  },
  googleText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    width: '100%',
  },
  appleIcon: {
    fontSize: 20,
    color: '#fff',
    marginRight: spacing.sm,
  },
  appleText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#fff',
  },


});
