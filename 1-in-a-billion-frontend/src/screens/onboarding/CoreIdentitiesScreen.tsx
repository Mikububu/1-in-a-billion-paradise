/**
 * ============================================================================
 * ANIMATED REASONING TYPOGRAPHY SYSTEM (ARTS)
 * ============================================================================
 * 
 * A reusable visual pattern for "waiting/loading" screens that transforms
 * boring loading states into engaging typographic experiences.
 * 
 * ============================================================================
 * MATHEMATICAL LAYOUT FORMULA
 * ============================================================================
 * 
 * The screen is divided into 5 typographic lines with precise sizing:
 * 
 *   LINE 1: 48px  - Intro word (e.g., "Your")
 *   LINE 2: 120px - KEY ELEMENT (number, symbol, icon) ← VISUAL ANCHOR
 *   LINE 3: 52px  - Context word
 *   LINE 4: 52px  - Action word
 *   LINE 5: 52px  - Conclusion (italic for emphasis)
 * 
 * Ratio: 48 : 120 : 52 : 52 : 52 = 0.4 : 1 : 0.43 : 0.43 : 0.43
 * The KEY ELEMENT (Line 2) is 2.5x larger than surrounding text.
 * 
 * ============================================================================
 * COLOR VARIATION ALGORITHM
 * ============================================================================
 * 
 * Each screen has a unique color palette to create visual distinction:
 * 
 *   INTRO:   Neutral dark (#1A1A1A) - establishes baseline
 *   SUN:     Warm tones with RED accent on symbol (#d10000)
 *   MOON:    Cool grey/blue tones (#3A3A5A)
 *   RISING:  Strong black/grey contrast (#1A1A1A, #4A4A4A)
 * 
 * Formula: Each screen shifts hue by ~30° on color wheel while
 * maintaining consistent luminosity for readability.
 * 
 * ============================================================================
 * ANIMATION SYSTEM
 * ============================================================================
 * 
 * TWO CORE ANIMATIONS:
 * 
 * 1. PULSE ANIMATION (Status Text)
 *    - Scale: 1.0 → 1.15 → 1.0
 *    - Duration: 800ms per direction (1600ms full cycle)
 *    - Easing: Default (ease-in-out)
 *    - Purpose: Draws attention to loading status
 * 
 * 2. ROTATE ANIMATION (Key Symbol)
 *    - Rotation: 0° → 360°
 *    - Duration: 8000ms (slow, meditative)
 *    - Easing: Linear (constant speed)
 *    - Condition: Only on calculation screens, NOT on intro
 *    - Purpose: Indicates active processing
 * 
 * ============================================================================
 * SCREEN SEQUENCE PATTERN
 * ============================================================================
 * 
 * The flow follows a 5-stage pattern:
 * 
 *   STAGE 1: INTRO      → 10+ seconds (build anticipation)
 *   STAGE 2: PROCESS A  → API call + 3s minimum display
 *   STAGE 3: PROCESS B  → API call + 3s minimum display
 *   STAGE 4: PROCESS C  → API call + 3s minimum display
 *   STAGE 5: OUTRO      → 2 seconds (return to intro, then navigate)
 * 
 * Minimum total time: ~20-30 seconds (feels substantial, not rushed)
 * 
 * ============================================================================
 * CONTENT STRUCTURE
 * ============================================================================
 * 
 * Each screen follows semantic structure:
 * 
 *   Line 1: POSSESSIVE    ("Your")
 *   Line 2: SYMBOL        (☉, ☽, ↑, or number)
 *   Line 3: SUBJECT       ("Sun", "Moon", "Rising")
 *   Line 4: VERB          ("Reveals")
 *   Line 5: OBJECT        ("Your Ego", "Your Soul", "Your Mask")
 * 
 * ============================================================================
 * REUSABILITY GUIDE
 * ============================================================================
 * 
 * To create a new ARTS screen:
 * 
 * 1. Define SCREENS config object with:
 *    - line1-line5 text content
 *    - colors object for each line
 * 
 * 2. Set up sequence array of screen keys
 * 
 * 3. Implement runSequence() with:
 *    - setCurrentScreen() calls
 *    - setStatusText() calls
 *    - API calls or async operations
 *    - delay() for minimum display times
 * 
 * 4. Use animations:
 *    - pulseAnim for status text
 *    - rotateAnim for key symbols (conditionally)
 * 
 * ============================================================================
 * EXAMPLE ADAPTATIONS
 * ============================================================================
 * 
 * SYNASTRY CALCULATION (longer wait):
 *   - Stage 1: "Your 2 Charts Combined"
 *   - Stage 2: "Analyzing Aspects"
 *   - Stage 3: "Finding Resonance"
 *   - Stage 4: "Mapping Tensions"
 *   - Stage 5: "Complete"
 * 
 * FULL READING GENERATION:
 *   - Stage 1: "Your Deep Reading"
 *   - Stage 2-6: Each system (Western, Vedic, Human Design, etc.)
 *   - Stage 7: "Compilation Complete"
 * 
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Easing, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';
import { audioApi } from '@/services/api';
import { AUDIO_CONFIG } from '@/config/readingConfig';
import { AmbientMusic } from '@/services/ambientMusic';
import { uploadHookAudioBase64 } from '@/services/hookAudioCloud';
import { Audio } from 'expo-av';
// Audio stored in memory (base64) - no file system needed

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CoreIdentities'>;

/**
 * ANIMATED REASONING TYPOGRAPHY SYSTEM
 * 
 * Layout Formula:
 * - Line 1: 48px headline (intro)
 * - Line 2: 120px headline (KEY ELEMENT - number/symbol)
 * - Line 3: 52px headline
 * - Line 4: 52px headline
 * - Line 5: 52px headline italic
 * 
 * Color Schemes:
 * - Intro: Dark charcoal (#1A1A1A)
 * - Sun: Warm black with red accent (#2A1A1A, #8B0000)
 * - Moon: Cool grey tones (#3A3A4A, #6B6B7B)
 * - Rising: Black with grey (#1A1A1A, #4A4A4A)
 */

