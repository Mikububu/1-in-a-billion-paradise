/**
 * MULTI-SYSTEM ANIMATION COMPONENT
 * 
 * Reusable animated loading screen for multi-system readings.
 * Shows all 5 systems with their unique animations.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';

const SYSTEMS = [
  { symbol: '☉', name: 'Western', color: '#D4A000', insight: 'Your psychology' },
  { symbol: 'ॐ', name: 'Vedic', color: '#E85D04', insight: 'Your karma' },
  { symbol: '◬', name: 'Human Design', color: '#9D4EDD', insight: 'Your strategy' },
  { symbol: '❋', name: 'Gene Keys', color: '#059669', insight: 'Your gifts' },
  { symbol: '✧', name: 'Kabbalah', color: '#7C3AED', insight: 'Your tikkun' },
];

const LOADING_MESSAGES = [
  'GENERATING',
  'THIS WILL TAKE A WHILE',
  'GENERATING',
  'YOU CAN LEAVE THE APP MEANWHILE',
];

interface MultiSystemAnimationProps {
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
  minDisplayTime?: number; // Minimum time to show animation (ms)
}

export const MultiSystemAnimation = ({
  title = 'Weaving Your Truth',
  subtitle = 'Five ancient lenses, one complete picture',
  onComplete,
  minDisplayTime = 3000,
}: MultiSystemAnimationProps) => {
  const [currentSystemIndex, setCurrentSystemIndex] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const startTimeRef = useRef<number>(Date.now());

  console.log('🎬 MultiSystemAnimation component mounted/rendered');

  // Animation refs
  const westernSpin = useRef(new Animated.Value(0)).current;
  const vedicPulse = useRef(new Animated.Value(0.5)).current;
  const hdScale = useRef(new Animated.Value(1)).current;
  const geneBloom = useRef(new Animated.Value(0.7)).current;
  const kabbDescend = useRef(new Animated.Value(-15)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Status text pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // ☉ WESTERN: Slow majestic spin
    Animated.loop(
      Animated.timing(westernSpin, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // ॐ VEDIC: Pulse like a mantra breath
    Animated.loop(
      Animated.sequence([
        Animated.timing(vedicPulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(vedicPulse, { toValue: 0.5, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // ◬ HUMAN DESIGN: Heartbeat pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(hdScale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(hdScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(hdScale, { toValue: 1.1, duration: 120, useNativeDriver: true }),
        Animated.timing(hdScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(700),
      ])
    ).start();

    // ❋ GENE KEYS: Bloom like a flower
    Animated.loop(
      Animated.sequence([
        Animated.timing(geneBloom, { toValue: 1.3, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(geneBloom, { toValue: 0.7, duration: 1500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // ✧ KABBALAH: Light descending/ascending
    Animated.loop(
      Animated.sequence([
        Animated.timing(kabbDescend, { toValue: 15, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(kabbDescend, { toValue: -15, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(300),
      ])
    ).start();

    // Cycle through systems
    const systemInterval = setInterval(() => {
      setCurrentSystemIndex(prev => (prev + 1) % SYSTEMS.length);
    }, 3000);

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    // Handle completion callback
    if (onComplete) {
      const elapsed = Date.now() - startTimeRef.current;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);
      
      setTimeout(() => {
        onComplete();
      }, remainingTime);
    }

    return () => {
      clearInterval(systemInterval);
      clearInterval(messageInterval);
    };
  }, [onComplete, minDisplayTime]);

  const currentSystem = SYSTEMS[currentSystemIndex];

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.loadingContainer, { opacity: fadeIn }]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* The Epic 5-Symbol Circle */}
        <View style={styles.symbolCircle}>
          {/* Western - Top */}
          <Animated.Text
            style={[
              styles.circleSymbol,
              styles.symbolWestern,
              {
                color: SYSTEMS[0].color,
                transform: [{
                  rotate: westernSpin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })
                }]
              }
            ]}
          >
            ☉
          </Animated.Text>

          {/* Vedic - Top Right */}
          <Animated.Text
            style={[
              styles.circleSymbol,
              styles.symbolVedic,
              {
                color: SYSTEMS[1].color,
                opacity: vedicPulse,
              }
            ]}
          >
            ॐ
          </Animated.Text>

          {/* Human Design - Bottom Right */}
          <Animated.Text
            style={[
              styles.circleSymbol,
              styles.symbolHD,
              {
                color: SYSTEMS[2].color,
                transform: [{ scale: hdScale }]
              }
            ]}
          >
            ◬
          </Animated.Text>

          {/* Gene Keys - Bottom Left */}
          <Animated.Text
            style={[
              styles.circleSymbol,
              styles.symbolGene,
              {
                color: SYSTEMS[3].color,
                transform: [{ scale: geneBloom }]
              }
            ]}
          >
            ❋
          </Animated.Text>

          {/* Kabbalah - Top Left */}
          <Animated.Text
            style={[
              styles.circleSymbol,
              styles.symbolKabb,
              {
                color: SYSTEMS[4].color,
                transform: [{ translateY: kabbDescend }]
              }
            ]}
          >
            ✧
          </Animated.Text>

          {/* Center - Current System */}
          <View style={styles.centerCircle}>
            <Text style={[styles.centerSymbol, { color: currentSystem.color }]}>
              {currentSystem.symbol}
            </Text>
          </View>
        </View>

        {/* Status */}
        <Animated.View style={{ transform: [{ scale: statusPulse }] }}>
          <Text style={[styles.statusSystem, { color: currentSystem.color }]}>
            {currentSystem.name}
          </Text>
          <Text style={styles.statusInsight}>
            Analyzing {currentSystem.insight}...
          </Text>
        </Animated.View>

        {/* Loading Message */}
        <Animated.Text style={[styles.loadingMessage, { transform: [{ scale: statusPulse }] }]}>
          {LOADING_MESSAGES[loadingMessageIndex]}
        </Animated.Text>

        {/* Progress Dots */}
        <View style={styles.progressDots}>
          {SYSTEMS.map((sys, i) => (
            <View
              key={sys.name}
              style={[
                styles.progressDot,
                { backgroundColor: i <= currentSystemIndex ? sys.color : colors.divider }
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.xl * 2,
  },
  symbolCircle: {
    width: 280,
    height: 280,
    position: 'relative',
    marginBottom: spacing.xl * 2,
  },
  circleSymbol: {
    position: 'absolute',
    fontSize: 48,
    fontFamily: typography.headline,
  },
  symbolWestern: {
    top: 0,
    left: '50%',
    marginLeft: -24,
  },
  symbolVedic: {
    top: '15%',
    right: '10%',
  },
  symbolHD: {
    bottom: '15%',
    right: '10%',
  },
  symbolGene: {
    bottom: '15%',
    left: '10%',
  },
  symbolKabb: {
    top: '15%',
    left: '10%',
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSymbol: {
    fontSize: 32,
    fontFamily: typography.headline,
  },
  statusSystem: {
    fontFamily: typography.headline,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  statusInsight: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loadingMessage: {
    fontFamily: typography.sansBold,
    fontSize: 18,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
