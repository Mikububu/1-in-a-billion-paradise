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
import { StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { env } from '@/config/env';
import { audioApi } from '@/services/api';
import { AUDIO_CONFIG } from '@/config/readingConfig';
import { AmbientMusic } from '@/services/ambientMusic';

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
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0); // 0 to 100

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
    const payload = {
      birthDate: birthDate || '1968-08-23',
      birthTime: birthTime || '13:45',
      timezone: birthCity?.timezone || 'Europe/Vienna',
      latitude: birthCity?.latitude || 46.6103,
      longitude: birthCity?.longitude || 13.8558,
      relationshipIntensity: relationshipIntensity || 5,
      relationshipMode: relationshipMode || 'sensual',
      primaryLanguage: primaryLanguage?.code || 'en',
    };

    // Track audio generation promise (run in background during waiting screens)
    // Intended pipeline:
    // - Sun audio is pre-rendered during the waiting/intro sequence
    // - Moon audio is generated on the Sun screen
    // - Rising audio is generated on the Moon screen
    let sunAudioPromise: Promise<void> | null = null;

    try {
      // SCREEN 1: Intro - show for 10 seconds
      // WHILE showing intro: fetch SUN reading AND start SUN audio generation
      setCurrentScreen('intro');
      setStatusText('Preparing your chart...');
      setProgress(5);

      // Start SUN reading fetch DURING intro (in parallel with 10s wait)
      console.log('🎵 Starting SUN reading fetch during INTRO screen...');
      let sunReading: any = null;
      const sunFetchPromise = fetch(`${env.CORE_API_URL}/api/reading/sun?provider=deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (res.ok) {
          const sunData = await res.json();
          sunReading = sunData.reading;
          setHookReading(sunData.reading);
          console.log('✅ SUN reading received during INTRO');

          // ✅ SAVE PLACEMENTS: Backend calculated all signs, save them now!
          if (sunData.placements) {
            console.log('💾 Saving placements from SUN hook:', sunData.placements);
            const user = useProfileStore.getState().people.find(p => p.isUser);
            if (user) {
              useProfileStore.getState().updatePerson(user.id, {
                placements: {
                  sunSign: sunData.placements.sunSign,
                  sunDegree: sunData.placements.sunDegree,
                  moonSign: sunData.placements.moonSign,
                  moonDegree: sunData.placements.moonDegree,
                  risingSign: sunData.placements.risingSign,
                  risingDegree: sunData.placements.risingDegree,
                },
              });
              console.log('✅ Placements saved to profile store');
            }
          }

          // Immediately start SUN audio generation (runs in background)
          sunAudioPromise = (async () => {
            console.log('🎵 Starting SUN audio generation (background)...');
            try {
              const result = await audioApi.generateTTS(
                `${sunReading.intro}\n\n${sunReading.main}`,
                { exaggeration: AUDIO_CONFIG.exaggeration }
              );
              if (result.success && result.audioBase64) {
                setHookAudio('sun', result.audioBase64);
                console.log('✅ SUN audio ready (generated during waiting screens)');
              } else {
                console.log('❌ SUN audio generation failed:', result.error);
              }
            } catch (err) {
              console.log('⚠️ SUN audio exception:', err);
            }
          })();
        }
      });

      // Wait for intro display time (10s) AND sun fetch to complete
      await Promise.all([delay(10000), sunFetchPromise]);
      setProgress(15);

      // SCREEN 2: Sun - show the sun screen (reading already fetched)
      setCurrentScreen('sun');
      setStatusText('Analyzing Sun sign...');
      setProgress(25);
      await delay(4000);
      setProgress(30);

      // SCREEN 3: Moon calculation
      setCurrentScreen('moon');
      setStatusText('Calculating Moon sign...');
      setProgress(35);
      let moonReading: any = null;
      const moonRes = await fetch(`${env.CORE_API_URL}/api/reading/moon?provider=deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (moonRes.ok) {
        const moonData = await moonRes.json();
        moonReading = moonData.reading;
        setHookReading(moonData.reading);

        // Save placements if not already saved (fallback if sun failed)
        if (moonData.placements) {
          const user = useProfileStore.getState().people.find(p => p.isUser);
          if (user && !user.placements) {
            console.log('💾 Saving placements from MOON hook (sun was missing)');
            useProfileStore.getState().updatePerson(user.id, {
              placements: {
                sunSign: moonData.placements.sunSign,
                sunDegree: moonData.placements.sunDegree,
                moonSign: moonData.placements.moonSign,
                moonDegree: moonData.placements.moonDegree,
                risingSign: moonData.placements.risingSign,
                risingDegree: moonData.placements.risingDegree,
              },
            });
          }
        }
      }
      setProgress(45);
      await delay(4000);
      setProgress(50);

      // SCREEN 4: Rising calculation
      setCurrentScreen('rising');
      setStatusText('Calculating Rising sign...');
      setProgress(55);
      let risingReading: any = null;
      const risingRes = await fetch(`${env.CORE_API_URL}/api/reading/rising?provider=deepseek`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (risingRes.ok) {
        const risingData = await risingRes.json();
        risingReading = risingData.reading;
        setHookReading(risingData.reading);

        // Save placements if not already saved (fallback if sun & moon failed)
        if (risingData.placements) {
          const user = useProfileStore.getState().people.find(p => p.isUser);
          if (user && !user.placements) {
            console.log('💾 Saving placements from RISING hook (sun/moon were missing)');
            useProfileStore.getState().updatePerson(user.id, {
              placements: {
                sunSign: risingData.placements.sunSign,
                sunDegree: risingData.placements.sunDegree,
                moonSign: risingData.placements.moonSign,
                moonDegree: risingData.placements.moonDegree,
                risingSign: risingData.placements.risingSign,
                risingDegree: risingData.placements.risingDegree,
              },
            });
          }
        }
      }
      setProgress(70);
      await delay(3000);
      setProgress(80);

      // SUN audio is generating in background - it will complete eventually
      console.log('🎵 SUN audio generating in background (non-blocking)...');

      setProgress(100);
      setStatusText('Ready!');
      await delay(500);

      console.log('✅ Navigating to HookSequence (audio will complete in background)');
      // Navigate to results
      navigation.replace('HookSequence');

    } catch (error) {
      console.log('Error fetching readings:', error);
      setStatusText('Error - retrying...');
      await delay(2000);
      navigation.replace('HookSequence');
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Pre-generate audio for a reading (runs in background)
  const generateAudioForReading = async (type: 'sun' | 'moon' | 'rising', reading: any) => {
    try {
      const text = `${reading.intro}\n\n${reading.main}`;
      console.log(`🎵 Pre-generating ${type} audio... Text length: ${text.length} chars`);
      // Lower exaggeration = calmer, more measured pace
      const result = await audioApi.generateTTS(text, { exaggeration: AUDIO_CONFIG.exaggeration });
      if (result.success && result.audioBase64) {
        console.log(`✅ ${type} audio pre-loaded: ${Math.round(result.audioBase64.length / 1024)}KB base64`);
        setHookAudio(type, result.audioBase64);
      } else {
        console.log(`❌ ${type} audio failed:`, result.error);
      }
    } catch (error) {
      console.log(`⚠️ Failed to pre-generate ${type} audio:`, error);
    }
  };

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
      <Text style={styles.screenId}>7</Text>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
});
