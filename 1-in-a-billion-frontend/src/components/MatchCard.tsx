import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatchCard as MatchCardType } from '@/types/api';
import { colors, spacing, typography, radii } from '@/theme/tokens';

type MatchCardProps = {
  match: MatchCardType;
  onPress: () => void;
};

export const MatchCard = ({ match, onPress }: MatchCardProps) => {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {match.name} · {match.age}
        </Text>
        <View style={styles.scoreBubble}>
          <Text style={styles.scoreText}>{match.score.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={styles.city}>{match.city}</Text>
      <Text style={styles.summary}>{match.fitSummary}</Text>
      <View style={styles.tags}>
        {match.tags.map((tag) => (
          <View style={styles.tag} key={tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontFamily: typography.serifSemiBold,
    fontSize: 20,
    color: colors.text,
  },
  scoreBubble: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scoreText: {
    fontFamily: typography.sansSemiBold,
    color: colors.primary,
  },
  city: {
    fontFamily: typography.sansMedium,
    color: colors.mutedText,
  },
  summary: {
    fontFamily: typography.sansRegular,
    color: colors.text,
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    fontFamily: typography.sansMedium,
    color: colors.primary,
    fontSize: 12,
  },
});

