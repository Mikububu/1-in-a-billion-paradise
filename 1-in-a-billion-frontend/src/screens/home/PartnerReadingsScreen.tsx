import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
// FileSystem not needed - audio stored in memory
import { colors, spacing, typography } from '@/theme/tokens';
import { HookReading } from '@/types/forms';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { audioApi } from '@/services/api';
import { uploadHookAudioBase64, downloadHookAudioBase64 } from '@/services/hookAudioCloud';
import { isSupabaseConfigured } from '@/services/supabase';
import { useProfileStore, Reading } from '@/store/profileStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { AUDIO_CONFIG, getPartnerSignLabel } from '@/config/readingConfig';
// Audio stored in memory (base64) - no file system needed

type Props = NativeStackScreenProps<MainStackParamList, 'PartnerReadings'>;

const { width: PAGE_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive scaling for smaller phones (iPhone SE = 667)
const isSmallScreen = SCREEN_HEIGHT < 700;
const fontScale = isSmallScreen ? 0.9 : 1;

// Dynamic labels using partner name - returns { name, suffix } for styling
const getSignLabel = (name: string, type: HookReading['type']) => {
  const upperName = name.toUpperCase();
  switch (type) {
    case 'sun': return { name: upperName, suffix: "'S SUN SIGN" };
    case 'moon': return { name: upperName, suffix: "'S MOON SIGN" };
    case 'rising': return { name: upperName, suffix: "'S RISING SIGN" };
  }
};

type LLMProvider = 'deepseek' | 'claude' | 'gpt' | 'deepthink';

// Extended page type to include the gateway page (same as HookSequenceScreen)
type PageItem = HookReading | { type: 'gateway'; sign: ''; intro: ''; main: '' };

const screenId = 'P1'; // Partner Readings

export const PartnerReadingsScreen = ({ navigation, route }: Props) => {
  console.log(`📱 Screen ${screenId}: PartnerReadingsScreen`);
  const { partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity, partnerId } = route.params || {};
  const user = useProfileStore((s) => s.getUser());
  const onboardingBirthTime = useOnboardingStore((s) => s.birthTime);
  const authUser = useAuthStore((s) => s.user);
  const hasUsedFreeOverlay = useAuthStore((s) => s.hasUsedFreeOverlay);

  const [readings, setReadings] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false); // No loading screen - data loads in background
  const [page, setPage] = useState(0);
  const [activeProvider, setActiveProvider] = useState<LLMProvider>('claude');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const listRef = useRef<FlatList<PageItem>>(null);

  // Fetch existing hook readings from profileStore
  const person = useProfileStore((state) => partnerId ? state.getPerson(partnerId) : undefined);
  const savedReadings = (person?.readings || []).filter(r => (r as any).type === 'single' && r.system === 'western' && r.wordCount && r.wordCount < 500);

  // Pre-rendered partner audio from store (same pattern as 1st person readings)
  const partnerAudio = useOnboardingStore((state) => state.partnerAudio);
  const setPartnerAudio = useOnboardingStore((state) => state.setPartnerAudio);

  // Audio state
  const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
  const [audioPlaying, setAudioPlaying] = useState<Record<string, boolean>>({});
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentPlayingType = useRef<string | null>(null);
  const inFlightAudio = useRef<Partial<Record<HookReading['type'], Promise<string | null>>>>({});
  const inFlightUpload = useRef<Partial<Record<HookReading['type'], Promise<void>>>>({});

  const startPartnerAudioGeneration = useCallback(
    (type: HookReading['type'], reading: HookReading) => {
      if (partnerAudio[type]) return Promise.resolve(partnerAudio[type] || null);
      const existing = inFlightAudio.current[type];
      if (existing) return existing;

      const textToSpeak = `${reading.intro}\n\n${reading.main}`;
      const p = audioApi
        .generateTTS(textToSpeak, { exaggeration: AUDIO_CONFIG.exaggeration })
        .then((result) => {
          if (result.success && result.audioBase64) {
            // Store base64 directly in memory for immediate playback
            console.log(`💾 ${partnerName}'s ${type} audio ready (in memory)`);
            setPartnerAudio(type, result.audioBase64);
            
            // Upload to Supabase in background (non-blocking)
            const userId = authUser?.id;
            if (userId && partnerId && result.audioBase64) {
              uploadHookAudioBase64({
                userId,
                personId: partnerId,
                type,
                audioBase64: result.audioBase64,
              })
                .then(uploadResult => {
                  if (uploadResult.success) {
                    console.log(`☁️ ${partnerName}'s ${type} synced to Supabase`);
                  }
                })
                .catch(() => {});
            }
            
            return result.audioBase64;
          }
          return null;
        })
        .catch(() => null)
        .finally(() => {
          inFlightAudio.current[type] = undefined;
        });

      inFlightAudio.current[type] = p;
      return p;
    },
    [partnerAudio, setPartnerAudio, partnerName]
  );

  // Download missing partner audio from Supabase (for reinstall/new device sync)
  useEffect(() => {
    const downloadMissingAudio = async () => {
      const userId = authUser?.id;
      if (!userId || !partnerId) return;

      const types: HookReading['type'][] = ['sun', 'moon', 'rising'];
      
      for (const type of types) {
        const localAudio = partnerAudio[type];
        if (!localAudio) {
          console.log(`📥 Checking Supabase for ${partnerName}'s ${type} audio...`);
          const result = await downloadHookAudioBase64({ userId, personId: partnerId, type });
          
          if (result.success) {
            setPartnerAudio(type, result.audioBase64);
            console.log(`✅ Downloaded ${partnerName}'s ${type} audio from Supabase`);
          }
        }
      }
    };

    downloadMissingAudio();
  }, []); // Run once on mount

  // If audio already exists (e.g., SUN was pre-rendered earlier), upload it once to Supabase Storage.
  useEffect(() => {
    const uid = authUser?.id;
    if (!uid || !partnerId) return;
    if (!env.ENABLE_SUPABASE_LIBRARY_SYNC || !isSupabaseConfigured) return;

    const types: HookReading['type'][] = ['sun', 'moon', 'rising'];
    for (const type of types) {
      const v = partnerAudio?.[type];
      // Only auto-upload if we still have legacy Base64 stored in state.
      // New pipeline stores a local filename (e.g. "partner_hook_sun_123.mp3").
      const b64 =
        v && !v.endsWith('.mp3') && !v.startsWith('http://') && !v.startsWith('https://') ? v : null;
      if (!b64) continue;
      const partner = useProfileStore.getState().getPerson(partnerId);
      if (partner?.hookAudioPaths?.[type]) continue;
      if (inFlightUpload.current[type]) continue;

      inFlightUpload.current[type] = uploadHookAudioBase64({
        userId: uid,
        personId: partnerId,
        type,
        audioBase64: b64,
      })
        .then((res) => {
          if (!res.success) return;
          const latest = useProfileStore.getState().getPerson(partnerId);
          useProfileStore.getState().updatePerson(partnerId, {
            hookAudioPaths: {
              ...(latest?.hookAudioPaths || {}),
              [type]: res.path,
            },
          } as any);
        })
        .finally(() => {
          inFlightUpload.current[type] = undefined;
        });
    }
  }, [authUser?.id, partnerId, partnerAudio.sun, partnerAudio.moon, partnerAudio.rising]);

  // Blink animation ref
  const blinkAnim = useRef(new Animated.Value(1)).current;


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

  // CRITICAL: Stop audio when screen loses focus (useFocusEffect runs cleanup BEFORE blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log('🛑 PartnerReadingsScreen LOSING FOCUS - stopping audio immediately');
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

  // Also cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('🛑 PartnerReadingsScreen unmounting - final cleanup');
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
      console.log(`🛑 Partner page changed to ${page} - stopping audio`);
      soundRef.current.stopAsync().catch(() => { });
      soundRef.current.unloadAsync().catch(() => { });
      soundRef.current = null;
      setAudioPlaying({});
      currentPlayingType.current = null;
    }
  }, [page]);

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKGROUND AUDIO GENERATION (same pattern as HookSequenceScreen)
  // Pre-render next audio while user views current page
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (readings.length === 0) return;

    const generateNextAudio = async () => {
      const currentReading = readings[page];
      if (!currentReading) return;

      // On SUN page → background generate MOON audio
      if (currentReading.type === 'sun' && readings[1] && !partnerAudio.moon) {
        console.log(`🎵 ${partnerName}'s Sun page: Background generating MOON audio...`);
        try {
          const moonReading = readings[1];
          const b64 = await startPartnerAudioGeneration('moon', moonReading as HookReading);
          if (b64) console.log(`✅ ${partnerName}'s Moon audio ready (generated while on Sun page)`);
        } catch (err) {
          console.log(`⚠️ ${partnerName}'s Moon audio background generation failed:`, err);
        }
      }

      // On MOON page → background generate RISING audio
      if (currentReading.type === 'moon' && readings[2] && !partnerAudio.rising) {
        console.log(`🎵 ${partnerName}'s Moon page: Background generating RISING audio...`);
        try {
          const risingReading = readings[2];
          const b64 = await startPartnerAudioGeneration('rising', risingReading as HookReading);
          if (b64) console.log(`✅ ${partnerName}'s Rising audio ready (generated while on Moon page)`);
        } catch (err) {
          console.log(`⚠️ ${partnerName}'s Rising audio background generation failed:`, err);
        }
      }
    };

    generateNextAudio();
  }, [page, readings, partnerAudio.moon, partnerAudio.rising, partnerName, startPartnerAudioGeneration]);

  // Handle audio playback
  // Handle audio playback (uses pre-rendered audio from store, same as 1st person readings)
  const handlePlayAudio = useCallback(async (reading: HookReading) => {
    const type = reading.type;

    // If already playing this one, stop it
    if (currentPlayingType.current === type && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setAudioPlaying(prev => ({ ...prev, [type]: false }));
      currentPlayingType.current = null;
      return;
    }

    // Stop any currently playing audio
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      if (currentPlayingType.current) {
        setAudioPlaying(prev => ({ ...prev, [currentPlayingType.current!]: false }));
      }
      currentPlayingType.current = null;
    }

    setAudioLoading(prev => ({ ...prev, [type]: true }));
    console.log(`⏳ Preparing ${partnerName}'s ${type} audio... cached=${!!partnerAudio[type]}`);

    let audioSource: string | null = partnerAudio[type] || null;
    // If background generation is in-flight, wait for it
    if (!audioSource && inFlightAudio.current[type]) {
      console.log(`⏳ Waiting for in-flight ${partnerName}'s ${type} audio...`);
      audioSource = (await inFlightAudio.current[type]!) || null;
    }
    // If still missing, start generation now (shared)
    if (!audioSource) {
      audioSource = await startPartnerAudioGeneration(type, reading);
    }
    if (!audioSource) {
      setAudioLoading(prev => ({ ...prev, [type]: false }));
      return;
    }

    setAudioLoading(prev => ({ ...prev, [type]: false }));

    // Play the audio - SIMPLE: base64 directly, no file system
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      const uri = `data:audio/mpeg;base64,${audioSource}`;
      console.log(`🎵 Playing ${partnerName}'s ${type} audio (base64)`);

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setAudioPlaying(prev => ({ ...prev, [type]: false }));
            currentPlayingType.current = null;
          }
        }
      );

      soundRef.current = sound;
      currentPlayingType.current = type;
      setAudioPlaying(prev => ({ ...prev, [type]: true }));
    } catch (error) {
      console.log('Audio playback error:', error);
    }
  }, [partnerAudio, partnerName, startPartnerAudioGeneration]);

  // Fetch initial readings
  // On mount, load existing readings or fetch new ones if missing
  useEffect(() => {
    if (savedReadings.length === 3) {
      // Parse saved readings into HookReading format
      const loadedReadings: HookReading[] = savedReadings.map((r: Reading, index) => {
        const [intro, ...mainParts] = r.content.split('\n\n');
        const type: HookReading['type'] = index === 0 ? 'sun' : index === 1 ? 'moon' : 'rising';
        // Extract sign from placements if available
        const person = useProfileStore.getState().people.find(p => p.id === partnerId);
        const sign = type === 'sun' ? person?.placements?.sunSign :
          type === 'moon' ? person?.placements?.moonSign :
            person?.placements?.risingSign;

        return {
          type,
          sign: sign || 'Unknown',
          intro: intro || '',
          main: mainParts.join('\n\n') || '',
        };
      });

      // Add 4th "gateway" page for navigation (same as HookSequenceScreen)
      setReadings([...loadedReadings, { type: 'gateway', sign: '', intro: '', main: '' }]);
      console.log(`✅ Loaded ${partnerName}'s existing readings from store`);
    } else {
      // Readings don't exist - generate them
      console.log(`⚠️ ${partnerName}'s readings not found - generating...`);
      fetchReadingsWithProvider('deepseek');
    }
  }, [partnerId, savedReadings.length]);

  const fetchReadingsWithProvider = async (provider: LLMProvider) => {
    console.log(`🔄 Fetching ${partnerName}'s readings with ${provider}...`);
    setActiveProvider(provider);
    setIsRegenerating(true);

    const minSpinnerTime = new Promise(resolve => setTimeout(resolve, 800));


    try {
      const types: HookReading['type'][] = ['sun', 'moon', 'rising'];
      const newReadings: HookReading[] = [];

      for (const type of types) {
        const response = await fetch(`${env.CORE_API_URL}/api/reading/${type}?provider=${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            birthDate: partnerBirthDate || '',
            birthTime: partnerBirthTime || '12:00',
            timezone: partnerBirthCity?.timezone || 'UTC',
            latitude: partnerBirthCity?.latitude || 0,
            longitude: partnerBirthCity?.longitude || 0,
            relationshipIntensity: 5,
            relationshipMode: 'sensual',
            primaryLanguage: 'en',
            subjectName: partnerName,
            isPartnerReading: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          newReadings.push(data.reading);
        }
      }

      if (newReadings.length === 3) {
        // Add 4th "gateway" page for navigation (same as HookSequenceScreen)
        setReadings([...newReadings, { type: 'gateway', sign: '', intro: '', main: '' }]);
        listRef.current?.scrollToIndex({ index: 0, animated: true });
        setPage(0);

        // NOTE: SUN audio is already pre-rendered by PartnerCoreIdentitiesScreen
        // MOON and RISING audio are generated in background via useEffect (page change)
        console.log(`📝 ${partnerName}'s readings loaded. Audio from store: sun=${!!partnerAudio.sun}`);

        // Hook readings are NOT saved to profileStore - they're ephemeral and displayed via special UI
        // If user wants deep readings, they can request via "Full Reading" CTA
      }
    } catch (error) {
      console.log(`Error fetching ${partnerName}'s readings:`, error);
    } finally {
      await minSpinnerTime;
      setIsRegenerating(false);
      setIsLoading(false);
    }
  };

  // Simplified: No auto-navigation, no transition state needed

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const index = Math.round(contentOffset.x / layoutMeasurement.width);
    setPage(index);
    // Simplified: No auto-navigation, just 3 cards (Sun/Moon/Rising)
  };

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

  // Simplified: Just 3 pages (Sun/Moon/Rising), no gateway

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with Back Button - moved higher */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonContainer}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.wrapper}>
        {/* Content */}
        <View style={styles.content}>
          {readings.length === 0 && isRegenerating ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                Generating <Text style={styles.nameRed}>{partnerName}</Text>'s readings...
              </Text>
            </View>
          ) : readings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                <Text style={styles.nameRed}>{partnerName}</Text>'s readings
              </Text>
              <Text style={styles.emptySubtext}>Tap a provider above to generate</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={readings}
                keyExtractor={(item) => item.type}
                pagingEnabled
                horizontal
                showsHorizontalScrollIndicator={false}
                ref={listRef}
                onMomentumScrollEnd={handleScroll}
                renderItem={({ item }) => {

                  // 4th page: Gateway (Continue to synastry/comparison)
                  if (item.type === 'gateway') {
                    return (
                      <View style={styles.page}>
                        <View style={styles.gatewayContainer}>
                          <Text style={styles.gatewayIcon}>✧</Text>
                          <Text style={styles.gatewayTitle}>
                            <Text style={styles.nameRed}>{partnerName}</Text>'s Chart Complete
                          </Text>
                          <Text style={styles.gatewaySubtitle}>
                            Ready to explore your cosmic connection?
                          </Text>

                          <TouchableOpacity
                            style={styles.continueBtn}
                            onPress={() => {
                              const userBirthTime = user?.birthData?.birthTime || onboardingBirthTime;
                              if (!userBirthTime || !partnerBirthTime) {
                                const missingLabel = !userBirthTime ? 'your birth time' : `${partnerName || 'partner'}'s birth time`;
                                Alert.alert(
                                  'Birth time required',
                                  `Compatibility requires birth time for BOTH people (Rising sign). Please add ${missingLabel} first.`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Edit Birth Data',
                                      onPress: () => {
                                        // If partner missing → edit partner, else edit user
                                        if (!partnerBirthTime && partnerId) {
                                          navigation.navigate('EditBirthData', { personId: partnerId });
                                        } else {
                                          // No personId = edit main user profile (EditBirthDataScreen falls back to getUser())
                                          navigation.navigate('EditBirthData');
                                        }
                                      },
                                    },
                                  ]
                                );
                                return;
                              }
                              // If the user has already used their free overlay preview, route directly to paid packages.
                              if (hasUsedFreeOverlay(authUser?.id)) {
                                navigation.navigate('SystemSelection', {
                                  readingType: 'overlay',
                                  forPartner: false,
                                  userName: 'You',
                                  partnerName,
                                  partnerBirthDate,
                                  partnerBirthTime,
                                  partnerBirthCity,
                                });
                                return;
                              }

                              // Otherwise allow the one-time free preview.
                              navigation.navigate('SynastryPreview', {
                                partnerName,
                                partnerBirthDate,
                                partnerBirthTime,
                                partnerBirthCity,
                              });
                            }}
                          >
                            <Text style={styles.continueBtnText}>Compare Charts →</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => navigation.navigate('Home')}
                          >
                            <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  // Regular reading pages (MATCHES HookSequenceScreen layout)
                  return (
                    <View style={styles.page}>
                      {/* Header - centered (same as HookSequenceScreen) */}
                      <View style={styles.headerCenter}>
                        <Text style={styles.badgeText} selectable>
                          <Text style={styles.badgeNameRed}>{getSignLabel(partnerName, item.type)?.name}</Text>
                          {getSignLabel(partnerName, item.type)?.suffix}
                        </Text>
                        <Text style={styles.signName} selectable>{item.sign}</Text>

                        {/* Audio button (inside headerCenter, same as HookSequenceScreen) */}
                        <TouchableOpacity
                          style={[
                            styles.audioBtn,
                            audioPlaying[item.type] && styles.audioBtnActive,
                          ]}
                          onPress={() => (item.type as string) !== 'gateway' && handlePlayAudio(item as HookReading)}
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

                      {/* Reading text - scrollable (same as HookSequenceScreen) */}
                      <ScrollView
                        style={styles.textScroll}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.textScrollContent}
                      >
                        <Text
                          style={styles.preamble}
                          selectable
                          textBreakStrategy="highQuality"
                        >
                          {item.intro}
                        </Text>
                        <Text
                          style={styles.analysis}
                          selectable
                          textBreakStrategy="highQuality"
                        >
                          {item.main}
                        </Text>
                      </ScrollView>
                    </View>
                  );
                }}
              />

            </>
          )}
        </View>

        {/* Footer - Pagination dots (OUTSIDE content, matches HookSequenceScreen) */}
        {readings.length > 0 && (
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

// IDENTICAL styles to HookSequenceScreen
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xs, // Moved higher to save screen space
    paddingBottom: spacing.xs,
  },
  backButtonContainer: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  backButton: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 0, // Remove top padding since header handles it
    paddingBottom: spacing.xl,
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
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  emptyText: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  nameRed: {
    color: colors.primary,
  },
  emptySubtext: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginTop: spacing.sm,
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  providerBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  providerBtnInner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 70,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerBtnTextActive: {
    color: colors.background,
  },
  deepthinkText: {
    color: colors.primary,
    fontWeight: '800',
  },
  page: {
    width: PAGE_WIDTH - (spacing.page * 2),
    paddingHorizontal: 8,
    flex: 1, // Important for ScrollView to work
  },
  headerCenter: {
    alignItems: 'center',
    width: '100%',
  },
  badgeText: {
    fontFamily: typography.sansBold,
    fontSize: 24 * fontScale, // Matches HookSequenceScreen
    fontWeight: '900',
    color: colors.text, // Rest of text is dark
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  badgeNameRed: {
    color: colors.primary, // Name is RED
  },
  signName: {
    fontFamily: typography.headline,
    fontSize: 44 * fontScale, // Matches HookSequenceScreen
    color: colors.text,
    lineHeight: 52 * fontScale, // Matches HookSequenceScreen
    textAlign: 'center',
    marginTop: spacing.md, // Matches HookSequenceScreen
    marginBottom: spacing.sm, // Matches HookSequenceScreen
  },
  headerSpacer: {
    height: isSmallScreen ? 4 : spacing.sm,
  },
  preamble: {
    fontFamily: typography.sansRegular,
    fontSize: 14 * fontScale,
    color: colors.mutedText,
    lineHeight: 20 * fontScale,
    marginTop: spacing.sm, // Matches HookSequenceScreen
    marginBottom: spacing.sm, // Matches HookSequenceScreen
    textAlign: 'justify',
  },
  analysis: {
    fontFamily: typography.sansRegular,
    fontSize: 15 * fontScale,
    color: colors.text,
    lineHeight: 22 * fontScale,
    textAlign: 'justify',
  },
  // Text scroll (matches HookSequenceScreen)
  textScroll: {
    flex: 1,
    width: '100%',
  },
  textScrollContent: {
    paddingBottom: spacing.xl * 2,
    paddingHorizontal: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg, // Matches HookSequenceScreen
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
  // Audio styles
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 24, // Rounded pill shape (matches HookSequenceScreen)
    marginTop: spacing.md,
    marginBottom: 4,
  },
  audioBtnActive: {
    backgroundColor: colors.text,
  },
  audioBtnText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  audioHint: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: spacing.lg, // Matches HookSequenceScreen - space before text
  },
  // Gateway page styles (4th page - continue to synastry)
  gatewayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  gatewayIcon: {
    fontSize: 48,
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  gatewayTitle: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  gatewaySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl * 2,
    paddingVertical: spacing.md,
    borderRadius: 24,
    marginBottom: spacing.md,
  },
  continueBtnText: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textDecorationLine: 'underline',
  },
});
