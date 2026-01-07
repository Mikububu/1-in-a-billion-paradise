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
import { env } from '@/config/env';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

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

  const handleNotifyMe = async () => {
    if (hasAskedPermission) {
      // Already asked, toggle off
      setNotificationsEnabled(!notificationsEnabled);
      return;
    }

    // Ask for permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setHasAskedPermission(true);

    if (finalStatus === 'granted') {
      setNotificationsEnabled(true);
      Alert.alert(
        'Notifications Enabled',
        "We'll let you know when your reading is ready!",
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Notifications Disabled',
        "No worries! Your reading will be saved to My Secret Life. Just check back later.",
        [{ text: 'OK' }]
      );
    }
  };

  const isThirdPerson = !!personName && personName !== 'You' && personName !== 'User';

  const handleGoToSecretLife = () => {
    if (isThirdPerson) {
      // If we have an id, go to that person; otherwise fall back to list
      if (partnerId || personId) {
        navigation.navigate('PersonProfile', { personId: (partnerId || personId)! });
      } else {
        navigation.navigate('PeopleList');
      }
    } else {
      navigation.navigate('Home');
    }
  };

  const handleGoToLibrary = () => {
    if (isThirdPerson) {
      navigation.navigate('PeopleList');
    } else {
      // User request: “Back to My Secret Life Dashboard” should return to Home
      navigation.navigate('Home');
    }
  };

  const readingSubject = partnerName
    ? `${personName || 'You'} & ${partnerName}`
    : personName || 'Your';

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/3c526d91-253e-4ee7-b894-96ad8dfa46e7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GeneratingReadingScreen.tsx:log',message:'GeneratingReading CTAs',data:{isThirdPerson,personName,links:['Notify','Label','Back'],labels:isThirdPerson?{primary:partnerId||personId?`Go to ${personName}'s Profile`:'Go to People List',secondary:'Back to People List'}:{primary:'VEDIC READING',secondary:'Back to My Secret Life Dashboard'}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'CTA1'})}).catch(()=>{});
  }, []);
  // #endregion

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen ID */}
      <Text style={styles.screenId}>{screenId}</Text>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        {/* Product Title - Centered */}
        <Text style={styles.productTitle}>The Soul Journey of</Text>
        <Text style={styles.subjectNames}>{readingSubject}</Text>

        {/* Combined Message Block */}
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>Deep Dive Readings Take Time</Text>
          <Text style={styles.messageText}>
            As these are comprehensive, personalized readings across multiple systems, they require significant processing time to ensure quality and depth. Your reading will be saved to <Text style={styles.highlight}>{isThirdPerson ? `${personName}'s Profile` : 'My Secret Life'}</Text>. You can close the app and check back later!
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

        {/* Primary CTA / Label */}
        {isThirdPerson ? (
          <TouchableOpacity style={styles.secretLifeButton} onPress={handleGoToSecretLife}>
            <Text style={styles.secretLifeText}>{partnerId || personId ? `Go to ${personName}'s Profile` : 'Go to People List'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.secretLifeButton}>
            <Text style={styles.secretLifeText}>VEDIC READING</Text>
          </View>
        )}

        {/* Secondary CTA */}
        <TouchableOpacity style={styles.secretLifeButton} onPress={handleGoToLibrary}>
          <Text style={styles.secretLifeText}>
            {isThirdPerson ? 'Back to People List' : 'Back to My Secret Life Dashboard'}
          </Text>
        </TouchableOpacity>

        {/* Status indicator - Centered */}
        <Animated.View style={[styles.statusRowCentered, { opacity: blinkAnim }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Generating in background</Text>
        </Animated.View>

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

        {/* Status Box - No Progress Bar */}
        <View style={styles.debugBox}>
          {/* Current Step */}
          <Text style={styles.debugStep}>{currentStep}</Text>

          {/* Verifiable receipt */}
          {!!activeJobId && (
            <Text style={styles.debugStep} selectable>
              Receipt (jobId): {activeJobId}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    marginBottom: spacing.md,
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
});

