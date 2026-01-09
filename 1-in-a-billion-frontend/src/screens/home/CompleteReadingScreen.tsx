/**
 * COMPLETE READING SCREEN
 * 
 * The ultimate reading experience - all 5 systems analyzed together.
 * 
 * Flow:
 * 1. Explainer page - why 5 systems together is powerful
 * 2. Buy button (DEV: bypasses Apple Pay)
 * 3. Epic ARTS loading animation with all 5 symbols
 * 4. Navigate to first reading (Western)
 */

import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { Button } from '@/components/Button';
import { COMPLETE_READING, PRODUCT_STRINGS, formatAudioDuration } from '@/config/products';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';

type Props = NativeStackScreenProps<MainStackParamList, 'CompleteReading'>;

const { width } = Dimensions.get('window');

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    THE FIVE LENSES OF TRUTH                              ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Each system sees a different facet of who you are.                      ║
 * ║  Together, they reveal the complete picture.                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
const SYSTEMS = [
  {
    symbol: '☉',
    name: 'Western',
    color: '#D4A000',
    insight: 'Your psychology',
  },
  {
    symbol: 'ॐ',
    name: 'Vedic',
    color: '#E85D04',
    insight: 'Your karma',
  },
  {
    symbol: '◬',
    name: 'Human Design',
    color: '#9D4EDD',
    insight: 'Your strategy',
  },
  {
    symbol: '❋',
    name: 'Gene Keys',
    color: '#059669',
    insight: 'Your gifts',
  },
  {
    symbol: '✧',
    name: 'Kabbalah',
    color: '#7C3AED',
    insight: 'Your tikkun',
  },
];

// Cycling messages for loading state
const LOADING_MESSAGES = [
  'GENERATING',
  'THIS WILL TAKE A WHILE',
  'GENERATING',
  'YOU CAN LEAVE THE APP MEANWHILE',
];

