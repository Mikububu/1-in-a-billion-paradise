/**
 * READY TO MATCH SCREEN
 * 
 * Transition screen before entering partner data.
 * Builds anticipation.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';

type Props = {
  onContinue: () => void;
};

export const ReadyToMatchScreen = ({ onContinue }: Props) => {
  const fade1 = useRef(new Animated.Value(0)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const fade3 = useRef(new Animated.Value(0)).current;
  const fade4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(250, [
      Animated.timing(fade1, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fade2, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fade3, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fade4, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.Text style={[styles.line1, { opacity: fade1 }]} selectable>
          Now
        </Animated.Text>
        <Animated.Text style={[styles.line2, { opacity: fade2 }]} selectable>
          tell us about
        </Animated.Text>
        <Animated.Text style={[styles.line3, { opacity: fade3 }]} selectable>
          them
        </Animated.Text>
        <Animated.Text style={[styles.line4, { opacity: fade4 }]} selectable>
          someone you love, someone you wonder about
        </Animated.Text>
      </View>

      <View style={styles.footer}>
        <Button label="Continue" onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.page },
  line1: { fontFamily: typography.headline, fontSize: 32, color: colors.mutedText },
  line2: { fontFamily: typography.headline, fontSize: 32, color: colors.text, marginTop: spacing.sm },
  line3: { fontFamily: typography.headline, fontSize: 72, color: colors.text, fontStyle: 'italic', marginTop: spacing.xs },
  line4: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginTop: spacing.xl, textAlign: 'center', fontStyle: 'italic' },
  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
});





