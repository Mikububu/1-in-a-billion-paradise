/**
 * KYC COMPLETE SCREEN
 * 
 * Celebration screen after successful verification.
 * Beautiful typography, warm welcome to the verified community.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useProfileStore } from '@/store/profileStore';

type Props = NativeStackScreenProps<MainStackParamList, 'KYCComplete'>;

export const KYCCompleteScreen = ({ navigation }: Props) => {
  const fade1 = useRef(new Animated.Value(0)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const fade3 = useRef(new Animated.Value(0)).current;
  const fade4 = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  // Mark user as verified
  const setUserVerified = useProfileStore((s) => s.setUserVerified);

  useEffect(() => {
    // Mark verified in store
    setUserVerified?.(true);

    // Entrance animations
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.stagger(200, [
        Animated.timing(fade1, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(fade2, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(fade3, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(fade4, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleContinue = () => {
    // Navigate to main app
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Checkmark animation */}
        <Animated.View style={[styles.checkContainer, { transform: [{ scale }] }]}>
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>

        <Animated.Text style={[styles.headline, { opacity: fade1 }]} selectable>
          You're verified
        </Animated.Text>

        <Animated.Text style={[styles.welcome, { opacity: fade2 }]} selectable>
          Welcome to the community
        </Animated.Text>

        <Animated.View style={[styles.textBlock, { opacity: fade3 }]}>
          <Text style={styles.paragraph} selectable>
            You've just joined a space where every single person is real, verified, and serious about connection.
          </Text>
          <Text style={styles.paragraph} selectable>
            No games. No ghosts. Just genuine people looking for something meaningful.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.badgesContainer, { opacity: fade4 }]}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🛡️</Text>
            <Text style={styles.badgeText}>Verified Member</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>💎</Text>
            <Text style={styles.badgeText}>Premium Access</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🔮</Text>
            <Text style={styles.badgeText}>Full Readings Unlocked</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Button label="Enter the Community" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: spacing.xl, alignItems: 'center' },
  
  checkContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  checkmark: { fontSize: 48, color: '#FFFFFF' },
  
  headline: { fontFamily: typography.headline, fontSize: 42, color: colors.text, textAlign: 'center' },
  welcome: { fontFamily: typography.headline, fontSize: 28, color: colors.primary, fontStyle: 'italic', marginTop: spacing.xs, textAlign: 'center' },
  
  textBlock: { marginTop: spacing.xl, paddingHorizontal: spacing.md },
  paragraph: { fontFamily: typography.sansRegular, fontSize: 17, color: colors.text, lineHeight: 26, textAlign: 'center', marginBottom: spacing.md },
  
  badgesContainer: { marginTop: spacing.xl },
  badge: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  badgeIcon: { fontSize: 24, marginRight: spacing.sm },
  badgeText: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  
  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
});





