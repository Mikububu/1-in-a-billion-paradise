/**
 * AnimatedZodiacLoader
 * 
 * Displays zodiac sign PNGs with animated color modulation.
 * Colors cycle through a mystical spectrum: gold → crimson → violet → teal → gold
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View, Easing } from 'react-native';

// Zodiac sign images - Vedic rashis (using relative paths for Metro bundler)
const RASHI_IMAGES: Record<string, any> = {
  aries: require('../../assets/zodiac/rashis/mesha-aries.png'),
  taurus: require('../../assets/zodiac/rashis/vrishabha-taurus.png'),
  gemini: require('../../assets/zodiac/rashis/mithuna-gemini.png'),
  cancer: require('../../assets/zodiac/rashis/karka-cancer.png'),
  leo: require('../../assets/zodiac/rashis/simha-leo.png'),
  virgo: require('../../assets/zodiac/rashis/kanya-virgo.png'),
  libra: require('../../assets/zodiac/rashis/tula-libra.png'),
  scorpio: require('../../assets/zodiac/rashis/vrishchika-scorpio.png'),
  sagittarius: require('../../assets/zodiac/rashis/dhanu-sagittarius.png'),
  capricorn: require('../../assets/zodiac/rashis/makara-capricorn.png'),
  aquarius: require('../../assets/zodiac/rashis/kumbha-aquarius.png'),
  pisces: require('../../assets/zodiac/rashis/meena-pisces.png'),
};

// Graha (planet) images
const GRAHA_IMAGES: Record<string, any> = {
  sun: require('../../assets/zodiac/grahas/surya-sun.png'),
  moon: require('../../assets/zodiac/grahas/candra-moon.png'),
  mars: require('../../assets/zodiac/grahas/mangala-mars.png'),
  mercury: require('../../assets/zodiac/grahas/budha-mercury.png'),
  jupiter: require('../../assets/zodiac/grahas/brihaspati-jupiter.png'),
  venus: require('../../assets/zodiac/grahas/shukra-venus.png'),
  saturn: require('../../assets/zodiac/grahas/shani-saturn.png'),
  rahu: require('../../assets/zodiac/grahas/rahu-northnode.png'),
};

// Mystical color palette for animation
const COLOR_SPECTRUM = [
  '#FFD700', // Gold
  '#FF6B35', // Warm orange
  '#DC143C', // Crimson
  '#9B59B6', // Violet
  '#6B5B95', // Purple haze
  '#3498DB', // Ocean blue
  '#1ABC9C', // Teal
  '#2ECC71', // Emerald
  '#FFD700', // Back to gold
];

type AnimatedZodiacLoaderProps = {
  /** Type of celestial body - 'rashi' for zodiac signs, 'graha' for planets */
  type: 'rashi' | 'graha';
  /** The sign or planet name (e.g., 'aries', 'sun') */
  name: string;
  /** Size of the image */
  size?: number;
  /** Enable rotation animation */
  rotate?: boolean;
  /** Rotation duration in ms */
  rotationDuration?: number;
  /** Color cycle duration in ms */
  colorDuration?: number;
};

export const AnimatedZodiacLoader = ({
  type,
  name,
  size = 120,
  rotate = true,
  rotationDuration = 8000,
  colorDuration = 4000,
}: AnimatedZodiacLoaderProps) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Get the correct image source
  const imageSource = type === 'rashi' 
    ? RASHI_IMAGES[name.toLowerCase()] 
    : GRAHA_IMAGES[name.toLowerCase()];

  useEffect(() => {
    // All animations must use same driver - false because tintColor needs JS driver
    
    // Rotation animation
    if (rotate) {
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: rotationDuration,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      rotateLoop.start();
    }

    // Color cycling animation
    const colorLoop = Animated.loop(
      Animated.timing(colorAnim, {
        toValue: COLOR_SPECTRUM.length - 1,
        duration: colorDuration,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    colorLoop.start();

    // Gentle pulse for glow effect
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      rotateAnim.stopAnimation();
      colorAnim.stopAnimation();
      pulseAnim.stopAnimation();
    };
  }, [rotate, rotationDuration, colorDuration]);

  // Interpolate rotation
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Interpolate color through spectrum
  const tintColor = colorAnim.interpolate({
    inputRange: COLOR_SPECTRUM.map((_, i) => i),
    outputRange: COLOR_SPECTRUM,
  });

  if (!imageSource) {
    // Fallback if image not found
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Animated.Text 
          style={[
            styles.fallbackText, 
            { 
              fontSize: size * 0.6,
              transform: [{ rotate: spin }, { scale: pulseAnim }]
            }
          ]}
        >
          ✧
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Glow effect layer - disabled for now */}
      
      {/* Main image - no tint to show original colors */}
      <Animated.Image
        source={imageSource}
        style={[
          styles.mainImage,
          {
            width: size,
            height: size,
            // tintColor removed to show original image
            transform: [
              { rotate: rotate ? spin : '0deg' },
              { scale: pulseAnim },
            ],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

/**
 * Preset loader for multiple signs orbiting
 */
type ZodiacOrbitLoaderProps = {
  signs?: string[];
  centerSize?: number;
  orbitSize?: number;
};

export const ZodiacOrbitLoader = ({
  signs = ['aries', 'leo', 'sagittarius', 'cancer', 'scorpio', 'pisces'],
  centerSize = 80,
  orbitSize = 200,
}: ZodiacOrbitLoaderProps) => {
  const orbitAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    orbit.start();
    return () => orbit.stop();
  }, []);

  const orbitRotation = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.orbitContainer, { width: orbitSize, height: orbitSize }]}>
      {/* Center loader */}
      <AnimatedZodiacLoader type="graha" name="sun" size={centerSize} />
      
      {/* Orbiting signs */}
      <Animated.View
        style={[
          styles.orbitRing,
          {
            width: orbitSize,
            height: orbitSize,
            transform: [{ rotate: orbitRotation }],
          },
        ]}
      >
        {signs.map((sign, index) => {
          const angle = (index * 360) / signs.length;
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * (orbitSize / 2 - 20);
          const y = Math.sin(rad) * (orbitSize / 2 - 20);
          
          return (
            <View
              key={sign}
              style={[
                styles.orbitItem,
                {
                  left: orbitSize / 2 + x - 15,
                  top: orbitSize / 2 + y - 15,
                },
              ]}
            >
              <AnimatedZodiacLoader
                type="rashi"
                name={sign}
                size={30}
                rotate={false}
              />
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowImage: {
    position: 'absolute',
  },
  mainImage: {
    position: 'absolute',
  },
  fallbackText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  orbitContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitRing: {
    position: 'absolute',
  },
  orbitItem: {
    position: 'absolute',
  },
});

export default AnimatedZodiacLoader;

