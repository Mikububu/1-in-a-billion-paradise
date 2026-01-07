import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Share, Alert, Animated, Easing, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

// Human Design PNG with animation
const HumanDesignImage = require('../../../assets/systems/human-design.png');
import { AnimatedSystemLoader } from '@/components/AnimatedSystemLoader';

// Western Zodiac Signs - Unicode symbols with text variation selector (︎) to force BLACK text, not emoji
const ZODIAC_SIGNS = [
  { name: 'Aries', symbol: '♈︎' },
  { name: 'Taurus', symbol: '♉︎' },
  { name: 'Gemini', symbol: '♊︎' },
  { name: 'Cancer', symbol: '♋︎' },
  { name: 'Leo', symbol: '♌︎' },
  { name: 'Virgo', symbol: '♍︎' },
  { name: 'Libra', symbol: '♎︎' },
  { name: 'Scorpio', symbol: '♏︎' },
  { name: 'Sagittarius', symbol: '♐︎' },
  { name: 'Capricorn', symbol: '♑︎' },
  { name: 'Aquarius', symbol: '♒︎' },
  { name: 'Pisces', symbol: '♓︎' },
];
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import { getDocumentDirectory } from '@/utils/fileSystem';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Audio } from 'expo-av';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore, ReadingSystem as ProfileReadingSystem } from '@/store/profileStore';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { SINGLE_SYSTEM, PRODUCT_STRINGS } from '@/config/products';
import { FEATURES } from '@/config/features';
import { generatePdfFilename } from '@/utils/fileNames';
import { audioApi } from '@/services/api';
import { GENERATION_MESSAGES, estimateReadingTime } from '@/config/readingConfig';

type Props = NativeStackScreenProps<MainStackParamList, 'FullReading'>;

type ReadingSystem = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';

const SYSTEM_NAMES: Record<ReadingSystem, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

const SYSTEM_DESCRIPTIONS: Record<ReadingSystem, string> = {
  western: 'Psychological birth chart analysis using tropical zodiac',
  vedic: 'Jyotish analysis with Nakshatras and Dashas',
  human_design: 'Your energetic type, strategy, and authority',
  gene_keys: 'Shadow, Gift, and Siddhi pathway exploration',
  kabbalah: 'Tree of Life and soul correction analysis',
};

/**
 * Format reading content with beautiful typography
 * - ALL CAPS lines become section headers
 * - **bold** becomes bold
 * - *italic* becomes italic
 * - Double newlines become paragraph breaks
 */
const formatReadingContent = (content: string) => {
  // Split into paragraphs
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((para, index) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // Check if it's a section header (ALL CAPS, possibly with parentheses)
    const isHeader = /^[A-Z][A-Z\s\(\)\-&]+$/.test(trimmed) && trimmed.length < 50;

    if (isHeader) {
      return (
        <Text key={index} style={formattedStyles.sectionHeader} selectable>
          {trimmed}
        </Text>
      );
    }

    // Parse inline formatting (bold and italic)
    const parts = parseInlineFormatting(trimmed);

    return (
      <Text key={index} style={formattedStyles.paragraph} selectable>
        {parts}
      </Text>
    );
  });
};

/**
 * Parse **bold** and *italic* formatting
 */
