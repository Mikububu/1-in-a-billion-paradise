/**
 * ANIMATED BORDER BUTTON
 * 
 * A button with animated gradient border that creates a "moving" effect.
 * Uses LinearGradient with animated rotation.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, radii } from '@/theme/tokens';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Continuous rotation
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
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View style={styles.container}>
          {/* Rotating gradient border */}
          <Animated.View style={[styles.gradientWrapper, animatedStyle]}>
            <LinearGradient
              colors={[color, 'transparent', color, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            />
          </Animated.View>
          
          {/* Inner button content */}
          <View style={styles.innerButton}>
            <Text style={[styles.label, { color }]}>{label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const BORDER_WIDTH = 3;

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginTop: spacing.md,
  },
  container: {
    height: 50,
    borderRadius: radii.button,
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
  innerButton: {
    position: 'absolute',
    top: BORDER_WIDTH,
    left: BORDER_WIDTH,
    right: BORDER_WIDTH,
    bottom: BORDER_WIDTH,
    backgroundColor: '#ECEAE6',
    borderRadius: radii.button - BORDER_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default MarchingAntsButton;