type ScreenConfig = {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
  colors: {
    line1: string;
    line2: string;
    line3: string;
    line4: string;
    line5: string;
  };
};

const SCREENS: Record<string, ScreenConfig> = {
  intro: {
    line1: 'Your',
    line2: '3',
    line3: 'Core',
    line4: 'Identities',
    line5: 'in Love',
    colors: {
      line1: '#1A1A1A',
      line2: '#1A1A1A',
      line3: '#1A1A1A',
      line4: '#1A1A1A',
      line5: '#1A1A1A',
    },
  },
  sun: {
    line1: 'Your',
    line2: '☉',
    line3: 'Sun',
    line4: 'Reveals',
    line5: 'Your Ego',
    colors: {
      line1: '#4A4A4A',
      line2: '#d10000', // Red sun
      line3: '#2A1A1A',
      line4: '#3A3A3A',
      line5: '#1A1A1A',
    },
  },
  moon: {
    line1: 'Your',
    line2: '☽',
    line3: 'Moon',
    line4: 'Reveals',
    line5: 'Your Soul',
    colors: {
      line1: '#5A5A6A',
      line2: '#3A3A5A', // Cool moon grey
      line3: '#4A4A5A',
      line4: '#5A5A5A',
      line5: '#2A2A3A',
    },
  },
  rising: {
    line1: 'Your',
    line2: '↑',
    line3: 'Rising',
    line4: 'Reveals',
    line5: 'Your Mask',
    colors: {
      line1: '#3A3A3A',
      line2: '#1A1A1A', // Strong black
      line3: '#4A4A4A',
      line4: '#5A5A5A',
      line5: '#2A2A2A',
    },
  },
};

