/**
 * PRIVACY POLICY SCREEN
 */

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'PrivacyPolicy'>;

const LAST_UPDATED = 'January 11, 2026';

const SECTIONS = [
    {
        title: 'Introduction',
        content: `Welcome to 1 In A Billion ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our mobile application.`,
    },
    {
        title: 'Information We Collect',
        content: `We collect information that you provide directly to us:
• Birth Information: Date, time, and location of birth for astrological calculations
• Relationship Preferences: Your safe-to-spicy relationship dynamic preference
• Language Preferences: Primary and secondary languages
• Account Information: Email address (if you create an account)`,
    },
    {
        title: 'How We Use Your Information',
        content: `Your information is used to:
• Generate personalized astrological readings using AI services
• Calculate accurate planetary positions
• Create compatibility analyses
• Improve our services and user experience`,
    },
    {
        title: 'AI Services & Third-Party Data Sharing',
        content: `Important: To generate your personalized readings, we share certain data with third-party AI services:
• Birth date, time, and location
• Calculated planetary positions
• Relationship preferences
• Language preferences

We do NOT share your name or email address.`,
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
                <Text style={styles.title}>Privacy Policy</Text>
                <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

                {SECTIONS.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionContent}>{section.content}</Text>
                    </View>
                ))}

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
