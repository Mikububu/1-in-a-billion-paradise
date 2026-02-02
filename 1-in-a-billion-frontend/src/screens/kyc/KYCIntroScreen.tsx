/**
 * KYC INTRO SCREEN
 * 
 * Explains WHY we verify - building trust, no fakes.
 * Premium, serious, but warm tone.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'KYCIntro'>;

export const KYCIntroScreen = ({ navigation }: Props) => {
  const fade1 = useRef(new Animated.Value(0)).current;
  const fade2 = useRef(new Animated.Value(0)).current;
  const fade3 = useRef(new Animated.Value(0)).current;
  const fade4 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.timing(fade1, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade2, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade3, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fade4, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.Text style={[styles.headline, { opacity: fade1 }]} selectable>
          Real people
        </Animated.Text>
        <Animated.Text style={[styles.headline2, { opacity: fade2 }]} selectable>
          only
        </Animated.Text>
        
        <Animated.View style={[styles.textBlock, { opacity: fade3 }]}>
          <Text style={styles.paragraph} selectable>
            We take authenticity seriously. Every person on 1 in a Billion is verified. 
            No bots. No catfish. No games.
          </Text>
          <Text style={styles.paragraph} selectable>
            This means the connections you make here are real. 
            The people you match with are who they say they are.
          </Text>
          <Text style={styles.emphasis} selectable>
            It takes 2 minutes. It protects everyone.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.trustBadges, { opacity: fade4 }]}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🔒</Text>
            <Text style={styles.badgeText}>256-bit encrypted</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🗑</Text>
            <Text style={styles.badgeText}>Data deleted after verification</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>👁</Text>
            <Text style={styles.badgeText}>Never shared or sold</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Button 
          label="Verify My Identity" 
          onPress={() => navigation.navigate('KYCPhone')} 
        />
        <Text style={styles.footerNote} selectable>
          Required to save your profile and match with others
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: spacing.page, paddingTop: 80 },
  headline: { fontFamily: typography.headline, fontSize: 48, color: colors.text },
  headline2: { fontFamily: typography.headline, fontSize: 48, color: colors.primary, fontStyle: 'italic', marginBottom: spacing.xl },
  textBlock: { marginTop: spacing.lg },
  paragraph: { fontFamily: typography.sansRegular, fontSize: 17, color: colors.text, lineHeight: 26, marginBottom: spacing.md },
  emphasis: { fontFamily: typography.sansSemiBold, fontSize: 17, color: colors.primary, marginTop: spacing.sm },
  trustBadges: { marginTop: spacing.xl },
  badge: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  badgeIcon: { fontSize: 20, marginRight: spacing.sm },
  badgeText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText },
  footer: { paddingHorizontal: spacing.page, paddingBottom: spacing.xl },
  footerNote: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, textAlign: 'center', marginTop: spacing.sm },
});





