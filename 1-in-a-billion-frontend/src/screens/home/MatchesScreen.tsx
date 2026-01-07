import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'Matches'>;

export const MatchesScreen = ({ navigation }: Props) => {
  return (
    <ScreenShell
      title="Your matches"
      subtitle="People with rare compatibility across all systems."
      footer={<Button label="My Secret Life" onPress={() => navigation.goBack()} />}
    >
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>No matches yet</Text>
        <Text style={styles.placeholderSub}>
          The matching engine is being set up. Check back soon!
        </Text>
      </View>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  placeholderText: {
    fontFamily: typography.serifBold,
    fontSize: 24,
    color: colors.text,
  },
  placeholderSub: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
  },
});
