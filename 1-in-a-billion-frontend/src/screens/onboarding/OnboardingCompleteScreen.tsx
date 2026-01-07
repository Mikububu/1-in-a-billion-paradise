/**
 * ONBOARDING COMPLETE SCREEN
 * 
 * Celebration + summary after user completes their initial readings.
 * Shows all 3 core signs together beautifully before transitioning to main app.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { OnboardingStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingComplete'>;

export const OnboardingCompleteScreen = ({ navigation }: Props) => {
  const hookReadings = useOnboardingStore((s) => s.hookReadings);

  // Get signs from stored readings
  const signs = {
    sun: hookReadings.sun?.sign || 'Virgo',
    moon: hookReadings.moon?.sign || 'Leo',
    rising: hookReadings.rising?.sign || 'Sagittarius',
  };

  // Animation values
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const scale1 = useRef(new Animated.Value(0.8)).current;
  const scale2 = useRef(new Animated.Value(0.8)).current;
  const scale3 = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.stagger(150, [
        Animated.spring(scale1, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.spring(scale2, { toValue: 1, friction: 4, useNativeDriver: true }),
        Animated.spring(scale3, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleContinue = () => {
    // CONTRACT: User must sign in with Google to create Supabase user
    // Navigate to Account screen where they can authenticate
    // After auth, RootNavigator will automatically show MainNavigator (Dashboard)
    navigation.navigate('Account');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen ID */}
      <Text style={styles.screenId}>9</Text>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeIn, transform: [{ translateY: slideUp }] }
        ]}
      >
        {/* Celebration text */}
        <Text style={styles.celebration}>Your chart is ready</Text>

        {/* The 3 signs */}
        <View style={styles.signsContainer}>
          <Animated.View style={[styles.signCard, { transform: [{ scale: scale1 }] }]}>
            <Text style={styles.signLabel}>Sun</Text>
            <Text style={styles.signIcon}>☉</Text>
            <Text style={styles.signName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{signs.sun}</Text>
            <Text style={styles.signDesc}>Your core self</Text>
          </Animated.View>

          <Animated.View style={[styles.signCard, { transform: [{ scale: scale2 }] }]}>
            <Text style={styles.signLabel}>Moon</Text>
            <Text style={styles.signIcon}>☽</Text>
            <Text style={styles.signName} selectable numberOfLines={1} adjustsFontSizeToFit>{signs.moon}</Text>
            <Text style={styles.signDesc}>Your inner world</Text>
          </Animated.View>

          <Animated.View style={[styles.signCard, { transform: [{ scale: scale3 }] }]}>
            <Text style={styles.signLabel}>Rising</Text>
            <Text style={styles.signIcon}>↑</Text>
            <Text style={styles.signName} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{signs.rising}</Text>
            <Text style={styles.signDesc}>Your mask</Text>
          </Animated.View>
        </View>

        {/* What's next */}
        <View style={styles.nextSection}>
          <Text style={styles.nextTitle} selectable>What happens now?</Text>
          <Text style={styles.nextText} selectable>
            Your profile is live in the matching pool. When we find someone whose chart
            resonates with yours, you'll be the first to know.
          </Text>
          <Text style={styles.nextText} selectable>
            In the meantime, you can overlay anyone's chart over yours to see your
            compatibility, deep dive into extended readings, or explore your full chart.
          </Text>
        </View>
      </Animated.View>

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          label="Create Account"
          onPress={handleContinue}
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xl * 2,
  },
  celebration: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xl,
  },
  signsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  signCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.xs,
    marginHorizontal: 2,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  signLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: 10,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signIcon: {
    fontSize: 24,
    marginVertical: spacing.xs,
  },
  signName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
  },
  signDesc: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.mutedText,
    marginTop: 2,
  },
  nextSection: {
    marginTop: spacing.lg,
  },
  nextTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  nextText: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.mutedText,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  screenId: {
    position: 'absolute',
    top: 95,
    left: 20,
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.text,
    zIndex: 100,
  },
});

