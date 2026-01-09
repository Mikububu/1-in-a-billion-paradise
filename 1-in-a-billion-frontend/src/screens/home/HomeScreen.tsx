import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Alert, Modal, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useOnboardingStore } from '@/store/onboardingStore';
import { backfillMissingPlacements } from '@/services/placementsCalculator';
import { supabase } from '@/services/supabase';
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

export const HomeScreen = ({ navigation }: Props) => {
  console.log('🏠 HomeScreen MOUNTED - This is Screen 10');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

    const partnersWithPlacements = partners.filter(
      (p: any) => p?.placements?.sunSign && p?.placements?.moonSign && p?.placements?.risingSign
    );
    partnersWithPlacements.forEach((p: any) => {
      const sun = p.hookReadings?.find((r: any) => r.type === 'sun');
      const moon = p.hookReadings?.find((r: any) => r.type === 'moon');
      const rising = p.hookReadings?.find((r: any) => r.type === 'rising');
      allPeople.push({
        person: p,
        placements: p.placements,
        hookReadings: sun && moon && rising ? { sun, moon, rising } : undefined,
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
    // Fallback when carousel is empty: try onboardingStore, then user placements, then known test data
    sun: hookReadings.sun?.sign || user?.placements?.sunSign || null,
    moon: hookReadings.moon?.sign || user?.placements?.moonSign || null,
    rising: hookReadings.rising?.sign || user?.placements?.risingSign || null,
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

  // Audio state (simple - no file system, just play from memory)
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playRequestTokenRef = useRef(0); // cancels in-flight async play when modal closes/switches

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

  // Handle audio playback for the modal
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

    // Get cached audio from store (base64 in memory, no file system).
    // User audio: hookAudio[type]
    // Partner audio: partnerAudio[type]
    const audioBase64 = currentPerson?.person?.isUser 
      ? hookAudio[selectedReading] 
      : partnerAudio[selectedReading];

    if (!audioBase64) {
      const reading = modalReadings?.[selectedReading];
      if (!reading) {
        Alert.alert('Preview not available', 'This person does not have preview text/audio saved yet.');
        return;
      }
      console.log('⚠️ Audio not pre-rendered - this should not happen if onboarding completed correctly');
      Alert.alert('Audio not available', 'Please re-generate this reading to enable audio playback.');
      return;
    }

    if (isCancelled()) return;
    
    console.log(`🎵 Playing ${currentPerson?.person?.isUser ? 'user' : 'partner'} ${selectedReading} audio from memory (base64)`);
    const uriToPlay = `data:audio/mpeg;base64,${audioBase64}`;

    // Play the audio
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      if (isCancelled()) return;

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
        return;
      }

      soundRef.current = sound;
      setAudioPlaying(true);
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert('Playback Error', 'Could not play audio');
    }
  }, [
    selectedReading,
    audioPlaying,
    hookAudio,
    partnerAudio,
    modalReadings,
    currentPerson?.person?.isUser,
    stopAndUnloadAudio,
  ]);


  return (
    <SafeAreaView style={styles.container}>
      {/* Screen ID */}
      <Text style={styles.screenId}>10</Text>
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings button */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Headline - centered - shows current person's name */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.headline}>
            {currentPerson ?
              (currentPerson.person.isUser ? 'My' : `${currentPerson.person.name}'s`)
              : 'My'
            } Secret Life
          </Text>
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
        <View style={styles.statusSection}>
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
              <Text style={styles.statusNumber} selectable>0</Text>
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
          style={styles.libraryCard}
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
                <Text style={{ fontFamily: typography.sansRegular, color: colors.mutedText, textAlign: 'center' }}>
                  Preview text/audio for this person isn’t saved yet.
                </Text>
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
    paddingTop: spacing.xl, // Increased from spacing.sm to push content down
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headline: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
  },
  settingsButton: {
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
});

