/**
 * ANIMATED GRADIENT BORDER
 * 
 * A reusable component that wraps content with an animated rotating gradient border.
 * Used for loading/pending states.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedGradientBorderProps {
  children: React.ReactNode;
  color?: string;
  borderWidth?: number;
  borderRadius?: number;
  height?: number;
  style?: ViewStyle;
}

export const AnimatedGradientBorder: React.FC<AnimatedGradientBorderProps> = ({
  children,
  color = '#C41E3A',
  borderWidth = 2,
  borderRadius = 14,
  height = 28,
  style,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { height, borderRadius }, style]}>
      {/* Rotating gradient border */}
      <Animated.View style={[styles.gradientWrapper, animatedStyle]}>
        <LinearGradient
          colors={[color, 'transparent', color, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>
      
      {/* Inner content */}
      <View style={[
        styles.inner, 
        { 
          top: borderWidth, 
          left: borderWidth, 
          right: borderWidth, 
          bottom: borderWidth,
          borderRadius: borderRadius - borderWidth,
        }
      ]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  gradientWrapper: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    width: 500,
    height: 500,
  },
  inner: {
    position: 'absolute',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AnimatedGradientBorder;
