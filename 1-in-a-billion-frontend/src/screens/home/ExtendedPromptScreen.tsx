import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ExtendedPrompt'>;

export const ExtendedPromptScreen = ({ navigation }: Props) => {
  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />
      
      <View style={styles.content}>
        <Text style={styles.line1} selectable>Would you like</Text>
        <Text style={styles.line2} selectable>a deeper</Text>
        <Text style={styles.line3} selectable>reading</Text>
        <Text style={styles.line4} selectable>about</Text>
        <Text style={styles.line5} selectable>yourself?</Text>
        
        <Text style={styles.subtitle} selectable>
          Explore Western, Vedic, Human Design, Gene Keys, and Kabbalah
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Button 
          label="YES" 
          onPress={() => navigation.navigate('ExtendedReading')}
          style={styles.yesButton}
        />
        <Button 
          label="NO" 
          variant="secondary"
          onPress={() => navigation.navigate('Home')}
          style={styles.noButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  line1: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  line2: {
    fontFamily: typography.headline,
    fontSize: 42,
    fontStyle: 'italic',
    color: colors.text,
    textAlign: 'center',
  },
  line3: {
    fontFamily: typography.headline,
    fontSize: 52,
    color: colors.text,
    textAlign: 'center',
  },
  line4: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
  },
  line5: {
    fontFamily: typography.headline,
    fontSize: 48,
    fontStyle: 'italic',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  yesButton: {
    flex: 1,
  },
  noButton: {
    flex: 1,
  },
});

