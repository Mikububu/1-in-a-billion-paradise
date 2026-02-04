/**
 * MARCHING ANTS BUTTON
 * 
 * A button with an animated dashed border that appears to move around the edge.
 * Uses SVG with animated strokeDashoffset for the marching ants effect.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { colors, typography, spacing, radii } from '@/theme/tokens';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface MarchingAntsButtonProps {
  label: string;
  onPress: () => void;
  width?: number;
  height?: number;
  color?: string;
}

export const MarchingAntsButton: React.FC<MarchingAntsButtonProps> = ({
  label,
  onPress,
  width = 300,
  height = 50,
  color = colors.primary,
}) => {
  const dashOffset = useSharedValue(0);

  useEffect(() => {
    // Animate the dash offset to create marching ants effect
    dashOffset.value = withRepeat(
      withTiming(-30, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1, // infinite
      false
    );
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const borderRadius = radii.button;
  const strokeWidth = 2;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.container, { width, height }]}>
        {/* SVG border with marching ants */}
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
        >
          <AnimatedRect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={width - strokeWidth}
            height={height - strokeWidth}
            rx={borderRadius}
            ry={borderRadius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray="10 5"
            fill="transparent"
            animatedProps={animatedProps}
          />
        </Svg>
        
        {/* Button text */}
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MarchingAntsButton;
