/**
 * ANIMATED SYSTEM LOADER
 * 
 * Beautiful loading animation that cycles through system images
 * with fade blending and color shifts.
 * 
 * - Western: Zodiac signs in indigo/gold tones
 * - Vedic: Zodiac signs in saffron/orange tones  
 * - Human Design: Single bodygraph with pumping + color flow
 * - Kabbalah: Tree of Life archetypes in purple tones
 * - Gene Keys: (coming soon)
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

// Vedic rashi images (only for Vedic astrology)
const VEDIC_IMAGES = [
  require('../../assets/zodiac/rashis/mesha-aries.png'),
  require('../../assets/zodiac/rashis/vrishabha-taurus.png'),
  require('../../assets/zodiac/rashis/mithuna-gemini.png'),
  require('../../assets/zodiac/rashis/karka-cancer.png'),
  require('../../assets/zodiac/rashis/simha-leo.png'),
  require('../../assets/zodiac/rashis/kanya-virgo.png'),
  require('../../assets/zodiac/rashis/tula-libra.png'),
  require('../../assets/zodiac/rashis/vrishchika-scorpio.png'),
  require('../../assets/zodiac/rashis/dhanu-sagittarius.png'),
  require('../../assets/zodiac/rashis/makara-capricorn.png'),
  require('../../assets/zodiac/rashis/kumbha-aquarius.png'),
  require('../../assets/zodiac/rashis/meena-pisces.png'),
];

// Unicode symbols for systems without PNG images
const SYSTEM_SYMBOLS: Record<string, string> = {
  western: '☉',      // Sun symbol for Western astrology
  gene_keys: '❋',    // Flower for Gene Keys
};

// Import Human Design bodygraph
const HUMAN_DESIGN_IMAGE = require('../../assets/systems/human-design.png');

// Import Kabbalah archetypes
const KABBALAH_IMAGES = [
  require('../../assets/systems/kabbalah/082EF620-0CDC-4F2D-95A4-5369D848FF63.png'),
  require('../../assets/systems/kabbalah/0843E35E-D182-4E04-8EB6-AB1A998A4109.png'),
  require('../../assets/systems/kabbalah/23D2AAB5-86D3-4A88-B4EA-C04F0F499C68.png'),
  require('../../assets/systems/kabbalah/32556A54-1CC4-42C9-A303-366945CCF097.png'),
  require('../../assets/systems/kabbalah/36689D07-8E50-4375-9668-3646CE1DA36F.png'),
  require('../../assets/systems/kabbalah/8093200C-BB59-400E-9A39-FE7713389D78.png'),
  require('../../assets/systems/kabbalah/9F9FB40C-4F98-4F60-8B56-06F69CC603D0.png'),
  require('../../assets/systems/kabbalah/A79033C7-5373-4D50-8595-217F9CD85F34.png'),
  require('../../assets/systems/kabbalah/BCE98729-D4D6-40E2-AB12-194449ED6DC5.png'),
  require('../../assets/systems/kabbalah/C1F5DA92-0A05-4D66-A487-C35BDC9C3FC5.png'),
  require('../../assets/systems/kabbalah/D78C6932-AC85-4262-B6FC-23F87E50B5A5.png'),
  require('../../assets/systems/kabbalah/D9637EA6-0332-440F-8B45-67BD3F0C2C82.png'),
  require('../../assets/systems/kabbalah/E5A918E7-CF81-454B-AF17-929856D9203C.png'),
  require('../../assets/systems/kabbalah/E624D61B-B5D4-4B6C-9585-CBE2C2B5D18C.png'),
];

type SystemType = 'western' | 'vedic' | 'human_design' | 'kabbalah' | 'gene_keys';

// Color schemes for each system
const SYSTEM_COLORS: Record<SystemType, string[]> = {
  western: ['#1a237e', '#3949ab', '#7986cb', '#D4A000', '#1a237e'], // Indigo to gold
  vedic: ['#e65100', '#ff6d00', '#ffc107', '#bf360c', '#e65100'],   // Saffron/orange
  human_design: ['#9D4EDD', '#00897b', '#4db6ac', '#ba68c8', '#9D4EDD'], // Magenta/teal
  kabbalah: ['#4a148c', '#7b1fa2', '#ba68c8', '#311b92', '#4a148c'], // Deep purple
  gene_keys: ['#880e4f', '#ad1457', '#f48fb1', '#d81b60', '#880e4f'], // Magenta/rose
};

interface Props {
  system: SystemType;
  size?: number;
  isActive?: boolean;
}

export const AnimatedSystemLoader: React.FC<Props> = ({ 
  system, 
  size = 160,
  isActive = true 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Systems that use Unicode symbols instead of images
  const useSymbol = system === 'western' || system === 'gene_keys';
  const symbol = SYSTEM_SYMBOLS[system];
  
  // Get images for systems that use them
  const images = system === 'human_design' 
    ? [HUMAN_DESIGN_IMAGE]
    : system === 'kabbalah'
      ? KABBALAH_IMAGES
      : system === 'vedic'
        ? VEDIC_IMAGES
        : []; // Western and Gene Keys use symbols, not images
  
  const colors = SYSTEM_COLORS[system];
  
  // Image cycling animation (for systems with multiple images)
  useEffect(() => {
    if (!isActive || images.length <= 1) return;
    
    const cycleImages = () => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 400,
        useNativeDriver: false, // Must match other animations on same node
      }).start(() => {
        // Change image
        setCurrentIndex(prev => (prev + 1) % images.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }).start();
      });
    };
    
    const interval = setInterval(cycleImages, 2000); // Change every 2 seconds
    return () => clearInterval(interval);
  }, [isActive, images.length]);
  
  // Color cycling animation
  useEffect(() => {
    if (!isActive) return;
    
    const colorCycle = Animated.loop(
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: false, // Color interpolation needs JS driver
      })
    );
    colorCycle.start();
    
    return () => colorCycle.stop();
  }, [isActive]);
  
  // Scale/pumping animation (subtle breathing effect)
  useEffect(() => {
    if (!isActive) return;
    
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // Must match - can't mix native/JS on same node
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    breathe.start();
    
    return () => breathe.stop();
  }, [isActive]);
  
  // Interpolate colors
  const animatedColor = colorAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: colors,
  });

  // Rotation animation for symbols (Western/Gene Keys)
  useEffect(() => {
    if (!isActive || !useSymbol) return;
    
    const spin = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    spin.start();
    
    return () => spin.stop();
  }, [isActive, useSymbol]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Render symbol for Western/Gene Keys, images for others
  if (useSymbol) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Animated.Text
          style={[
            styles.symbol,
            {
              fontSize: size * 0.6,
              color: animatedColor,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { rotate: rotation }],
            },
          ]}
        >
          {symbol}
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.Image
        source={images[currentIndex]}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            opacity: fadeAnim,
            tintColor: animatedColor,
            transform: [{ scale: scaleAnim }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    // Base styles
  },
  symbol: {
    fontWeight: '300',
    textAlign: 'center',
  },
});

export default AnimatedSystemLoader;

