/**
 * SYNASTRY PREVIEW SCREEN - 2 SWIPEABLE PAGES
 * 
 * Page 1: Score + You & Partner comparison
 * Page 2: Basic Overlay insights (3 cards)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Animated, 
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore, type Person } from '@/store/profileStore';
import { env } from '@/config/env';
import { BackButton } from '@/components/BackButton';
import { Video, ResizeMode } from 'expo-av';

type Props = NativeStackScreenProps<MainStackParamList, 'SynastryPreview'>;

const { width: PAGE_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_HEIGHT < 700;
const fontScale = isSmallScreen ? 0.9 : 1;

const screenId = '20';

type PageType = 'score' | 'insights' | 'gateway';
const COMPATIBILITY_UNAVAILABLE_MESSAGE = 'Compatibility unavailable. Retry or edit birth data.';

const toHookReadingRecord = (hookReadings: Person['hookReadings']) => {
  if (!hookReadings) return null;
  if (!Array.isArray(hookReadings) && typeof hookReadings === 'object') return hookReadings as any;

  if (Array.isArray(hookReadings)) {
    const record: Record<'sun' | 'moon' | 'rising', any> = {
      sun: null,
      moon: null,
      rising: null,
    };
    for (const reading of hookReadings as any[]) {
      const type: unknown = reading?.type;
      if (type === 'sun' || type === 'moon' || type === 'rising') {
        record[type] = reading;
      }
    }
    return record;
  }

  return null;
};

const getSignFromPerson = (person: Person | undefined, type: 'sun' | 'moon' | 'rising'): string | null => {
  if (!person) return null;
  const hookRecord = toHookReadingRecord(person.hookReadings);
  if (hookRecord?.[type]?.sign) return hookRecord[type].sign;

  if (type === 'sun') return person.placements?.sunSign || null;
  if (type === 'moon') return person.placements?.moonSign || null;
  return person.placements?.risingSign || null;
};

export const SynastryPreviewScreen = ({ navigation, route }: Props) => {
  console.log(`📱 Screen ${screenId}: SynastryPreviewScreen`);
  const { partnerName, partnerBirthDate, partnerBirthTime, partnerBirthCity } = route.params || {};
  const partnerIdFromRoute = (route.params as any)?.partnerId as string | undefined;
  const onboardingNext = (route.params as any)?.onboardingNext as string | undefined;
  const hookReadings = useOnboardingStore((state: any) => state.hookReadings);
  const userBirthDate = useOnboardingStore((state: any) => state.birthDate);
  const userBirthTime = useOnboardingStore((state: any) => state.birthTime);
  const userBirthCity = useOnboardingStore((state: any) => state.birthCity);
  const relationshipPreferenceScale = useOnboardingStore((state: any) => state.relationshipPreferenceScale) ?? 5;
  const authUser = useAuthStore((s: any) => s.user);
  const markFreeOverlayUsed = useAuthStore((s: any) => s.markFreeOverlayUsed);
  const people = useProfileStore((s) => s.people);
  const profileUser = useProfileStore((s) => s.getUser());
  const addCompatibilityReading = useProfileStore((s) => s.addCompatibilityReading);
  const getCompatibilityReadings = useProfileStore((s) => s.getCompatibilityReadings);
  
  const userName = 'You';
  const partner = partnerName || 'Them';
  
  const [page, setPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Scores are nullable: if missing inputs or API fails, show "—" (never fake numbers).
  const [spicyScore, setSpicyScore] = useState<number | null>(null);
  const [safeStableScore, setSafeStableScore] = useState<number | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [loadingScores, setLoadingScores] = useState(true);
  const listRef = useRef<FlatList>(null);

  const partnerPerson = useMemo(() => {
    if (partnerIdFromRoute) {
      return people.find((p) => p.id === partnerIdFromRoute);
    }
    const normalized = partner.trim().toLowerCase();
    if (!normalized) return undefined;
    return people.find((p) => !p.isUser && p.name.trim().toLowerCase() === normalized);
  }, [partner, partnerIdFromRoute, people]);

  const resolvedUserCompatibilityId = profileUser?.id || 'self';
  const resolvedPartnerCompatibilityId =
    (partnerIdFromRoute && partnerIdFromRoute.trim()) ||
    partnerPerson?.id ||
    `partner:${partner.trim().toLowerCase().replace(/\s+/g, '-') || 'unknown'}`;
  
  // Get user's signs from store
  const userSigns = {
    sun: hookReadings.sun?.sign || getSignFromPerson(profileUser, 'sun'),
    moon: hookReadings.moon?.sign || getSignFromPerson(profileUser, 'moon'),
    rising: hookReadings.rising?.sign || getSignFromPerson(profileUser, 'rising'),
  };
  
  // Partner signs must come from real stored data (no placeholders).
  const partnerSigns = {
    sun: getSignFromPerson(partnerPerson, 'sun'),
    moon: getSignFromPerson(partnerPerson, 'moon'),
    rising: getSignFromPerson(partnerPerson, 'rising'),
  };
  
  // Calculate real compatibility scores from backend

  useEffect(() => {
    const calculateScores = async () => {
      setScoreError(null);

      // We require birth date + city for both, and birth time for both (rising sign + houses).
      if (!userBirthDate || !userBirthCity || !partnerBirthDate || !partnerBirthCity) {
        console.log('❌ Missing birth date/city for compatibility calculation');
        setScoreError(COMPATIBILITY_UNAVAILABLE_MESSAGE);
        setLoadingScores(false);
        setSpicyScore(null);
        setSafeStableScore(null);
        return;
      }

      if (!userBirthTime || !partnerBirthTime) {
        console.log('❌ Missing birth time for compatibility calculation');
        setScoreError(COMPATIBILITY_UNAVAILABLE_MESSAGE);
        setLoadingScores(false);
        setSpicyScore(null);
        setSafeStableScore(null);
        return;
      }
      
      try {
        setLoadingScores(true);
        const response = await fetch(`${env.CORE_API_URL}/api/compatibility/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person1: {
              name: userName,
              birthDate: userBirthDate,
              birthTime: userBirthTime,
              timezone: userBirthCity.timezone,
              latitude: userBirthCity.latitude,
              longitude: userBirthCity.longitude,
            },
            person2: {
              name: partner,
              birthDate: partnerBirthDate,
              birthTime: partnerBirthTime,
              timezone: partnerBirthCity.timezone,
              latitude: partnerBirthCity.latitude,
              longitude: partnerBirthCity.longitude,
            },
            relationshipPreferenceScale,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          // Use actual API values - only fallback if truly missing
          if (typeof data.spicyScore === 'number' && typeof data.safeStableScore === 'number') {
            const normalizedSpicy = Number(data.spicyScore.toFixed(1));
            const normalizedSafeStable = Number(data.safeStableScore.toFixed(1));
            setSpicyScore(normalizedSpicy);
            setSafeStableScore(normalizedSafeStable);
            console.log('✅ Compatibility scores calculated:', { spicy: normalizedSpicy, safe: normalizedSafeStable });
            setScoreError(null);

            // Persist preview scores locally before payment/account creation.
            const existingForPair = getCompatibilityReadings(
              resolvedUserCompatibilityId,
              resolvedPartnerCompatibilityId
            );
            const alreadyStored = existingForPair.some(
              (reading) =>
                reading.system === 'western' &&
                Math.abs(reading.spicyScore - normalizedSpicy) < 0.05 &&
                Math.abs(reading.safeStableScore - normalizedSafeStable) < 0.05
            );

            if (!alreadyStored) {
              addCompatibilityReading({
                person1Id: resolvedUserCompatibilityId,
                person2Id: resolvedPartnerCompatibilityId,
                system: 'western',
                content: `Compatibility preview between ${userName} and ${partner}.`,
                spicyScore: normalizedSpicy,
                safeStableScore: normalizedSafeStable,
                conclusion: `Preview scores: spicy ${normalizedSpicy}/10, safe & stable ${normalizedSafeStable}/10. Preference lens ${relationshipPreferenceScale}/10.`,
                generatedAt: new Date().toISOString(),
                source: 'gpt',
              });
            }

            // Mark the free overlay as used only after a successful calculation (so no accidental charges).
            // Pre-payment onboarding has no auth user, so we skip.
            if (authUser?.id) markFreeOverlayUsed(authUser.id);
          } else {
            console.error('❌ Invalid score format from API:', data);
            // If API returns error object, log it but don't set scores (keep at 0)
            if (data.error) {
              console.error('❌ API error:', data.error);
            }
            setSpicyScore(null);
            setSafeStableScore(null);
            setScoreError(COMPATIBILITY_UNAVAILABLE_MESSAGE);
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Failed to calculate scores:', response.status, errorText);
          setSpicyScore(null);
          setSafeStableScore(null);
          setScoreError(COMPATIBILITY_UNAVAILABLE_MESSAGE);
        }
      } catch (error) {
        console.error('❌ Error calculating compatibility:', error);
        setSpicyScore(null);
        setSafeStableScore(null);
        setScoreError(COMPATIBILITY_UNAVAILABLE_MESSAGE);
      } finally {
        setLoadingScores(false);
      }
    };
    
    calculateScores();
  }, [
    addCompatibilityReading,
    authUser?.id,
    getCompatibilityReadings,
    markFreeOverlayUsed,
    partner,
    partnerBirthCity,
    partnerBirthDate,
    partnerBirthTime,
    resolvedPartnerCompatibilityId,
    resolvedUserCompatibilityId,
    relationshipPreferenceScale,
    userBirthCity,
    userBirthDate,
    userBirthTime,
    userName,
  ]);

  const canContinue = !loadingScores && spicyScore != null && safeStableScore != null;
  const displaySign = (value: string | null | undefined) => value || 'Unknown';
  
  // Reset transition state when screen regains focus (prevents loop when coming back)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isTransitioning) {
        setIsTransitioning(false);
        // Scroll back to page 1 (insights) when returning
        listRef.current?.scrollToIndex({ index: 1, animated: false });
        setPage(1);
      }
    });
    return unsubscribe;
  }, [navigation, isTransitioning]);
  
  // Animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  
  // Basic insights
  const insights = [
    {
      title: 'Sun-Moon Connection',
      content: `Your ${displaySign(userSigns.sun)} Sun meets ${partner}'s ${displaySign(partnerSigns.moon)} Moon. This creates a dynamic where your core identity resonates with ${partner}'s emotional nature. You see the world through logic and service, while ${partner} feels it through nurturing intuition.`,
    },
    {
      title: 'Rising Sign Chemistry',
      content: `Your ${displaySign(userSigns.rising)} Rising meets ${partner}'s ${displaySign(partnerSigns.rising)} Rising. First impressions matter - you appear adventurous and philosophical, while ${partner} projects mystery and intensity. This creates magnetic attraction or curious tension.`,
    },
    {
      title: 'Element Balance',
      content: `Your chart emphasizes Earth and Fire, while ${partner}'s flows with Water and Water. This creates a complementary dynamic - you ground ${partner}'s emotions, ${partner} deepens your feelings.`,
    },
  ];
  
  // 3 pages: Score, Insights, Gateway (to continue to dashboard)
  const pages: PageType[] = ['score', 'insights', 'gateway'];
  const isGoingBack = useRef(false);
  const scrollStartX = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const index = Math.round(contentOffset.x / layoutMeasurement.width);
    setPage(index);
    
    // Detect swipe-left on first page to go back (threshold: -50px)
    if (page === 0 && contentOffset.x < -50 && !isGoingBack.current) {
      isGoingBack.current = true;
      console.log('← Swiping back');
      navigation.goBack();
    }
  };
  
  // Track scroll start position
  const handleScrollBeginDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollStartX.current = event.nativeEvent.contentOffset.x;
  };
  
  const renderPage = (pageType: PageType) => {
    switch (pageType) {
      case 'score':
        return (
          <View style={styles.page}>
            <Animated.View style={[styles.pageContent, { opacity: fadeIn }]}>
              {/* Header */}
              <Text style={styles.title} selectable>
                {userName} & {partner}
              </Text>
              <Text style={styles.subtitle}>
                BASIC COMPATIBILITY OVERVIEW
              </Text>
              
              {/* Dual Score */}
              <View style={styles.scoreSection}>
                <Text style={styles.scoreLabel}>DUAL COMPATIBILITY</Text>
                
                {/* Two scores side-by-side, equal weight */}
                {loadingScores ? (
                  <View style={{ paddingVertical: spacing.xl }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.scoreHint, { marginTop: spacing.sm }]}>Calculating compatibility...</Text>
                  </View>
                ) : (
                  <View style={styles.dualScoresRow}>
                    <View style={styles.scoreColumn}>
                      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <Text style={styles.scoreNumberSmall}>{spicyScore == null ? '—' : spicyScore.toFixed(1)}</Text>
                      </Animated.View>
                      <Text style={styles.scoreColumnLabel}>Spicy /10</Text>
                    </View>
                    
                    <View style={styles.scoreColumn}>
                      <Text style={styles.scoreNumberSmall}>{safeStableScore == null ? '—' : safeStableScore.toFixed(1)}</Text>
                      <Text style={styles.scoreColumnLabel}>Safe & Stable /10</Text>
                    </View>
                  </View>
                )}
                
                <Text style={styles.scoreHint}>
                  Based on Sun, Moon & Rising alignment
                </Text>
                {!!scoreError && (
                  <Text style={[styles.scoreHint, { marginTop: spacing.sm }]}>
                    {scoreError}
                  </Text>
                )}
              </View>
              
              {/* Connection Visualization - VERTICAL */}
              <View style={styles.connectionViz}>
                {/* Person 1 - You */}
                <View style={styles.personBubble}>
                  <Text style={styles.personName}>{userName}</Text>
                  <View style={styles.signsRow}>
                    <Text style={styles.personSigns}>☉ {displaySign(userSigns.sun)}</Text>
                    <Text style={styles.signDot}>·</Text>
                    <Text style={styles.personSigns}>☽ {displaySign(userSigns.moon)}</Text>
                    <Text style={styles.signDot}>·</Text>
                    <Text style={styles.personSigns}>↑ {displaySign(userSigns.rising)}</Text>
                  </View>
                </View>
                
                {/* Connection: Arrow down, Heart, Arrow up */}
                <View style={styles.connectionVertical}>
                  <Text style={styles.connectionArrow}>↓</Text>
                  <Text style={styles.connectionHeartBig}>♡</Text>
                  <Text style={styles.connectionArrow}>↑</Text>
                </View>
                
                {/* Person 2 - Partner */}
                <View style={styles.personBubble}>
                  <Text style={styles.personName}>{partner}</Text>
                  <View style={styles.signsRow}>
                    <Text style={styles.personSigns}>☉ {displaySign(partnerSigns.sun)}</Text>
                    <Text style={styles.signDot}>·</Text>
                    <Text style={styles.personSigns}>☽ {displaySign(partnerSigns.moon)}</Text>
                    <Text style={styles.signDot}>·</Text>
                    <Text style={styles.personSigns}>↑ {displaySign(partnerSigns.rising)}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>
        );
        
      case 'insights':
        return (
          <View style={styles.page}>
            <ScrollView 
              style={styles.insightsScroll}
              contentContainerStyle={styles.insightsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.insightsTitle}>BASIC OVERLAY</Text>
              
              {insights.map((insight, idx) => (
                <View key={idx} style={styles.insightCard}>
                  <Text style={styles.insightCardTitle} selectable>{insight.title}</Text>
                  <Text style={styles.insightCardContent} selectable>{insight.content}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        );
        
      case 'gateway':
        return (
          <View style={styles.page}>
            <View style={styles.gatewayContainer}>
              {/* Card content */}
              <View style={styles.gatewayCard}>
                <Text style={styles.gatewayTitle} selectable>
                  Want the full picture?
                </Text>
                <Text style={styles.gatewaySubtitle} selectable>
                  Come with us on a journey into the space between you and another.
                </Text>
                
                <TouchableOpacity
                  style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
                  disabled={!canContinue}
                  onPress={() => {
                    if (!canContinue) {
                      Alert.alert('Compatibility unavailable', COMPATIBILITY_UNAVAILABLE_MESSAGE);
                      return;
                    }
                    if (onboardingNext) {
                      navigation.navigate(onboardingNext as any);
                      return;
                    }
                    navigation.navigate('SynastryOptions' as any, {
                      partnerName: partner,
                      partnerBirthDate,
                      partnerBirthTime,
                      partnerBirthCity,
                      partnerId: partnerIdFromRoute,
                    });
                  }}
                >
                  <Text style={styles.continueBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Fullscreen background video - only visible on gateway page */}
      {page === 2 && (
        <Video
          source={require('@/../assets/videos/want_the_full_picture.mp4')}
          style={styles.gatewayBgVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          rate={0.9}
        />
      )}
      
      <BackButton onPress={() => navigation.goBack()} />
      
      {/* Swipeable Pages */}
      <FlatList
        data={pages}
        keyExtractor={(item) => item}
        pagingEnabled
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={listRef}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        renderItem={({ item }) => renderPage(item)}
      />
      
      {/* Pagination */}
      <View style={styles.pagination}>
        {pages.map((_, index) => (
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
  },
  backButton: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  
  // Page
  page: {
    width: PAGE_WIDTH,
    flex: 1,
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl, // More space below BackButton
    alignItems: 'center',
  },
  
  // Page 1: Score
  title: {
    fontFamily: typography.headline,
    fontSize: 32 * fontScale,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14 * fontScale,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
  scoreSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  scoreLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12 * fontScale,
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  dualScoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  scoreColumn: {
    alignItems: 'center',
    minWidth: 140,
  },
  scoreNumberSmall: {
    fontFamily: typography.headline,
    fontSize: 48 * fontScale,
    color: colors.text,
    lineHeight: 52 * fontScale,
  },
  scoreColumnLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 14 * fontScale,
    color: colors.mutedText,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  scoreNumber: {
    fontFamily: typography.headline,
    fontSize: 72 * fontScale,
    color: colors.text,
    lineHeight: 80 * fontScale,
  },
  scoreMax: {
    fontFamily: typography.sansRegular,
    fontSize: 16 * fontScale,
    color: colors.mutedText,
    marginTop: -spacing.xs,
  },
  scoreHint: {
    fontFamily: typography.sansRegular,
    fontSize: 13 * fontScale,
    color: colors.mutedText,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  connectionViz: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  personBubble: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    minWidth: 180,
  },
  personName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 22 * fontScale,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  signsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  personSigns: {
    fontFamily: typography.sansRegular,
    fontSize: 13 * fontScale,
    color: colors.mutedText,
  },
  signDot: {
    fontFamily: typography.sansRegular,
    fontSize: 13 * fontScale,
    color: colors.mutedText,
    marginHorizontal: 4,
  },
  connectionVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  connectionArrow: {
    fontSize: 28,
    color: colors.primary,
    lineHeight: 28,
    marginVertical: -4,
  },
  connectionHeartBig: {
    fontSize: 48,
    color: colors.primary,
    lineHeight: 50,
  },
  
  // Page 2: Insights
  insightsScroll: {
    flex: 1,
  },
  insightsScrollContent: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl, // Match first page
    paddingBottom: spacing.xl,
  },
  insightsTitle: {
    fontFamily: typography.headline, // Headline font
    fontSize: 28 * fontScale, // Bigger
    color: colors.text, // Black text
    textAlign: 'center', // Centered
    marginBottom: spacing.xl, // More space below
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  insightCardTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16 * fontScale,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  insightCardContent: {
    fontFamily: typography.sansRegular,
    fontSize: 14 * fontScale,
    color: colors.text,
    lineHeight: 21 * fontScale,
  },
  
  // Page 3: Gateway
  gatewayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  gatewayBgVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  gatewayCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255,255,255,0.82)', // off-white card (not full white)
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gatewayTitle: {
    fontFamily: typography.headline,
    fontSize: 28 * fontScale,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 36 * fontScale,
    marginBottom: spacing.md,
  },
  gatewaySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16 * fontScale,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 24 * fontScale,
    marginBottom: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: 30,
    marginBottom: spacing.md,
    minWidth: 250,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: '#fff',
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  secondaryBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
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
});
