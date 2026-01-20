import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Alert, Modal, ActivityIndicator, Pressable, useWindowDimensions, Image, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';
import { Audio } from 'expo-av';
import { useOnboardingStore } from '@/store/onboardingStore';
import { backfillMissingPlacements } from '@/services/placementsCalculator';
import { supabase } from '@/services/supabase';
import { downloadHookAudioBase64 } from '@/services/hookAudioCloud';
import { useProfileStore } from '@/store/profileStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { Button } from '@/components/Button';
import { UpsellModal } from '@/components/UpsellModal';
import { type UpsellTrigger } from '@/config/subscriptions';
import { readingsApi } from '@/services/api';
import { SIGN_LABELS } from '@/config/readingConfig';
import { AntChase } from '@/components/AntChase';
import { AntChaseV2 } from '@/components/AntChaseV2';

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

type ReadingType = 'sun' | 'moon' | 'rising';

type HookReadingLike = {
  type: ReadingType;
  sign: string;
  intro: string;
  main: string;
  generatedAt?: string;
};

const toHookRecord = (hookReadings: any): Record<ReadingType, HookReadingLike> | null => {
  if (!hookReadings) return null;
  // already record
  if (!Array.isArray(hookReadings) && typeof hookReadings === 'object') return hookReadings as any;
  // array -> record
  if (Array.isArray(hookReadings)) {
    const out: any = {};
    for (const r of hookReadings) {
      if (r?.type) out[r.type] = r;
    }
    return out;
  }
  return null;
};

const recordToArray = (rec: Record<ReadingType, HookReadingLike>): any[] => {
  return (['sun', 'moon', 'rising'] as ReadingType[])
    .map((k) => rec[k])
    .filter(Boolean)
    .map((r) => ({ ...r, type: r.type || (r as any).type }));
};

