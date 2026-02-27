import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'CoreIdentitiesIntro'>;

// Compatibility screen kept for legacy route references.
// Active flow should route directly to CoreIdentities.
export const CoreIdentitiesIntroScreen = ({ navigation }: Props) => {
  useEffect(() => {
    const timeout = setTimeout(() => {
      navigation.replace('CoreIdentities');
    }, 300);

    return () => clearTimeout(timeout);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Preparing your core identities...</Text>
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  title: {
    fontFamily: typography.sansMedium,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  spinner: {
    marginTop: spacing.lg,
  },
});
