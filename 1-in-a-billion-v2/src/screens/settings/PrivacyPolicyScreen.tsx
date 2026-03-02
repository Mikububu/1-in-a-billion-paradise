/**
 * PRIVACY POLICY SCREEN
 */

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'PrivacyPolicy'>;

const LAST_UPDATED = 'January 11, 2026';

export const PrivacyPolicyScreen = ({ navigation }: Props) => {
    const SECTIONS = [
        {
            title: t('privacy.introTitle'),
            content: t('privacy.introText'),
        },
        {
            title: t('privacy.collectTitle'),
            content: t('privacy.collectText'),
        },
        {
            title: t('privacy.useTitle'),
            content: t('privacy.useText'),
        },
        {
            title: t('privacy.aiTitle'),
            content: t('privacy.aiText'),
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{t('privacy.title')}</Text>
                <Text style={styles.lastUpdated}>{t('privacy.lastUpdated')}: {LAST_UPDATED}</Text>

                {SECTIONS.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionContent}>{section.content}</Text>
                    </View>
                ))}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {t('privacy.footer')}
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
