/**
 * MATCH REVEAL SCREEN
 * 
 * Beautiful reveal screen when a new match is discovered.
 * Shows both users' AI portraits with a poetic welcome message.
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'MatchReveal'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WELCOME_MESSAGES = [
  'Good luck with this new soul connection. Only God knows where this is heading towards and what it will bring to you.',
  'Two souls have found resonance across the cosmic web. May this connection reveal what you both need to see.',
  'The universe has conspired to bring you together. What unfolds from here is yours to discover.',
  'A rare alignment has been detected. This connection carries the potential for profound mutual understanding.',
  'Somewhere in the vast tapestry of existence, your threads have crossed. Honor this moment of recognition.',
];

export const MatchRevealScreen = ({ navigation, route }: Props) => {
  const {
    matchId,
    otherName,
    otherClaymationUrl,
    userName,
    userClaymationUrl,
    compatibilityScore,
    matchReason,
    conversationId,
  } = route.params;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing animation for the connection icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Get a random welcome message (consistent per match)
  const messageIndex = matchId ? matchId.charCodeAt(0) % WELCOME_MESSAGES.length : 0;
  const welcomeMessage = WELCOME_MESSAGES[messageIndex];

  const handleStartChat = () => {
    navigation.replace('Chat', {
      conversationId,
      otherName,
      otherPortraitUrl,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Portraits */}
        <View style={styles.portraitsContainer}>
          {/* User Portrait */}
          <View style={styles.portraitWrapper}>
            {userClaymationUrl ? (
              <Image source={{ uri: userClaymationUrl }} style={styles.portrait} />
            ) : (
              <View style={[styles.portrait, styles.placeholderPortrait]}>
                <Text style={styles.portraitInitial}>{userName?.charAt(0) || '?'}</Text>
              </View>
            )}
            <Text style={styles.portraitName}>{userName || 'You'}</Text>
          </View>

          {/* Connection Icon */}
          <Animated.View style={[styles.connectionIcon, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.connectionEmoji}>✨</Text>
          </Animated.View>

          {/* Match Portrait */}
          <View style={styles.portraitWrapper}>
            {otherClaymationUrl ? (
              <Image source={{ uri: otherClaymationUrl }} style={styles.portrait} />
            ) : (
              <View style={[styles.portrait, styles.placeholderPortrait]}>
                <Text style={styles.portraitInitial}>{otherName?.charAt(0) || '?'}</Text>
              </View>
            )}
            <Text style={styles.portraitName}>{otherName}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>A Connection Emerged</Text>

        {/* Compatibility Score */}
        {compatibilityScore && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Resonance</Text>
            <Text style={styles.scoreValue}>{Math.round(compatibilityScore)}%</Text>
          </View>
        )}

        {/* Match Reason */}
        {matchReason && (
          <Text style={styles.matchReason}>{matchReason}</Text>
        )}

        {/* Welcome Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>{welcomeMessage}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.chatButton} onPress={handleStartChat}>
            <Text style={styles.chatButtonText}>Start Conversation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.laterButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Background decoration */}
      <View style={styles.bgDecoration}>
        {[...Array(20)].map((_, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.bgStar,
              {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: fadeAnim,
              },
            ]}
          >
            ✦
          </Animated.Text>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D15',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.xxl,
    alignItems: 'center',
    zIndex: 10,
  },
  
  // Portraits
  portraitsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  portraitWrapper: {
    alignItems: 'center',
  },
  portrait: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  placeholderPortrait: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portraitInitial: {
    fontFamily: typography.sansBold,
    fontSize: 48,
    color: '#fff',
  },
  portraitName: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: '#fff',
    marginTop: spacing.sm,
  },
  connectionIcon: {
    marginHorizontal: spacing.md,
  },
  connectionEmoji: {
    fontSize: 32,
  },
  
  // Title
  title: {
    fontFamily: typography.sansBold,
    fontSize: 28,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  
  // Score
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scoreLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: '#888',
  },
  scoreValue: {
    fontFamily: typography.sansBold,
    fontSize: 24,
    color: '#FFD700',
  },
  
  // Match Reason
  matchReason: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: '#8B5CF6',
    marginBottom: spacing.lg,
  },
  
  // Message
  messageContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  messageText: {
    fontFamily: typography.sansItalic,
    fontSize: 15,
    color: '#E0E0E0',
    lineHeight: 24,
    textAlign: 'center',
  },
  
  // Buttons
  buttonsContainer: {
    width: '100%',
    gap: spacing.md,
    marginTop: 'auto',
    marginBottom: spacing.xl,
  },
  chatButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
  },
  chatButtonText: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: '#fff',
  },
  laterButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  laterButtonText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: '#888',
  },
  
  // Background
  bgDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgStar: {
    position: 'absolute',
    fontSize: 12,
    color: 'rgba(255, 215, 0, 0.3)',
  },
});

export default MatchRevealScreen;