export const CompleteReadingScreen = ({ navigation, route }: Props) => {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CompleteReadingScreen.tsx:mount',message:'Screen mounted',data:{routeParams:route.params},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'MOUNT'})}).catch(()=>{});
  }, []);
  // #endregion
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Animation refs for all 5 symbols
  const westernSpin = useRef(new Animated.Value(0)).current;
  const vedicPulse = useRef(new Animated.Value(0.5)).current;
  const hdScale = useRef(new Animated.Value(1)).current;
  const geneBloom = useRef(new Animated.Value(0.7)).current;
  const kabbDescend = useRef(new Animated.Value(-15)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;

  // Start epic multi-system animation
  useEffect(() => {
    if (isGenerating) {
      // Fade in
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }).start();

      // Status text pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
          Animated.timing(statusPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // ☉ WESTERN: Slow majestic spin (Sun through zodiac)
      Animated.loop(
        Animated.timing(westernSpin, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // ॐ VEDIC: Pulse like a mantra breath
      Animated.loop(
        Animated.sequence([
          Animated.timing(vedicPulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(vedicPulse, { toValue: 0.5, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      // ◬ HUMAN DESIGN: Heartbeat pulse (Sacral response)
      Animated.loop(
        Animated.sequence([
          Animated.timing(hdScale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
          Animated.timing(hdScale, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(hdScale, { toValue: 1.1, duration: 120, useNativeDriver: true }),
          Animated.timing(hdScale, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.delay(700),
        ])
      ).start();

      // ❋ GENE KEYS: Bloom like a flower opening
      Animated.loop(
        Animated.sequence([
          Animated.timing(geneBloom, { toValue: 1.3, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(geneBloom, { toValue: 0.7, duration: 1500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      // ✧ KABBALAH: Light descending/ascending the Tree
      Animated.loop(
        Animated.sequence([
          Animated.timing(kabbDescend, { toValue: 15, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(300),
          Animated.timing(kabbDescend, { toValue: -15, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(300),
        ])
      ).start();

      // Cycle through systems every 3 seconds for the status text
      const systemInterval = setInterval(() => {
        setCurrentSystemIndex(prev => (prev + 1) % SYSTEMS.length);
      }, 3000);

      // Cycle through loading messages every 2.5 seconds
      const messageInterval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);

      return () => {
        clearInterval(systemInterval);
        clearInterval(messageInterval);
      };
    }
  }, [isGenerating]);

  // Data Stores
  const {
    name, birthDate, birthTime, birthCity,
    relationshipIntensity, relationshipMode
  } = useOnboardingStore();
  const user = useProfileStore(state => state.people.find(p => p.isUser));
  const authDisplayName = useAuthStore((s) => s.displayName);

  // Params from navigation (if buying for a partner)
  const { partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } = route.params || {};
  const isForPartner = !!partnerName;

  const handleBuy = async () => {
    try {
      setIsGenerating(true);

      // 1. Get User ID
      let userId = user?.id || '00000000-0000-0000-0000-000000000001';
      let accessToken: string | undefined;

      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) userId = session.user.id;
        accessToken = session?.access_token;
      }

      // 2. Construct Person Data
      // If for partner, use params. If for self, use OnboardingStore/ProfileStore.
      // CRITICAL: Always include unique person ID
      const personData = isForPartner ? {
        id: user?.id, // CRITICAL: Include person ID
        name: partnerName,
        birthDate: partnerBirthDate,
        birthTime: partnerBirthTime,
        birthPlace: partnerBirthCity?.name,
        latitude: partnerBirthCity?.latitude,
        longitude: partnerBirthCity?.longitude,
        timezone: partnerBirthCity?.timezone,
      } : {
        id: user?.id, // CRITICAL: Include person ID
        name: name || user?.name || authDisplayName || 'You',
        birthDate: birthDate || user?.birthData?.birthDate,
        birthTime: birthTime || user?.birthData?.birthTime,
        birthPlace: birthCity?.name || user?.birthData?.birthCity,
        latitude: birthCity?.latitude || user?.birthData?.latitude,
        longitude: birthCity?.longitude || user?.birthData?.longitude,
        timezone: birthCity?.timezone || user?.birthData?.timezone,
      };

      // 3. Construct Payload for "Complete Reading" (5 systems, extended job)
      const payload = {
        type: 'extended', // Supports multi-system
        systems: ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'],
        style: 'production',
        person1: personData,
        relationshipIntensity: relationshipIntensity || 50,
        voiceId: 'david', // Default narrator
        // Optional: audioUrl if custom voice
      };

      // 4. Call API
      const { env } = require('@/config/env');
      const res = await fetch(`${env.CORE_API_URL}/api/jobs/v2/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Failed to start job (${res.status})`);
      }

      const data = await res.json();
      if (!data.jobId) throw new Error('No jobId returned');

      // 5. Navigate to Progress Screen
      setIsGenerating(false); // Stop local spinner before navigating
      navigation.replace('GeneratingReading', {
        jobId: data.jobId,
        productType: 'complete_reading',
        productName: 'Complete Reading',
        personName: personData.name,
        readingType: 'individual',
        systems: payload.systems,
        forPartner: isForPartner,
      });

    } catch (e: any) {
      console.error('Failed to start complete reading:', e);
      setIsGenerating(false);
      // Show error alert?
      // Alert.alert('Error', 'Could not start generation. Please try again.');
    }
  };

  // LOADING STATE - Epic multi-symbol animation
  if (isGenerating) {
    const currentSystem = SYSTEMS[currentSystemIndex];

    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.loadingContainer, { opacity: fadeIn }]}>
          {/* Header */}
          <Text style={styles.loadingTitle}>Weaving Your Truth</Text>
          <Text style={styles.loadingSubtitle}>Five ancient lenses, one complete picture</Text>

          {/* The Epic 5-Symbol Circle */}
          <View style={styles.symbolCircle}>
            {/* Western - Top */}
            <Animated.Text
              style={[
                styles.circleSymbol,
                styles.symbolWestern,
                {
                  color: SYSTEMS[0].color,
                  transform: [{
                    rotate: westernSpin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    })
                  }]
                }
              ]}
            >
              ☉
            </Animated.Text>

            {/* Vedic - Top Right */}
            <Animated.Text
              style={[
                styles.circleSymbol,
                styles.symbolVedic,
                {
                  color: SYSTEMS[1].color,
                  opacity: vedicPulse,
                }
              ]}
            >
              ॐ
            </Animated.Text>

            {/* Human Design - Bottom Right */}
            <Animated.Text
              style={[
                styles.circleSymbol,
                styles.symbolHD,
                {
                  color: SYSTEMS[2].color,
                  transform: [{ scale: hdScale }]
                }
              ]}
            >
              ◬
            </Animated.Text>

            {/* Gene Keys - Bottom Left */}
            <Animated.Text
              style={[
                styles.circleSymbol,
                styles.symbolGene,
                {
                  color: SYSTEMS[3].color,
                  transform: [{ scale: geneBloom }]
                }
              ]}
            >
              ❋
            </Animated.Text>

            {/* Kabbalah - Top Left */}
            <Animated.Text
              style={[
                styles.circleSymbol,
                styles.symbolKabb,
                {
                  color: SYSTEMS[4].color,
                  transform: [{ translateY: kabbDescend }]
                }
              ]}
            >
              ✧
            </Animated.Text>

            {/* Center - Current System Being Analyzed */}
            <View style={styles.centerCircle}>
              <Text style={[styles.centerSymbol, { color: currentSystem.color }]}>
                {currentSystem.symbol}
              </Text>
            </View>
          </View>

          {/* Status - Current System */}
          <Animated.View style={{ transform: [{ scale: statusPulse }] }}>
            <Text style={[styles.statusSystem, { color: currentSystem.color }]}>
              {currentSystem.name}
            </Text>
            <Text style={styles.statusInsight}>
              Analyzing {currentSystem.insight}...
            </Text>
          </Animated.View>

          {/* Cycling Loading Message */}
          <Animated.Text style={[styles.loadingMessage, { transform: [{ scale: statusPulse }] }]}>
            {LOADING_MESSAGES[loadingMessageIndex]}
          </Animated.Text>

          {/* Progress Dots */}
          <View style={styles.progressDots}>
            {SYSTEMS.map((sys, i) => (
              <View
                key={sys.name}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= currentSystemIndex ? sys.color : colors.divider }
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // EXPLAINER STATE - Now with carousel
  const onScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slide !== currentPage) {
      setCurrentPage(slide);
    }
  };

  // -- SLIDE 1: The Power of Synthesis --
  const renderSynthesis = () => (
    <View style={styles.slideContainer}>
      <View style={styles.slideContent}>
        <Text style={styles.slideIcon}>∞</Text>
        <Text style={styles.slideTitle}>The Power of Synthesis</Text>
        <Text style={styles.slideTagline}>Five systems, one truth</Text>

        <Text style={styles.slideBodyParagraph}>
          For thousands of years, different civilizations developed different maps of the soul. Each revealed part of the truth, but none captured it all. Western shows your psychology. Vedic your karma. Human Design your energy. Gene Keys your genius. Kabbalah your correction.
        </Text>

        <Text style={styles.sectionHeader}>WHY IT MATTERS</Text>
        <Text style={styles.slideBodyParagraph}>
          When you see yourself through all five lenses at once, contradictions resolve into clarity. What seems like weakness in one system becomes your greatest strength in another. The complete picture emerges.
        </Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteHeader}>THE SYNTHESIS</Text>
          <Text style={styles.noteText}>
            "This isn't five separate readings. It's one unified story of your soul, woven from ancient wisdom that finally reveals the whole truth."
          </Text>
        </View>
      </View>
    </View>
  );

  // -- SLIDE 2: A Complete Soul Portrait --
  const renderSoulPortrait = () => (
    <View style={styles.slideContainer}>
      <View style={styles.slideContent}>
        <Text style={styles.slideIcon}>✧</Text>
        <Text style={styles.slideTitle}>A Complete Soul Portrait</Text>
        <Text style={styles.slideTagline}>The full dimensionality of who you are</Text>

        <Text style={styles.slideBodyParagraph}>
          Most people try to figure themselves out from a single angle. They get a horoscope, or read about their Human Design. It helps - but it's like seeing a diamond from only one side. You're missing the full brilliance.
        </Text>

        <Text style={styles.sectionHeader}>HOW THIS IS DIFFERENT</Text>
        <Text style={styles.slideBodyParagraph}>
          This reading weaves all five systems into one unified narrative. Where Western sees your ego, Vedic sees your dharma. Where Human Design reveals your mechanics, Gene Keys show your evolution. Where Kabbalah maps your correction, all the others show you how.
        </Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteHeader}>YOUR SOUL, FULLY SEEN</Text>
          <Text style={styles.noteText}>
            "It's not just a reading. It's a mirror for your highest potential. It's a map home to yourself. Every contradiction makes sense. Every gift has a purpose."
          </Text>
        </View>
      </View>
    </View>
  );

  // -- SLIDE 3: The Offer (Purchase Screen) --
  const renderPurchase = () => (
    <View style={styles.slideContainer}>
      <View style={[styles.slideContent, styles.purchaseSlideContent]}>
        {/* Hero Section - Compact */}
        <Text style={styles.heroTitle}>Five Lenses. One Truth.</Text>
        <Text style={styles.heroSubtitle}>
          Each system sees what the others miss
        </Text>

        {/* Systems with insights - icons on left */}
        <View style={styles.systemsList}>
          {SYSTEMS.map((sys) => (
            <View key={sys.name} style={styles.systemRow}>
              <Text style={[styles.systemIcon2, { color: sys.color }]}>{sys.symbol}</Text>
              <View style={styles.systemText}>
                <Text style={styles.systemName}>{sys.name}</Text>
                <Text style={styles.systemInsight}>{sys.insight}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Big Red Button with Price & Info Inside */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.bigRedButton}
            onPress={handleBuy}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonTitle}>Unlock Complete Reading</Text>
            <Text style={styles.buttonDetails}>
              {COMPLETE_READING.pages} page PDF · {COMPLETE_READING.audioMinutes} min Audio
            </Text>
            <Text style={styles.buttonPrice}>{PRODUCT_STRINGS.completeReading.price}</Text>
          </TouchableOpacity>

          <Text style={styles.devNote}>DEV: Skips payment</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {renderSynthesis()}
        {renderSoulPortrait()}
        {renderPurchase()}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentPage === index && styles.activeDot,
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },

  // Hero - Compact, headline & subheadline close together
  heroTitle: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 17,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xs,
    lineHeight: 24,
  },

  // Systems List - Icons on left, text on right - FULL WIDTH
  systemsList: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40, // Fixed height for consistent spacing
    marginBottom: 2,
  },
  systemIcon: {
    fontSize: 24,
    width: 40,
    height: 40,
    lineHeight: 40, // Vertically center the icon
    textAlign: 'center',
  },
  systemIcon2: {
    fontSize: 24,
    width: 40,
    height: 40,
    lineHeight: 40,
    textAlign: 'center',
  },
  systemText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  systemName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 17,
    color: colors.text,
    marginRight: spacing.sm,
  },
  systemInsight: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
  },

  // Stats Row - Inline
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl, // More space before price section
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  statNumber: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
  },
  statLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
  },
  statDot: {
    fontFamily: typography.sansRegular,
    fontSize: 20,
    color: colors.divider,
  },

  // CTA Section
  ctaSection: {
    alignItems: 'center',
  },

  // Big Red Button (replaces old price row + button)
  bigRedButton: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 24,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonTitle: {
    fontFamily: typography.sansBold,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  buttonDetails: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.sm,
  },
  buttonPrice: {
    fontFamily: typography.headline,
    fontSize: 36,
    color: '#FFFFFF',
  },
  devNote: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    textAlign: 'center',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  loadingTitle: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  loadingSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xl * 2,
  },

  // Symbol Circle - 5 symbols arranged in a pentagon
  symbolCircle: {
    width: 250,
    height: 250,
    position: 'relative',
    marginBottom: spacing.xl * 2,
  },
  circleSymbol: {
    position: 'absolute',
    fontSize: 40,
    textAlign: 'center',
  },
  // Positions for pentagon arrangement
  symbolWestern: { // Top
    top: 0,
    left: '50%',
    marginLeft: -20,
  },
  symbolVedic: { // Top Right
    top: 50,
    right: 0,
  },
  symbolHD: { // Bottom Right
    bottom: 30,
    right: 20,
  },
  symbolGene: { // Bottom Left
    bottom: 30,
    left: 20,
  },
  symbolKabb: { // Top Left
    top: 50,
    left: 0,
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSymbol: {
    fontSize: 36,
  },

  // Status
  statusSystem: {
    fontFamily: typography.headline,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  statusInsight: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
  },

  // Progress Dots
  progressDots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadingMessage: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 2,
    marginTop: spacing.xl,
    textAlign: 'center',
  },

  // Carousel Slides
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: width,
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  slideScrollView: {
    flex: 1,
  },
  slideScrollContent: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideIcon: {
    fontSize: 64,
    color: colors.primary,
    marginBottom: spacing.lg,
    opacity: 0.9,
  },
  slideTitle: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  slideTagline: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  slideBody: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'center',
    maxWidth: '90%',
  },
  slideBodyParagraph: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'left',
    marginBottom: spacing.md,
    width: '100%',
  },
  sectionHeader: {
    fontFamily: typography.sansBold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    width: '100%',
  },
  noteBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  noteHeader: {
    fontFamily: typography.sansBold,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  noteText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },

  // Purchase slide needs different alignment
  purchaseSlideContent: {
    alignItems: 'stretch',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.xl,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 24,
  },
});