export const HomeScreen = ({ navigation }: Props) => {
  console.log('🏠 HomeScreen MOUNTED - This is Screen 10');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Responsive vertical rhythm:
  // - On very tall phones, default spacing makes the UI feel "swimmy" (too much air).
  // - On smaller phones, we must not increase spacing (scrolling is already tight).
  const compactV = useMemo(() => {
    const BASE_HEIGHT = 812; // baseline-ish iPhone height for our spacing rhythm
    const raw = BASE_HEIGHT / Math.max(1, windowHeight);
    return Math.max(0.82, Math.min(1, raw));
  }, [windowHeight]);
  const hookReadings = useOnboardingStore((state) => state.hookReadings);
  const setHookReading = useOnboardingStore((state) => state.setHookReading);
  const hookAudio = useOnboardingStore((state) => state.hookAudio);
  const partnerAudio = useOnboardingStore((state) => state.partnerAudio);
  const setHasCompletedOnboarding = useOnboardingStore((state) => state.setHasCompletedOnboarding);
  const user = useProfileStore((state) => state.getUser());
  const userName = useOnboardingStore((state) => state.name) || 'User';
  const getAllPeopleWithHookReadings = useProfileStore((state) => state.getAllPeopleWithHookReadings);
  const allPeople = useProfileStore((state) => state.people);
  const partners = useMemo(() => allPeople.filter(p => !p.isUser), [allPeople]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  
  // Claymation photo upload state
  const [claymationPhotoUrl, setClaymationPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const blinkAnim = useRef(new Animated.Value(1)).current;
  
  // DEBUG: Get current user ID from session (user object is not persisted)
  const session = useAuthStore((state) => state.session);
  const currentUserId = session?.user?.id;

  // Load claymation portrait and match count on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!authUserId) return;

      try {
        // Load claymation URL from library_people
        const { data } = await supabase
          .from('library_people')
          .select('claymation_url')
          .eq('user_id', authUserId)
          .eq('is_user', true)
          .single();

        if (data?.claymation_url) {
          setClaymationPhotoUrl(data.claymation_url);
        }

        // Load match count
        const { count } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .or(`user1_id.eq.${authUserId},user2_id.eq.${authUserId}`);

        setMatchCount(count || 0);
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, [authUserId]);
  
  // Blinking animation for upload prompt
  useEffect(() => {
    if (!claymationPhotoUrl) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      blink.start();
      return () => blink.stop();
    }
  }, [claymationPhotoUrl, blinkAnim]);
  
  // Upload and generate claymation photo - PRODUCTION VERSION
  const handleUploadPhoto = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      
      // Request permissions
      const { status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a photo.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      setUploadingPhoto(true);

      // Get user ID from auth store
      const authState = useAuthStore.getState();
      const userId = authState.session?.user?.id || authState.user?.id;
      
      if (!userId) {
        Alert.alert('Error', 'You must be signed in to upload a photo. Please restart the app and sign in.');
        setUploadingPhoto(false);
        return;
      }

      // Upload to backend
      const response = await fetch(`${env.CORE_API_URL}/api/profile/claymation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ photoBase64: result.assets[0].base64 }),
      });

      const data = await response.json();
      
      if (data.success && data.imageUrl) {
        setClaymationPhotoUrl(data.imageUrl);
        Alert.alert('Success', 'Your claymation portrait is ready!');
      } else {
        Alert.alert('Error', data.error || 'Failed to generate claymation portrait');
      }
      
      setUploadingPhoto(false);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload photo. Please try again.');
      setUploadingPhoto(false);
    }
  };

  console.log('🔍 HomeScreen data check:', {
    hasHookReadings: !!(hookReadings.sun && hookReadings.moon && hookReadings.rising),
    userName,
    userFromProfile: user?.name,
    partnersCount: partners.length,
  });

  // Backfill missing placements via Swiss Ephemeris.
  const updatePerson = useProfileStore((state) => state.updatePerson);
  const didRunPlacementsBackfillRef = useRef(false);

  useEffect(() => {
    const initPlacements = async () => {
      // Backfill missing placements via Swiss Ephemeris.
      // IMPORTANT: This must run even if people already exist (e.g. Eva/Fabrice were added earlier)
      // but their placements are missing due to earlier failures.
      if (didRunPlacementsBackfillRef.current) return;
      didRunPlacementsBackfillRef.current = true;

      // Small delay to let store update
      setTimeout(async () => {
        const currentPeople = useProfileStore.getState().people;
        const peopleWithoutPlacements = currentPeople.filter(p =>
          !p.placements?.sunSign || !p.placements?.moonSign || !p.placements?.risingSign
        );

        if (peopleWithoutPlacements.length > 0) {
          console.log(`🔮 Calculating placements for ${peopleWithoutPlacements.length} people...`);
          await backfillMissingPlacements(peopleWithoutPlacements, updatePerson);
        } else {
          console.log('✅ All people already have placements');
        }
      }, 500);
    };

    initPlacements();
  }, []);

  // Keep auth user id in sync with Supabase session (avoids relying on Zustand auth store here)
  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const nextId = data?.session?.user?.id || null;
        if (isMounted) setAuthUserId(nextId);
      } catch {
        if (isMounted) setAuthUserId(null);
      }
    };

    loadInitial();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user?.id || null;
      if (isMounted) setAuthUserId(nextId);
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Load hook readings from Supabase if store is empty
  useEffect(() => {
    const loadFromSupabase = async () => {
      console.log('🔄 Loading hook readings - authUserId:', authUserId, 'hasSun:', !!hookReadings.sun);
      if (!authUserId || hookReadings.sun) return;

      const { getUserReadings } = await import('@/services/userReadings');
      const saved = await getUserReadings(authUserId);
      console.log('📥 Got saved readings from Supabase:', saved.length);

      if (saved.length === 3) {
        const map: any = {};
        saved.forEach(r => { map[r.type] = { type: r.type, sign: r.sign, intro: r.intro, main: r.main }; });
        if (map.sun && map.moon && map.rising) {
          setHookReading(map.sun);
          setHookReading(map.moon);
          setHookReading(map.rising);
          console.log('✅ Set hook readings from Supabase');
        }
      }
    };
    loadFromSupabase();
  }, [authUserId, hookReadings.sun, setHookReading]);

  // Carousel: Rotate through all people with hook readings every 10 seconds
  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Build array of all people for the carousel (user first, then partners).
  // Rotation should NOT depend on nuclear/deep jobs; it should rotate whenever we have 2+ people with placements.
  // Hook readings (free previews) are optional and only used for the modal text/audio when available.
  const peopleWithReadings = useMemo(() => {
    const allPeople: Array<{ person: any; hookReadings?: any; placements?: any }> = [];

    const userPlacements = user?.placements;
    const hasUserPlacements = !!(userPlacements?.sunSign && userPlacements?.moonSign && userPlacements?.risingSign);
    const hasUserHooks = !!(hookReadings.sun && hookReadings.moon && hookReadings.rising);

    if (hasUserHooks || hasUserPlacements) {
      allPeople.push({
        person: { ...(user || {}), name: user?.name || userName, isUser: true },
        placements: hasUserPlacements ? userPlacements : undefined,
        hookReadings: hasUserHooks
          ? { sun: hookReadings.sun, moon: hookReadings.moon, rising: hookReadings.rising }
          : undefined,
      });
    }

    // Only include partners who have ALL THREE hook readings (from free onboarding)
    const partnersWithHookReadings = partners.filter((p: any) => {
      if (!p.hookReadings || !Array.isArray(p.hookReadings)) return false;
      const sun = p.hookReadings.find((r: any) => r.type === 'sun');
      const moon = p.hookReadings.find((r: any) => r.type === 'moon');
      const rising = p.hookReadings.find((r: any) => r.type === 'rising');
      return sun && moon && rising;
    });
    
    partnersWithHookReadings.forEach((p: any) => {
      const sun = p.hookReadings.find((r: any) => r.type === 'sun');
      const moon = p.hookReadings.find((r: any) => r.type === 'moon');
      const rising = p.hookReadings.find((r: any) => r.type === 'rising');
      
      allPeople.push({
        person: p,
        placements: p.placements,
        hookReadings: { sun, moon, rising }, // Guaranteed to exist
      });
    });

    console.log('🎠 Carousel peopleWithReadings:', allPeople.length, allPeople.map(p => p.person.name));
    return allPeople;
  }, [hookReadings, userName, partners, user]);

  // Current person being displayed - with fallback to direct hookReadings or user placements
  const currentPerson = peopleWithReadings[currentPersonIndex] || null;

  // Known test user data fallback (REMOVED)
  const getKnownPlacements = (name: string) => null;
  const knownPlacements = null;

  const coreSigns = currentPerson ? {
    sun: currentPerson.hookReadings?.sun?.sign || currentPerson.placements?.sunSign || null,
    moon: currentPerson.hookReadings?.moon?.sign || currentPerson.placements?.moonSign || null,
    rising: currentPerson.hookReadings?.rising?.sign || currentPerson.placements?.risingSign || null,
  } : {
    // Fallback when carousel is empty: prefer placements (Swiss Ephemeris = accurate) over hookReadings (potentially stale)
    sun: user?.placements?.sunSign || hookReadings.sun?.sign || null,
    moon: user?.placements?.moonSign || hookReadings.moon?.sign || null,
    rising: user?.placements?.risingSign || hookReadings.rising?.sign || null,
  };

  // Rotate carousel every 10 seconds
  useEffect(() => {
    if (peopleWithReadings.length <= 1) return; // No rotation needed for single person

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Change person
        setCurrentPersonIndex((prev) => (prev + 1) % peopleWithReadings.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [peopleWithReadings.length, fadeAnim]);

  // Check if we have readings or placements
  const hasReadings = !!(hookReadings.sun && hookReadings.moon && hookReadings.rising);
  const hasPlacements = !!(coreSigns.sun && coreSigns.moon && coreSigns.rising);

  console.log('📊 HomeScreen readings:', {
    hasSun: !!hookReadings.sun,
    hasMoon: !!hookReadings.moon,
    hasRising: !!hookReadings.rising,
    sunSign: hookReadings.sun?.sign || coreSigns.sun,
    moonSign: hookReadings.moon?.sign || coreSigns.moon,
    risingSign: hookReadings.rising?.sign || coreSigns.rising,
    coreSigns,
    canClickSun: !!coreSigns.sun,
    canClickMoon: !!coreSigns.moon,
    canClickRising: !!coreSigns.rising,
  });

  // State for expanded reading modal
  const [selectedReading, setSelectedReading] = useState<ReadingType | null>(null);
  const [hookPreviewLoading, setHookPreviewLoading] = useState(false);
  const [hookPreviewError, setHookPreviewError] = useState<string | null>(null);
  const hookPreviewRequestTokenRef = useRef(0);

  // The modal must ONLY show text/audio for the currently displayed person.
  // Never fall back to *your* hook previews when the carousel is showing someone else.
  const modalReadings = useMemo(() => {
    console.log('🔍 DEBUG: resolving modalReadings', {
      personExists: !!currentPerson,
      personName: currentPerson?.person?.name,
      isUser: currentPerson?.person?.isUser,
      personHookReadingsKeys: currentPerson?.hookReadings ? Object.keys(currentPerson.hookReadings) : [],
      globalHookReadingsKeys: hookReadings ? Object.keys(hookReadings) : [],
      hookReadingsType: Array.isArray(hookReadings) ? 'array' : typeof hookReadings,
      currentPersonHookReadingsType: Array.isArray(currentPerson?.hookReadings) ? 'array' : typeof currentPerson?.hookReadings
    });

    if (!currentPerson) {
      // Before carousel initializes, show user's onboarding previews if present
      return hookReadings as any;
    }

    // Prefer person-specific readings if they exist and are not empty
    if (currentPerson.hookReadings && (Array.isArray(currentPerson.hookReadings) || Object.keys(currentPerson.hookReadings).length > 0)) {
      // HANDLE DATA MISMATCH: profileStore saves as Array[], but UI expects Record<type, reading>
      // If it's an array, convert it to a Record
      if (Array.isArray(currentPerson.hookReadings)) {
        console.log('⚠️ Converting Array hookReadings to Object');
        return currentPerson.hookReadings.reduce((acc, r) => {
          if (r && r.type) acc[r.type] = r;
          return acc;
        }, {} as Record<string, any>);
      }
      // If it's already an object (legacy/other stores), use as is
      return currentPerson.hookReadings as any;
    }

    // Fallback: if it's the user, use the global store readings (which is already a Record)
    if (currentPerson.person?.isUser) {
      console.log('Using global hookReadings fallback for user');
      return hookReadings as any;
    }

    return null;
  }, [currentPerson, hookReadings]);

  // UX: Hook preview text should be cached for saved people (audio can be on-demand).
  // If we don't have text for the current person + selected reading, fetch from Supabase `library_people.hook_readings`.
  // If missing in Supabase, generate via API once and persist back to Supabase and local store.
  useEffect(() => {
    const run = async () => {
      if (!selectedReading) return;
      if (!currentPerson?.person) return;
      if (!authUserId) return;
      if (currentPerson.person.isUser) return; // user handled via onboardingStore + userReadings loader

      const rec = toHookRecord(currentPerson.hookReadings);
      if (rec?.[selectedReading]) {
        setHookPreviewLoading(false);
        setHookPreviewError(null);
        return;
      }

      const myToken = ++hookPreviewRequestTokenRef.current;
      const isCancelled = () => myToken !== hookPreviewRequestTokenRef.current;

      setHookPreviewLoading(true);
      setHookPreviewError(null);

      try {
        // 1) Try Supabase cached hook_readings first
        const { data: row, error } = await supabase
          .from('library_people')
          .select('hook_readings')
          .eq('user_id', authUserId)
          .eq('client_person_id', currentPerson.person.id)
          .maybeSingle();

        if (isCancelled()) return;

        if (error) {
          console.warn('⚠️ Failed to fetch hook_readings from Supabase:', error.message);
        }

        const rowRec = row?.hook_readings ? toHookRecord(row.hook_readings) : null;
        if (rowRec?.[selectedReading]) {
          // Cache into local store for instant future access
          updatePerson(currentPerson.person.id, {
            hookReadings: recordToArray(rowRec) as any,
          } as any);
          setHookPreviewLoading(false);
          setHookPreviewError(null);
          return;
        }

        // 2) Not in Supabase → generate it now (one reading) and persist
        const onboarding = useOnboardingStore.getState() as any;
        const bd = currentPerson.person.birthData;
        if (!bd?.birthDate || !bd?.birthTime || !bd?.timezone || !bd?.latitude || !bd?.longitude) {
          setHookPreviewError('Missing birth data to generate preview.');
          setHookPreviewLoading(false);
          return;
        }

        const payload: any = {
          name: currentPerson.person.name,
          birthDate: bd.birthDate,
          birthTime: bd.birthTime,
          latitude: bd.latitude,
          longitude: bd.longitude,
          timezone: bd.timezone,
          relationshipMode: onboarding.relationshipMode,
          relationshipIntensity: onboarding.relationshipIntensity,
          primaryLanguage: onboarding.primaryLanguage?.code || onboarding.primaryLanguage,
          secondaryLanguage: onboarding.secondaryLanguage?.code || onboarding.secondaryLanguage,
        };

        const apiRes =
          selectedReading === 'sun'
            ? await readingsApi.sun(payload)
            : selectedReading === 'moon'
              ? await readingsApi.moon(payload)
              : await readingsApi.rising(payload);

        if (isCancelled()) return;

        const generated = apiRes?.reading;
        if (!generated?.type || !generated?.intro || !generated?.main) {
          setHookPreviewError('Failed to generate preview.');
          setHookPreviewLoading(false);
          return;
        }

        const merged: Record<ReadingType, HookReadingLike> = {
          ...(rowRec || ({} as any)),
          [selectedReading]: generated,
        } as any;

        // Persist to Supabase for future sessions
        const { error: upError } = await supabase
          .from('library_people')
          .update({ hook_readings: merged, updated_at: new Date().toISOString() })
          .eq('user_id', authUserId)
          .eq('client_person_id', currentPerson.person.id);

        if (upError) {
          console.warn('⚠️ Failed to persist hook_readings to Supabase:', upError.message);
        }

        // Cache locally
        updatePerson(currentPerson.person.id, {
          hookReadings: recordToArray(merged) as any,
        } as any);

        setHookPreviewLoading(false);
        setHookPreviewError(null);
      } catch (e: any) {
        if (isCancelled()) return;
        console.warn('⚠️ Hook preview preload failed:', e?.message);
        setHookPreviewError(e?.message || 'Failed to load preview.');
        setHookPreviewLoading(false);
      }
    };

    run();
    return () => {
      // cancel in-flight
      hookPreviewRequestTokenRef.current += 1;
    };
  }, [selectedReading, currentPerson?.person?.id, currentPerson?.person?.isUser, authUserId, updatePerson]);

  // Audio state (simple - no file system, just play from memory)
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioLoadingText, setAudioLoadingText] = useState<string | null>(null); // "Downloading audio..." etc
  const [audioPlaying, setAudioPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playRequestTokenRef = useRef(0); // cancels in-flight async play when modal closes/switches
  
  // Session-level cache for downloaded audio (avoids re-downloading during same session)
  const downloadedAudioCache = useRef<Record<string, string>>({});

  const stopAndUnloadAudio = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.stopAsync();
    } catch { }
    try {
      await soundRef.current.unloadAsync();
    } catch { }
    soundRef.current = null;
    setAudioPlaying(false);
  }, []);


  // Swipe right to go back to HookSequenceScreen
  // REMOVED: Swipe-right gesture that was causing navigation loop back to onboarding
  // Users can use Settings → "Start Over" to reset if needed

  // Get compatibility count for match status
  const compatibilityReadings = useProfileStore((state) => state.compatibilityReadings);
  const clearCompatibilityReadings = useProfileStore((state) => state.clearCompatibilityReadings);
  const hasMatch = compatibilityReadings.length > 0;

  // Match handlers
  const handleMatchYes = () => {
    Alert.alert(
      '■ Interest Registered!',
      'When this person also says YES, you\'ll both be notified and can start chatting.\n\nMatching feature coming soon!',
      [{ text: 'Got it!' }]
    );
  };

  const handleMatchNo = () => {
    Alert.alert(
      'Not Interested?',
      'This will remove this match from your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Match',
          style: 'destructive',
          onPress: () => clearCompatibilityReadings?.()
        }
      ]
    );
  };

  // Pulsating animation for "1 in a billion" text
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Shimmer animation for sign cards (shows they're tappable)
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  // Interpolate shimmer for each card (staggered)
  const shimmerColor1 = shimmerAnim.interpolate({
    inputRange: [0, 0.3, 0.5, 1],
    outputRange: [colors.border, colors.primary, colors.primary, colors.border],
  });
  const shimmerColor2 = shimmerAnim.interpolate({
    inputRange: [0, 0.3, 0.5, 0.7, 1],
    outputRange: [colors.border, colors.border, colors.primary, colors.primary, colors.border],
  });
  const shimmerColor3 = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 0.7, 0.9, 1],
    outputRange: [colors.border, colors.border, colors.primary, colors.primary, colors.border],
  });

  // CRITICAL: Stop audio when screen loses focus (useFocusEffect runs cleanup BEFORE blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log('🛑 HomeScreen LOSING FOCUS - stopping audio immediately');
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => { });
          soundRef.current.unloadAsync().catch(() => { });
          soundRef.current = null;
        }
        setAudioPlaying(false);
      };
    }, [])
  );

  // Also cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('🛑 HomeScreen unmounting - final cleanup');
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
    };
  }, []);

  // Stop audio when modal closes
  const closeModal = useCallback(async () => {
    // Cancel any in-flight async play request immediately
    playRequestTokenRef.current += 1;
    await stopAndUnloadAudio();
    setAudioLoading(false);
    setSelectedReading(null);
  }, [stopAndUnloadAudio]);

  // If user switches Sun/Moon/Rising while modal is open, stop the previous audio immediately
  useEffect(() => {
    // Cancel any in-flight async play request immediately
    playRequestTokenRef.current += 1;
    stopAndUnloadAudio();
    setAudioLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReading]);

  // Handle audio playback for the modal (ON-DEMAND DOWNLOAD)
  const handlePlayAudio = useCallback(async () => {
    if (!selectedReading) return;

    // Token-based cancellation: if modal closes or selection changes mid-flight,
    // we must not start playback afterward.
    const myToken = ++playRequestTokenRef.current;
    const isCancelled = () => myToken !== playRequestTokenRef.current;

    // If already playing, stop it
    if (audioPlaying && soundRef.current) {
      await stopAndUnloadAudio();
      return;
    }

    // Check reading exists for this person
    const reading = modalReadings?.[selectedReading];
    if (!reading) {
      Alert.alert('Preview not available', 'This person does not have preview text saved yet.');
      return;
    }

    // STEP 1: Check if audio is already in memory (hookAudio/partnerAudio store)
    let audioBase64 = currentPerson?.person?.isUser 
      ? hookAudio[selectedReading] 
      : partnerAudio[selectedReading];

    // STEP 2: Check session cache (for previously downloaded audio this session)
    const personId = currentPerson?.person?.id;
    const cacheKey = personId ? `${personId}_${selectedReading}` : null;
    if (!audioBase64 && cacheKey && downloadedAudioCache.current[cacheKey]) {
      console.log(`🎵 Using session-cached audio for ${currentPerson?.person?.name} ${selectedReading}`);
      audioBase64 = downloadedAudioCache.current[cacheKey];
    }

    // STEP 3: Download from Supabase on-demand if not in memory
    if (!audioBase64 && authUserId && personId) {
      console.log(`📥 Downloading ${currentPerson?.person?.name}'s ${selectedReading} audio on-demand...`);
      setAudioLoading(true);
      setAudioLoadingText('Downloading audio...');
      
      try {
        const result = await downloadHookAudioBase64({
          userId: authUserId,
          personId: personId,
          type: selectedReading,
        });
        
        if (isCancelled()) {
          setAudioLoading(false);
          setAudioLoadingText(null);
          return;
        }
        
        if (result.success) {
          audioBase64 = result.audioBase64;
          // Cache for this session
          if (cacheKey) {
            downloadedAudioCache.current[cacheKey] = audioBase64;
          }
          console.log(`✅ Downloaded ${selectedReading} audio for ${currentPerson?.person?.name}`);
        } else {
          console.log(`⚠️ Audio download failed: ${result.error}`);
        }
      } catch (err) {
        console.error('Audio download error:', err);
      }
      
      setAudioLoading(false);
      setAudioLoadingText(null);
    }

    // STEP 4: If still no audio, show error
    if (!audioBase64) {
      Alert.alert('Audio not available', 'Audio for this reading is not available. It may still be generating.');
      return;
    }

    if (isCancelled()) return;
    
    console.log(`🎵 Playing ${currentPerson?.person?.name}'s ${selectedReading} audio`);
    const uriToPlay = `data:audio/mpeg;base64,${audioBase64}`;

    // Play the audio
    try {
      setAudioLoading(true);
      setAudioLoadingText(null); // Just spinner, no text for playback loading
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      if (isCancelled()) {
        setAudioLoading(false);
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: uriToPlay },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setAudioPlaying(false);
          }
        }
      );
      if (isCancelled()) {
        try {
          await sound.stopAsync();
        } catch { }
        try {
          await sound.unloadAsync();
        } catch { }
        setAudioLoading(false);
        return;
      }

      soundRef.current = sound;
      setAudioPlaying(true);
      setAudioLoading(false);
    } catch (error) {
      console.error('Audio playback error:', error);
      setAudioLoading(false);
      Alert.alert('Playback Error', 'Could not play audio');
    }
  }, [
    selectedReading,
    audioPlaying,
    hookAudio,
    partnerAudio,
    modalReadings,
    currentPerson?.person?.isUser,
    currentPerson?.person?.id,
    currentPerson?.person?.name,
    authUserId,
    stopAndUnloadAudio,
  ]);


  return (
    <SafeAreaView style={styles.container}>
      {/* Settings button (fixed; not part of scroll content) */}
      <TouchableOpacity
        style={[styles.settingsButton, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={styles.settingsIcon}>⚙</Text>
      </TouchableOpacity>

      {/* Screen ID */}
      {/** Screen numbers temporarily removed */}
      {/* Two minimalist humans roam the entire screen in the background (never interacts with UI). */}
      {/* Sprite animation temporarily disabled */}
      {/* <View style={styles.walkersOverlay} pointerEvents="none">
        {FEATURES.USE_ANT_CHASE_V2 ? (
          <AntChaseV2 width={windowWidth} height={windowHeight} gender1="male" gender2="female" />
        ) : (
          <AntChase width={windowWidth} height={windowHeight} />
        )}
      </View> */}
      <ScrollView
        style={styles.scrollView}
        scrollEnabled={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.content,
          {
            gap: spacing.lg * compactV,
            // Keep headlines on the app's standard baseline (not "too high").
            // The screen can scroll on smaller devices, but the baseline should feel consistent.
            paddingTop: spacing.xl + 20,
            paddingBottom: spacing.xl * 2 * compactV,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Headline - centered - shows current person's name */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.headlineWrap}>
            <Text
              style={styles.headlineTop}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {(() => {
                const toPossessive = (name: string) => {
                  const trimmed = name.trim();
                  if (!trimmed) return "Someone's";
                  // common English possessive rule for names ending in s
                  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
                };

                if (!currentPerson) return 'My';
                return currentPerson.person.isUser ? 'My' : toPossessive(currentPerson.person.name);
              })()}
            </Text>
            <Text style={styles.headlineBottom}>Secret Life</Text>
          </View>
        </Animated.View>

        {/* CORE SIGNS - 3 Card Layout (Tappable with shimmer) - rotates through all people */}
        <Animated.View style={[styles.signsCardRow, { opacity: fadeAnim }]}>
          <TouchableOpacity
            onPress={() => {
              console.log('☉ SUN card clicked!', { sunSign: coreSigns.sun, canOpen: !!coreSigns.sun });
              if (coreSigns.sun) setSelectedReading('sun');
              else Alert.alert('No data', 'Sun sign not calculated yet');
            }}
            activeOpacity={coreSigns.sun ? 0.7 : 1}
            disabled={!coreSigns.sun}
          >
            <Animated.View style={[styles.signCard, { borderColor: coreSigns.sun ? shimmerColor1 : colors.border }]}>
              <Text style={styles.signCardLabel}>SUN</Text>
              <Text style={styles.signCardIcon}>☉</Text>
              <Text style={styles.signCardSign}>{coreSigns.sun || '—'}</Text>
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('☽ MOON card clicked!', { moonSign: coreSigns.moon, canOpen: !!coreSigns.moon });
              if (coreSigns.moon) setSelectedReading('moon');
              else Alert.alert('No data', 'Moon sign not calculated yet');
            }}
            activeOpacity={coreSigns.moon ? 0.7 : 1}
            disabled={!coreSigns.moon}
          >
            <Animated.View style={[styles.signCard, { borderColor: coreSigns.moon ? shimmerColor2 : colors.border }]}>
              <Text style={styles.signCardLabel}>MOON</Text>
              <Text style={styles.signCardIcon}>☽</Text>
              <Text style={styles.signCardSign}>{coreSigns.moon || '—'}</Text>
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('↑ RISING card clicked!', { risingSign: coreSigns.rising, canOpen: !!coreSigns.rising });
              if (coreSigns.rising) setSelectedReading('rising');
              else Alert.alert('No data', 'Rising sign not calculated yet');
            }}
            activeOpacity={coreSigns.rising ? 0.7 : 1}
            disabled={!coreSigns.rising}
          >
            <Animated.View style={[styles.signCard, { borderColor: coreSigns.rising ? shimmerColor3 : colors.border }]}>
              <Text style={styles.signCardLabel}>RISING</Text>
              <Text style={styles.signCardIcon}>↑</Text>
              <Text style={styles.signCardSign}>{coreSigns.rising || '—'}</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* Match Status */}
        <View
          style={[
            styles.statusSection,
            {
              paddingTop: 40 * compactV,
              paddingBottom: spacing.xl * compactV,
            },
          ]}
        >
          {hasMatch ? (
            <>
              <Text style={styles.matchFoundText} selectable>
                We found a match with approx
              </Text>
              <Text style={styles.matchScore} selectable>4/10</Text>
              <Text style={styles.matchFoundText} selectable>
                compatibility
              </Text>
              <Text style={styles.matchQuestion} selectable>
                Would you be interested to get in touch with this person?
              </Text>
              <View style={styles.matchButtons}>
                <Button
                  label="YES"
                  variant="primary"
                  onPress={handleMatchYes}
                  style={styles.matchButton}
                />
                <Button
                  label="NO"
                  variant="secondary"
                  onPress={handleMatchNo}
                  style={styles.matchButton}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel} selectable>Match status</Text>
              {/* Match count only - profile photo moved below library card */}
              <TouchableOpacity 
                style={styles.matchCountWrapper}
                onPress={() => navigation.navigate('Gallery' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.statusNumber} selectable>{matchCount}</Text>
              </TouchableOpacity>
              <Animated.Text
                style={[styles.statusSub, { transform: [{ scale: pulseAnim }] }]}
                selectable
              >
                BUT THE <Text style={styles.statusOne}>1</Text> IN A BILLION IS STILL OUT THERE
              </Animated.Text>
            </>
          )}
        </View>

        {/* MY SOULS LABORATORY CARD - Simple */}
        <TouchableOpacity
          style={[styles.libraryCard, { marginTop: spacing.lg * compactV }]}
          onPress={() => navigation.navigate('NextStep')}
          activeOpacity={0.8}
        >
          <View style={styles.libraryHeader}>
            <View style={styles.libraryInfo}>
              <Text style={styles.libraryTitle}>My Souls Laboratory</Text>
              <Text style={styles.librarySubtitle}>
                Readings, audio & people
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* PROFILE PHOTO / UPLOAD BUTTON - Moved below library card */}
        <View style={styles.profilePhotoSection}>
          {!claymationPhotoUrl ? (
            <TouchableOpacity 
              style={styles.uploadPhotoButton}
              onPress={handleUploadPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
            >
              <Animated.View style={{ opacity: blinkAnim, alignItems: 'center' }}>
                <View style={styles.uploadPhotoPlaceholder}>
                  <Text style={styles.uploadPhotoIcon}>⊕</Text>
                </View>
                <Text style={styles.uploadPhotoLabel}>
                  {uploadingPhoto ? 'Creating...' : 'Upload photo'}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Gallery' as any)}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ uri: claymationPhotoUrl }} 
                  style={styles.claymationImageLarge}
                />
              </TouchableOpacity>
              {/* Cosmic Signature Badge - 3 Signs instead of name */}
              {(() => {
                const sunSign = hookReadings.sun?.sign;
                const moonSign = hookReadings.moon?.sign;
                const risingSign = hookReadings.rising?.sign;
                
                if (!sunSign || !moonSign || !risingSign) return null;
                
                // Get 3-letter abbreviations (Ari, Tau, Gem, Can, Leo, Vir, Lib, Sco, Sag, Cap, Aqu, Pis)
                const abbreviate = (sign: string) => sign.substring(0, 3);
                
                return (
                  <View style={styles.cosmicSignatureBadge}>
                    <Text style={styles.cosmicSignatureText}>
                      ☉{abbreviate(sunSign)} ☽{abbreviate(moonSign)} ↑{abbreviate(risingSign)}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}
        </View>

        {/* Produced By Section - Moved down and closer together */}
        <View style={styles.producedBySection}>
          <Text style={styles.producedByText}>produced by</Text>
          <Image
            source={require('../../../assets/images/forbidden-yoga-logo-white.png')}
            style={styles.forbiddenYogaLogo}
            resizeMode="contain"
          />
        </View>

      </ScrollView>

      {/* Reading Detail Modal */}
      <Modal
        visible={selectedReading !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              onPress={closeModal}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]}>
              {selectedReading === 'sun' && (currentPerson?.person?.isUser ? 'YOUR SUN SIGN' : `${currentPerson?.person?.name?.toUpperCase()}'S SUN SIGN`)}
              {selectedReading === 'moon' && (currentPerson?.person?.isUser ? 'YOUR MOON SIGN' : `${currentPerson?.person?.name?.toUpperCase()}'S MOON SIGN`)}
              {selectedReading === 'rising' && (currentPerson?.person?.isUser ? 'YOUR RISING SIGN' : `${currentPerson?.person?.name?.toUpperCase()}'S RISING SIGN`)}
            </Text>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedReading && modalReadings?.[selectedReading] && (
              <>
                {/* Horizontal Row: Icon + Sign + Listen Button */}
                <View style={styles.modalTopRow}>
                  <Animated.Text style={[styles.modalIcon, { transform: [{ scale: pulseAnim }] }]}>
                    {selectedReading === 'sun' && '☉'}
                    {selectedReading === 'moon' && '☽'}
                    {selectedReading === 'rising' && '↑'}
                  </Animated.Text>

                  <Text style={styles.modalSign}>
                    {modalReadings?.[selectedReading]?.sign}
                  </Text>

                  {/* Audio Button */}
                  <View style={styles.audioBtnWrapper}>
                    <TouchableOpacity
                      style={[styles.audioBtn, audioPlaying && styles.audioBtnActive]}
                      onPress={handlePlayAudio}
                      disabled={audioLoading}
                      activeOpacity={0.7}
                    >
                      {audioLoading ? (
                        <ActivityIndicator size="small" color={colors.background} />
                      ) : (
                        <Text style={styles.audioBtnText}>
                          {audioPlaying ? '■' : '▶'}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {audioLoadingText && (
                      <Text style={styles.audioLoadingText}>{audioLoadingText}</Text>
                    )}
                  </View>
                </View>

                <Text style={styles.modalIntro} selectable>
                  {modalReadings?.[selectedReading]?.intro}
                </Text>
                <Text style={styles.modalMain} selectable>
                  {modalReadings?.[selectedReading]?.main}
                </Text>
              </>
            )}


            {selectedReading && !modalReadings?.[selectedReading] && (
              <View style={{ paddingHorizontal: spacing.sm }}>
                {hookPreviewLoading ? (
                  <View style={{ alignItems: 'center', gap: spacing.sm }}>
                    <ActivityIndicator />
                    <Text style={{ fontFamily: typography.sansRegular, color: colors.mutedText, textAlign: 'center' }}>
                      Loading preview...
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontFamily: typography.sansRegular, color: colors.mutedText, textAlign: 'center' }}>
                    {hookPreviewError ? hookPreviewError : 'Preview text/audio for this person isn’t saved yet.'}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  walkersOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  screenId: {
    position: 'absolute',
    top: 95,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  headline: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
  },
  headlineWrap: {
    alignItems: 'center',
  },
  headlineTop: {
    fontFamily: typography.headline,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
    textAlign: 'center',
  },
  headlineBottom: {
    fontFamily: typography.headline,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
    textAlign: 'center',
    marginTop: -2,
  },
  settingsButton: {
    position: 'absolute',
    right: spacing.page,
    zIndex: 50,
    padding: spacing.sm,
  },
  settingsIcon: {
    fontFamily: typography.sansRegular,
    fontSize: 24,
    color: colors.text,
  },

  // Library Card (with dashed border like Soul Lab button)
  libraryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginTop: spacing.lg,
  },
  libraryHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryIcon: {
    fontFamily: typography.sansBold,
    fontSize: 28,
    color: colors.text,
  },
  libraryInfo: {
    alignItems: 'center',
  },
  libraryTitle: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.text,
  },
  librarySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  libraryArrow: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.primary,
  },
  libraryStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  libraryStat: {
    flex: 1,
    alignItems: 'center',
  },
  libraryStatNumber: {
    fontFamily: typography.sansRegular,
    fontSize: 22,
    color: colors.text,
  },
  libraryStatLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  libraryStatDivider: {
    width: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },

  // Status Section
  statusSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: spacing.xl,
  },
  buttonContainer: {
    // Match library card visual width (no extra padding, but respects parent)
  },
  sectionLabel: {
    fontFamily: typography.sansSemiBold,
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  statusNumber: {
    fontFamily: typography.sansRegular,
    color: colors.text,
    fontSize: 64,
    lineHeight: 68,
    marginBottom: spacing.sm,
  },
  statusSub: {
    fontFamily: typography.sansBold,
    color: colors.text,
    textAlign: 'center',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusOne: {
    fontSize: 16, // 20% larger than 13
    fontFamily: typography.sansBold,
    color: colors.primary, // Make it red to stand out
  },
  // Match Found State
  matchFoundText: {
    fontFamily: typography.sansRegular,
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  matchScore: {
    fontFamily: typography.sansBold,
    color: colors.text,
    textAlign: 'center',
    fontSize: 48,
    lineHeight: 56,
    marginVertical: spacing.sm,
  },
  matchQuestion: {
    fontFamily: typography.sansRegular,
    color: colors.mutedText,
    textAlign: 'center',
    fontSize: 14,
    marginTop: spacing.md,
  },
  matchButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  matchButton: {
    flex: 1,
  },
  // 3 Card Sign Layout
  signsCardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  signCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 100,
  },
  signCardLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  signCardIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  signCardSign: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  signCardDesc: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
  },

  // Reading Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    zIndex: 10,
  },
  modalCloseButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    fontSize: 28,
    color: colors.text,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    // More breathing room for premium reading feel (slightly more on the RIGHT)
    paddingLeft: spacing.page + spacing.sm,
    paddingRight: spacing.page + spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'stretch',
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  modalIcon: {
    fontSize: 48,
  },
  modalSign: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  modalIntro: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
    lineHeight: 22,
    textAlign: 'justify',
    marginBottom: spacing.lg,
  },
  modalMain: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    textAlign: 'justify',
  },
  // Audio button in modal
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 24,
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
  audioBtnWrapper: {
    alignItems: 'center',
  },
  audioLoadingText: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  
  // Produced By Section
  // Upload photo prompt styles
  matchCountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  claymationImageSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  
  // Profile photo section - below library card
  profilePhotoSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  uploadPhotoButton: {
    alignItems: 'center',
  },
  uploadPhotoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPhotoIcon: {
    fontSize: 32,
  },
  uploadPhotoLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  claymationImageLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cosmicSignatureBadge: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  cosmicSignatureText: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.text,
    letterSpacing: 0.5,
  },
  
  producedBySection: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  producedByText: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 4,
  },
  forbiddenYogaLogo: {
    width: 200,
    height: 60,
  },
});

