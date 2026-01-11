/**
 * PRIVACY POLICY SCREEN
 * 
 * Apple App Store REQUIRED - must be accessible from within the app.
 * Explains data collection, usage, and sharing practices.
 * Updated for 2024 AI disclosure requirements.
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';

import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'PrivacyPolicy'>;

const LAST_UPDATED = 'December 9, 2024';

const SECTIONS = [
  {
    title: 'Introduction',
    content: `Welcome to 1 In A Billion ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our mobile application.

By using our app, you agree to the collection and use of information in accordance with this policy.`,
  },
  {
    title: 'Information We Collect',
    content: `We collect information that you provide directly to us:

• **Birth Information**: Date, time, and location of birth for astrological calculations
• **Relationship Preferences**: Your relationship intensity and mode preferences
• **Language Preferences**: Primary and secondary languages
• **Account Information**: Email address (if you create an account)
• **Payment Information**: Processed securely through Apple's payment system

We do NOT collect:
• Photos or images from your device
• Contacts or address book
• Location data (except birth location you enter)
• Browsing history outside our app`,
  },
  {
    title: 'How We Use Your Information',
    content: `Your information is used to:

• Generate personalized astrological readings using AI services
• Calculate accurate planetary positions using Swiss Ephemeris
• Create compatibility analyses between you and partners you add
• Generate audio narrations of your readings
• Improve our services and user experience
• Process purchases and maintain your account
• Send important updates about our service (with your consent)`,
  },
  {
    title: 'AI Services & Third-Party Data Sharing',
    content: `**Important**: To generate your personalized readings, we share certain data with third-party AI services:

**Data Shared with AI Providers**:
• Birth date, time, and location
• Calculated planetary positions
• Relationship preferences
• Language preferences

**AI Services We Use**:
• DeepSeek (text generation)
• DeepSeek (text generation - primary)
• Anthropic Claude (text generation - backup)
• Chatterbox TTS via RunPod (audio narration)

**What We Do NOT Share**:
• Your name or email address
• Payment information
• Device identifiers
• Any personally identifying information

All AI providers are bound by their own privacy policies and data protection standards. We only share the minimum data necessary to generate your readings.`,
  },
  {
    title: 'Data Storage & Security',
    content: `• Your data is stored securely using industry-standard encryption
• Readings and preferences are stored locally on your device
• Account data (if created) is stored on secure cloud servers
• We use Supabase for backend services with enterprise-grade security
• We never sell your personal data to third parties
• You can delete all your data at any time through the app`,
  },
  {
    title: 'Your Rights',
    content: `You have the right to:

• **Access**: Request a copy of your personal data
• **Correction**: Update or correct your information
• **Deletion**: Delete your account and all associated data
• **Portability**: Export your readings and data
• **Withdraw Consent**: Opt out of data processing at any time

To exercise these rights, use the Settings menu in the app or contact us at privacy@oneinabillion.app`,
  },
  {
    title: 'Data Retention',
    content: `• Active account data: Retained while your account is active
• Deleted accounts: Data permanently removed within 30 days
• Analytics data: Anonymized and aggregated, retained for 2 years
• Purchase records: Retained as required by law for tax purposes`,
  },
  {
    title: 'Children\'s Privacy',
    content: `Our service is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected data from a minor, please contact us immediately.`,
  },
  {
    title: 'International Data Transfers',
    content: `Your data may be transferred to and processed in countries outside your country of residence. We ensure appropriate safeguards are in place to protect your data in accordance with this policy and applicable laws.`,
  },
  {
    title: 'Changes to This Policy',
    content: `We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy in the app and updating the "Last Updated" date. Your continued use of the app after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: 'Contact Us',
    content: `If you have questions about this privacy policy or our data practices, please contact us:

Email: privacy@oneinabillion.app
Address: One In A Billion Ltd.

For EU residents: You have the right to lodge a complaint with your local data protection authority.`,
  },
];

export const PrivacyPolicyScreen = ({ navigation }: Props) => {
  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using 1 In A Billion, you acknowledge that you have read and understood this Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontFamily: typography.sansMedium,
    fontSize: 16,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xl,
  },
  title: {
    fontFamily: typography.headline,
    fontSize: 32,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  lastUpdated: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: typography.serifBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    fontFamily: typography.sansRegular,
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  footerText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});







