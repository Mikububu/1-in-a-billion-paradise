/**
 * WELCOME BACK SCREEN
 * 
 * Shown when returning user opens the app.
 * Warm, personal greeting.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  userName: string;
  onContinue: () => void;
};

export const WelcomeBackScreen = ({ userName, onContinue }: Props) => {
  const fade1 = useRef(new Animated.Value(0)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const fade3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.timing(fade1, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade2, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade3, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Auto-advance after 3 seconds
    const timer = setTimeout(onContinue, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.content} onPress={onContinue} activeOpacity={0.9}>
        <Animated.Text style={[styles.welcome, { opacity: fade1 }]} selectable>
          Welcome back,
        </Animated.Text>
        <Animated.Text style={[styles.name, { opacity: fade2 }]} selectable>
          {userName}
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: fade3 }]} selectable>
          The stars remember you
        </Animated.Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.page },
  welcome: { fontFamily: typography.headline, fontSize: 28, color: colors.mutedText, fontStyle: 'italic' },
  name: { fontFamily: typography.headline, fontSize: 56, color: colors.text, marginTop: spacing.sm },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 18, color: colors.mutedText, marginTop: spacing.xl, fontStyle: 'italic' },
});





