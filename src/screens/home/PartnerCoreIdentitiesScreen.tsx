/**
 * ============================================================================
 * PARTNER CORE IDENTITIES SCREEN
 * ============================================================================
 * 
 * Uses the ARTS (Animated Reasoning Typography System) for partner calculations.
 * Same pattern as CoreIdentitiesScreen but personalized for the partner.
 * 
 * SEQUENCE:
 * 1. INTRO: "[Partner]'s 3 Core Identities in Love" (10 sec)
 * 2. SUN: "[Partner]'s ☉ Sun Reveals Their Ego"
 * 3. MOON: "[Partner]'s ☽ Moon Reveals Their Soul"
 * 4. RISING: "[Partner]'s ↑ Rising Reveals Their Mask"
 * 5. OUTRO: Back to intro briefly → navigate
 */

import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Easing, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { useProfileStore } from '@/store/profileStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { audioApi } from '@/services/api';
import { uploadHookAudioBase64 } from '@/services/hookAudioCloud';
import { AUDIO_CONFIG } from '@/config/readingConfig';
import { CityOption } from '@/types/forms';

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerCoreIdentities'>;

const screenId = '16'; // Partner Core Identities

type ScreenKey = 'intro' | 'sun' | 'moon' | 'rising';

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

const getScreens = (name: string): Record<ScreenKey, ScreenConfig> => ({
  intro: {
    line1: `${name}'s`,
    line2: '3',
    line3: 'Core',
    line4: 'Identities',
    line5: 'in Love',
    colors: {
      line1: '#d10000', // Name always RED
      line2: '#1A1A1A',
      line3: '#1A1A1A',
      line4: '#1A1A1A',
      line5: '#1A1A1A',
    },
  },
  sun: {
    line1: `${name}'s`,
    line2: '☉',
    line3: 'Sun',
    line4: 'Reveals',
    line5: `${name}'s Ego`,
    colors: {
      line1: '#d10000', // Name always RED
      line2: '#d10000', // Red sun
      line3: '#2A1A1A',
      line4: '#3A3A3A',
      line5: '#1A1A1A',
    },
  },
  moon: {
    line1: `${name}'s`,
    line2: '☽',
    line3: 'Moon',
    line4: 'Reveals',
    line5: `${name}'s Soul`,
    colors: {
      line1: '#d10000', // Name always RED
      line2: '#3A3A5A', // Cool moon grey
      line3: '#4A4A5A',
      line4: '#5A5A5A',
      line5: '#2A2A3A',
    },
  },
  rising: {
    line1: `${name}'s`,
    line2: '↑',
    line3: 'Rising',
    line4: 'Reveals',
    line5: `${name}'s Mask`,
    colors: {
      line1: '#d10000', // Name always RED
      line2: '#1A1A1A', // Strong black
      line3: '#4A4A4A',
      line4: '#5A5A5A',
      line5: '#2A2A2A',
    },
  },
});

