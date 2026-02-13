import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Alert, Modal, ActivityIndicator, Pressable, useWindowDimensions, Image, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';
import { useOnboardingStore } from '@/store/onboardingStore';
import { backfillMissingPlacements } from '@/services/placementsCalculator';
import { supabase } from '@/services/supabase';
import { getHookAudioSignedUrl } from '@/services/hookAudioCloud';
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
import { useAudio } from '@/contexts/AudioContext';
import { CHAT_RENEW_WARNING_TEXT } from '@/utils/chatAccess';

type Props = NativeStackScreenProps<MainStackParamList, 'Home'>;

type ReadingType = 'sun' | 'moon' | 'rising';

type HookReadingLike = {
    type: ReadingType;
    sign: string;
    intro: string;
    main: string;
    generatedAt?: string;
};

const toHookRecord = (hookReadings: any): Partial<Record<ReadingType, HookReadingLike>> | null => {
    if (!hookReadings) return null;
    if (!Array.isArray(hookReadings) && typeof hookReadings === 'object') return hookReadings as any;
    if (Array.isArray(hookReadings)) {
        const out: any = {};
        for (const r of hookReadings) {
            if (r?.type) out[r.type] = r;
        }
        return out;
    }
    return null;
};

const recordToArray = (rec: Partial<Record<ReadingType, HookReadingLike>>): any[] => {
    return (['sun', 'moon', 'rising'] as ReadingType[])
        .map((k) => rec[k])
        .filter((r): r is HookReadingLike => Boolean(r))
        .map((r) => ({ ...r, type: r.type || (r as any).type }));
};