const parseInlineFormatting = (text: string) => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  // Regex to match **bold** or *italic*
  const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = formatRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Check if it's bold (**) or italic (*)
    if (match[2]) {
      // Bold
      parts.push(
        <Text key={`b-${keyIndex++}`} style={formattedStyles.bold}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Italic
      parts.push(
        <Text key={`i-${keyIndex++}`} style={formattedStyles.italic}>
          {match[3]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// Formatted text styles
const formattedStyles = StyleSheet.create({
  sectionHeader: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.primary,
    marginTop: 28,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  paragraph: {
    fontFamily: typography.sansRegular,
    fontSize: 17,
    color: colors.text,
    lineHeight: 28,
    marginBottom: 16,
    textAlign: 'left',
  },
  bold: {
    fontFamily: typography.sansSemiBold,
    fontWeight: '600',
  },
  italic: {
    fontStyle: 'italic',
  },
});

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║            ARTS - ANIMATED REASONING TYPOGRAPHY SYSTEM                    ║
 * ║                                                                           ║
 * ║  Each system has a DEEPLY MEANINGFUL symbol and animation that           ║
 * ║  reflects its core philosophy, not just decoration.                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ☉ WESTERN ASTROLOGY                                                        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ PHILOSOPHY: The Sun is your EGO, your core identity, what you're           │
 * │ becoming. It's the CENTER of your solar system, everything orbits you.     │
 * │                                                                             │
 * │ SYMBOL: ☉ - The Sun with its central dot (spirit) within circle (matter)  │
 * │ COLOR: Gold (#D4A000) - Solar, regal, life-giving warmth                   │
 * │ ANIMATION: SPIN - The Sun's apparent journey through 12 zodiac signs      │
 * │            Slow (12s), majestic, like the year passing                     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ॐ VEDIC ASTROLOGY (JYOTISH)                                                │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ PHILOSOPHY: Jyotish means "science of light" - the divine illumination    │
 * │ that reveals your karmic path. Om is the primordial sound of creation.    │
 * │ Rahu/Ketu (lunar nodes) show your obsessions and past-life wounds.        │
 * │                                                                             │
 * │ SYMBOL: ॐ - Om, the sacred syllable, vibration of the cosmos             │
 * │ COLOR: Saffron (#E85D04) - Sacred color of renunciation, spiritual fire   │
 * │ ANIMATION: WAXWANE - Pulsing like breath/mantra, showing impermanence     │
 * │            Om vibrates between manifest and unmanifest                     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ◬ HUMAN DESIGN                                                              │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ PHILOSOPHY: You have 9 CENTERS (like chakras). Some are DEFINED (colored), │
 * │ some UNDEFINED (white). You absorb energy through undefined centers.       │
 * │ Your STRATEGY tells you how to make decisions: wait, respond, inform.      │
 * │                                                                             │
 * │ SYMBOL: ◬ - Triangle pointing up (Head Center at top of Bodygraph)        │
 * │         The Bodygraph is a geometric figure with triangle at crown         │
 * │ COLOR: Magenta (#9D4EDD) - The defined center color, activated energy     │
 * │ ANIMATION: PULSE - Like a heartbeat, the Sacral Center's response         │
 * │            "Uh-huh" (yes) or "Un-un" (no) - the gut response               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ❋ GENE KEYS                                                                 │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ PHILOSOPHY: Your DNA contains 64 Gene Keys (from I Ching). Each operates   │
 * │ at 3 frequencies: SHADOW (fear), GIFT (service), SIDDHI (transcendence).   │
 * │ Through CONTEMPLATION, shadows transform into gifts.                        │
 * │                                                                             │
 * │ SYMBOL: ❋ - Flower with 6 petals (hexagram geometry of I Ching)           │
 * │ COLOR: Emerald (#059669) - Heart opening, Venus Sequence, love            │
 * │ ANIMATION: BLOOM - Flower opens from tight bud (shadow) to full bloom     │
 * │            (siddhi), then closes to contemplate again                       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ✧ KABBALAH                                                                  │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ PHILOSOPHY: The TREE OF LIFE has 10 Sephiroth (spheres) connected by      │
 * │ 22 paths. Divine light (OR) descends from Keter (Crown) to Malkuth        │
 * │ (Kingdom). Your TIKKUN is your soul's correction, what you're here to fix. │
 * │                                                                             │
 * │ SYMBOL: ✧ - Four-pointed star, divine light (Or) radiating                │
 * │ COLOR: Royal Purple (#7C3AED) - Yesod (Foundation), connecting worlds     │
 * │ ANIMATION: DESCEND - Light flows down the Tree (involution) then          │
 * │            ascends back up (evolution), the soul's journey                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
type AnimationType = 'spin' | 'waxwane' | 'pulse' | 'bloom' | 'descend';

const SYSTEM_ARTS: Record<ReadingSystem, {
  symbol: string;
  animationType: AnimationType;
  color: string;
  line1: string;
  line3: string;
  line4: string;
  line5: string;
}> = {
  western: {
    symbol: '☉',
    animationType: 'spin',
    color: '#D4A000',
    line1: 'Your',
    line3: 'Birth Chart',
    line4: 'Reveals',
    line5: 'Your Psychology',
  },
  vedic: {
    symbol: 'ॐ',
    animationType: 'waxwane',
    color: '#E85D04',
    line1: 'Your',
    line3: 'Jyotish',
    line4: 'Reveals',
    line5: 'Your Karma',
  },
  human_design: {
    symbol: '◬',
    animationType: 'pulse',
    color: '#9D4EDD',
    line1: 'Your',
    line3: 'Bodygraph',
    line4: 'Reveals',
    line5: 'Your Strategy',
  },
  gene_keys: {
    symbol: '❋',
    animationType: 'bloom',
    color: '#059669',
    line1: 'Your',
    line3: 'Gene Keys',
    line4: 'Reveals',
    line5: 'Your Golden Path',
  },
  kabbalah: {
    symbol: '✧',
    animationType: 'descend',
    color: '#7C3AED',
    line1: 'Your',
    line3: 'Tree of Life',
    line4: 'Reveals',
    line5: 'Your Tikkun',
  },
};

export const FullReadingScreen = ({ navigation, route }: Props) => {
  console.log('📖 FullReadingScreen MOUNTED - This is Screen 13');
  const {
    system: rawSystem = 'western',
    forPartner,
    partnerName,
    partnerBirthDate,
    partnerBirthTime,
    partnerBirthCity,
  } = route.params || {};
  // Validate system is one of the known systems
  const validSystems: ReadingSystem[] = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];
  const system = validSystems.includes(rawSystem as ReadingSystem) ? rawSystem : 'western';

  // Use partner data if forPartner, otherwise use user data from store
  const userBirthDate = useOnboardingStore((state) => state.birthDate);
  const userBirthTime = useOnboardingStore((state) => state.birthTime);
  const userBirthCity = useOnboardingStore((state) => state.birthCity);
  const relationshipIntensity = useOnboardingStore((state) => state.relationshipIntensity);
  const relationshipMode = useOnboardingStore((state) => state.relationshipMode);
  const primaryLanguage = useOnboardingStore((state) => state.primaryLanguage);

  // Select the appropriate birth data
  const birthDate = forPartner ? partnerBirthDate : userBirthDate;
  const birthTime = forPartner ? partnerBirthTime : userBirthTime;
  const birthCity = forPartner ? partnerBirthCity : userBirthCity;
  const subjectName = forPartner ? partnerName : 'You';

  // Profile store for saving readings
  const addPerson = useProfileStore((state) => state.addPerson);
  const getUser = useProfileStore((state) => state.getUser);
  const addReading = useProfileStore((state) => state.addReading);

  const [reading, setReading] = useState<string | null>(null);
  const [currentReadingId, setCurrentReadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading immediately
  const [loadingStatus, setLoadingStatus] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [cyclingMessage, setCyclingMessage] = useState('GENERATING READING');
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Zodiac cycling state (for Western system)
  const [currentZodiacIndex, setCurrentZodiacIndex] = useState(0);

  // ARTS Animation refs - simplified since AnimatedSystemLoader handles image animations
  const statusPulse = useRef(new Animated.Value(1)).current;    // Status text pulse
  const fadeAnim = useRef(new Animated.Value(0)).current;       // Fade in
  const zodiacFadeAnim = useRef(new Animated.Value(1)).current; // Zodiac crossfade

  // Get current system's animation type
  const currentArts = SYSTEM_ARTS[system as ReadingSystem];

  // Determine if we're still in loading state (reading OR audio OR PDF)
  const isStillLoading = isLoading || isGeneratingAudio || !pdfReady;

  // Start ARTS animations when loading - AnimatedSystemLoader handles image animations
  useEffect(() => {
    if (isStillLoading && currentArts) {
      // Fade in the container
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();

      // Status text pulse - must use false to match AnimatedSystemLoader
      const statusPulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse, { toValue: 1.15, duration: 800, useNativeDriver: false }),
          Animated.timing(statusPulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        ])
      );
      statusPulseAnim.start();

      // Zodiac sign cycling (for Western) - change every 2 seconds with fade
      let zodiacInterval: NodeJS.Timeout | null = null;
      if (system === 'western') {
        zodiacInterval = setInterval(() => {
          // Fade out
          Animated.timing(zodiacFadeAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
            // Change sign
            setCurrentZodiacIndex(prev => (prev + 1) % 12);
            // Fade in
            Animated.timing(zodiacFadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
          });
        }, 2000);
      }

      return () => {
        statusPulseAnim.stop();
        fadeAnim.setValue(0);
        if (zodiacInterval) clearInterval(zodiacInterval);
      };
    }
  }, [isStillLoading, currentArts, system]);

  // Cycling loading messages - keeps user engaged while waiting
  useEffect(() => {
    if (isStillLoading) {
      const messages = isLoading
        ? GENERATION_MESSAGES.reading
        : GENERATION_MESSAGES.pdf;
      let index = 0;
      const interval = setInterval(() => {
        index = (index + 1) % messages.length;
        setCyclingMessage(messages[index]);
      }, 3000); // Change every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isStillLoading, isLoading]);

  // Generate reading on mount
  useEffect(() => {
    generateReading();
  }, [system]);

  const generateReading = async () => {
    setIsLoading(true);
    const nameForDisplay = forPartner ? partnerName : 'you';
    setLoadingStatus(`Connecting to Claude for ${nameForDisplay}'s ${SYSTEM_NAMES[system as ReadingSystem]}...`);

    try {
      // Call backend for extended reading with Claude
      const response = await fetch(`${env.CORE_API_URL}/api/reading/extended`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          birthDate: birthDate || '1968-08-23',
          birthTime: birthTime || '13:45',
          timezone: birthCity?.timezone || 'Europe/Vienna',
          latitude: birthCity?.latitude || 46.6103,
          longitude: birthCity?.longitude || 13.8558,
          relationshipIntensity: relationshipIntensity || 5,
          relationshipMode: relationshipMode || 'sensual',
          primaryLanguage: primaryLanguage?.code || 'en',
          provider: 'claude', // Use Claude for full readings
          longForm: true, // Request longer output
          subjectName: subjectName || 'You', // Pass subject name for personalized reading
          isPartnerReading: forPartner || false,
        }),
      });

      setLoadingStatus(`Claude is analyzing ${nameForDisplay}'s chart...`);

      if (response.ok) {
        const data = await response.json();
        // Strip ALL markdown formatting for display
        let content = data.reading?.content || data.reading?.main || '';
        content = content
          .replace(/^#{1,6}\s*/gm, '')     // Remove # ## ### headers
          .replace(/\*\*/g, '')             // Remove bold **
          .replace(/\*/g, '')               // Remove italic *
          .replace(/^-\s+/gm, '• ')         // Convert - lists to bullets
          .replace(/^\d+\.\s+/gm, '')       // Remove numbered lists
          .trim();
        setReading(content);

        // AUTO-SAVE: Store reading in profile
        const rawSource = data.metadata?.source || data.source || 'claude';
        const source = (rawSource === 'deepseek' || rawSource === 'gpt' ? rawSource : 'claude') as 'claude' | 'deepseek' | 'gpt';
        const wordCount = content.split(/\s+/).length;

        // Ensure user exists in store
        let user = getUser();
        if (!user) {
          // CRITICAL: Self profile should ALWAYS exist after onboarding
          // If it doesn't, something went wrong - do NOT create a new one
          console.error('❌ ABORT: No self profile exists in FullReadingScreen. Cannot generate reading.');
          setLoadingStatus('Your profile could not be found. Please restart the app or complete onboarding first.');
          setIsLoading(false);
          return;
        }

        console.log('✅ Generating reading for existing self profile');
        if (user) {
          const readingId = addReading(user.id, {
            system: system as ProfileReadingSystem,
            content,
            generatedAt: new Date().toISOString(),
            source,
            wordCount,
          });
          setCurrentReadingId(readingId);
          console.log(`✅ Reading saved to library: ${SYSTEM_NAMES[system as ReadingSystem]} (${wordCount} words)`);
        }

        // AUTO-GENERATE: Audio and PDF immediately after reading
        autoGenerateMedia(content);
      } else {
        const errorText = await response.text();
        console.log('API error:', errorText);
        setReading(`Error generating reading. Please try again.`);
      }
    } catch (error) {
      console.log('Error generating reading:', error);
      setReading(`Connection error. Please check your network.`);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  // Auto-generate PDF when reading is received (audio is generated on AudioPlayer screen)
  const autoGenerateMedia = async (content: string) => {
    // PDF generation - controlled by FEATURES.AUTO_GENERATE_PDF
    if (FEATURES.AUTO_GENERATE_PDF) {
      setLoadingStatus('Preparing your PDF...');
      try {
        const pdfResponse = await fetch(`${env.CORE_API_URL}/api/pdf/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${SYSTEM_NAMES[system as ReadingSystem]} Reading`,
            content,
            system,
            subjectName: subjectName || 'You',
          }),
        });

        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          if (pdfData.success) {
            setPdfHtml(pdfData.html);
            setPdfReady(true);
            console.log('✅ PDF ready');
          }
        }
      } catch (error) {
        console.log('PDF generation error:', error);
      }
    }

    setLoadingStatus('');
  };

  // Audio playback functions
  const playAudio = async () => {
    if (!audioBase64) {
      Alert.alert('Audio Not Ready', 'Please wait for audio to finish generating.');
      return;
    }

    try {
      // If we have an existing sound, toggle play/pause
      if (soundRef.current) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            if (isPlaying) {
              await soundRef.current.pauseAsync();
              setIsPlaying(false);
            } else {
              await soundRef.current.playAsync();
              setIsPlaying(true);
            }
            return;
          }
        } catch (e) {
          // Sound not loaded properly, create new one
          console.log('Recreating sound...');
        }
      }

      // Create new sound from base64
      console.log('Creating audio from base64 data...');
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${audioBase64}` },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis / 1000);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackPosition(0);
            }
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      console.log('✅ Audio playing');
    } catch (error) {
      console.log('Audio playback error:', error);
      Alert.alert('Playback Error', `Could not play audio: ${String(error)}`);
    }
  };

  // CRITICAL: Stop audio when screen loses focus (useFocusEffect runs cleanup BEFORE blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        console.log('🛑 FullReadingScreen LOSING FOCUS - stopping audio immediately');
        if (soundRef.current) {
          soundRef.current.stopAsync().catch(() => { });
          soundRef.current.unloadAsync().catch(() => { });
          soundRef.current = null;
        }
        setIsPlaying(false);
      };
    }, [])
  );

  // Also cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => { });
        soundRef.current.unloadAsync().catch(() => { });
        soundRef.current = null;
      }
    };
  }, []);

  const generateAudio = async () => {
    if (!reading) return;

    // Navigate to Audio Player immediately - it will handle generation
    navigation.navigate('AudioPlayer', {
      audioUrl: undefined, // Will generate on the player screen
      title: `${userName}'s ${SYSTEM_NAMES[system as ReadingSystem]} Reading`,
      personName: userName,
      system: system,
      readingId: currentReadingId || undefined,
      readingText: reading, // Pass the text to generate audio from
    });
  };

  // Get user's name from store or default
  const storedUser = getUser();
  const userName = storedUser?.name || 'You';

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSave = async () => {
    if (!reading) return;

    setIsGeneratingPdf(true);

    try {
      const systemName = SYSTEM_NAMES[system as ReadingSystem];
      const personName = subjectName && subjectName !== 'You' ? subjectName : (userName !== 'You' ? userName : 'Michael');
      const birthDateFormatted = birthDate ? new Date(birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown';

      // System-specific colors
      const systemColors: Record<string, { primary: string; accent: string }> = {
        western: { primary: '#1a365d', accent: '#3182ce' },
        vedic: { primary: '#744210', accent: '#dd6b20' },
        human_design: { primary: '#22543d', accent: '#38a169' },
        gene_keys: { primary: '#553c9a', accent: '#805ad5' },
        kabbalah: { primary: '#1a202c', accent: '#718096' },
      };
      const colors = systemColors[system] || systemColors.western;

      // Convert reading text to HTML paragraphs
      const readingHtml = reading
        .split('\n\n')
        .map(para => `<p>${para.trim()}</p>`)
        .join('\n');

      // Beautiful PDF HTML template
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 50px; size: A4; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.8;
      color: #2d3748;
      max-width: 100%;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid ${colors.primary};
      padding-bottom: 30px;
      margin-bottom: 40px;
    }
    .logo {
      font-size: 14px;
      letter-spacing: 4px;
      color: ${colors.accent};
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .title {
      font-size: 32px;
      color: ${colors.primary};
      margin: 20px 0 10px 0;
      font-weight: normal;
    }
    .version {
      font-size: 12px;
      color: #718096;
      letter-spacing: 2px;
    }
    .meta {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 25px;
      font-size: 14px;
      color: #4a5568;
    }
    .meta-item {
      text-align: center;
    }
    .meta-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #a0aec0;
    }
    .meta-value {
      font-size: 16px;
      color: ${colors.primary};
      margin-top: 4px;
    }
    .content {
      font-size: 15px;
      text-align: justify;
    }
    .content p {
      margin-bottom: 18px;
      text-indent: 20px;
    }
    .content p:first-child {
      text-indent: 0;
    }
    .content p:first-child::first-letter {
      font-size: 48px;
      float: left;
      line-height: 1;
      padding-right: 10px;
      color: ${colors.primary};
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #a0aec0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">1 in a Billion</div>
    <h1 class="title">${systemName} Reading</h1>
    <div class="version">Version 1.0</div>
    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">Prepared For</div>
        <div class="meta-value">${personName}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Birth Date</div>
        <div class="meta-value">${birthDateFormatted}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Generated</div>
        <div class="meta-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </div>
  </div>
  
  <div class="content">
    ${readingHtml}
  </div>
  
  <div class="footer">
    Generated by 1 in a Billion • www.1inabillion.app
  </div>
</body>
</html>
      `;

      // Generate actual PDF file using expo-print
      // Use centralized filename generator
      const fileName = generatePdfFilename(personName, systemName);

      try {
        // Create PDF file (expo-print creates with UUID name in temp)
        const { uri: tempUri } = await Print.printToFileAsync({
          html,
          base64: false,
        });

        console.log('✅ PDF created at temp:', tempUri);

        // Create a dedicated PDFs directory in documentDirectory
        const pdfDir = `${getDocumentDirectory() || ''}PDFs/`;
        const dirInfo = await FileSystem.getInfoAsync(pdfDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(pdfDir, { intermediates: true });
        }

        // Final path with proper filename
        const finalUri = `${pdfDir}${fileName}`;

        // Delete existing file with same name if exists
        const existingFile = await FileSystem.getInfoAsync(finalUri);
        if (existingFile.exists) {
          await FileSystem.deleteAsync(finalUri, { idempotent: true });
        }

        // Move to our controlled directory with proper name
        await FileSystem.moveAsync({
          from: tempUri,
          to: finalUri,
        });

        console.log('✅ PDF saved as:', finalUri);
        console.log('✅ Filename:', fileName);

        // Share from our controlled location - iOS will show this filename
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(finalUri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
          });
          console.log('✅ PDF shared successfully');
        } else {
          Alert.alert('Sharing not available', 'Cannot share files on this device.');
        }
      } catch (printError) {
        console.log('PDF print error:', printError);
        // Fallback to text share if PDF fails
        const textFallback = `${systemName} Reading for ${personName}\n\n${reading}`;
        await Share.share({ message: textFallback, title: fileName });
      }
    } catch (error) {
      console.log('Share error:', error);
      Alert.alert('Error', 'Could not share reading.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const formattedDate = birthDate ? new Date(birthDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  }) : 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenId}>13</Text>

      {/* LOADING STATE - Full screen, no scroll */}
      {isStillLoading && currentArts ? (
        <View style={styles.loadingScreen}>
          {/* Header info */}
          <Text style={styles.loadingTitle}>{SYSTEM_NAMES[system as ReadingSystem]} Reading</Text>
          <Text style={styles.loadingSubtitle}>Deep analysis for {userName}, born {formattedDate}</Text>
          <Text style={styles.loadingDesc}>{SYSTEM_DESCRIPTIONS[system as ReadingSystem]}</Text>

          {/* ARTS Content */}
          <Text style={styles.artsLine1}>{currentArts.line1}</Text>

          {/* Zodiac Symbol - NEO BRUTALIST: Black text symbols */}
          <View style={styles.systemImageContainer}>
            {system === 'western' ? (
              <View style={styles.zodiacContainer}>
                <Animated.Text style={[styles.zodiacSymbol, { opacity: zodiacFadeAnim }]}>
                  {ZODIAC_SIGNS[currentZodiacIndex].symbol}
                </Animated.Text>
                <Text style={styles.zodiacName}>{ZODIAC_SIGNS[currentZodiacIndex].name.toUpperCase()}</Text>
              </View>
            ) : (
              <AnimatedSystemLoader
                system={system as 'western' | 'vedic' | 'human_design' | 'kabbalah' | 'gene_keys'}
                size={120}
                isActive={isStillLoading}
              />
            )}
          </View>

          <Text style={styles.artsLine3}>{currentArts.line3}</Text>
          <Text style={styles.artsLine4}>{currentArts.line4}</Text>
          <Text style={styles.artsLine5}>{currentArts.line5}</Text>

          <Animated.Text style={[styles.artsStatus, { transform: [{ scale: statusPulse }] }]}>
            {cyclingMessage}
          </Animated.Text>

          {/* Exit buttons */}
          <View style={styles.exitButtons}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.libraryButton}
              onPress={() => navigation.navigate('MyLibrary')}
            >
              <Text style={styles.libraryButtonText}>Go to My Souls Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            {/* Title Section */}
            <Text style={styles.title} selectable>
              {SYSTEM_NAMES[system as ReadingSystem]} Reading
            </Text>
            <Text style={styles.subtitle} selectable>
              Deep analysis for {userName}, born {formattedDate}
            </Text>
            <Text style={styles.systemDescription} selectable>
              {SYSTEM_DESCRIPTIONS[system as ReadingSystem]}
            </Text>

            {/* Show media player ONLY when everything is ready (reading + audio + PDF) */}
            {!isLoading && reading && !isGeneratingAudio && pdfReady && (
              <View style={styles.mediaContainer}>
                {/* AUDIO PLAYER - Beautiful Red */}
                <View style={styles.audioPlayerCard}>
                  <Text style={styles.audioTitle}>🎧 Audio Narration</Text>
                  <Text style={styles.audioDuration}>
                    {audioBase64
                      ? (playbackDuration > 0 ? `${Math.floor(playbackDuration / 60)}:${String(Math.floor(playbackDuration % 60)).padStart(2, '0')}` : 'Ready')
                      : 'Tap to generate'}
                  </Text>

                  {/* Play/Pause Button */}
                  <TouchableOpacity
                    style={[styles.playButton, !audioBase64 && styles.playButtonDisabled]}
                    onPress={audioBase64 ? playAudio : () => Alert.alert('Audio Disabled', 'Audio generation is temporarily disabled to save costs during testing.')}
                    disabled={false}
                  >
                    <Text style={styles.playButtonIcon}>{audioBase64 ? (isPlaying ? '⏸' : '▶') : '🔇'}</Text>
                  </TouchableOpacity>

                  {/* Progress Bar */}
                  {audioBase64 && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${(playbackPosition / playbackDuration) * 100}%` }
                          ]}
                        />
                      </View>
                      <Text style={styles.progressTime}>
                        {Math.floor(playbackPosition / 60)}:{String(Math.floor(playbackPosition % 60)).padStart(2, '0')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* PDF ICON - Adobe Style Red */}
                <TouchableOpacity
                  style={styles.pdfCard}
                  onPress={handleSave}
                  disabled={!pdfReady}
                >
                  <View style={styles.pdfIconContainer}>
                    <View style={styles.pdfIcon}>
                      <Text style={styles.pdfIconText}>PDF</Text>
                    </View>
                  </View>
                  <View style={styles.pdfInfo}>
                    <Text style={styles.pdfTitle}>{SYSTEM_NAMES[system as ReadingSystem]}</Text>
                    <Text style={styles.pdfSubtitle}>
                      {pdfReady ? 'Tap to download & share' : 'Preparing PDF...'}
                    </Text>
                  </View>
                  {!pdfReady && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>

                {/* Home Button */}
                <TouchableOpacity
                  style={styles.homeButton}
                  onPress={() => navigation.navigate('Home')}
                >
                  <Text style={styles.homeButtonText}>← Back to Home</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Cream white, not pink
  },
  screenId: {
    position: 'absolute',
    top: 55,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  systemDescription: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actionsCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionIcon: {
    fontSize: 28,
    color: colors.text,
    marginBottom: 4,
  },
  actionIconLarge: {
    fontSize: 32,
    marginBottom: 6,
  },
  actionSymbol: {
    fontSize: 28,
    color: colors.text,
    marginBottom: 6,
    fontWeight: '300',
  },
  actionIconHandDrawn: {
    fontSize: 34,
    color: colors.text,
    marginBottom: 4,
    // Linocut/woodblock feel - slightly irregular, bold
    transform: [{ rotate: '-2deg' }],
  },
  actionButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  // Full screen loading - no scroll
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
    backgroundColor: colors.background,
  },
  loadingTitle: {
    fontFamily: typography.headline,
    fontSize: 24,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  loadingSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: '#4A4A4A',
    textAlign: 'center',
  },
  loadingDesc: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: '#6A6A6A',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  artsLine1: {
    fontFamily: typography.sansRegular,
    fontSize: 32,
    color: '#1A1A1A', // Pure black
    textAlign: 'center',
  },
  artsLine2: {
    fontFamily: typography.headline,
    fontSize: 90,
    textAlign: 'center',
    lineHeight: 100,
    marginVertical: spacing.xs,
  },
  // System image container for animated loader
  systemImageContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  zodiacContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zodiacSymbol: {
    fontSize: 80,
    color: '#1A1A1A', // Black - Neo Brutalist
    textAlign: 'center',
  },
  zodiacName: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: '#4A4A4A', // Dark grey
    marginTop: spacing.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  artsLine3: {
    fontFamily: typography.headline,
    fontSize: 36,
    color: '#1A1A1A', // Pure black
    textAlign: 'center',
  },
  artsLine4: {
    fontFamily: typography.headline, // Changed to headline for consistency
    fontSize: 36,
    color: '#1A1A1A', // Pure black (was looking grey)
    textAlign: 'center',
  },
  artsLine5: {
    fontFamily: typography.headline,
    fontSize: 36,
    color: '#1A1A1A', // Pure black
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  artsStatus: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: '#1A1A1A', // Pure black
    letterSpacing: 2,
    marginTop: spacing.md,
  },
  timeEstimate: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: '#6A6A6A',
    marginTop: spacing.sm,
  },
  exitButtons: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  backButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1,
  },
  libraryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryButtonText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.background,
    letterSpacing: 1,
  },
  artsSubtext: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  readingContainer: {
    backgroundColor: colors.background,
  },
  readingText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    lineHeight: 26,
  },
  // NEW: Media Container Styles (Audio + PDF)
  mediaContainer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  generatingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  generatingText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  // Audio Player Card
  audioPlayerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  audioTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  audioDuration: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playButtonDisabled: {
    backgroundColor: colors.mutedText,
    opacity: 0.6,
  },
  playButtonIcon: {
    fontSize: 32,
    color: '#FFF',
  },
  progressContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.divider,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressTime: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    minWidth: 40,
  },
  // PDF Card - Adobe Style
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pdfIconContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIcon: {
    width: 48,
    height: 56,
    backgroundColor: '#D93025', // Adobe PDF Red
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // Folded corner effect
    borderTopRightRadius: 12,
  },
  pdfIconText: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  pdfInfo: {
    flex: 1,
  },
  pdfTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  pdfSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  homeButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  homeButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.primary,
  },
});
