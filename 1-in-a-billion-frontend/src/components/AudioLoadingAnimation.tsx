/**
 * AUDIO LOADING ANIMATION
 * 
 * A smooth, elegant SVG animation for the audio slider loading state.
 * Uses react-native-reanimated for smooth 60fps animations.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);

interface AudioLoadingAnimationProps {
  size?: number;
  color?: string;
}

export const AudioLoadingAnimation: React.FC<AudioLoadingAnimationProps> = ({
  size = 24,
  color = '#C41E3A',
}) => {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    // Continuous rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1, // infinite
      false
    );

    // Pulsing effect
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.8, 1.2]);
    const opacity = interpolate(pulse.value, [0, 1], [0.4, 1]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const center = size / 2;
  const strokeWidth = size / 10;
  const radius = (size - strokeWidth) / 2 - 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Pulsing background circle */}
      <Animated.View style={[styles.pulseCircle, pulseStyle, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius * 0.6}
            fill={color}
            opacity={0.2}
          />
        </Svg>
      </Animated.View>

      {/* Rotating arc */}
      <Animated.View style={[styles.rotatingArc, animatedStyle]}>
        <Svg width={size} height={size}>
          <G>
            {/* Background track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Animated arc - 3 dots rotating */}
            {[0, 120, 240].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = center + radius * Math.cos(rad);
              const y = center + radius * Math.sin(rad);
              const dotSize = strokeWidth * (1 - i * 0.15);
              return (
                <Circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={dotSize}
                  fill={color}
                  opacity={1 - i * 0.25}
                />
              );
            })}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
};

/**
 * Inline slider loading animation - shows within the slider track
 */
export const SliderLoadingAnimation: React.FC<{
  width?: number;
  height?: number;
  color?: string;
}> = ({ width = 200, height = 4, color = '#C41E3A' }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true // reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [-width * 0.3, width * 0.3]);
    const scaleX = interpolate(progress.value, [0, 0.5, 1], [0.3, 0.6, 0.3]);
    return {
      transform: [{ translateX }, { scaleX }],
    };
  });

  return (
    <View style={[styles.sliderContainer, { width, height }]}>
      {/* Background track */}
      <View style={[styles.sliderTrack, { backgroundColor: '#E5E7EB', height }]} />
      {/* Animated highlight */}
      <Animated.View
        style={[
          styles.sliderHighlight,
          { backgroundColor: color, height },
          animatedStyle,
        ]}
      />
    </View>
  );
};

/**
 * Sound wave animation - 3 bars that animate like an equalizer
 */
export const SoundWaveAnimation: React.FC<{
  size?: number;
  color?: string;
}> = ({ size = 24, color = '#C41E3A' }) => {
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);

  useEffect(() => {
    // Staggered animations for each bar
    bar1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    setTimeout(() => {
      bar2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 100);

    setTimeout(() => {
      bar3.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 350, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 200);
  }, []);

  const barStyle1 = useAnimatedStyle(() => ({
    height: interpolate(bar1.value, [0, 1], [size * 0.3, size * 0.9]),
  }));

  const barStyle2 = useAnimatedStyle(() => ({
    height: interpolate(bar2.value, [0, 1], [size * 0.2, size]),
  }));

  const barStyle3 = useAnimatedStyle(() => ({
    height: interpolate(bar3.value, [0, 1], [size * 0.4, size * 0.7]),
  }));

  const barWidth = size / 5;
  const gap = size / 10;

  return (
    <View style={[styles.waveContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.waveBar,
          { width: barWidth, backgroundColor: color, borderRadius: barWidth / 2 },
          barStyle1,
        ]}
      />
      <View style={{ width: gap }} />
      <Animated.View
        style={[
          styles.waveBar,
          { width: barWidth, backgroundColor: color, borderRadius: barWidth / 2 },
          barStyle2,
        ]}
      />
      <View style={{ width: gap }} />
      <Animated.View
        style={[
          styles.waveBar,
          { width: barWidth, backgroundColor: color, borderRadius: barWidth / 2 },
          barStyle3,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatingArc: {
    position: 'absolute',
  },
  sliderContainer: {
    overflow: 'hidden',
    borderRadius: 2,
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 2,
  },
  sliderHighlight: {
    position: 'absolute',
    width: '40%',
    borderRadius: 2,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveBar: {
    minHeight: 4,
  },
});

export default AudioLoadingAnimation;
