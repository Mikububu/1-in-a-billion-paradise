/**
 * ABOUT SCREEN
 * 
 * App information, version, and credits.
 * Required for App Store transparency.
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'About'>;

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '1';

export const AboutScreen = ({ navigation }: Props) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Title */}
        <View style={styles.logoSection}>
          <Text style={styles.logoNumber}>1</Text>
          <Text style={styles.logoText}>In A Billion</Text>
          <Text style={styles.version}>Version {APP_VERSION} (Build {BUILD_NUMBER})</Text>
        </View>

        {/* Mission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.missionText}>
            Finding meaningful connection in a world of billions. We combine ancient wisdom with modern technology to help you understand yourself and discover rare compatibility.
          </Text>
        </View>

        {/* What Makes Us Different */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Makes Us Different</Text>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>◎</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Swiss Ephemeris Precision</Text>
              <Text style={styles.featureDesc}>
                The gold standard for astronomical calculations, used by professional astrologers worldwide.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>◉</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Five Systems, One Chart</Text>
              <Text style={styles.featureDesc}>
                Western, Vedic, Human Design, Gene Keys, and Kabbalah — each offering a unique perspective.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>◇</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>AI-Powered Depth</Text>
              <Text style={styles.featureDesc}>
                Advanced language models create personalized interpretations that go far beyond generic horoscopes.
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>♪</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Audio Readings</Text>
              <Text style={styles.featureDesc}>
                Professional AI narration lets you listen to your readings anytime, anywhere.
              </Text>
            </View>
          </View>
        </View>

        {/* Technology */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technology</Text>
          
          <View style={styles.techItem}>
            <Text style={styles.techLabel}>Astronomical Engine</Text>
            <Text style={styles.techValue}>Swiss Ephemeris</Text>
          </View>
          <View style={styles.techItem}>
            <Text style={styles.techLabel}>AI Text Generation</Text>
            <Text style={styles.techValue}>DeepSeek, Claude, GPT</Text>
          </View>
          <View style={styles.techItem}>
            <Text style={styles.techLabel}>AI Voice</Text>
            <Text style={styles.techValue}>Chatterbox TTS</Text>
          </View>
          <View style={styles.techItem}>
            <Text style={styles.techLabel}>Mobile Framework</Text>
            <Text style={styles.techValue}>React Native (Expo)</Text>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          
          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
            <Text style={styles.legalArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            <Text style={styles.legalLinkText}>Terms of Service</Text>
            <Text style={styles.legalArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => navigation.navigate('DataPrivacy')}
          >
            <Text style={styles.legalLinkText}>AI & Data Usage</Text>
            <Text style={styles.legalArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Credits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acknowledgments</Text>
          <Text style={styles.creditsText}>
            Swiss Ephemeris by Astrodienst AG{'\n'}
            Astrological traditions spanning millennia{'\n'}
            The seekers who trust us with their charts
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>1</Text>
          <Text style={styles.footerText}>One In A Billion Ltd.</Text>
          <Text style={styles.footerCopy}>© 2024 All Rights Reserved</Text>
          <Text style={styles.footerTagline}>Find your 1 in a billion.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.page, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backButton: { paddingVertical: spacing.xs },
  backText: { fontFamily: typography.sansMedium, fontSize: 16, color: colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.page, paddingVertical: spacing.xl },

  logoSection: { alignItems: 'center', marginBottom: spacing.xl * 2 },
  logoNumber: { fontFamily: typography.headline, fontSize: 80, color: colors.text, lineHeight: 85 },
  logoText: { fontFamily: typography.headline, fontSize: 28, color: colors.text, marginTop: -spacing.sm },
  version: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, marginTop: spacing.md },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: typography.serifBold, fontSize: 20, color: colors.text, marginBottom: spacing.md },

  missionText: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.text, lineHeight: 26, fontStyle: 'italic' },

  featureCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.card, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  featureIcon: { fontSize: 28, width: 48, marginTop: 2 },
  featureContent: { flex: 1 },
  featureTitle: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text, marginBottom: 4 },
  featureDesc: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, lineHeight: 20 },

  techItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  techLabel: { fontFamily: typography.sansRegular, fontSize: 15, color: colors.mutedText },
  techValue: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.text },

  legalLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  legalLinkText: { fontFamily: typography.sansMedium, fontSize: 16, color: colors.text },
  legalArrow: { fontFamily: typography.sansMedium, fontSize: 18, color: colors.mutedText },

  creditsText: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, lineHeight: 24, textAlign: 'center' },

  footer: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingBottom: spacing.xl },
  footerLogo: { fontFamily: typography.headline, fontSize: 48, color: colors.primary },
  footerText: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.text, marginTop: spacing.xs },
  footerCopy: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, marginTop: spacing.xs },
  footerTagline: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, fontStyle: 'italic', marginTop: spacing.md },
});




