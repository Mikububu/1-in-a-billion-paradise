/**
 * SYSTEM SELECTION SCREEN (Screen 22)
 * 
 * Shows 6 options with prices:
 * - 5 individual systems ($29 each for individual, $59 each for overlay)
 * - 1 "Best Choice" bundle (All 5 systems - $79 individual, $108 overlay)
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av'; // Added for voice samples
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { PRODUCTS, formatAudioDuration } from '@/config/products';
import { useOnboardingStore } from '@/store/onboardingStore';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { useState, useEffect } from 'react';
// Voices are now fetched from backend API - no need for hardcoded VOICES object
import { VoiceSelectionModal } from '@/components/VoiceSelectionModal';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'SystemSelection'>;

const screenId = '22';

const SYSTEMS = [
  { id: 'western', name: 'Western Astrology', icon: '☉' },
  { id: 'vedic', name: 'Vedic (Jyotish)', icon: 'ॐ' },
  { id: 'human_design', name: 'Human Design', icon: '◎' },
  { id: 'gene_keys', name: 'Gene Keys', icon: '◇' },
  { id: 'kabbalah', name: 'Kabbalah', icon: '✧' },
];

export const SystemSelectionScreen = ({ navigation, route }: Props) => {
  console.log(`📱 Screen ${screenId}: SystemSelectionScreen`);
  const [isLoading, setIsLoading] = useState(false);
  // Voice Selection State
  const [selectedVoice, setSelectedVoice] = useState<string>('david');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [pendingJob, setPendingJob] = useState<{ productType: string; title: string; systems: string[]; voiceId?: string; relationshipContext?: string; personalContext?: string } | null>(null);

  const {
    readingType,
    forPartner,
    userName,
    partnerName,
    partnerBirthDate,
    partnerBirthTime,
    partnerBirthCity,
    person1Override,
    person2Override,
    personId, // NEW
    relationshipContext, // From RelationshipContextScreen (for overlays)
    personalContext, // From PersonalContextScreen (for individual readings)
    preselectedSystem, // NEW: If coming from SystemExplainer → Injection, this system is already chosen
  } = (route.params || {}) as any;

  // Hydrate person data if personId is passed
  const getPerson = useProfileStore(s => s.getPerson);
  const targetPerson = personId ? getPerson(personId) : null;

  // If targetPerson exists, we are in "Partner" mode for THEM.
  const isForTarget = !!targetPerson;

  // Auto-trigger voice selection screen if preselectedSystem is passed (skip system selection UI)
  useEffect(() => {
    if (preselectedSystem) {
      const systemName = SYSTEMS.find(s => s.id === preselectedSystem)?.name || preselectedSystem;
      
      // Navigate to full-screen voice selection
      navigation.navigate('VoiceSelection', {
        preselectedVoice: selectedVoice,
        onSelect: (voiceId: string) => {
          // Callback when voice is selected
          startJobAndNavigate({
            productType: isOverlay ? 'compatibility_overlay' : 'single_system',
            title: systemName,
            systems: [preselectedSystem],
            voiceIdOverride: voiceId,
            relationshipContext,
            personalContext,
          });
        },
      });
    }
  }, [preselectedSystem]); // Only trigger on mount if preselectedSystem exists

  const isOverlay = readingType === 'overlay';
  const singlePrice = isOverlay ? PRODUCTS.compatibility_overlay.priceUSD : PRODUCTS.single_system.priceUSD;
  const bundlePrice = isOverlay ? PRODUCTS.nuclear_package.priceUSD : PRODUCTS.complete_reading.priceUSD;
  const bundleSavings = (singlePrice * 5) - bundlePrice;

  const singleProduct = isOverlay ? PRODUCTS.compatibility_overlay : PRODUCTS.single_system;
  const bundleProduct = isOverlay ? PRODUCTS.nuclear_package : PRODUCTS.complete_reading;

  const authDisplayName = useAuthStore((s) => s.displayName);
  
  // CRITICAL: Get user data from profileStore FIRST (synced from Supabase), 
  // then fallback to onboardingStore (local device storage which may be empty after re-signin)
  const profileStoreUser = useProfileStore((s) => s.getUser());
  const onboardingMainUser = useOnboardingStore((s) => s.getMainUser());
  const onboardingBirthDate = useOnboardingStore((s) => s.birthDate);
  const onboardingBirthTime = useOnboardingStore((s) => s.birthTime);
  const onboardingBirthCity = useOnboardingStore((s) => s.birthCity);
  const onboardingIntensity = useOnboardingStore((s) => s.relationshipIntensity);
  
  // Priority: profileStore (Supabase synced) > onboardingStore (local) > route params > fallback
  const meName = profileStoreUser?.name || onboardingMainUser?.name || userName || authDisplayName || 'You';
  const meBirthDate = profileStoreUser?.birthData?.birthDate || onboardingBirthDate;
  const meBirthTime = profileStoreUser?.birthData?.birthTime || onboardingBirthTime;
  const meCity = profileStoreUser?.birthData 
    ? { 
        timezone: profileStoreUser.birthData.timezone, 
        latitude: profileStoreUser.birthData.latitude, 
        longitude: profileStoreUser.birthData.longitude,
        name: profileStoreUser.birthData.birthCity,
      } 
    : onboardingBirthCity;
  const relationshipIntensity = onboardingIntensity || (profileStoreUser as any)?.relationshipIntensity || 5;

  // NEVER use "You/Your" - always use actual NAME (3rd person per docs)
  const displayP1Name = person1Override?.name || (targetPerson?.name) || (forPartner ? (partnerName || userName || 'Partner') : meName);
  const displayP2Name = person2Override?.name || partnerName || 'Partner';
  
  // If name is 'You' (fallback), use 'Your Reading' instead of "You's Reading"
  const cleanP1Name = displayP1Name === 'You' ? 'Your' : displayP1Name;
  
  const title = isOverlay
    ? `${displayP1Name} & ${displayP2Name}`
    : displayP1Name === 'You' 
      ? 'Your Reading'
      : `${displayP1Name}'s Reading`;

  // Preload voice samples in background on mount
  useEffect(() => {
    const preloadVoiceSamples = async () => {
      try {
        console.log('🎵 SystemSelection: Preloading voice samples in background...');
        const baseCandidates = [
          env.CORE_API_URL,
          'http://172.20.10.2:8787',
          'http://localhost:8787',
          'http://127.0.0.1:8787',
          'https://1-in-a-billion-backend.fly.dev',
        ];
        const bases = Array.from(new Set(baseCandidates.filter(Boolean)));

        for (const base of bases) {
          try {
            const url = `${base}/api/voices/samples`;
            const response = await fetch(url, { 
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.voices) {
                console.log(`✅ Preloaded ${data.voices.length} voice samples`);
                
                // Preload each voice sample audio (fire and forget)
                data.voices.forEach((voice: any) => {
                  if (voice.sampleUrl) {
                    Audio.Sound.createAsync({ uri: voice.sampleUrl }, { shouldPlay: false })
                      .then(() => console.log(`✅ Cached audio for ${voice.displayName}`))
                      .catch(() => {/* silent fail */});
                  }
                });
              }
              break; // Success, stop trying other bases
            }
          } catch (e) {
            // Try next base
            continue;
          }
        }
      } catch (err) {
        console.log('⚠️ Voice sample preload failed (non-blocking):', err);
      }
    };

    preloadVoiceSamples(); // Fire and forget
  }, []);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playVoiceSample = async (voiceName: string) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setPlayingVoice(null);

        // If clicking same voice, just stop
        if (playingVoice === voiceName) return;
      }

      // Fetch voice sample URL from API
      const voiceResponse = await fetch(`${env.CORE_API_URL}/api/voices/${voiceName}`);
      const voiceData = await voiceResponse.json();
      if (!voiceData.success || !voiceData.voice?.sampleUrl) {
        throw new Error('Voice sample not found');
      }
      const url = voiceData.voice.sampleUrl;
      console.log(`▶️ Playing sample for ${voiceName}: ${url}`);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingVoice(voiceName);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoice(null);
        }
      });
    } catch (error) {
      console.error('Failed to play sample:', error);
      Alert.alert('Audio Error', 'Could not play voice sample.');
      setPlayingVoice(null);
    }
  };

  const startJobAndNavigate = async (opts: { productType: string; title: string; systems: string[]; voiceIdOverride?: string; relationshipContext?: string; personalContext?: string }) => {
    if (isLoading) return; // Prevent double-clicks
    setIsLoading(true);

    // Debug: Log data sources for person1
    console.log('🔍 SystemSelection: Data sources for job creation:', {
      profileStoreUser: profileStoreUser ? { name: profileStoreUser.name, hasBirthData: !!profileStoreUser.birthData } : null,
      onboardingBirthDate,
      onboardingBirthTime,
      meName,
      meBirthDate,
      meBirthTime,
      meCity: meCity ? { timezone: (meCity as any)?.timezone, lat: (meCity as any)?.latitude } : null,
    });

    const { productType, systems: systemsToGenerate, voiceIdOverride, relationshipContext: contextOverride, personalContext: personalContextOverride } = opts;
    const isOverlayFlow = isOverlay;

    // Person 1 data (supports overrides for "two other people" overlays)
    // Updated Logic: Priority 1: Override, Priority 2: targetPerson (from personId), Priority 3: Partner params, Priority 4: User
    // CRITICAL: Always include unique person ID for matching (not just name!)
    const person1 = person1Override
      ? { ...person1Override, id: person1Override.id || targetPerson?.id || profileStoreUser?.id }
      : targetPerson
        ? {
          id: targetPerson.id, // CRITICAL: Include person ID
          name: targetPerson.name,
          birthDate: targetPerson.birthData?.birthDate,
          birthTime: targetPerson.birthData?.birthTime,
          timezone: targetPerson.birthData?.timezone,
          latitude: targetPerson.birthData?.latitude,
          longitude: targetPerson.birthData?.longitude,
          placements: targetPerson.placements, // Pass cached placements!
        }
        : forPartner
          ? {
            id: partnerId || personId, // CRITICAL: Include person ID
            name: partnerName || userName || 'Partner',
            birthDate: partnerBirthDate,
            birthTime: partnerBirthTime,
            timezone: (partnerBirthCity as any)?.timezone,
            latitude: (partnerBirthCity as any)?.latitude,
            longitude: (partnerBirthCity as any)?.longitude,
          }
          : {
            id: profileStoreUser?.id, // CRITICAL: Include person ID
            name: meName,
            birthDate: meBirthDate,
            birthTime: meBirthTime,
            timezone: (meCity as any)?.timezone,
            latitude: (meCity as any)?.latitude,
            longitude: (meCity as any)?.longitude,
            placements: profileStoreUser?.placements, // Pass cached placements from profileStore!
          };

    // Person 2 data (overlay only)
    const person2 = isOverlayFlow
      ? (person2Override
        ? { ...person2Override, id: person2Override.id || partnerId || personId }
        : {
          id: partnerId || personId, // CRITICAL: Include person ID
          name: partnerName || 'Partner',
          birthDate: partnerBirthDate,
          birthTime: partnerBirthTime,
          timezone: (partnerBirthCity as any)?.timezone,
          latitude: (partnerBirthCity as any)?.latitude,
          longitude: (partnerBirthCity as any)?.longitude,
        })
      : undefined;

    // Determine backend job type
    let jobType: 'extended' | 'synastry' | 'nuclear_v2' = 'extended';
    if (productType === 'nuclear_package') jobType = 'nuclear_v2';
    else if (isOverlayFlow) jobType = 'synastry';

    // Get user ID for queue ownership
    let xUserId = '00000000-0000-0000-0000-000000000001';
    if (isSupabaseConfigured) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) xUserId = session.user.id;
      } catch {
        // ignore
      }
    }

    const payload: any = {
      type: jobType,
      systems: systemsToGenerate,
      style: 'production',
      person1,
      relationshipIntensity,
      voiceId: voiceIdOverride || selectedVoice, // Use override if passed
      // Note: audioUrl is no longer needed - backend will fetch it based on voiceId
      // audioUrl: Will be fetched by backend based on voiceId
    };
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SystemSelectionScreen.tsx:320',message:'Job payload created',data:{person1Id:person1?.id,person1Name:person1?.name,person2Id:person2?.id,person2Name:person2?.name,jobType,systems:systemsToGenerate,systemsCount:systemsToGenerate.length,voiceId:payload.voiceId,audioUrl:payload.audioUrl?.substring(0,80)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'JOBCREATE'})}).catch(()=>{});
    // #endregion
    if (isOverlayFlow) {
      payload.person2 = person2;
      if (contextOverride || relationshipContext) {
        payload.relationshipContext = contextOverride || relationshipContext; // Add context for overlays
      }
    } else {
      // For individual readings, add personalContext if provided
      if (personalContextOverride || personalContext) {
        payload.personalContext = personalContextOverride || personalContext;
      }
    }

    // Log if we're sending cached placements (skip Swiss Eph calculation!)
    if (person1.placements) {
      console.log(`✅ Person1 (${person1.name}): Using cached placements ☉${person1.placements.sunSign} ☽${person1.placements.moonSign} ↑${person1.placements.risingSign}`);
    }
    if (person2?.placements) {
      console.log(`✅ Person2 (${person2.name}): Using cached placements ☉${person2.placements.sunSign} ☽${person2.placements.moonSign} ↑${person2.placements.risingSign}`);
    }

    try {
      const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': xUserId,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to start job (${res.status})`);
      }
      const data = await res.json();
      const newJobId = data?.jobId;
      if (!newJobId) throw new Error('No jobId returned from backend');

      // IMPORTANT: Always show a verifiable "receipt" (jobId) while generating.
      // This prevents "we did it / we didn't" confusion later — jobId is the source of truth.
      navigation.replace('GeneratingReading', {
        jobId: newJobId,
        productType,
        productName: opts.title,
        personName: person1.name,
        partnerName: person2?.name,
        systems: systemsToGenerate,
        readingType: isOverlayFlow ? 'overlay' : 'individual',
        // readingType: isOverlayFlow ? 'overlay' : 'individual', // Duplicate removed
        forPartner: forPartner || isForTarget,
      });
    } catch (e: any) {
      setIsLoading(false);
      Alert.alert('Could not start job', e?.message || 'Unknown error');
    }
  };

  const handleSelectSystem = (systemId: string) => {
    // Navigate to system explainer screen (slider overview)
    navigation.navigate('SystemExplainer', {
      system: systemId as any,
      forPurchase: true,
      readingType: isOverlay ? 'overlay' : 'individual',
      forPartner: false,
      partnerName: partnerName,
      partnerBirthDate: partnerBirthDate,
      partnerBirthTime: partnerBirthTime,
      partnerBirthCity: partnerBirthCity,
      // Pass through person overrides for SystemExplainer → RelationshipContext → SystemSelection flow
      person1Override,
      person2Override,
      userName,
    } as any);
  };

  const handleSelectBundle = () => {
    // For OVERLAY/COMPATIBILITY → ReadingOverview (nuclear package)
    // For INDIVIDUAL → SystemsOverview
    if (isOverlay) {
      navigation.navigate('ReadingOverview', {
        personId,
        personName: partnerName,
        forPartner: true,
        readingType: 'overlay',
      });
    } else {
      navigation.navigate('SystemsOverview', {
        personId,
        forPartner,
        targetPersonName: partnerName,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenId}>{screenId}</Text>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.controlRoomText}>My Secret Life</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {isOverlay ? 'Compatibility analysis' : 'Choose a system for deep insights'}
        </Text>

        {SYSTEMS.map((system) => (
          <TouchableOpacity
            key={system.id}
            style={[styles.systemCard, isLoading && styles.disabledCard]}
            onPress={() => handleSelectSystem(system.id)}
            disabled={isLoading}
          >
            <Text style={styles.systemIcon}>{system.icon}</Text>
            <View style={styles.systemTextContainer}>
              <Text style={styles.systemName}>{system.name}</Text>
              <Text style={styles.systemMeta}>
                {singleProduct.pagesMax} pages · {formatAudioDuration(singleProduct.audioMinutes)} audio
              </Text>
            </View>
            <Text style={styles.systemPrice}>${singlePrice}</Text>
          </TouchableOpacity>
        ))}

        {/* Best Choice - Bundle (at bottom) */}
        <Pressable
          style={({ pressed }) => [
            styles.bestChoiceCard,
            pressed && !isLoading && { opacity: 0.7 },
            isLoading && styles.disabledCard
          ]}
          onPress={handleSelectBundle}
          disabled={isLoading}
        >
          <View style={styles.bestChoiceLeft}>
            <View style={styles.bestChoiceBadge}>
              <Text style={styles.bestChoiceBadgeText}>★ BEST CHOICE</Text>
            </View>
            <Text style={styles.bestChoiceTitle}>All 5 Systems</Text>
            <Text style={styles.bestChoiceDescription}>
              {bundleProduct.pagesMax} pages · {formatAudioDuration(bundleProduct.audioMinutes)} audio
            </Text>
          </View>
          <View style={styles.bestChoiceRight}>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <Text style={styles.bestChoicePrice}>${bundlePrice}</Text>
                <Text style={styles.savingsText}>Save ${bundleSavings}</Text>
              </>
            )}
          </View>
        </Pressable>
      </ScrollView>

      <VoiceSelectionModal
        visible={showVoiceModal}
        onCancel={() => setShowVoiceModal(false)}
        onConfirm={(voiceId) => {
          setShowVoiceModal(false);
          setSelectedVoice(voiceId as any);
          if (pendingJob) {
            startJobAndNavigate({
              ...pendingJob,
              voiceIdOverride: voiceId
            });
          }
        }}
      />
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
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  controlRoomText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  // Voice Section
  voiceSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
  },
  voiceList: {
    paddingRight: spacing.page,
  },
  voiceCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  selectedVoiceCard: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  voiceName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginRight: 4,
  },
  selectedVoiceText: {
    color: colors.primary,
  },
  checkmark: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  playButton: {
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playingButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  playButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  playingButtonText: {
    color: colors.background,
  },

  // Best Choice Card
  bestChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  bestChoiceLeft: {
    flex: 1,
  },
  bestChoiceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  bestChoiceBadgeText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 1,
  },
  bestChoiceTitle: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.background,
  },
  bestChoiceDescription: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  bestChoiceRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  bestChoicePrice: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.background,
  },
  savingsText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.background,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 4,
  },

  orText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginVertical: spacing.md,
  },

  // System Cards
  systemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  systemIcon: {
    fontSize: 28,
    marginRight: spacing.md,
    width: 40,
    textAlign: 'center',
  },
  systemTextContainer: {
    flex: 1,
  },
  systemName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  systemMeta: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  systemPrice: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: colors.text,
  },
  disabledCard: {
    opacity: 0.5,
  },
});
