/**
 * WHY DIFFERENT CARD
 * 
 * Compact version of the "Why We're Different" message.
 * Can be embedded in purchase screens, product pages, etc.
 */

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, radii } from '@/theme/tokens';

type Props = {
  variant?: 'compact' | 'full';
};

export const WhyDifferentCard = ({ variant = 'compact' }: Props) => {
  const navigation = useNavigation<any>();

  if (variant === 'compact') {
    return (
      <TouchableOpacity 
        style={styles.compactCard}
        onPress={() => navigation.navigate('WhyDifferent')}
      >
        <Text style={styles.compactIcon}>🔮</Text>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle}>Not standard AI</Text>
          <Text style={styles.compactText}>
            Deep reasoning mode · Holds 2 lives at once · 20+ pages coherent
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.fullCard}>
      <Text style={styles.fullTitle}>Why this is different</Text>
      <Text style={styles.fullText} selectable>
        A regular chatbot gives quick answers but cannot think in layers. 
        It cannot hold 2 lives at the same time or track emotional patterns across many pages.
      </Text>
      <View style={styles.highlightBox}>
        <Text style={styles.highlightText} selectable>
          These readings use a deeper reasoning mode that studies each person with detail, 
          understands how both energies meet, and writes long connected interpretations.
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.learnMore}
        onPress={() => navigation.navigate('WhyDifferent')}
      >
        <Text style={styles.learnMoreText}>Learn more →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact variant
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  compactIcon: { fontSize: 24, marginRight: spacing.sm },
  compactContent: { flex: 1 },
  compactTitle: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text },
  compactText: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, marginTop: 2 },
  arrow: { fontFamily: typography.sansBold, fontSize: 18, color: colors.primary },

  // Full variant
  fullCard: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullTitle: { 
    fontFamily: typography.sansSemiBold, 
    fontSize: 14, 
    color: colors.primary, 
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  fullText: { 
    fontFamily: typography.sansRegular, 
    fontSize: 15, 
    color: colors.text, 
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  highlightBox: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.card - 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  highlightText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  learnMore: { marginTop: spacing.md, alignSelf: 'flex-end' },
  learnMoreText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.primary },
});





