/**
 * TERMS OF SERVICE SCREEN
 */

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';

type Props = NativeStackScreenProps<MainStackParamList, 'TermsOfService'>;

const LAST_UPDATED = 'January 11, 2026';

const SECTIONS = [
    {
        title: 'Agreement to Terms',
        content: `By downloading, installing, or using the 1 in a Billion application, you agree to be bound by these Terms of Service. If you do not agree to these Terms, do not use the App.`,
    },
    {
        title: 'Description of Service',
        content: `1 In A Billion provides personalized astrological readings and compatibility analyses. The App is intended for entertainment and self-reflection purposes. Astrological readings should not be used as the sole basis for important life decisions.`,
    },
    {
        title: 'Payments',
        content: `All purchases are processed through the App Store. Due to the personalized nature of our digital content, all purchases are final and non-refundable.`,
    },
];

export const TermsOfServiceScreen = ({ navigation }: Props) => {
    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Terms of Service</Text>
                <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

                {SECTIONS.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionContent}>{section.content}</Text>
                    </View>
                ))}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        By using 1 In A Billion, you agree to be bound by these Terms of Service.
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