export const CoreIdentitiesScreen = ({ navigation }: Props) => {
  const [currentScreen, setCurrentScreen] = useState<'intro' | 'sun' | 'moon' | 'rising'>('intro');
  const [statusText, setStatusText] = useState('Initializing...');
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isInitializing, setIsInitializing] = useState(true); // Show overlay immediately on mount

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sunPulseAnim = useRef(new Animated.Value(1)).current;
  const risingAnim = useRef(new Animated.Value(0)).current; // Rising arrow moves up

  // Get birth data from store
  const birthDate = useOnboardingStore((state) => state.birthDate);
  const birthTime = useOnboardingStore((state) => state.birthTime);
  const birthCity = useOnboardingStore((state) => state.birthCity);
  const relationshipIntensity = useOnboardingStore((state) => state.relationshipIntensity);
  const relationshipMode = useOnboardingStore((state) => state.relationshipMode);
  const primaryLanguage = useOnboardingStore((state) => state.primaryLanguage);
  const setHookReading = useOnboardingStore((state) => state.setHookReading);
  const setHookAudio = useOnboardingStore((state) => state.setHookAudio);
  const authUser = useAuthStore((s) => s.user);

  // Background music (Whispering Breeze)
  const bgMusicRef = useRef<Audio.Sound | null>(null);

  // Load and play background music on mount
  useEffect(() => {
    const loadBgMusic = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('@/../assets/audio/whispering-breeze.mp3'),
          { 
            shouldPlay: true, 
            isLooping: true, 
            volume: 0.3 // Ambient volume
          }
        );
        bgMusicRef.current = sound;
        console.log('🎵 Whispering Breeze background music started');
      } catch (err) {
        console.warn('⚠️ Background music failed to load:', err);
      }
    };
    loadBgMusic();

    return () => {
      // Stop and unload background music on unmount
      if (bgMusicRef.current) {
        bgMusicRef.current.stopAsync().catch(() => {});
        bgMusicRef.current.unloadAsync().catch(() => {});
        bgMusicRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Start animations
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000, // Slow rotation - 8 seconds per full rotation
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotate.start();

    // Sun pulsate animation - warm, glowing feel
    const sunPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulseAnim, { toValue: 1.2, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sunPulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    sunPulse.start();

    // Rising arrow - moves up repeatedly
    const rising = Animated.loop(
      Animated.sequence([
        Animated.timing(risingAnim, { toValue: -40, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(risingAnim, { toValue: 0, duration: 600, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(300), // Pause at bottom before rising again
      ])
    );
    rising.start();

    // Fade out ambient music as we enter the reasoning phase
    AmbientMusic.fadeOut(4000); // Gradual fade out over 4 seconds

    runSequence();

    return () => {
      pulse.stop();
      rotate.stop();
      sunPulse.stop();
      rising.stop();
    };
  }, []);

  const runSequence = async () => {
    // HARD LOCK: if hook readings already exist, never generate again (prevents infinite free API usage).
    const existing = useOnboardingStore.getState().hookReadings;
    if (existing?.sun && existing?.moon && existing?.rising) {
      console.log('🔒 Hook readings already exist - skipping CoreIdentities generation');
      setIsInitializing(false);
      navigation.replace('HookSequence');
      return;
    }

    // Never silently fallback to fake birth data.
    if (!birthDate || !birthCity) {
      Alert.alert('Missing birth data', 'Please add birth date + city first.');
      navigation.goBack();
      return;
    }

    const payload = {
      birthDate,
      birthTime: birthTime || '12:00',
      timezone: birthCity?.timezone || 'UTC',
      latitude: birthCity?.latitude || 0,
      longitude: birthCity?.longitude || 0,
      relationshipIntensity: relationshipIntensity || 5,
      relationshipMode: relationshipMode || 'sensual',
      primaryLanguage: primaryLanguage?.code || 'en',
    };

    // ============================================================================
    // AUDIO GENERATION PIPELINE
    // ============================================================================
    // DESIGN: Generate Sun audio here, wait for it to complete before navigating
    //
    // Timeline:
    //   INTRO (10s)   → Fetch SUN reading → Start SUN audio generation
    //   SUN (4s)      → Fetch MOON reading
    //   MOON (4s)     → Fetch RISING reading
    //   RISING (3s)   → Wait for SUN audio → Navigate to HookSequence
    //
    // Audio Generation Strategy:
    //   - SUN audio: Generated here, MUST complete before navigation
    //   - MOON audio: Pre-rendered in HookSequenceScreen when viewing SUN page
    //   - RISING audio: Pre-rendered in HookSequenceScreen when viewing MOON page
    // ============================================================================
    
    // Store readings at function scope (not inside callbacks)
    let sunReading: any = null;
    let moonReading: any = null;
    let risingReading: any = null;
    
    // SUN audio promise - only Sun is generated here; Moon/Rising use staggered preload
    let sunAudioPromise: Promise<void> | null = null;

    // Helper to generate audio for a reading - SIMPLE: store base64 in memory, no file system
    const generateAudioForType = async (type: 'sun' | 'moon' | 'rising', reading: any): Promise<void> => {
      if (!reading) return;
      console.log(`🎵 Starting ${type.toUpperCase()} audio generation...`);
      
      try {
        const tts = await audioApi.generateTTS(`${reading.intro}\n\n${reading.main}`, {
          exaggeration: AUDIO_CONFIG.exaggeration,
        });

        if (tts.success && tts.audioBase64) {
          // Store base64 directly in memory for immediate playback
          setHookAudio(type, tts.audioBase64);
          console.log(`✅ ${type.toUpperCase()} audio ready (in memory)`);
          
          // Upload to Supabase in background (non-blocking, for cross-device sync)
          const userId = useAuthStore.getState().user?.id;
          const user = useProfileStore.getState().people.find(p => p.isUser);
          const personId = user?.id;
          
          if (userId && personId && tts.audioBase64) {
            uploadHookAudioBase64({
              userId,
              personId,
              type,
              audioBase64: tts.audioBase64,
            })
              .then(result => {
                if (result.success) {
                  console.log(`☁️ ${type.toUpperCase()} synced to Supabase: ${result.path}`);
                } else {
                  console.log(`⚠️ ${type.toUpperCase()} sync failed: ${result.error} (non-critical)`);
                }
              })
              .catch(err => console.log(`⚠️ ${type.toUpperCase()} sync error:`, err.message));
          }
        } else {
          console.log(`❌ ${type.toUpperCase()} audio failed:`, tts.error);
        }
      } catch (err: any) {
        console.log(`⚠️ ${type.toUpperCase()} audio exception:`, err);
      }
    };

    try {
      // Hide initialization overlay after a brief delay (smooth transition from AccountScreen)
      setTimeout(() => setIsInitializing(false), 300);
      
      // ========== SCREEN 1: INTRO (15s minimum) ==========
      setCurrentScreen('intro');
      setStatusText('Preparing your chart...');
      setProgress(5);

      // Fetch SUN reading (parallel with intro delay)
      console.log('🔮 Fetching SUN reading...');
      const sunFetchPromise = fetch(`${env.CORE_API_URL}/api/reading/sun?provider=deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          sunReading = data.reading;
          setHookReading(data.reading);
          console.log('✅ SUN reading received');

          // Save placements from backend
          if (data.placements) {
            const user = useProfileStore.getState().people.find(p => p.isUser);
            if (user) {
              useProfileStore.getState().updatePerson(user.id, {
                placements: {
                  sunSign: data.placements.sunSign,
                  sunDegree: data.placements.sunDegree,
                  moonSign: data.placements.moonSign,
                  moonDegree: data.placements.moonDegree,
                  risingSign: data.placements.risingSign,
                  risingDegree: data.placements.risingDegree,
                },
              });
            }
          }
        }
      });

      // Wait for intro (15s) AND sun reading fetch - allows RunPod warmup
      await Promise.all([delay(15000), sunFetchPromise]);
      setProgress(15);

      // START SUN AUDIO NOW (after reading is available, not inside .then())
      if (sunReading) {
        sunAudioPromise = generateAudioForType('sun', sunReading);
      }

      // ========== SCREEN 2: SUN (4s minimum) ==========
      setCurrentScreen('sun');
      setStatusText('Analyzing Sun sign...');
      setProgress(25);

      // Fetch MOON reading in parallel with display delay
      console.log('🔮 Fetching MOON reading...');
      const moonFetchPromise = fetch(`${env.CORE_API_URL}/api/reading/moon?provider=deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          moonReading = data.reading;
          setHookReading(data.reading);
          console.log('✅ MOON reading received');

          // Save placements fallback
          if (data.placements) {
          const user = useProfileStore.getState().people.find(p => p.isUser);
          if (user && !user.placements) {
            useProfileStore.getState().updatePerson(user.id, {
              placements: {
                  sunSign: data.placements.sunSign,
                  sunDegree: data.placements.sunDegree,
                  moonSign: data.placements.moonSign,
                  moonDegree: data.placements.moonDegree,
                  risingSign: data.placements.risingSign,
                  risingDegree: data.placements.risingDegree,
              },
            });
          }
        }
      }
      });

      await Promise.all([delay(4000), moonFetchPromise]);
      setProgress(35);

      // NOTE: Moon audio is NOT generated here - it's handled by staggered preload
      // in HookSequenceScreen (generates Moon audio while viewing Sun page)

      // ========== SCREEN 3: MOON (4s minimum) ==========
      setCurrentScreen('moon');
      setStatusText('Calculating Moon sign...');
      setProgress(45);

      // Fetch RISING reading in parallel with display delay
      console.log('🔮 Fetching RISING reading...');
      const risingFetchPromise = fetch(`${env.CORE_API_URL}/api/reading/rising?provider=deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          risingReading = data.reading;
          setHookReading(data.reading);
          console.log('✅ RISING reading received');

          // Save placements fallback
          if (data.placements) {
          const user = useProfileStore.getState().people.find(p => p.isUser);
          if (user && !user.placements) {
            useProfileStore.getState().updatePerson(user.id, {
              placements: {
                  sunSign: data.placements.sunSign,
                  sunDegree: data.placements.sunDegree,
                  moonSign: data.placements.moonSign,
                  moonDegree: data.placements.moonDegree,
                  risingSign: data.placements.risingSign,
                  risingDegree: data.placements.risingDegree,
              },
            });
          }
        }
      }
      });

      await Promise.all([delay(4000), risingFetchPromise]);
      setProgress(55);

      // NOTE: Rising audio is NOT generated here - it's handled by staggered preload
      // in HookSequenceScreen (generates Rising audio while viewing Moon page)

      // ========== SCREEN 4: RISING (3s minimum) ==========
      setCurrentScreen('rising');
      setStatusText('Calculating Rising sign...');
      setProgress(70);
      await delay(3000);
      setProgress(80);

      // ========== WAIT FOR SUN AUDIO BEFORE NAVIGATING ==========
      // Sun audio must be ready before user sees HookSequence screen
      // Retry up to 3 times if generation fails
      setProgress(90);
      
      const MAX_RETRIES = 3;
      let audioReady = false;
      let attempt = 0;

      while (!audioReady && attempt < MAX_RETRIES) {
        attempt++;
        // Keep UX poetic (no technical retry counters) - show text longer so it's visible
        setStatusText('Giving your reading a voice…');
        await delay(1500); // Show text for at least 1.5s so user can read it
        
        console.log(`🎵 Audio generation attempt ${attempt}/${MAX_RETRIES}`);
        
        try {
          // If first attempt, wait for existing promise
          if (attempt === 1 && sunAudioPromise) {
            await sunAudioPromise;
          } else {
            // Retry: generate fresh
            if (sunReading) {
              await generateAudioForType('sun', sunReading);
            }
          }
          
          // Check if audio was actually stored
          const stored = useOnboardingStore.getState().hookAudio.sun;
          if (stored) {
            audioReady = true;
            console.log(`✅ Sun audio ready after ${attempt} attempt(s)!`);
          } else {
            throw new Error('Audio not stored in state');
          }
        } catch (error: any) {
          console.warn(`⚠️ Audio attempt ${attempt} failed:`, error.message);
          
          if (attempt < MAX_RETRIES) {
            // Wait longer and show text so user can read it
            setStatusText('One moment…');
            await delay(2500); // Longer delay so text is visible
          } else {
            // Final attempt failed - proceed anyway
            console.error('❌ All audio attempts failed, proceeding without audio');
            setStatusText('Continuing…');
            await delay(2000); // Longer delay so text is visible
          }
        }
      }

      setProgress(100);
      setStatusText('Ready!');
      await delay(1500); // Longer delay so "Ready!" is visible

      // Log audio state for debugging
      const hookAudioAtNavigation = useOnboardingStore.getState().hookAudio;
      console.log('🎵 Audio state at navigation:', {
        sun: hookAudioAtNavigation.sun ? 'ready (URL)' : 'missing',
        moon: hookAudioAtNavigation.moon ? 'ready (URL)' : 'pending',
        rising: hookAudioAtNavigation.rising ? 'ready (URL)' : 'pending',
      });

      // Navigate to HookSequence (Sun audio is ready, Moon/Rising will pre-render)
      console.log('✅ Navigating to HookSequence (Sun audio ready)');
      navigation.replace('HookSequence');

    } catch (error) {
      console.log('Error fetching readings:', error);
      setStatusText('One moment…');
      await delay(2000);
      navigation.replace('HookSequence');
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const screen = SCREENS[currentScreen];

  // Rotation interpolation for icons
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={[styles.line1, { color: screen.colors.line1 }]} selectable>
          {screen.line1}
        </Text>

        {/* Line 2 - Animated symbol */}
        {currentScreen === 'intro' ? (
          // Intro screen: show pulsating "3"
          <Animated.Text
            style={[
              styles.line2,
              { color: screen.colors.line2, transform: [{ scale: pulseAnim }] }
            ]}
            selectable
          >
            3
          </Animated.Text>
        ) : currentScreen === 'sun' ? (
          // Sun: pulsating glow
          <Animated.Text
            style={[
              styles.line2Symbol,
              { color: screen.colors.line2, transform: [{ scale: sunPulseAnim }] }
            ]}
            selectable
          >
            ☉
          </Animated.Text>
        ) : currentScreen === 'moon' ? (
          // Moon: rotating (phases)
          <Animated.Text
            style={[
              styles.line2Symbol,
              { color: screen.colors.line2, transform: [{ rotate: spin }] }
            ]}
            selectable
          >
            ☽
          </Animated.Text>
        ) : (
          // Rising: arrow symbol moves UP
          <Animated.Text
            style={[
              styles.line2Symbol,
              { color: screen.colors.line2, transform: [{ translateY: risingAnim }] }
            ]}
            selectable
          >
            ↑
          </Animated.Text>
        )}

        <Text style={[styles.line3, { color: screen.colors.line3 }]} selectable>
          {screen.line3}
        </Text>

        <Text style={[styles.line4, { color: screen.colors.line4 }]} selectable>
          {screen.line4}
        </Text>

        <Text style={[styles.line5, { color: screen.colors.line5 }]} selectable>
          {screen.line5}
        </Text>
      </View>

      {/* Screen ID */}
      {/** Screen numbers temporarily removed */}

      <View style={styles.footer}>
        {/* Progress bar - 0% to 100% */}
        <View style={styles.loadingBarContainer}>
          <View style={[styles.loadingBar, { width: `${progress}%` }]} />
        </View>

        {/* Status text */}
        <Text style={styles.statusText} selectable>
          {statusText}
        </Text>
      </View>

      {/* Initialization Overlay - Prevents white flash during navigation */}
      {isInitializing && (
        <View style={styles.initOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.initText}>Loading your experience...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep root transparent so leather texture always shows through.
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  // TYPOGRAPHY FORMULA
  line1: {
    fontFamily: typography.headline,
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  line2: {
    fontFamily: typography.headline,
    fontSize: 140,
    lineHeight: 160,
    height: 160, // Fixed height so line3 stays in same position
  },
  line2Symbol: {
    fontSize: 140,
    lineHeight: 180,
    height: 180, // Same height as line2 so line3 stays in same position
  },
  line3: {
    fontFamily: typography.headline,
    fontSize: 52,
  },
  line4: {
    fontFamily: typography.headline,
    fontSize: 52,
  },
  line5: {
    fontFamily: typography.headline,
    fontSize: 52,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  loadingBarContainer: {
    width: '60%',
    height: 6,
    backgroundColor: colors.divider,
    borderRadius: 3,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
  },
  screenId: {
    position: 'absolute',
    top: 95,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
  },
  initOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Prevent flashes but never hide the leather texture.
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    gap: spacing.lg,
  },
  initText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    marginTop: spacing.md,
  },
});