export const HomeScreen = ({ navigation }: Props) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compactV = useMemo(() => {
    const BASE_HEIGHT = 812;
    const raw = BASE_HEIGHT / Math.max(1, windowHeight);
    return Math.max(0.82, Math.min(1, raw));
  }, [windowHeight]);

  const hookReadings = useOnboardingStore((state) => state.hookReadings);
  const setHookReading = useOnboardingStore((state) => state.setHookReading);
  const hookAudio = useOnboardingStore((state) => state.hookAudio);
  const partnerAudio = useOnboardingStore((state) => state.partnerAudio);
  const setHookAudio = useOnboardingStore((state) => state.setHookAudio);
  const setPartnerAudio = useOnboardingStore((state) => state.setPartnerAudio);
  const user = useProfileStore((state) => state.getUser());
  const userName = useOnboardingStore((state) => state.name) || 'User';
  const allPeople = useProfileStore((state) => state.people);
  const clearCompatibilityReadings = useProfileStore((state) => state.clearCompatibilityReadings);
  const entitlementState = useAuthStore((state) => state.entitlementState);
  const partners = useMemo(() => allPeople.filter(p => !p.isUser), [allPeople]);
  
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [portraitPhotoUrl, setPortraitPhotoUrl] = useState<string | null>(null);
  const [portraitPreviewVisible, setPortraitPreviewVisible] = useState(false);
  const [howMatchingVisible, setHowMatchingVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loadUserData = async () => {
      if (!authUserId) return;
      try {
        const { data } = await supabase.from('library_people').select('portrait_url').eq('user_id', authUserId).eq('is_user', true).single();
        if (data?.portrait_url) setPortraitPhotoUrl(data.portrait_url);
        const { count } = await supabase.from('matches').select('*', { count: 'exact', head: true }).or(`user1_id.eq.${authUserId},user2_id.eq.${authUserId}`);
        setMatchCount(count || 0);
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };
    loadUserData();
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId || matchCount <= 0) return;

    let cancelled = false;
    const key = `home:first-match-popup-shown:${authUserId}`;

    const maybeShowFirstMatchPopup = async () => {
      const alreadyShown = await AsyncStorage.getItem(key);
      if (cancelled || alreadyShown === '1') return;

      Alert.alert('Match found', 'We found a match for you. Tap the big number to open Soul Gallery.');
      await AsyncStorage.setItem(key, '1');
    };

    maybeShowFirstMatchPopup();
    return () => {
      cancelled = true;
    };
  }, [authUserId, matchCount]);

  useEffect(() => {
    if (!portraitPhotoUrl) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      blink.start();
      return () => blink.stop();
    }
  }, [portraitPhotoUrl, blinkAnim]);

  const handleUploadPhoto = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0]?.base64) return;
      setUploadingPhoto(true);
      const userId = useAuthStore.getState().session?.user?.id || useAuthStore.getState().user?.id;
      if (!userId) {
        Alert.alert('Error', 'You must be signed in to upload a photo.');
        setUploadingPhoto(false);
        return;
      }
      const response = await fetch(`${env.CORE_API_URL}/api/profile/portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ photoBase64: result.assets[0].base64 }),
      });
      const data = await response.json();
      if (data.success && data.imageUrl) {
        setPortraitPhotoUrl(data.imageUrl);
        Alert.alert('Success', 'Your stylized portrait is ready!');
      } else {
        Alert.alert('Error', data.error || 'Failed to generate stylized portrait');
      }
      setUploadingPhoto(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload photo.');
      setUploadingPhoto(false);
    }
  };

  const updatePerson = useProfileStore((state) => state.updatePerson);
  const didRunPlacementsBackfillRef = useRef(false);

  useEffect(() => {
    const initPlacements = async () => {
      if (didRunPlacementsBackfillRef.current) return;
      didRunPlacementsBackfillRef.current = true;
      setTimeout(async () => {
        const currentPeople = useProfileStore.getState().people;
        const peopleWithoutPlacements = currentPeople.filter(p => !p.placements?.sunSign || !p.placements?.moonSign || !p.placements?.risingSign);
        if (peopleWithoutPlacements.length > 0) {
          await backfillMissingPlacements(peopleWithoutPlacements, updatePerson);
        }
      }, 500);
    };
    initPlacements();
  }, []);

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

  useEffect(() => {
    const loadFromSupabase = async () => {
      if (!authUserId || hookReadings.sun) return;
      const { getUserReadings } = await import('@/services/userReadings');
      const saved = await getUserReadings(authUserId);
      if (saved.length === 3) {
        const map: any = {};
        saved.forEach(r => { map[r.type] = { type: r.type, sign: r.sign, intro: r.intro, main: r.main }; });
        if (map.sun && map.moon && map.rising) {
          setHookReading(map.sun);
          setHookReading(map.moon);
          setHookReading(map.rising);
        }
      }
    };
    loadFromSupabase();
  }, [authUserId, hookReadings.sun, setHookReading]);

  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const peopleWithReadings = useMemo(() => {
    const list: Array<{ person: any; hookReadings?: any; placements?: any }> = [];
    const userPlacements = user?.placements;
    const hasUserPlacements = !!(userPlacements?.sunSign && userPlacements?.moonSign && userPlacements?.risingSign);
    const hasUserHooks = !!(hookReadings.sun && hookReadings.moon && hookReadings.rising);

    if (hasUserHooks || hasUserPlacements) {
      list.push({
        person: { ...(user || {}), name: user?.name || userName, isUser: true },
        placements: hasUserPlacements ? userPlacements : undefined,
        hookReadings: hasUserHooks ? { sun: hookReadings.sun, moon: hookReadings.moon, rising: hookReadings.rising } : undefined,
      });
    }

    const partnersWithHooks = partners.filter((p: any) => {
      const rec = toHookRecord(p.hookReadings);
      return rec?.sun && rec?.moon && rec?.rising;
    });

    partnersWithHooks.forEach((p: any) => {
      const rec = toHookRecord(p.hookReadings);
      list.push({ person: p, placements: p.placements, hookReadings: rec });
    });
    return list;
  }, [hookReadings, userName, partners, user]);

  const currentPerson = peopleWithReadings[currentPersonIndex] || null;
  const coreSigns = currentPerson ? {
    sun: currentPerson.hookReadings?.sun?.sign || currentPerson.placements?.sunSign || null,
    moon: currentPerson.hookReadings?.moon?.sign || currentPerson.placements?.moonSign || null,
    rising: currentPerson.hookReadings?.rising?.sign || currentPerson.placements?.risingSign || null,
  } : {
    sun: user?.placements?.sunSign || hookReadings.sun?.sign || null,
    moon: user?.placements?.moonSign || hookReadings.moon?.sign || null,
    rising: user?.placements?.risingSign || hookReadings.rising?.sign || null,
  };

  useEffect(() => {
    if (peopleWithReadings.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setCurrentPersonIndex((prev) => (prev + 1) % peopleWithReadings.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [peopleWithReadings.length, fadeAnim]);

  const [selectedReading, setSelectedReading] = useState<ReadingType | null>(null);
  const [hookPreviewLoading, setHookPreviewLoading] = useState(false);
  const [hookPreviewError, setHookPreviewError] = useState<string | null>(null);
  const hookPreviewRequestTokenRef = useRef(0);

  const modalReadings = useMemo(() => {
    if (!currentPerson) return hookReadings as any;
    const rec = toHookRecord(currentPerson.hookReadings);
    if (rec && Object.keys(rec).length > 0) return rec;
    if (currentPerson.person?.isUser) return hookReadings as any;
    return null;
  }, [currentPerson, hookReadings]);

  useEffect(() => {
    const run = async () => {
      if (!selectedReading || !currentPerson?.person || !authUserId || currentPerson.person.isUser) return;
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
        const { data: row } = await supabase.from('library_people').select('hook_readings').eq('user_id', authUserId).eq('client_person_id', currentPerson.person.id).maybeSingle();
        if (isCancelled()) return;
        const rowRec = row?.hook_readings ? toHookRecord(row.hook_readings) : null;
        if (rowRec?.[selectedReading]) {
          updatePerson(currentPerson.person.id, { hookReadings: recordToArray(rowRec) as any });
          setHookPreviewLoading(false);
          return;
        }
        const bd = currentPerson.person.birthData;
        if (!bd?.birthDate || !bd?.birthTime || !bd?.timezone || !bd?.latitude || !bd?.longitude) {
          setHookPreviewError('Missing birth data.');
          setHookPreviewLoading(false);
          return;
        }
        const apiRes = selectedReading === 'sun' ? await readingsApi.sun(bd) : selectedReading === 'moon' ? await readingsApi.moon(bd) : await readingsApi.rising(bd);
        if (isCancelled()) return;
        const generated = apiRes?.reading;
        if (!generated?.type || !generated?.intro || !generated?.main) {
          setHookPreviewError('Failed to generate.');
          setHookPreviewLoading(false);
          return;
        }
        const merged = { ...(rowRec || {}), [selectedReading]: generated };
        await supabase.from('library_people').update({ hook_readings: merged }).eq('user_id', authUserId).eq('client_person_id', currentPerson.person.id);
        updatePerson(currentPerson.person.id, { hookReadings: recordToArray(merged) as any });
        setHookPreviewLoading(false);
      } catch (e: any) {
        if (!isCancelled()) { setHookPreviewError(e.message); setHookPreviewLoading(false); }
      }
    };
    run();
    return () => { hookPreviewRequestTokenRef.current += 1; };
  }, [selectedReading, currentPerson?.person?.id, authUserId, updatePerson]);

  const [audioLoading, setAudioLoading] = useState(false);
  const [audioLoadingText, setAudioLoadingText] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const playRequestTokenRef = useRef(0);
  const downloadedAudioCache = useRef<Record<string, string>>({});
  const { toggleAudio, stopAudio, primeAudio } = useAudio();
  const getModalAudioKey = useCallback(
    (personId: string | undefined, reading: ReadingType) => `home-preview:${personId || 'self'}:${reading}`,
    []
  );
  const selectedPersonIdForAudio = currentPerson?.person?.id;
  const selectedPersonIsUserForAudio = !!currentPerson?.person?.isUser;
  const selectedPersonHookAudioPaths = currentPerson?.person?.hookAudioPaths;

  useEffect(() => {
    if (!selectedReading || !selectedPersonIdForAudio) return;
    const sourceFromPath = selectedPersonHookAudioPaths?.[selectedReading];
    const sourceFromStore = selectedPersonIsUserForAudio ? hookAudio[selectedReading] : partnerAudio[selectedReading];
    const source = sourceFromPath || sourceFromStore;
    if (!source) return;
    primeAudio(getModalAudioKey(selectedPersonIdForAudio, selectedReading), source).catch(() => { });
  }, [
    getModalAudioKey,
    hookAudio.moon,
    hookAudio.rising,
    hookAudio.sun,
    partnerAudio.moon,
    partnerAudio.rising,
    partnerAudio.sun,
    primeAudio,
    selectedPersonIdForAudio,
    selectedPersonHookAudioPaths,
    selectedPersonIsUserForAudio,
    selectedReading,
  ]);

  const stopAndUnloadAudio = useCallback(async () => {
    await stopAudio();
    setAudioPlaying(false);
  }, [stopAudio]);

  useFocusEffect(useCallback(() => {
    return () => {
      stopAudio().catch(() => {});
      setAudioPlaying(false);
    };
  }, [stopAudio]));

  const closeModal = useCallback(async () => {
    playRequestTokenRef.current += 1;
    await stopAndUnloadAudio();
    setAudioLoading(false);
    setSelectedReading(null);
  }, [stopAndUnloadAudio]);

  useEffect(() => {
    playRequestTokenRef.current += 1;
    stopAndUnloadAudio();
    setAudioLoading(false);
  }, [selectedReading, stopAndUnloadAudio]);

  const handlePlayAudio = useCallback(async () => {
    if (!selectedReading) return;
    const myToken = ++playRequestTokenRef.current;
    const reading = modalReadings?.[selectedReading];
    if (!reading) { Alert.alert('Error', 'Reading not found.'); return; }
    
    let audioSource =
      currentPerson?.person?.hookAudioPaths?.[selectedReading] ||
      (currentPerson?.person?.isUser ? hookAudio[selectedReading] : partnerAudio[selectedReading]) ||
      null;
    const personId = currentPerson?.person?.id;
    const cacheKey = personId ? `${personId}_${selectedReading}` : null;
    if (!audioSource && cacheKey && downloadedAudioCache.current[cacheKey]) {
      audioSource = downloadedAudioCache.current[cacheKey];
    }

    if (!audioSource && authUserId && personId) {
      setAudioLoading(true); setAudioLoadingText('Checking cloud audio...');
      try {
        const storagePath = `hook-audio/${authUserId}/${personId}/${selectedReading}.mp3`;
        const signed = await getHookAudioSignedUrl(storagePath, 60);
        if (myToken === playRequestTokenRef.current && signed) {
          audioSource = storagePath;
          if (cacheKey) downloadedAudioCache.current[cacheKey] = storagePath;
          if (currentPerson?.person?.isUser) {
            setHookAudio(selectedReading, storagePath);
          } else {
            setPartnerAudio(selectedReading, storagePath);
          }
          const latest = useProfileStore.getState().getPerson(personId);
          useProfileStore.getState().updatePerson(personId, {
            hookAudioPaths: {
              ...(latest?.hookAudioPaths || {}),
              [selectedReading]: storagePath,
            },
          } as any);
        }
      } catch {}
      setAudioLoading(false); setAudioLoadingText(null);
    }

    if (!audioSource || myToken !== playRequestTokenRef.current) return;

    try {
      setAudioLoading(true);
      const result = await toggleAudio({
        key: getModalAudioKey(personId, selectedReading),
        source: audioSource,
        onFinish: () => {
          setAudioPlaying(false);
        },
      });
      if (myToken === playRequestTokenRef.current) {
        setAudioPlaying(result === 'playing');
      }
      setAudioLoading(false);
    } catch { setAudioLoading(false); }
  }, [selectedReading, hookAudio, partnerAudio, modalReadings, currentPerson, authUserId, toggleAudio, getModalAudioKey, setHookAudio, setPartnerAudio]);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true })]));
    pulse.start(); return () => pulse.stop();
  }, [pulseAnim]);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const shimmer = Animated.loop(Animated.sequence([Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: false }), Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: false })]));
    shimmer.start(); return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerColor1 = shimmerAnim.interpolate({ inputRange: [0, 0.3, 0.5, 1], outputRange: [colors.border, colors.primary, colors.primary, colors.border] });
  const shimmerColor2 = shimmerAnim.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [colors.border, colors.border, colors.primary, colors.primary, colors.border] });
  const shimmerColor3 = shimmerAnim.interpolate({ inputRange: [0, 0.5, 0.7, 0.9, 1], outputRange: [colors.border, colors.border, colors.primary, colors.primary, colors.border] });

  // Match Handlers
  const handleMatchYes = () => Alert.alert('Registered!', 'Match feature coming soon!', [{ text: 'Got it' }]);
  const handleMatchNo = () => clearCompatibilityReadings?.();
  const matchingPaused = entitlementState === 'inactive';
  const displayedMatchCount = matchCount;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={[styles.settingsButton, { top: insets.top + spacing.sm }]} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.settingsIcon}>⚙</Text>
      </TouchableOpacity>

      {/* <View style={styles.walkersOverlay} pointerEvents="none">
        <AntChase width={windowWidth} height={windowHeight} />
      </View> */}

      <ScrollView style={styles.scrollView} scrollEnabled={false} contentContainerStyle={[styles.content, { gap: spacing.lg * compactV, paddingTop: spacing.xl + 20 }]}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.headlineWrap}>
            <Text style={styles.headlineTop} numberOfLines={2} ellipsizeMode="tail">
              {(() => {
                const name = currentPerson?.person?.name || 'Someone';
                if (!currentPerson) return 'My';
                if (currentPerson.person.isUser) return 'My';
                return /s$/i.test(name) ? `${name}'` : `${name}'s`;
              })()}
            </Text>
            <Text style={styles.headlineBottom}>Secret Life</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.signsCardRow, { opacity: fadeAnim }]}>
          {([['SUN', '☉', 'sun', shimmerColor1], ['MOON', '☽', 'moon', shimmerColor2], ['RISING', '↑', 'rising', shimmerColor3]] as const).map(([label, icon, type, color]) => (
            <TouchableOpacity key={type} onPress={() => coreSigns[type] ? setSelectedReading(type) : Alert.alert('No data')} activeOpacity={0.7} disabled={!coreSigns[type]}>
              <Animated.View style={[styles.signCard, { borderColor: coreSigns[type] ? color : colors.border }]}>
                <Text style={styles.signCardLabel}>{label}</Text>
                <Text style={styles.signCardIcon}>{icon}</Text>
                <Text style={styles.signCardSign}>{coreSigns[type] || '—'}</Text>
              </Animated.View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        <View style={styles.statusSection}>
          <Text style={styles.sectionLabel}>Match status</Text>
          <View style={styles.matchCountRow}>
            <TouchableOpacity
              style={styles.matchCountWrapper}
              onPress={() => navigation.navigate('Gallery' as any)}
            >
              <Text style={styles.statusNumber}>{displayedMatchCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.howMatchingButton}
              onPress={() => setHowMatchingVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.howMatchingButtonText}>How matching works</Text>
            </TouchableOpacity>
          </View>
          <Animated.Text style={[styles.statusSub, { transform: [{ scale: pulseAnim }] }]}>
            BUT THE <Text style={styles.statusOne}>1</Text> IN A BILLION IS STILL OUT THERE
          </Animated.Text>
          {matchingPaused ? (
            <Text style={styles.subscriptionWarning}>{CHAT_RENEW_WARNING_TEXT}</Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.libraryCard} onPress={() => navigation.navigate('NextStep' as any)}>
          <View style={styles.libraryHeader}><Text style={styles.libraryTitle}>My Souls Laboratory</Text></View>
        </TouchableOpacity>

        <View style={styles.profilePhotoSection}>
          {!portraitPhotoUrl ? (
            <TouchableOpacity style={styles.uploadPhotoButton} onPress={handleUploadPhoto} disabled={uploadingPhoto}>
              <Animated.View style={{ opacity: blinkAnim, alignItems: 'center' }}>
                <View style={styles.uploadPhotoPlaceholder}><Text style={styles.uploadPhotoIcon}>⊕</Text></View>
                <Text style={styles.uploadPhotoLabel}>{uploadingPhoto ? 'Creating...' : 'Upload photo'}</Text>
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setPortraitPreviewVisible(true)} onLongPress={() => navigation.navigate('Gallery' as any)}>
              <Image source={{ uri: portraitPhotoUrl }} style={styles.portraitImageLarge} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={portraitPreviewVisible && Boolean(portraitPhotoUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPortraitPreviewVisible(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPortraitPreviewVisible(false)}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{userName || 'Your'} portrait</Text>
            {portraitPhotoUrl ? (
              <Image source={{ uri: portraitPhotoUrl }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
            <Text style={styles.previewHint}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={howMatchingVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHowMatchingVisible(false)}
      >
        <Pressable style={styles.howMatchingBackdrop} onPress={() => setHowMatchingVisible(false)}>
          <Pressable style={styles.howMatchingCard} onPress={() => {}}>
            <View style={styles.howMatchingHeader}>
              <Text style={styles.howMatchingTitle}>How Matching Works</Text>
              <Pressable style={styles.howMatchingCloseButton} onPress={() => setHowMatchingVisible(false)}>
                <Text style={styles.howMatchingCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.howMatchingContent}>
              <Text style={styles.howMatchingParagraph}>
                We compare your birth signature across five spiritual systems:
                Astrology, Numerology, Human Design, Gene Keys, and Kabbalah.
              </Text>
              <Text style={styles.howMatchingParagraph}>
                Your number shows people with strong algorithmic resonance to your profile.
                The system does this automatically in the background.
              </Text>
              <Text style={styles.howMatchingParagraph}>
                There is no swiping. You can open Soul Gallery anytime and see your current matches.
                When a new resonance appears, your match number updates.
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={selectedReading !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={closeModal} style={styles.modalCloseButton}><Text style={styles.modalClose}>✕</Text></Pressable>
            <Text style={styles.modalTitle}>{selectedReading?.toUpperCase()}</Text>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {selectedReading && modalReadings?.[selectedReading] && (
              <>
                <View style={styles.modalTopRow}>
                  <Text style={styles.modalIcon}>{selectedReading === 'sun' ? '☉' : selectedReading === 'moon' ? '☽' : '↑'}</Text>
                  <Text style={styles.modalSign}>{modalReadings[selectedReading].sign}</Text>
                  <TouchableOpacity style={[styles.audioBtn, audioPlaying && styles.audioBtnActive]} onPress={handlePlayAudio} disabled={audioLoading}>
                    {audioLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.audioBtnText}>{audioPlaying ? '■' : '▶'}</Text>}
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalIntro}>{modalReadings[selectedReading].intro}</Text>
                <Text style={styles.modalMain}>{modalReadings[selectedReading].main}</Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl * 2, gap: spacing.lg },
  headlineWrap: { alignItems: 'center' },
  headlineTop: { fontFamily: typography.headline, fontSize: 32, color: colors.text, textAlign: 'center' },
  headlineBottom: { fontFamily: typography.headline, fontSize: 32, color: colors.text, textAlign: 'center', marginTop: -2 },
  settingsButton: { position: 'absolute', right: spacing.page, zIndex: 50, padding: spacing.sm },
  settingsIcon: { fontSize: 24, color: colors.text },
  libraryCard: { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', marginTop: spacing.lg },
  libraryHeader: { alignItems: 'center' },
  libraryTitle: { fontFamily: typography.serifBold, fontSize: 20, color: colors.text },
  statusSection: { alignItems: 'center', paddingTop: 40, paddingBottom: spacing.xl },
  sectionLabel: { fontFamily: typography.sansSemiBold, color: colors.primary, fontSize: 12, textTransform: 'uppercase', marginBottom: spacing.xs },
  statusNumber: { fontFamily: typography.sansRegular, color: colors.text, fontSize: 64 },
  statusSub: { fontFamily: typography.sansBold, color: colors.text, textAlign: 'center', fontSize: 13 },
  statusOne: { fontFamily: typography.sansBold, color: colors.primary, fontSize: 16 },
  subscriptionWarning: {
    marginTop: spacing.xs,
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
  },
  signsCardRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  signCard: { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md, alignItems: 'center', borderWidth: 2, minWidth: 100 },
  signCardLabel: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.primary, marginBottom: spacing.xs },
  signCardIcon: { fontSize: 28, marginBottom: spacing.xs },
  signCardSign: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.page, borderBottomWidth: 1, borderBottomColor: colors.divider },
  modalCloseButton: { padding: spacing.sm },
  modalClose: { fontSize: 28, color: colors.text, fontWeight: 'bold' },
  modalTitle: { fontFamily: typography.sansBold, fontSize: 14, color: colors.primary, flex: 1, textAlign: 'center' },
  modalScroll: { flex: 1 },
  modalContent: { padding: spacing.page, paddingTop: spacing.xl },
  modalTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalIcon: { fontSize: 48 },
  modalSign: { fontFamily: typography.headline, fontSize: 32, color: colors.text, flex: 1, textAlign: 'center' },
  modalIntro: { fontFamily: typography.sansRegular, fontSize: 15, color: colors.mutedText, lineHeight: 22, marginBottom: spacing.lg },
  modalMain: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.text, lineHeight: 24 },
  audioBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 24 },
  audioBtnActive: { backgroundColor: colors.text },
  audioBtnText: { color: colors.background, fontWeight: 'bold' },
  profilePhotoSection: { alignItems: 'center', marginTop: spacing.xl },
  uploadPhotoButton: { alignItems: 'center' },
  uploadPhotoPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  uploadPhotoIcon: { fontSize: 32 },
  uploadPhotoLabel: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.primary, marginTop: spacing.xs },
  portraitImageLarge: { width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: colors.primary },
  matchCountRow: { width: '100%', minHeight: 92, justifyContent: 'center', alignItems: 'center' },
  matchCountWrapper: { padding: 10 },
  howMatchingButton: {
    position: 'absolute',
    right: spacing.xs,
    top: '50%',
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  howMatchingButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.mutedText,
  },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.page },
  previewCard: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  previewTitle: { fontFamily: typography.sansSemiBold, fontSize: 18, color: colors.text, marginBottom: spacing.sm },
  previewImage: { width: '100%', height: 420, borderRadius: 14, backgroundColor: colors.background },
  previewHint: { marginTop: spacing.sm, fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText },
  howMatchingBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  howMatchingCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '78%',
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  howMatchingHeader: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howMatchingTitle: {
    fontFamily: typography.headline,
    fontSize: 34,
    color: colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingRight: spacing.xl,
  },
  howMatchingCloseButton: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.xs,
    padding: spacing.xs,
  },
  howMatchingCloseText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 28,
    color: colors.text,
  },
  howMatchingContent: {
    padding: spacing.page,
    gap: spacing.md,
  },
  howMatchingParagraph: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  walkersOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
});
