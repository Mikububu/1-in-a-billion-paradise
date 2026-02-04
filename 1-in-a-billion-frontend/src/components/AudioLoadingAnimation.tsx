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

/**
 * Circular shimmer animation for the play button
 * Shows a rotating ring effect while audio is generating
 */
export const CircularShimmerAnimation: React.FC<{
  size?: number;
  baseColor?: string;
  highlightColor?: string;
}> = ({
  size = 50,
  baseColor = '#FFFFFF',
  highlightColor = '#C41E3A',
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const center = size / 2;
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* White background circle */}
      <View style={{
        position: 'absolute',
        width: size - 4,
        height: size - 4,
        borderRadius: size / 2,
        backgroundColor: baseColor,
      }} />
      
      {/* Rotating arc */}
      <Animated.View style={[{ position: 'absolute' }, rotateStyle]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={highlightColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${radius * Math.PI * 0.6} ${radius * Math.PI * 1.4}`}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

/**
 * Shimmer loading animation - modern skeleton effect for the slider
 * Shows a smooth gradient sweep across the slider while audio is generating
 */
export const ShimmerSliderAnimation: React.FC<{
  width?: number;
  height?: number;
  borderRadius?: number;
  baseColor?: string;
  highlightColor?: string;
}> = ({ 
  width = 200, 
  height = 28, 
  borderRadius = 14,
  baseColor = '#F3F4F6',
  highlightColor = '#FFFFFF'
}) => {
  const shimmerPosition = useSharedValue(-1);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(2, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerPosition.value,
      [-1, 2],
      [-width, width * 2]
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[shimmerStyles.container, { width, height, borderRadius }]}>
      {/* Base background */}
      <View style={[shimmerStyles.base, { backgroundColor: baseColor, borderRadius }]} />
      
      {/* Shimmer highlight - simple colored bar */}
      <Animated.View style={[
        shimmerStyles.shimmerBar,
        { backgroundColor: highlightColor, height },
        shimmerStyle
      ]} />
      
      {/* Subtle pulsing dots to indicate "working" */}
      <View style={shimmerStyles.dotsContainer}>
        <PulsingDots color="#9CA3AF" />
      </View>
    </View>
  );
};

/**
 * Pulsing dots indicator - 3 dots that pulse in sequence
 */
const PulsingDots: React.FC<{ color?: string; size?: number }> = ({ 
  color = '#9CA3AF', 
  size = 4 
}) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const duration = 400;
    
    dot1.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 150);

    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, 300);
  }, []);

  const dotStyle1 = useAnimatedStyle(() => ({
    opacity: interpolate(dot1.value, [0, 1], [0.3, 1]),
    transform: [{ scale: interpolate(dot1.value, [0, 1], [0.8, 1.2]) }],
  }));

  const dotStyle2 = useAnimatedStyle(() => ({
    opacity: interpolate(dot2.value, [0, 1], [0.3, 1]),
    transform: [{ scale: interpolate(dot2.value, [0, 1], [0.8, 1.2]) }],
  }));

  const dotStyle3 = useAnimatedStyle(() => ({
    opacity: interpolate(dot3.value, [0, 1], [0.3, 1]),
    transform: [{ scale: interpolate(dot3.value, [0, 1], [0.8, 1.2]) }],
  }));

  return (
    <View style={shimmerStyles.dots}>
      <Animated.View style={[shimmerStyles.dot, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }, dotStyle1]} />
      <Animated.View style={[shimmerStyles.dot, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }, dotStyle2]} />
      <Animated.View style={[shimmerStyles.dot, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }, dotStyle3]} />
    </View>
  );
};

const shimmerStyles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  shimmerBar: {
    position: 'absolute',
    top: 0,
    width: 60,
    opacity: 0.5,
    borderRadius: 14,
  },
  dotsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    marginHorizontal: 2,
  },
});

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