export const PartnerCoreIdentitiesScreen = ({ navigation, route }: Props) => {
  console.log(`📱 Screen ${screenId}: PartnerCoreIdentitiesScreen`);
  const { partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } = route.params || {};
  const partnerIdFromRoute = (route.params as any)?.partnerId as string | undefined;
  const isPrepayOnboarding = (route.params as any)?.mode === 'onboarding_hook';
  const name = partnerName || 'Partner';
  
  const [currentScreen, setCurrentScreen] = useState<ScreenKey>('intro');
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0); // 0 to 100
  
  // Profile store for saving partner
  const addPerson = useProfileStore((state) => state.addPerson);
  const setHookReadings = useProfileStore((state) => state.setHookReadings);
  const people = useProfileStore((state) => state.people);

  // Use the same config knobs as the 1st-person hook pipeline (don’t hardcode).
  const relationshipPreferenceScale = useOnboardingStore((s: any) => s.relationshipPreferenceScale) ?? 5;
  const relationshipMode = useOnboardingStore((s: any) => s.relationshipMode) ?? 'sensual';
  const primaryLanguage = useOnboardingStore((s: any) => s.primaryLanguage?.code) ?? 'en';
  
  // Audio store for partner audio pre-rendering
  const setPartnerAudio = useOnboardingStore((state: any) => state.setPartnerAudio);
  const clearPartnerAudio = useOnboardingStore((state: any) => state.clearPartnerAudio);
  
  // Check if person already exists with cached placements
  const existingPerson = people.find(p => 
    p.name?.toLowerCase() === name.toLowerCase() && 
    !p.isUser &&
    p.placements?.sunSign && 
    p.placements?.moonSign && 
    p.placements?.risingSign
  );
  
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sunPulseAnim = useRef(new Animated.Value(1)).current;
  const risingAnim = useRef(new Animated.Value(0)).current; // Rising arrow moves UP

  const SCREENS = getScreens(name);

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
        duration: 8000, // Slow rotation
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

    // Rising arrow - moves up repeatedly (THE BEAUTIFUL ARROW!)
    const rising = Animated.loop(
      Animated.sequence([
        Animated.timing(risingAnim, { toValue: -20, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(risingAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    rising.start();
    
    runSequence();
    
    return () => {
      pulse.stop();
      rotate.stop();
      sunPulse.stop();
      rising.stop();
    };
  }, []);

  const runSequence = async () => {
    // Clear any old partner audio first
    clearPartnerAudio();

    // Check if we have cached placements from existing person - skip calculation if so
    if (existingPerson?.placements) {
      console.log(`✅ Using cached placements for ${name}:`, existingPerson.placements);
      const cachedCity: CityOption | null =
        partnerBirthCity ??
        ({
          id: `saved-${existingPerson.id}`,
          name: existingPerson.birthData?.birthCity || 'Unknown',
          country: '',
          region: '',
          latitude: typeof existingPerson.birthData?.latitude === 'number' ? existingPerson.birthData.latitude : 0,
          longitude: typeof existingPerson.birthData?.longitude === 'number' ? existingPerson.birthData.longitude : 0,
          timezone: existingPerson.birthData?.timezone || 'UTC',
        } as CityOption);

      // Pre-pay onboarding must run the real hook-reading pipeline (API calls) so the data is correct.
      // So we only use the cached fast-path in non-onboarding flows.
      if (!isPrepayOnboarding) {
        setProgress(100);
        setStatusText('Loading existing readings...');
        await delay(500);
        navigation.replace('PartnerReadings', {
          partnerName: name,
          partnerBirthDate: partnerBirthDate || existingPerson.birthData?.birthDate,
          partnerBirthTime: partnerBirthTime || existingPerson.birthData?.birthTime,
          partnerBirthCity: cachedCity,
          partnerId: existingPerson.id,
        });
        return;
      }

      // If we're in onboarding, fall through and run the real pipeline below.
    }

    // Capture placements so Compare can work later (no extra "pre-run free flows")
    let sunSign: string | undefined;
    let moonSign: string | undefined;
    let risingSign: string | undefined;

    // Never silently fall back to fake birth data in onboarding.
    if (!partnerBirthDate || !partnerBirthCity) {
      Alert.alert('Missing birth data', 'Please add birth date + city for this person.');
      navigation.goBack();
      return;
    }
    
    // CRITICAL: Validate birth location has valid coordinates
    if (
      typeof partnerBirthCity?.latitude !== 'number' ||
      typeof partnerBirthCity?.longitude !== 'number' ||
      (partnerBirthCity.latitude === 0 && partnerBirthCity.longitude === 0)
    ) {
      console.error('❌ Invalid partner birth location:', partnerBirthCity);
      Alert.alert(
        'Invalid Birth Location',
        `${name}'s birth city is missing coordinates. Please go back and select a valid city from the list.`
      );
      navigation.goBack();
      return;
    }

    console.log(`🌍 Partner birth location validated:`, {
      city: partnerBirthCity.name,
      lat: partnerBirthCity.latitude,
      lng: partnerBirthCity.longitude,
      tz: partnerBirthCity.timezone,
    });

    // CRITICAL: Detect timezone issues BEFORE making API calls
    const resolvedTimezone = partnerBirthCity.timezone || 'UTC';
    if (resolvedTimezone === 'UTC') {
      // If timezone is UTC but coordinates are far from GMT, we have a bug!
      const expectedOffset = Math.round(partnerBirthCity.longitude / 15);
      if (Math.abs(expectedOffset) > 1) {
        console.error(`⚠️ TIMEZONE BUG for ${name}! Using UTC but coordinates suggest a different timezone:`, {
          storedTimezone: partnerBirthCity.timezone,
          longitude: partnerBirthCity.longitude,
          expectedOffset: `UTC${expectedOffset >= 0 ? '+' : ''}${expectedOffset}`,
          cityObject: JSON.stringify(partnerBirthCity),
        });
      }
    }
    
    const payload = {
      birthDate: partnerBirthDate,
      birthTime: partnerBirthTime || '12:00',
      timezone: resolvedTimezone,
      latitude: partnerBirthCity.latitude,
      longitude: partnerBirthCity.longitude,
      relationshipPreferenceScale,
      relationshipMode,
      primaryLanguage,
      subjectName: name,
      isPartnerReading: true,
    };
    
    console.log(`🚀 Partner payload for ${name}:`, {
      birthDate: payload.birthDate,
      birthTime: payload.birthTime,
      timezone: payload.timezone,
      lat: payload.latitude,
      lng: payload.longitude,
    });

    try {
      // SCREEN 1: Intro - show for 10 seconds
      // Start fetching Sun reading in parallel (same as 1st person readings)
      setCurrentScreen('intro');
      setStatusText(`Preparing ${name}'s chart...`);
      setProgress(5);
      
      const nocacheParam = __DEV__ ? '&nocache=true' : ''; // Always bypass cache in dev
      const sunReadingPromise = fetch(`${env.CORE_API_URL}/api/reading/sun?provider=deepseek${nocacheParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => res.ok ? res.json() : null);
      
      // Start Sun audio generation during intro screen (same as 1st person readings)
      const sunAudioPromise = sunReadingPromise.then(async (sunData) => {
        if (sunData?.reading) {
          sunSign = sunData.reading.sign;
          console.log(`🎵 Starting ${name}'s SUN audio generation...`);
          
          // ✅ SAVE PLACEMENTS for partner
          if (sunData.placements) {
            console.log(`💾 Saving ${name}'s placements:`, sunData.placements);
            // Prefer Swiss Ephemeris placements as source-of-truth for signs.
            sunSign = sunSign || sunData.placements.sunSign;
            moonSign = moonSign || sunData.placements.moonSign;
            risingSign = risingSign || sunData.placements.risingSign;
          }
          
          const result = await audioApi.generateTTS(
            `${sunData.reading.intro}\n\n${sunData.reading.main}`,
            { exaggeration: AUDIO_CONFIG.exaggeration }
          );
          if (result.success) {
            const immediateSource = result.audioUrl;
            if (immediateSource) {
              setPartnerAudio('sun', immediateSource);
            }
            console.log(`✅ ${name}'s SUN audio ready`);
            
            // Upload to Supabase in background (non-blocking)
            const userId = useAuthStore.getState().user?.id;
            if (!isPrepayOnboarding && userId && partnerIdFromRoute && result.audioBase64) {
              uploadHookAudioBase64({
                userId,
                personId: partnerIdFromRoute,
                type: 'sun',
                audioBase64: result.audioBase64,
              })
                .then(uploadResult => {
                  if (uploadResult.success) {
                    setPartnerAudio('sun', uploadResult.path);
                    useProfileStore.getState().updatePerson(partnerIdFromRoute, {
                      hookAudioPaths: {
                        ...(useProfileStore.getState().getPerson(partnerIdFromRoute)?.hookAudioPaths || {}),
                        sun: uploadResult.path,
                      },
                    } as any);
                    console.log(`☁️ ${name}'s SUN synced to Supabase`);
                  }
                })
                .catch(() => {});
            }
          }
        }
        return sunData;
      });
      
      await delay(10000);
      setProgress(10);

      // SCREEN 2: Sun - wait for Sun audio to be ready
      setCurrentScreen('sun');
      setStatusText(`Calculating ${name}'s Sun sign...`);
      setProgress(15);
      
      // Wait for Sun audio to complete before proceeding
      const sunData = await sunAudioPromise;
      console.log(`✅ ${name}'s Sun audio ready!`);
      setProgress(30);
      await delay(3000);

      // SCREEN 3: Moon calculation + start Moon audio
      setCurrentScreen('moon');
      setStatusText(`Calculating ${name}'s Moon sign...`);
      setProgress(40);
      
      const moonRes = await fetch(`${env.CORE_API_URL}/api/reading/moon?provider=deepseek${nocacheParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const moonData = moonRes.ok ? await moonRes.json() : null;
      moonSign = moonData?.reading?.sign;

      // ✅ SAVE PLACEMENTS fallback: if Sun failed, Moon can still provide full Swiss Ephemeris placements
      if (moonData?.placements) {
        // Prefer Swiss Ephemeris placements as source of truth for signs
        sunSign = sunSign || moonData.placements.sunSign;
        moonSign = moonSign || moonData.placements.moonSign;
        risingSign = risingSign || moonData.placements.risingSign;
      }
      
      // Start Moon audio generation (returns promise for later awaiting)
      let moonAudioPromise: Promise<void> | null = null;
      if (moonData?.reading) {
        console.log(`🎵 Starting ${name}'s MOON audio generation...`);
        moonAudioPromise = audioApi.generateTTS(
          `${moonData.reading.intro}\n\n${moonData.reading.main}`,
          { exaggeration: AUDIO_CONFIG.exaggeration }
        )
          .then((result) => {
            if (result.success) {
              const immediateSource = result.audioUrl;
              if (immediateSource) {
                setPartnerAudio('moon', immediateSource);
              }
              console.log(`✅ ${name}'s MOON audio ready`);
              
              // Upload to Supabase in background (non-blocking)
              const userId = useAuthStore.getState().user?.id;
              if (!isPrepayOnboarding && userId && partnerIdFromRoute && result.audioBase64) {
                uploadHookAudioBase64({
                  userId,
                  personId: partnerIdFromRoute,
                  type: 'moon',
                  audioBase64: result.audioBase64,
                })
                  .then(uploadResult => {
                    if (uploadResult.success) {
                      setPartnerAudio('moon', uploadResult.path);
                      useProfileStore.getState().updatePerson(partnerIdFromRoute, {
                        hookAudioPaths: {
                          ...(useProfileStore.getState().getPerson(partnerIdFromRoute)?.hookAudioPaths || {}),
                          moon: uploadResult.path,
                        },
                      } as any);
                      console.log(`☁️ ${name}'s MOON synced to Supabase`);
                    }
                  })
                  .catch(() => {});
              }
            }
          })
          .catch((err) => console.log('Moon audio generation failed:', err));
      }
      setProgress(60);
      await delay(3000);

      // SCREEN 4: Rising calculation + start Rising audio
      setCurrentScreen('rising');
      setStatusText(`Calculating ${name}'s Rising sign...`);
      setProgress(70);
      
      const risingRes = await fetch(`${env.CORE_API_URL}/api/reading/rising?provider=deepseek${nocacheParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const risingData = risingRes.ok ? await risingRes.json() : null;
      risingSign = risingData?.reading?.sign;

      // ✅ SAVE PLACEMENTS fallback: if Sun+Moon failed, Rising can still provide full Swiss Ephemeris placements
      if (risingData?.placements) {
        sunSign = sunSign || risingData.placements.sunSign;
        moonSign = moonSign || risingData.placements.moonSign;
        risingSign = risingSign || risingData.placements.risingSign;
      }
      
      // Start Rising audio generation (returns promise for later awaiting)
      let risingAudioPromise: Promise<void> | null = null;
      if (risingData?.reading) {
        console.log(`🎵 Starting ${name}'s RISING audio generation...`);
        risingAudioPromise = audioApi.generateTTS(
          `${risingData.reading.intro}\n\n${risingData.reading.main}`,
          { exaggeration: AUDIO_CONFIG.exaggeration }
        )
          .then((result) => {
            if (result.success) {
              const immediateSource = result.audioUrl;
              if (immediateSource) {
                setPartnerAudio('rising', immediateSource);
              }
              console.log(`✅ ${name}'s RISING audio ready`);
              
              // Upload to Supabase in background (non-blocking)
              const userId = useAuthStore.getState().user?.id;
              if (!isPrepayOnboarding && userId && partnerIdFromRoute && result.audioBase64) {
                uploadHookAudioBase64({
                  userId,
                  personId: partnerIdFromRoute,
                  type: 'rising',
                  audioBase64: result.audioBase64,
                })
                  .then(uploadResult => {
                    if (uploadResult.success) {
                      setPartnerAudio('rising', uploadResult.path);
                      useProfileStore.getState().updatePerson(partnerIdFromRoute, {
                        hookAudioPaths: {
                          ...(useProfileStore.getState().getPerson(partnerIdFromRoute)?.hookAudioPaths || {}),
                          rising: uploadResult.path,
                        },
                      } as any);
                      console.log(`☁️ ${name}'s RISING synced to Supabase`);
                    }
                  })
                  .catch(() => {});
              }
            }
          })
          .catch(() => console.log('Rising audio generation failed'));
      }
      setProgress(85);

      // ========== WAIT FOR ALL AUDIO BEFORE NAVIGATING ==========
      setStatusText(`Giving ${name}'s reading a voice…`);
      
      // Wait for Moon and Rising audio (Sun was already awaited earlier)
      console.log(`🎵 Waiting for ${name}'s Moon and Rising audio...`);
      await Promise.all([
        moonAudioPromise || Promise.resolve(),
        risingAudioPromise || Promise.resolve(),
      ]);
      console.log(`✅ All ${name}'s audio ready!`);
      
      setProgress(95);
      setStatusText('All readings ready!');
      await delay(1500);

      // SCREEN 5: Back to intro briefly
      setCurrentScreen('intro');
      setStatusText('Chart complete!');
      setProgress(100);
      await delay(1000);

      // Ensure we reuse the person created in PartnerInfoScreen to avoid duplicates.
      // (PartnerInfo creates/reuses the partner row and passes partnerId here.)
      const ensuredPartnerId =
        partnerIdFromRoute ||
        addPerson({
          name: partnerName || 'Partner',
          isUser: false,
          birthData: {
            birthDate: partnerBirthDate || '',
            birthTime: partnerBirthTime || '12:00',
            birthCity: partnerBirthCity?.name || 'Unknown',
            timezone: partnerBirthCity?.timezone || 'UTC',
            latitude: partnerBirthCity?.latitude || 0,
            longitude: partnerBirthCity?.longitude || 0,
          },
          placements: sunSign && moonSign && risingSign ? { sunSign, moonSign, risingSign } : undefined,
        });
      console.log(`✅ Using partner ID: ${ensuredPartnerId}`);
      
      // Save the 3 hook readings to profileStore (for Home carousel rotation).
      // IMPORTANT: store them in `person.hookReadings`, not as normal readings.
      // (hook readings are previews and should not be mixed with deep readings.)
      const nextHookReadings: any[] = [];
      if (sunData?.reading) {
        nextHookReadings.push({
          type: 'sun',
          sign: sunData.reading.sign,
          intro: sunData.reading.intro || '',
          main: sunData.reading.main || '',
          generatedAt: new Date().toISOString(),
        });
      }
      if (moonData?.reading) {
        nextHookReadings.push({
          type: 'moon',
          sign: moonData.reading.sign,
          intro: moonData.reading.intro || '',
          main: moonData.reading.main || '',
          generatedAt: new Date().toISOString(),
        });
      }
      if (risingData?.reading) {
        nextHookReadings.push({
          type: 'rising',
          sign: risingData.reading.sign,
          intro: risingData.reading.intro || '',
          main: risingData.reading.main || '',
          generatedAt: new Date().toISOString(),
        });
      }
      if (nextHookReadings.length === 3) {
        setHookReadings(ensuredPartnerId, nextHookReadings as any);
        console.log(`✅ Saved ${partnerName}'s hook readings for Home carousel rotation`);
      }

      if (isPrepayOnboarding) {
        // In onboarding: proceed to partner hook reading screens + compatibility preview.
        navigation.replace('PartnerReadings', {
          partnerName: name,
          partnerBirthDate,
          partnerBirthTime,
          partnerBirthCity,
          partnerId: ensuredPartnerId,
        });
        return;
      }

      // Non-onboarding: keep the legacy behavior (dashboard navigation + optional cloud sync).
      // FIX: Use auth user ID (Supabase UUID), not local person ID!
      const authUserId = useAuthStore.getState().user?.id;
      if (authUserId) {
        try {
          const { syncPeopleToSupabase } = await import('@/services/peopleCloud');
          const allPeople = useProfileStore.getState().people;
          const result = await syncPeopleToSupabase(authUserId, allPeople);
          if (result.success) {
            console.log(`✅ Saved ${partnerName} and readings to Supabase`);
          } else {
            console.warn(`⚠️ Failed to save partner to Supabase:`, result.error);
          }
        } catch (error) {
          console.error('❌ Error saving partner to Supabase:', error);
        }
      }
      console.log('✅ Partner readings complete - navigating to Dashboard');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });

    } catch (error) {
      console.error('Error fetching partner readings:', error);
      setStatusText('Error - retrying...');
      await delay(2000);
      
      // Still save partner even on error
      const partnerId = addPerson({
        name: partnerName || 'Partner',
        isUser: false,
        birthData: {
          birthDate: partnerBirthDate || '',
          birthTime: partnerBirthTime || '12:00',
          birthCity: partnerBirthCity?.name || 'Unknown',
          timezone: partnerBirthCity?.timezone || 'UTC',
          latitude: partnerBirthCity?.latitude || 0,
          longitude: partnerBirthCity?.longitude || 0,
        },
      });
      
      navigation.replace('PartnerReadings', {
        partnerName,
        partnerBirthDate,
        partnerBirthTime,
        partnerBirthCity,
        partnerId,
      });
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const screen = SCREENS[currentScreen];
  
  // Rotation interpolation
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen ID */}
      {/** Screen numbers temporarily removed */}
      <View style={styles.content}>
        <Text style={[styles.line1, { color: screen.colors.line1 }]} selectable>
          {screen.line1}
        </Text>
        
        {/* Line 2 - Animated symbol with different animations per type */}
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
          // Rising: THE BEAUTIFUL ARROW that moves UP!
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

      <View style={styles.footer}>
        {/* Progress bar */}
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
    backgroundColor: 'transparent',
  },
  screenId: {
    position: 'absolute',
    top: 50,
    left: 16,
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.mutedText,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  // TYPOGRAPHY FORMULA (ARTS) - ALL CENTERED
  line1: {
    fontFamily: typography.headline,
    fontSize: 48,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  line2: {
    fontFamily: typography.headline,
    fontSize: 140,
    lineHeight: 160,
    height: 160, // Fixed height so line3 stays in same position
    textAlign: 'center',
  },
  line2Symbol: {
    fontSize: 100,
    lineHeight: 160,
    height: 160, // Same height as line2 so line3 stays in same position
    textAlign: 'center',
  },
  line3: {
    fontFamily: typography.headline,
    fontSize: 52,
    textAlign: 'center',
  },
  line4: {
    fontFamily: typography.headline,
    fontSize: 52,
    textAlign: 'center',
  },
  line5: {
    fontFamily: typography.headline,
    fontSize: 52,
    fontStyle: 'italic',
    textAlign: 'center',
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
});
