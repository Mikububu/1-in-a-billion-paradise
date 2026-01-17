/**
 * GENERATING READING SCREEN
 * 
 * Shows progress while deep readings are being generated.
 * User can close app and check back later.
 */

import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { PRODUCTS } from '@/config/products';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { enableNotificationsForJob } from '@/services/pushNotifications';
import { 
  estimateAudioGenerationTime, 
  calculateRemainingTime, 
  formatCountdown 
} from '@/utils/audioTimeEstimator';

const API_URL = env.CORE_API_URL;

type Props = NativeStackScreenProps<MainStackParamList, 'GeneratingReading'>;

const screenId = '25';

// Intentionally no time estimates. We only show currentStep + receipt (jobId).

export const GeneratingReadingScreen = ({ navigation, route }: Props) => {
  console.log(`📱 Screen ${screenId}: GeneratingReadingScreen`);
  const { productType, productName, personName, partnerName, systems, readingType, forPartner, jobId, personId, partnerId } = route.params || {};
  const [activeJobId, setActiveJobId] = useState<string | null>(jobId || null);

  // Get user data from store

  const store = useOnboardingStore();
  const {
    birthDate: storeBirthDate,
    birthTime: storeBirthTime,
    birthCity,
    relationshipIntensity,
  } = store;

  // User's data
  const userData = {
    name: personName || 'You',
    birthDate: storeBirthDate,
    birthTime: storeBirthTime,
    timezone: birthCity?.timezone,
    latitude: birthCity?.latitude,
    longitude: birthCity?.longitude,
  };

  // Partner data
  const partnerData = {
    name: partnerName,
    birthDate: undefined,
    birthTime: undefined,
    timezone: undefined,
    latitude: undefined,
    longitude: undefined,
  };

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasAskedPermission, setHasAskedPermission] = useState(false);
  const [currentStep, setCurrentStep] = useState('Initializing...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Enhanced progress tracking
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'text' | 'audio'>('text');
  const [currentSystem, setCurrentSystem] = useState('');
  const [systemsCompleted, setSystemsCompleted] = useState(0);
  const [audioChunksTotal, setAudioChunksTotal] = useState(0);
  const [audioChunksCompleted, setAudioChunksCompleted] = useState(0);
  
  // Smart timer state
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [initialEstimate, setInitialEstimate] = useState<number | null>(null);

  // Nuclear V2: 16 document slots
  const [completedDocs, setCompletedDocs] = useState<string[]>([]);
  // Option B: All Person 1 profiles → All Person 2 profiles → All Overlays → Verdict
  const NUCLEAR_DOCS = [
    // Person 1: All 5 systems
    { id: 'western_p1', label: 'W1', system: 'Western' },
    { id: 'vedic_p1', label: 'V1', system: 'Vedic' },
    { id: 'human_design_p1', label: 'H1', system: 'Human Design' },
    { id: 'gene_keys_p1', label: 'G1', system: 'Gene Keys' },
    { id: 'kabbalah_p1', label: 'K1', system: 'Kabbalah' },
    // Person 2: All 5 systems
    { id: 'western_p2', label: 'W2', system: 'Western' },
    { id: 'vedic_p2', label: 'V2', system: 'Vedic' },
    { id: 'human_design_p2', label: 'H2', system: 'Human Design' },
    { id: 'gene_keys_p2', label: 'G2', system: 'Gene Keys' },
    { id: 'kabbalah_p2', label: 'K2', system: 'Kabbalah' },
    // Overlays: All 5 systems
    { id: 'western_overlay', label: 'W✦', system: 'Western' },
    { id: 'vedic_overlay', label: 'V✦', system: 'Vedic' },
    { id: 'human_design_overlay', label: 'H✦', system: 'Human Design' },
    { id: 'gene_keys_overlay', label: 'G✦', system: 'Gene Keys' },
    { id: 'kabbalah_overlay', label: 'K✦', system: 'Kabbalah' },
    // Final Verdict
    { id: 'verdict', label: '⚖️', system: 'VERDICT' },
  ];

  const startTime = useRef(Date.now());
  const totalSystems = (systems || ['western']).length;

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  // Blinking animation for "Generating in background"
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [blinkAnim]);

  // Always treat jobId as the "receipt" for debugging. Store it locally so we can verify later.
  useEffect(() => {
    if (!jobId) return;
    setActiveJobId(jobId);
    (async () => {
      try {
        const key = '@deep_reading_job_receipts';
        const existingRaw = await AsyncStorage.getItem(key);
        const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
        const next = [
          {
            jobId,
            productType,
            productName,
            personName,
            partnerName,
            readingType,
            createdAt: new Date().toISOString(),
          },
          ...existing.filter((r) => r?.jobId && r.jobId !== jobId),
        ].slice(0, 50);
        await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore
      }
    })();
  }, [jobId, partnerName, personName, productName, productType, readingType]);

  // Poll V2 job endpoint by jobId. Never start a legacy job from this screen.
  useEffect(() => {
    let cancelled = false;
    let interval: any;

    const tick = async () => {
      if (!activeJobId) return;
      try {
        setIsGenerating(true);

        const url = `${API_URL}/api/jobs/v2/${activeJobId}`;
        let accessToken: string | undefined;
        if (isSupabaseConfigured) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            accessToken = session?.access_token;
          } catch {
            // ignore
          }
        }

        // Try with auth first (RLS), fall back without.
        let resp = await fetch(url, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (resp.status === 401 || resp.status === 403) {
          resp = await fetch(url);
        }
        if (!resp.ok) {
          const t = await resp.text().catch(() => '');
          throw new Error(t || `Job fetch failed (${resp.status})`);
        }

        const data = await resp.json();
        const job = data?.job;
        if (!job) throw new Error('Invalid job response');

        if (cancelled) return;

        const status = String(job.status || '').toLowerCase();
        const total = job.progress?.totalTasks;
        const done = job.progress?.completedTasks;
        const pctRaw =
          typeof job.progress?.percent === 'number'
            ? job.progress.percent
            : typeof total === 'number' && total > 0
              ? (Number(done || 0) / total) * 100
              : 0;
        const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));
        setProgressPercent(pct);
        setCurrentStep(job.progress?.message || `Status: ${status || 'unknown'}`);

        // Smart timer: Calculate initial estimate on first poll
        if (initialEstimate === null && job.progress?.message) {
          // Estimate based on number of systems/docs being generated
          const systemCount = systems?.length || 1;
          const isNuclear = productType === 'nuclear_package';
          
          // Each system generates ~2000 words of text (takes 3-5 min)
          // Plus audio generation (varies by provider)
          // Nuclear has 16 docs, each ~2000 words
          const estimatedTextMinutes = isNuclear ? 15 : systemCount * 4; // 4 min per system
          const estimatedAudioMinutes = isNuclear ? 20 : systemCount * 3; // 3 min per system
          const totalMinutes = estimatedTextMinutes + estimatedAudioMinutes;
          const totalSeconds = totalMinutes * 60;
          
          setInitialEstimate(totalSeconds);
          setEstimatedTimeRemaining(totalSeconds);
        }
        
        // Update remaining time based on progress
        if (initialEstimate !== null) {
          const remaining = calculateRemainingTime(initialEstimate, pct);
          setEstimatedTimeRemaining(remaining);
        }

        // For Nuclear V2, mark docs as "complete" when we have at least a pdf/audio URL.
        if (productType === 'nuclear_package') {
          const docs: any[] = job?.results?.documents || [];
          const completed = docs
            .filter((d) => d && (d.pdfUrl || d.audioUrl) && typeof d.docNum === 'number')
            .map((d) => NUCLEAR_DOCS[d.docNum - 1]?.id)
            .filter(Boolean);
          setCompletedDocs(completed);
        }

        const isDone = status === 'complete' || status === 'completed';
        if (isDone) {
          setGenerationComplete(true);
          setIsGenerating(false);
          clearInterval(interval);
          // DO NOT auto-navigate to any "audiobook" / chapter hub screen.
          // All completed results are found in My Souls Library.
          setCurrentStep('✅ Complete — view it in My Souls Library');
        }
      } catch (e: any) {
        if (cancelled) return;
        setGenerationError(e?.message || 'Unknown error');
        setCurrentStep(`Error: ${e?.message || 'Unknown error'}`);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    };

    if (!activeJobId) {
      setGenerationError('Missing job receipt (jobId). Please start the reading again.');
      setCurrentStep('Missing job receipt (jobId). Please start again.');
      return;
    }

    // Start immediately, then poll.
    tick();
    interval = setInterval(tick, 6000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [API_URL, activeJobId, navigation, productType]);

  useEffect(() => {
    // Pulse animation for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Dots animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(dotAnim, { toValue: 2, duration: 500, useNativeDriver: false }),
        Animated.timing(dotAnim, { toValue: 3, duration: 500, useNativeDriver: false }),
        Animated.timing(dotAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
      ])
    ).start();

    // No elapsed time counter (per UX rule: no time estimates)
    return;
  }, []); // Empty dependency array - animations run once on mount

  // Get auth user for notifications
  const authUser = useAuthStore((s) => s.user);

  const handleNotifyMe = async () => {
    if (hasAskedPermission && notificationsEnabled) {
      // Already enabled, toggle off
      setNotificationsEnabled(false);
      return;
    }

    if (!activeJobId) {
      Alert.alert('No Job', 'Please wait for the job to start before enabling notifications.');
      return;
    }

    setHasAskedPermission(true);

    // Use the new notification service
    const userId = authUser?.id;
    const userEmail = authUser?.email;

    if (!userId) {
      // Fallback: just ask for local notification permission
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        Alert.alert(
          'Notifications Enabled',
          "We'll notify you when your reading is ready!",
          [{ text: 'OK' }]
        );
      }
      return;
    }

    // Full registration with push + email
    const result = await enableNotificationsForJob(userId, activeJobId, userEmail);

    // Always show success - email notifications work even if subscription table fails
    // The subscription table is just for tracking, not required for email delivery
    setNotificationsEnabled(true);
    const message = result.pushEnabled
      ? "We'll send you a push notification and email when your reading is ready!"
      : "We'll send you an email when your reading is ready!";
    Alert.alert('Notifications Enabled', message, [{ text: 'OK' }]);
  };

  const isThirdPerson = !!personName && personName !== 'You' && personName !== 'User';

  const handleGoToSoulLaboratory = () => {
    // Navigate to My Souls Library
    navigation.navigate('MyLibrary');
  };

  const handleGoToResults = () => {
    // Navigate directly to readings screen
    if (activeJobId) {
      const personType = partnerName ? 'overlay' : 'individual';
      const displayName = partnerName 
        ? `${personName || 'You'} & ${partnerName}`
        : personName || 'You';
      
      navigation.navigate('PersonReadings', {
        personName: displayName,
        personId: personId || '',
        personType: personType as 'person1' | 'person2' | 'overlay' | 'individual',
        jobId: activeJobId,
      });
    }
  };

  const handleGoToMySecretLife = () => {
    // Navigate to My Secret Life (Home screen)
    navigation.navigate('Home');
  };

  // Get the system name for the headline
  const getSystemHeadline = () => {
    if (productType === 'nuclear_package') {
      return 'Nuclear Package Reading';
    }
    if (systems && systems.length > 0) {
      const systemNames: Record<string, string> = {
        western: 'Western Astrology',
        vedic: 'Vedic Astrology',
        human_design: 'Human Design',
        gene_keys: 'Gene Keys',
        kabbalah: 'Kabbalah',
      };
      const systemName = systemNames[systems[0]] || systems[0];
      return systems.length > 1 ? `Combined Reading (${systems.length} Systems)` : systemName;
    }
    return 'Deep Reading';
  };

  const readingSubject = partnerName
    ? `${personName || 'You'} & ${partnerName}`
    : personName || 'Your';


  return (
    <SafeAreaView style={styles.container}>
      {/* Screen ID */}
      {/** Screen numbers temporarily removed */}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        {/* Product Title - Centered */}
        <Text style={styles.productTitle}>The Soul Journey of</Text>
        <Text style={styles.subjectNames}>{readingSubject}</Text>

        {/* Reading Type Subheadline */}
        <Text style={styles.systemSubheadline}>{getSystemHeadline()}</Text>

        {/* Combined Message Block */}
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>Deep Dive Readings Take Time</Text>
          <Text style={styles.messageText}>
            As these are comprehensive, personalized readings across one or multiple systems, they require significant processing time to ensure quality and depth. You can close the app and check back later!
          </Text>
        </View>

        {/* Notify Me Button */}
        <TouchableOpacity
          style={[
            styles.notifyButton,
            notificationsEnabled && styles.notifyButtonActive
          ]}
          onPress={handleNotifyMe}
        >
          <Text style={[
            styles.notifyIcon,
            notificationsEnabled && styles.notifyIconActive
          ]}>
            {notificationsEnabled ? '♪' : '♩'}
          </Text>
          <Text style={[
            styles.notifyText,
            notificationsEnabled && styles.notifyTextActive
          ]}>
            {notificationsEnabled ? 'Notifications On' : 'Notify me when ready'}
          </Text>
        </TouchableOpacity>

        {/* Results Button - Go directly to readings */}
        <TouchableOpacity 
          style={styles.libraryButton} 
          onPress={handleGoToResults}
          disabled={!activeJobId}
        >
          <Text style={[styles.libraryButtonText, !activeJobId && styles.libraryButtonTextDisabled]}>
            Results
          </Text>
        </TouchableOpacity>

        {/* My Secret Life Button */}
        <TouchableOpacity style={styles.libraryButton} onPress={handleGoToMySecretLife}>
          <Text style={styles.libraryButtonText}>My Secret Life</Text>
        </TouchableOpacity>

        {/* My Souls Library Button */}
        <TouchableOpacity style={styles.libraryButton} onPress={handleGoToSoulLaboratory}>
          <Text style={styles.libraryButtonText}>My Souls Library</Text>
        </TouchableOpacity>

        {/* Status indicator - Centered */}
        <Animated.View style={[styles.statusRowCentered, { opacity: blinkAnim }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Generating in background</Text>
        </Animated.View>

        {/* Smart Timer - Shows estimated time remaining */}
        {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && !generationComplete && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerLabel}>ESTIMATED TIME</Text>
            <Text style={styles.timerDisplay}>{formatCountdown(estimatedTimeRemaining)}</Text>
            <Text style={styles.timerHint}>You can close the app</Text>
          </View>
        )}

        {/* Nuclear V2: PDF Grid - Classical Forbidden Yoga Style */}
        {productType === 'nuclear_package' && (
          <View style={styles.pdfGridContainer}>
            <Text style={styles.pdfGridTitle}>Calculations</Text>
            <Text style={styles.pdfGridSubtitle}>16 Documents · 5 Systems · Final Verdict</Text>

            {/* 6 rows: 5 Systems + Final Verdict */}
            {['Western', 'Vedic', 'Human Design', 'Gene Keys', 'Kabbalah'].map((system, sysIdx) => (
              <View key={system} style={styles.pdfSystemRow}>
                <Text style={styles.pdfSystemLabel}>{system}</Text>
                <View style={styles.pdfSystemDocs}>
                  {[0, 1, 2].map((docIdx) => {
                    const globalIdx = sysIdx * 3 + docIdx;
                    const doc = NUCLEAR_DOCS[globalIdx];
                    const isComplete = completedDocs.includes(doc.id);
                    const isCurrent = globalIdx === completedDocs.length;
                    return (
                      <View
                        key={doc.id}
                        style={[
                          styles.pdfSlot,
                          isComplete && styles.pdfSlotComplete,
                          isCurrent && styles.pdfSlotCurrent,
                        ]}
                      >
                        <Text style={[
                          styles.pdfLabel,
                          isComplete && styles.pdfLabelComplete,
                          isCurrent && styles.pdfLabelCurrent
                        ]}>
                          {docIdx === 0 ? 'I' : docIdx === 1 ? 'II' : '⊕'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Final Verdict - Same format as other systems */}
            <View style={styles.pdfSystemRow}>
              <Text style={styles.pdfSystemLabel}>Final Verdict</Text>
              <View style={styles.pdfSystemDocs}>
                <View
                  style={[
                    styles.pdfSlot,
                    completedDocs.includes('verdict') && styles.pdfSlotComplete,
                    completedDocs.length === 15 && styles.pdfSlotCurrent,
                  ]}
                >
                  <Text style={[
                    styles.pdfLabel,
                    completedDocs.includes('verdict') && styles.pdfLabelComplete,
                    completedDocs.length === 15 && styles.pdfLabelCurrent
                  ]}>
                    ⚖
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.pdfProgress}>
              {completedDocs.length} of 16
            </Text>
          </View>
        )}

        {/* Single-system / Overlay: show 1 card */}
        {productType !== 'nuclear_package' && (
          <View style={styles.pdfGridContainer}>
            <Text style={styles.pdfGridTitle}>Calculations</Text>
            <Text style={styles.pdfGridSubtitle}>
              {readingType === 'overlay' ? 'Compatibility Overlay' : 'Single System'}
            </Text>

            <View style={styles.pdfSystemRow}>
              <Text style={styles.pdfSystemLabel}>
                {(systems?.[0] || 'System')
                  .replace('human_design', 'Human Design')
                  .replace('gene_keys', 'Gene Keys')
                  .replace('kabbalah', 'Kabbalah')
                  .replace('vedic', 'Vedic')
                  .replace('western', 'Western')}
              </Text>
              <View style={styles.pdfSystemDocs}>
                <View
                  style={[
                    styles.pdfSlot,
                    completedDocs.length > 0 && styles.pdfSlotComplete,
                    completedDocs.length === 0 && styles.pdfSlotCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.pdfLabel,
                      completedDocs.length > 0 && styles.pdfLabelComplete,
                      completedDocs.length === 0 && styles.pdfLabelCurrent,
                    ]}
                  >
                    {readingType === 'overlay' ? '⊕' : 'I'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
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
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  productTitle: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    width: '100%',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  subjectNames: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.primary,
    textAlign: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  systemSubheadline: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    width: '100%',
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  messageBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: 0,
    width: '100%',
  },
  messageTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
    marginBottom: spacing.xs,
  },
  messageText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'left',
    lineHeight: 20,
  },
  timeBox: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  timeLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.mutedText,
    letterSpacing: 1,
  },
  timeValue: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: colors.text,
    marginTop: 4,
  },
  timeBreakdown: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
  infoText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'left',
    marginTop: spacing.lg,
    lineHeight: 22,
    width: '100%',
  },
  highlight: {
    color: colors.primary,
    fontFamily: typography.sansSemiBold,
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    width: '100%',
  },
  notifyButtonActive: {
    backgroundColor: colors.primary,
  },
  notifyIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
    color: colors.primary,
  },
  notifyIconActive: {
    color: colors.background,
  },
  notifyText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  notifyTextActive: {
    color: colors.background,
  },
  secretLifeButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  secretLifeText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  headlineContainer: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  headlineText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  libraryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.text,
  },
  libraryButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  libraryButtonTextDisabled: {
    opacity: 0.5,
    color: colors.mutedText,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    width: '100%',
  },
  statusRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    width: '100%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  statusText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  // Debug styles
  debugBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.text,
    borderRadius: radii.card,
    alignItems: 'center',
    width: '100%',
  },
  debugStep: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
    textAlign: 'center',
  },
  // PDF Grid styles - Forbidden Yoga Classical Aesthetic
  pdfGridContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pdfGridTitle: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 4,
  },
  pdfGridSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.mutedText,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  pdfSystemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 260,
    marginBottom: 16,
  },
  pdfSystemLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    width: 100,
  },
  pdfSystemDocs: {
    flexDirection: 'row',
    gap: 12,
  },
  pdfSlot: {
    width: 28,
    height: 36,
    borderRadius: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfSlotComplete: {
    backgroundColor: 'rgba(139,0,0,0.1)',
    borderColor: '#8b0000',
  },
  pdfSlotCurrent: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  pdfLabel: {
    fontFamily: typography.headline,
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    fontStyle: 'italic',
  },
  pdfLabelComplete: {
    color: '#8b0000',
  },
  pdfLabelCurrent: {
    color: colors.primary,
  },
  pdfProgress: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: spacing.md,
  },
  // Smart Timer Styles
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardStroke,
  },
  timerLabel: {
    fontFamily: typography.sansSemiBold, // Inter SemiBold (app's main font)
    fontSize: 11,
    color: colors.mutedText,
    letterSpacing: 1,
    marginBottom: 6,
  },
  timerDisplay: {
    fontFamily: typography.sansBold, // Inter Bold (app's main font)
    fontSize: 32,
    color: colors.text,
    letterSpacing: 2,
  },
  timerHint: {
    fontFamily: typography.sansRegular, // Inter Regular (app's main font)
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 6,
  },
});

