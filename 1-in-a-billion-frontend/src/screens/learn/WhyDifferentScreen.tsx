/**
 * WHY WE'RE DIFFERENT SCREEN
 * 
 * Explains the deep reasoning mode and why our readings
 * are not "standard AI chatbot" outputs.
 * 
 * Beautiful typography, builds trust before purchase.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'WhyDifferent'>;

export const WhyDifferentScreen = ({ navigation }: Props) => {
  const fade1 = useRef(new Animated.Value(0)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const fade3 = useRef(new Animated.Value(0)).current;
  const fade4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.timing(fade1, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade2, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade3, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade4, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Animated.View style={{ opacity: fade1 }}>
          <Text style={styles.headline} selectable>
            Why normal AI
          </Text>
          <Text style={styles.headline2} selectable>
            cannot create this
          </Text>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fade2 }]}>
          <Text style={styles.paragraph} selectable>
            A regular chatbot gives quick answers but it does not think in layers. 
            It cannot hold 2 lives at the same time, it cannot track emotional patterns 
            across many pages, and it cannot stay coherent when the story becomes complex.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.highlightBox, { opacity: fade3 }]}>
          <Text style={styles.highlightText} selectable>
            These readings are created with a deeper reasoning mode.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fade4 }]}>
          <Text style={styles.paragraph} selectable>
            It studies each person with detail, understands how both energies meet, 
            and writes a long connected interpretation instead of short fragments.
          </Text>
          <Text style={styles.emphasisText} selectable>
            This is why the compatibility analysis feels personal and accurate 
            rather than generic.
          </Text>
        </Animated.View>

        {/* Visual comparison */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>The difference</Text>
          
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonLabel}>Regular AI</Text>
              <Text style={styles.comparisonIcon}>💬</Text>
              <Text style={styles.comparisonDesc}>Quick surface answers</Text>
              <Text style={styles.comparisonDesc}>Forgets context</Text>
              <Text style={styles.comparisonDesc}>Generic patterns</Text>
            </View>
            
            <View style={[styles.comparisonCard, styles.comparisonCardHighlight]}>
              <Text style={styles.comparisonLabelHighlight}>Our Readings</Text>
              <Text style={styles.comparisonIcon}>🔮</Text>
              <Text style={styles.comparisonDescHighlight}>Deep reasoning mode</Text>
              <Text style={styles.comparisonDescHighlight}>Holds 2 lives at once</Text>
              <Text style={styles.comparisonDescHighlight}>20+ pages coherent</Text>
            </View>
          </View>
        </View>

        {/* Trust badges */}
        <View style={styles.trustSection}>
          <View style={styles.trustItem}>
            <Text style={styles.trustIcon}>⏱</Text>
            <Text style={styles.trustText}>30-45 min generation time</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustIcon}>📖</Text>
            <Text style={styles.trustText}>Up to 60 pages of analysis</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.trustIcon}>🎯</Text>
            <Text style={styles.trustText}>Specific to your exact birth data</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="See Reading Options" onPress={() => navigation.navigate('Purchase', {})} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backButton: { paddingHorizontal: spacing.page, paddingVertical: spacing.sm, paddingLeft: 60 },
  backText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },

  headline: { fontFamily: typography.headline, fontSize: 36, color: colors.text, marginTop: spacing.lg },
  headline2: { fontFamily: typography.headline, fontSize: 36, color: colors.primary, fontStyle: 'italic' },

  textBlock: { marginTop: spacing.xl },
  paragraph: { 
    fontFamily: typography.sansRegular, 
    fontSize: 18, 
    color: colors.text, 
    lineHeight: 28,
    marginBottom: spacing.md,
  },

  highlightBox: {
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    borderRadius: radii.card,
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  highlightText: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.text,
    lineHeight: 28,
    fontStyle: 'italic',
  },

  emphasisText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.primary,
    lineHeight: 26,
    marginTop: spacing.sm,
  },

  comparisonSection: { marginTop: spacing.xl },
  comparisonTitle: { 
    fontFamily: typography.sansSemiBold, 
    fontSize: 14, 
    color: colors.mutedText, 
    textTransform: 'uppercase', 
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  comparisonRow: { flexDirection: 'row', gap: spacing.sm },
  comparisonCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  comparisonCardHighlight: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  comparisonLabel: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.mutedText, marginBottom: spacing.xs },
  comparisonLabelHighlight: { fontFamily: typography.sansSemiBold, fontSize: 12, color: colors.primary, marginBottom: spacing.xs },
  comparisonIcon: { fontSize: 32, marginBottom: spacing.sm },
  comparisonDesc: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, textAlign: 'center' },
  comparisonDescHighlight: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.text, textAlign: 'center' },

  trustSection: { marginTop: spacing.xl },
  trustItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  trustIcon: { fontSize: 20, marginRight: spacing.sm, width: 28 },
  trustText: { fontFamily: typography.sansRegular, fontSize: 15, color: colors.text },

  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
});





