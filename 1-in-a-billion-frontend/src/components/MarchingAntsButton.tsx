/**
 * MARCHING ANTS BUTTON
 * 
 * A button with an animated dashed border that appears to move around the edge.
 * Uses a simple pulsing scale animation since SVG marching ants is problematic.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing, radii } from '@/theme/tokens';

interface MarchingAntsButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
}

export const MarchingAntsButton: React.FC<MarchingAntsButtonProps> = ({
  label,
  onPress,
  color = colors.primary,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Subtle pulsing animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.8}
        style={[styles.button, { borderColor: color }]}
      >
        <Text style={[styles.label, { color }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
  button: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    borderRadius: radii.button,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MarchingAntsButton;
