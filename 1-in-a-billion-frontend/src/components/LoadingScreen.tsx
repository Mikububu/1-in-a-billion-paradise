/**
 * LOADING SCREEN COMPONENT
 * 
 * A beautiful, on-brand loading state that never feels empty or broken.
 * Uses cosmic/astrological theming consistent with the app.
 * 
 * DESIGN PRINCIPLES:
 * 1. Never just a spinner - always context + visual interest
 * 2. Rotating quotes keep user engaged during longer waits
 * 3. Animated elements create sense of "something is happening"
 * 4. Matches the app's typography and color system
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

type LoadingScreenProps = {
  title?: string;
  message?: string;
  variant?: 'default' | 'chart' | 'reading' | 'matching' | 'synastry';
};

// Rotating quotes to keep user engaged
const QUOTES = [
  { text: 'The stars incline, but do not compel.', author: 'Ancient wisdom' },
  { text: 'We are all made of star stuff.', author: 'Carl Sagan' },
  { text: 'The cosmos is within us.', author: 'Neil deGrasse Tyson' },
  { text: 'As above, so below.', author: 'Hermes Trismegistus' },
  { text: 'The fault is not in our stars, but in ourselves.', author: 'Shakespeare' },
  { text: 'Love is the whole thing. We are only pieces.', author: 'Rumi' },
];

// Context-specific messages
const VARIANT_CONFIG: Record<string, { title: string; messages: string[] }> = {
  default: {
    title: 'Loading',
    messages: ['Preparing your experience...', 'Almost there...', 'Just a moment...'],
  },
  chart: {
    title: 'Calculating Your Chart',
    messages: [
      'Aligning the celestial spheres...',
      'Reading the planetary positions...',
      'Mapping your cosmic blueprint...',
    ],
  },
  reading: {
    title: 'Generating Your Reading',
    messages: [
      'Consulting the stars...',
      'Weaving cosmic insights...',
      'Channeling ancient wisdom...',
    ],
  },
  matching: {
    title: 'Searching the Cosmos',
    messages: [
      'Scanning billions of charts...',
      'Finding rare alignments...',
      'Seeking your cosmic match...',
    ],
  },
  synastry: {
    title: 'Analyzing Compatibility',
    messages: [
      'Overlaying your charts...',
      'Measuring harmonic resonance...',
      'Decoding your connection...',
    ],
  },
};

export const LoadingScreen = ({ 
  title, 
  message, 
  variant = 'default' 
}: LoadingScreenProps) => {
  const config = VARIANT_CONFIG[variant];
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Animations
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const dotsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spin animation for the symbol
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Dots animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotsAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(dotsAnim, { toValue: 2, duration: 500, useNativeDriver: false }),
        Animated.timing(dotsAnim, { toValue: 3, duration: 500, useNativeDriver: false }),
        Animated.timing(dotsAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();

    // Rotate quotes every 4 seconds
    const quoteInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 4000);

    // Rotate messages every 3 seconds
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % config.messages.length);
    }, 3000);

    return () => {
      clearInterval(quoteInterval);
      clearInterval(messageInterval);
    };
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const currentQuote = QUOTES[quoteIndex];
  const currentMessage = message || config.messages[messageIndex];
  const displayTitle = title || config.title;

  return (
    <View style={styles.container}>
      {/* Cosmic Symbol */}
      <Animated.View 
        style={[
          styles.symbolContainer,
          { transform: [{ rotate: spin }, { scale: pulseAnim }] }
        ]}
      >
        <Text style={styles.symbol}>✧</Text>
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>{displayTitle}</Text>

      {/* Animated Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.message}>{currentMessage}</Text>
      </View>

      {/* Quote */}
      <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
        <Text style={styles.quoteText}>"{currentQuote.text}"</Text>
        <Text style={styles.quoteAuthor}>— {currentQuote.author}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Keep transparent so the global leather texture shows through.
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.page,
  },
  symbolContainer: {
    marginBottom: spacing.xl,
  },
  symbol: {
    fontSize: 64,
    color: colors.primary,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 28,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  messageContainer: {
    height: 24,
    justifyContent: 'center',
  },
  message: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
  },
  quoteContainer: {
    position: 'absolute',
    bottom: 80,
    left: spacing.page,
    right: spacing.page,
    alignItems: 'center',
  },
  quoteText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  quoteAuthor: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
  },
});





