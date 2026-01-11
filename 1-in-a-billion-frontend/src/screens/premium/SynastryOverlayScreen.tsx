/**
 * SYNASTRY OVERLAY SCREEN
 * 
 * Shows deep compatibility reading between two people.
 * Auto-generates on mount using Claude with DeepSeek fallback.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
// @ts-ignore - expo-file-system types not resolving correctly
import * as FileSystem from 'expo-file-system/legacy';
import { getCacheDirectory, EncodingType } from '@/utils/fileSystem';
import * as Sharing from 'expo-sharing';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { env } from '@/config/env';
import { BackButton } from '@/components/BackButton';

// Cycling loading messages
const LOADING_MESSAGES = [
  'ANALYZING CHARTS',
  'THIS IS DEEP WORK',
  'COMPARING PLACEMENTS',
  'FINDING CONNECTIONS',
];

type Props = NativeStackScreenProps<MainStackParamList, 'SynastryOverlay'>;

type SynastryReading = {
  opening: string;
  coreSynastryAnalysis: string;
  venusAndMarsDeepDive: string;
  relationshipGuidance: string;
};

export const SynastryOverlayScreen = ({ navigation, route }: Props) => {
  const { user1, user2 } = route.params || {};
  const [reading, setReading] = useState<SynastryReading | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Connecting to Claude Sonnet 4.5...');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Heart animation refs
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(0.6)).current;

  // Heart pumping animation
  useEffect(() => {
    if (isGenerating) {
      // Heartbeat animation - pumps and gets redder
      const heartbeat = Animated.loop(
        Animated.sequence([
          // Beat out - bigger and more opaque (redder)
          Animated.parallel([
            Animated.timing(heartScale, {
              toValue: 1.3,
              duration: 150,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(heartOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          // Beat in - smaller and less opaque
          Animated.parallel([
            Animated.timing(heartScale, {
              toValue: 1,
              duration: 150,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(heartOpacity, {
              toValue: 0.6,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          // Pause between beats
          Animated.delay(600),
        ])
      );
      heartbeat.start();
      return () => heartbeat.stop();
    }
  }, [isGenerating, heartScale, heartOpacity]);

  // Cycle loading messages
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  // Auto-generate on mount (only once)
  useEffect(() => {
    const hasValidParams = user1?.name && user2?.name && user1?.birthChart && user2?.birthChart;
    if (hasValidParams) {
      generateReading();
    } else {
      setIsGenerating(false);
      setError('Missing user data. Please go back and try again.');
    }
  }, []); // Empty dependency - run only on mount

  const generateReading = async () => {
    if (!user1?.birthChart || !user2?.birthChart) {
      setError('Missing birth chart data');
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLoadingStatus('Connecting to Claude Sonnet 4.5...');

    try {
      const response = await fetch(`${env.CORE_API_URL}/api/reading/synastry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1: {
            name: user1.name || 'Person 1',
            sunSign: user1.birthChart?.sunSign || 'Unknown',
            moonSign: user1.birthChart?.moonSign || 'Unknown',
            risingSign: user1.birthChart?.risingSign || 'Unknown',
          },
          user2: {
            name: user2.name || 'Person 2',
            sunSign: user2.birthChart?.sunSign || 'Unknown',
            moonSign: user2.birthChart?.moonSign || 'Unknown',
            risingSign: user2.birthChart?.risingSign || 'Unknown',
          },
          provider: 'claude',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReading(data.reading);
      } else {
        // Generate fallback reading
        generateFallbackReading();
      }
    } catch (err) {
      console.error('Synastry generation error:', err);
      // Generate fallback reading on error
      generateFallbackReading();
    } finally {
      setIsGenerating(false);
      setLoadingStatus('');
    }
  };

  const generateFallbackReading = () => {
    const name1 = user1?.name || 'Person 1';
    const name2 = user2?.name || 'Person 2';
    const sun1 = user1?.birthChart?.sunSign || 'their Sun';
    const sun2 = user2?.birthChart?.sunSign || 'their Sun';
    const moon1 = user1?.birthChart?.moonSign || 'their Moon';
    const moon2 = user2?.birthChart?.moonSign || 'their Moon';
    const rising1 = user1?.birthChart?.risingSign || 'their Rising';

    setReading({
      opening: `The cosmic dance between ${name1} and ${name2} reveals a profound connection that transcends ordinary compatibility. Your charts interweave in ways that suggest karmic significance - this is not a random meeting, but one written in the stars.`,
      coreSynastryAnalysis: `${name1}'s ${sun1} Sun illuminates ${name2}'s deepest desires, while ${name2}'s ${moon2} Moon provides the emotional container ${name1} has always sought. The way ${name1}'s ${rising1} Rising interacts with ${name2}'s ${sun2} Sun creates an immediate recognition - you each see something essential in the other. This is not a relationship of convenience. It is one of transformation.`,
      venusAndMarsDeepDive: `The Venus-Mars axis between your charts creates an undeniable magnetic pull. ${name1}'s way of loving activates ${name2}'s passion centers, while ${name2}'s desire nature speaks directly to ${name1}'s heart. There is heat here, yes, but also depth - the kind that sustains attraction through years rather than weeks. Your erotic connection is wired for intimacy, not just intensity.`,
      relationshipGuidance: `For this partnership to reach its highest potential: Honor each other's need for both intimacy and independence. ${name1} must learn to receive without over-giving - your worth is not measured by what you provide. ${name2} must learn to stay present when the relationship deepens, resisting the urge to retreat when vulnerability increases. Together, you can build something rare - a partnership that grows more magnetic with time.`,
    });
  };

  // Safe names for display
  const name1 = user1?.name || 'Person 1';
  const name2 = user2?.name || 'Person 2';

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>Error</Text>
          <Text style={styles.loadingSubtext}>{error}</Text>
          <TouchableOpacity
            style={{ marginTop: 20, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#fff', fontFamily: typography.sansSemiBold }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state with cycling messages and pumping heart
  if (isGenerating) {
    return (
      <SafeAreaView style={styles.container}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <Animated.Text
            style={[
              styles.loadingSymbol,
              {
                transform: [{ scale: heartScale }],
                opacity: heartOpacity,
              }
            ]}
          >
            ❤
          </Animated.Text>
          <Text style={styles.loadingTitle}>{name1} & {name2}</Text>
          <Text style={styles.loadingMessage}>{LOADING_MESSAGES[loadingMessageIndex]}</Text>
          <Text style={styles.loadingSubtext}>
            Claude Sonnet 4.5 is weaving your cosmic story
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // PDF generation
  const handlePdf = async () => {
    if (!reading) return;
    setIsGeneratingPdf(true);
    try {
      const fullContent = `OPENING\n\n${reading.opening}\n\nCORE SYNASTRY\n\n${reading.coreSynastryAnalysis}\n\nVENUS & MARS\n\n${reading.venusAndMarsDeepDive}\n\nGUIDANCE\n\n${reading.relationshipGuidance}`;
      const response = await fetch(`${env.CORE_API_URL}/api/pdf/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName: `${name1}_and_${name2}`,
          system: 'western',
          content: fullContent,
          birthDate: 'Synastry Reading',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const filePath = `${getCacheDirectory() || ''}${data.filename}`;
        await FileSystem.writeAsStringAsync(filePath, data.pdf, {
          encoding: EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleListen = () => {
    if (!reading) return;
    const fullText = `${reading.opening} ${reading.coreSynastryAnalysis} ${reading.venusAndMarsDeepDive} ${reading.relationshipGuidance}`;
    navigation.navigate('AudioPlayer', {
      title: `${name1} & ${name2} Compatibility`,
      personName: name1,
      system: 'western',
      readingText: fullText,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.header}>
        <TouchableOpacity onPress={generateReading}>
          <Text style={styles.regenerateText}>Regenerate</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Title */}
        <Text style={styles.title} selectable>
          {name1} & {name2}
        </Text>
        <Text style={styles.subtitle} selectable>Deep compatibility analysis</Text>

        {/* Action Bar */}
        {reading && (
          <View style={styles.actionsCard}>
            <View style={styles.actionRow}>
              {isGeneratingPdf ? (
                <View style={styles.actionButton}>
                  <ActivityIndicator size="small" color={colors.text} />
                  <Text style={styles.actionButtonText}>Creating...</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.actionButton} onPress={handlePdf}>
                  <Text style={styles.actionIcon}>✎</Text>
                  <Text style={styles.actionButtonText}>PDF</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionButton} onPress={handleListen}>
                <Text style={styles.actionIcon}>♬</Text>
                <Text style={styles.actionButtonText}>Listen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.actionIcon}>⌂</Text>
                <Text style={styles.actionButtonText}>Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Compatibility Score - REMOVED: No hardcoded values */}

        {/* Chart Summary */}
        <View style={styles.chartSummary}>
          <View style={styles.personChart}>
            <Text style={styles.personName}>{name1}</Text>
            <Text style={styles.chartInfo} selectable>
              {user1?.birthChart?.sunSign || '?'} / {user1?.birthChart?.moonSign || '?'} / {user1?.birthChart?.risingSign || '?'}
            </Text>
          </View>
          <Text style={styles.heartIcon}>♡</Text>
          <View style={styles.personChart}>
            <Text style={styles.personName}>{name2}</Text>
            <Text style={styles.chartInfo} selectable>
              {user2?.birthChart?.sunSign || '?'} / {user2?.birthChart?.moonSign || '?'} / {user2?.birthChart?.risingSign || '?'}
            </Text>
          </View>
        </View>

        {/* Reading Sections */}
        {reading && (
          <View style={styles.readingContainer}>
            <View style={styles.readingSection}>
              <Text style={styles.sectionTitle}>Opening</Text>
              <Text style={styles.readingText} selectable>{reading.opening}</Text>
            </View>

            <View style={styles.readingSection}>
              <Text style={styles.sectionTitle}>Core Synastry</Text>
              <Text style={styles.readingText} selectable>{reading.coreSynastryAnalysis}</Text>
            </View>

            <View style={styles.readingSection}>
              <Text style={styles.sectionTitle}>Venus & Mars</Text>
              <Text style={styles.readingText} selectable>{reading.venusAndMarsDeepDive}</Text>
            </View>

            <View style={styles.readingSection}>
              <Text style={styles.sectionTitle}>Guidance</Text>
              <Text style={styles.readingText} selectable>{reading.relationshipGuidance}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label="Get Complete Package"
          onPress={() => navigation.navigate('SystemExplainer', { system: 'all', forPurchase: true, readingType: 'overlay' })}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backButton: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingSymbol: {
    fontSize: 80,
    color: '#D10000', // Deep red heart
    marginBottom: spacing.lg,
  },
  loadingTitle: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  loadingMessage: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  loadingSubtext: {
    fontFamily: typography.sansRegular,
    color: colors.mutedText,
    fontSize: 14,
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 32,
    color: colors.text,
    marginBottom: 4,
    transform: [{ rotate: '-2deg' }],
  },
  actionButtonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  regenerateText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
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
  scoreSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  scoreLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  scoreNumber: {
    fontFamily: typography.headline,
    fontSize: 64,
    color: colors.text,
    lineHeight: 72,
  },
  scoreMax: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
  },
  chartSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
  },
  personChart: {
    alignItems: 'center',
    flex: 1,
    padding: spacing.sm,
  },
  personName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  chartInfo: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
  heartIcon: {
    fontSize: 24,
    color: colors.primary,
    marginHorizontal: spacing.sm,
  },
  readingContainer: {
    gap: spacing.xl,
  },
  readingSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  readingText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
