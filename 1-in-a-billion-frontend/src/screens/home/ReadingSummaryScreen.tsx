/**
 * READING SUMMARY SCREEN
 * 
 * Shows after a reading is generated - the "ta-da" moment.
 * Displays key scores/highlights before diving into full text.
 * 
 * Purpose: Celebrate completion, show value, offer next actions.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Share, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { OUTPUT_POLICY } from '@/config/products';
import { AnimatedSystemIcon } from '@/components/AnimatedSystemIcon';

type Props = NativeStackScreenProps<MainStackParamList, 'ReadingSummary'>;

export const ReadingSummaryScreen = ({ navigation, route }: Props) => {
  const {
    readingType = 'compatibility',
    person1Name = 'You',
    person2Name,
    overallScore,
    highlights = [],
    wordCount = 4500,
    readingId,
  } = route.params || {};

  // Animation
  const scoreScale = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const highlightAnims = useRef(highlights.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Dramatic score reveal
    Animated.sequence([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scoreScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
      Animated.stagger(100,
        highlightAnims.map(anim =>
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true })
        )
      ),
    ]).start();
  }, []);

  const handleReadFull = () => {
    navigation.navigate('CompleteReading', {
      partnerName: person2Name,
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just got my compatibility reading with ${person2Name}! Our score: ${overallScore}/10 ✨`,
      });
    } catch (e) {
      console.log('Share cancelled');
    }
  };

  const handleAnalyzeAnother = () => {
    navigation.navigate('PartnerInfo');
  };

  // Score color based on value - only if score exists
  const getScoreColor = (score?: number) => {
    if (typeof score !== 'number') return colors.text; // Default if no score
    if (score >= 8) return '#22c55e'; // Green
    if (score >= 6) return '#eab308'; // Yellow
    if (score >= 4) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  // Calculate stats dynamically from word count
  const estimatedPages = Math.round(wordCount / OUTPUT_POLICY.wordsPerPage);
  // Complete reading = 10000 words / 5 systems, compatibility = 6000 words / 1 system
  const systemCount = wordCount >= 8000 ? 5 : 1;

  // Default highlights if none provided
  const displayHighlights = highlights.length > 0 ? highlights : [
    { icon: '☉', text: 'Strong emotional resonance detected' },
    { icon: '♀', text: 'Venus-Mars alignment indicates physical chemistry' },
    { icon: '☿', text: 'Communication styles complement each other' },
    { icon: '⚠', text: 'Watch for power dynamics in conflict' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        {/* Header */}
        <Text style={styles.header}>Reading Complete</Text>
        <Text style={styles.subheader} selectable>
          {person2Name ? `${person1Name} & ${person2Name}` : person1Name}
        </Text>

        {/* Big Score */}
        <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreScale }] }]}>
          <Text style={[styles.scoreNumber, { color: getScoreColor(overallScore) }]}>
            {(overallScore || 0).toFixed(1)}
          </Text>
          <Text style={styles.scoreLabel}>/10</Text>
        </Animated.View>
        <Text style={styles.scoreCaption} selectable>
          {(overallScore || 0) >= 8 ? 'Exceptional compatibility' :
            (overallScore || 0) >= 6 ? 'Strong potential' :
              (overallScore || 0) >= 4 ? 'Interesting dynamics' :
                'Challenging terrain'}
        </Text>

        {/* Highlights */}
        <View style={styles.highlightsSection}>
          <Text style={styles.highlightsTitle}>Key Insights</Text>
          {displayHighlights.map((highlight, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.highlightRow,
                { opacity: highlightAnims[idx] || fadeIn }
              ]}
            >
              <AnimatedSystemIcon icon={highlight.icon} size={20} />
              <Text style={styles.highlightText} selectable>{highlight.text}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{wordCount.toLocaleString()}</Text>
            <Text style={styles.statLabel}>words</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{systemCount}</Text>
            <Text style={styles.statLabel}>{systemCount === 1 ? 'system' : 'systems'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{estimatedPages}</Text>
            <Text style={styles.statLabel}>pages</Text>
          </View>
        </View>
      </Animated.View>

      {/* Actions */}
      <View style={styles.footer}>
        <Button
          label="Read Full Analysis"
          onPress={handleReadFull}
        />
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
            <Text style={styles.secondaryBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAnalyzeAnother}>
            <Text style={styles.secondaryBtnText}>Analyze Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  header: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subheader: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xl,
  },
  scoreNumber: {
    fontFamily: typography.headline,
    fontSize: 96,
    fontStyle: 'italic',
  },
  scoreLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 32,
    color: colors.mutedText,
    marginLeft: 4,
  },
  scoreCaption: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    marginTop: spacing.xs,
  },
  highlightsSection: {
    width: '100%',
    marginTop: spacing.xl,
  },
  highlightsTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 12,
    color: colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  highlightIcon: {
    fontSize: 18,
    width: 30,
  },
  highlightText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    width: '100%',
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  statNumber: {
    fontFamily: typography.serifBold,
    fontSize: 24,
    color: colors.text,
  },
  statLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  secondaryBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  secondaryBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});





