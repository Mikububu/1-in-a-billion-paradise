/**
 * STATEMENT SCREEN
 * 
 * Big, beautiful typography screens for emotional moments.
 * Used for transitions, introductions, loading states.
 * 
 * Style: Dramatic, minimal, centered, breathing room.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';

type Line = {
  text: string;
  size?: 'small' | 'medium' | 'large' | 'huge';
  italic?: boolean;
  animate?: 'fade' | 'pulse' | 'spin';
  color?: string;
};

type Props = {
  lines: Line[];
  buttonLabel?: string;
  onButtonPress?: () => void;
  autoAdvance?: number; // ms to auto-advance
  onAutoAdvance?: () => void;
};

export const StatementScreen = ({ 
  lines, 
  buttonLabel, 
  onButtonPress,
  autoAdvance,
  onAutoAdvance,
}: Props) => {
  // Animations for each line
  const fadeAnims = useRef(lines.map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stagger fade-in for each line
    const animations = fadeAnims.map((anim, idx) => 
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: idx * 200,
        useNativeDriver: true,
      })
    );
    Animated.parallel(animations).start();

    // Pulse animation for lines that need it
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    // Spin animation
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();

    // Auto-advance timer
    if (autoAdvance && onAutoAdvance) {
      const timer = setTimeout(onAutoAdvance, autoAdvance);
      return () => clearTimeout(timer);
    }
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getFontSize = (size: Line['size']) => {
    switch (size) {
      case 'small': return 18;
      case 'medium': return 28;
      case 'large': return 42;
      case 'huge': return 120;
      default: return 32;
    }
  };

  const getLineHeight = (size: Line['size']) => {
    switch (size) {
      case 'small': return 24;
      case 'medium': return 36;
      case 'large': return 50;
      case 'huge': return 130;
      default: return 40;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {lines.map((line, idx) => {
          const animStyle: any = { opacity: fadeAnims[idx] };
          
          if (line.animate === 'pulse') {
            animStyle.transform = [{ scale: pulseAnim }];
          } else if (line.animate === 'spin') {
            animStyle.transform = [{ rotate: spin }];
          }

          return (
            <Animated.Text
              key={idx}
              style={[
                styles.text,
                {
                  fontSize: getFontSize(line.size),
                  lineHeight: getLineHeight(line.size),
                  fontStyle: line.italic ? 'italic' : 'normal',
                  color: line.color || colors.text,
                  fontFamily: line.size === 'huge' ? typography.serifBold : typography.headline,
                },
                animStyle,
              ]}
              selectable
            >
              {line.text}
            </Animated.Text>
          );
        })}
      </View>

      {buttonLabel && onButtonPress && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={onButtonPress}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep transparent so the global leather texture shows through.
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
  },
  text: {
    fontFamily: typography.headline,
    color: colors.text,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignSelf: 'center',
  },
  buttonText: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
});





