/**
 * CONTACT SUPPORT SCREEN
 * 
 * Help, FAQ, and contact options.
 * Provides multiple channels for user support.
 */

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'ContactSupport'>;

const FAQ_ITEMS = [
  {
    question: 'How accurate are the astrological calculations?',
    answer: 'We use Swiss Ephemeris, the gold standard in astronomical calculation used by professional astrologers worldwide. Planetary positions are calculated with precision to the arc-second.',
  },
  {
    question: 'Why do I need my exact birth time?',
    answer: 'Your Rising sign (Ascendant) changes roughly every 2 hours, and house cusps shift every few minutes. Even a 15-minute difference can affect your chart interpretation. If you don\'t know your exact time, you can still get a reading but some features may be less accurate.',
  },
  {
    question: 'How are readings generated?',
    answer: 'Swiss Ephemeris calculates your precise planetary positions. These are then interpreted by AI language models trained in astrological symbolism and psychology. Each reading is unique to your chart.',
  },
  {
    question: 'Can I get a refund?',
    answer: 'Purchases are processed through Apple. For refund requests, please contact Apple Support or use the "Report a Problem" feature in your purchase history. We may offer refunds at our discretion for technical issues.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. We use industry-standard encryption for all data transmission. Your birth data is stored securely and never sold to third parties. See our Privacy Policy for details.',
  },
  {
    question: 'What\'s the difference between the 5 systems?',
    answer: 'Western astrology focuses on psychological patterns, Vedic on karma and dharma, Human Design on energy mechanics, Gene Keys on genetic potential, and Kabbalah on spiritual soul path. Each offers a unique lens into your chart.',
  },
  {
    question: 'How do compatibility readings work?',
    answer: 'We overlay two charts to analyze how planetary positions interact. This includes synastry aspects, house overlays, and composite analysis across multiple systems.',
  },
  {
    question: 'Can I delete my account?',
    answer: 'Yes, you can delete your account and all data anytime through Settings > Delete Account. There\'s a 30-day grace period before permanent deletion.',
  },
];

export const ContactSupportScreen = ({ navigation }: Props) => {
  const handleEmail = (subject: string) => {
    Linking.openURL(`mailto:support@oneinabillion.app?subject=${encodeURIComponent(subject)}`);
  };

  const handleCopyEmail = () => {
    // In production, use Clipboard API
    Alert.alert('Email Copied', 'support@oneinabillion.app');
  };

  return (
    <SafeAreaView style={styles.container}>
      <BackButton onPress={() => navigation.goBack()} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Help & Support</Text>
        <Text style={styles.subtitle}>
          We're here to help you get the most out of your readings.
        </Text>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => handleEmail('Support Request')}
          >
            <Text style={styles.quickActionIcon}>→</Text>
            <Text style={styles.quickActionTitle}>Email Support</Text>
            <Text style={styles.quickActionDesc}>Get help within 24 hours</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAction}
            onPress={handleCopyEmail}
          >
            <Text style={styles.quickActionIcon}>◎</Text>
            <Text style={styles.quickActionTitle}>Copy Email</Text>
            <Text style={styles.quickActionDesc}>support@oneinabillion.app</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          
          <TouchableOpacity 
            style={styles.contactOption}
            onPress={() => handleEmail('General Question')}
          >
            <Text style={styles.contactIcon}>?</Text>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>General Questions</Text>
              <Text style={styles.contactDesc}>Ask about features, readings, or systems</Text>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactOption}
            onPress={() => handleEmail('Technical Issue')}
          >
            <Text style={styles.contactIcon}>◎</Text>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Technical Issues</Text>
              <Text style={styles.contactDesc}>Report bugs or app problems</Text>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactOption}
            onPress={() => handleEmail('Purchase Question')}
          >
            <Text style={styles.contactIcon}>◇</Text>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Billing & Purchases</Text>
              <Text style={styles.contactDesc}>Questions about payments or refunds</Text>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactOption}
            onPress={() => handleEmail('Feedback')}
          >
            <Text style={styles.contactIcon}>◇</Text>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Feedback & Suggestions</Text>
              <Text style={styles.contactDesc}>Help us improve the app</Text>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {FAQ_ITEMS.map((item, index) => (
            <View key={index} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            </View>
          ))}
        </View>

        {/* Response Time */}
        <View style={styles.responseSection}>
          <Text style={styles.responseTitle}>Response Times</Text>
          <View style={styles.responseRow}>
            <Text style={styles.responseType}>General questions:</Text>
            <Text style={styles.responseTime}>Within 24 hours</Text>
          </View>
          <View style={styles.responseRow}>
            <Text style={styles.responseType}>Technical issues:</Text>
            <Text style={styles.responseTime}>Within 12 hours</Text>
          </View>
          <View style={styles.responseRow}>
            <Text style={styles.responseType}>Billing issues:</Text>
            <Text style={styles.responseTime}>Within 48 hours</Text>
          </View>
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
  title: { fontFamily: typography.headline, fontSize: 32, color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontFamily: typography.sansRegular, fontSize: 16, color: colors.mutedText, marginBottom: spacing.xl },

  quickActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  quickAction: { flex: 1, backgroundColor: colors.primarySoft, padding: spacing.lg, borderRadius: radii.card, alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '30' },
  quickActionIcon: { fontSize: 32, marginBottom: spacing.sm },
  quickActionTitle: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.text, textAlign: 'center' },
  quickActionDesc: { fontFamily: typography.sansRegular, fontSize: 12, color: colors.mutedText, textAlign: 'center', marginTop: 4 },

  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: typography.serifBold, fontSize: 20, color: colors.text, marginBottom: spacing.md },

  contactOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.card, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  contactIcon: { fontSize: 24, width: 44 },
  contactContent: { flex: 1 },
  contactTitle: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text },
  contactDesc: { fontFamily: typography.sansRegular, fontSize: 13, color: colors.mutedText, marginTop: 2 },
  contactArrow: { fontFamily: typography.sansMedium, fontSize: 18, color: colors.mutedText },

  faqItem: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radii.card, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  faqQuestion: { fontFamily: typography.sansSemiBold, fontSize: 16, color: colors.text, marginBottom: spacing.sm },
  faqAnswer: { fontFamily: typography.sansRegular, fontSize: 14, color: colors.mutedText, lineHeight: 22 },

  responseSection: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border },
  responseTitle: { fontFamily: typography.sansSemiBold, fontSize: 14, color: colors.mutedText, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  responseRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  responseType: { fontFamily: typography.sansRegular, fontSize: 15, color: colors.text },
  responseTime: { fontFamily: typography.sansSemiBold, fontSize: 15, color: colors.primary },
});




