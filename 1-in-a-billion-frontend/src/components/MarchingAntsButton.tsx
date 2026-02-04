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
  color?: string;
}

export const MarchingAntsButton: React.FC<MarchingAntsButtonProps> = ({
  label,
  onPress,
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
  const height = 50;

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.8}
      style={styles.touchable}
    >
      <View style={styles.container}>
        {/* Off-white background */}
        <View style={[styles.background, { borderRadius }]} />
        
        {/* SVG border with marching ants */}
        <Svg
          width="100%"
          height={height}
          style={StyleSheet.absoluteFill}
        >
          <AnimatedRect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width="99%"
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
  touchable: {
    width: '100%',
    marginTop: spacing.md,
  },
  container: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FAF8F5', // off-white matching the app background
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MarchingAntsButton;
