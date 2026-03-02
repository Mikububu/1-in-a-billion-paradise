/**
 * ABOUT SCREEN
 */

import { StyleSheet, Text, View, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'About'>;

export const AboutScreen = ({ navigation }: Props) => {
    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{t('about.title')}</Text>

                <View style={styles.content}>
                    <Text style={styles.description}>
                        {t('about.description')}
                    </Text>

                    <Text style={styles.sectionTitle}>{t('about.missionTitle')}</Text>
                    <Text style={styles.description}>
                        {t('about.missionText')}
                    </Text>

                    <Text style={styles.sectionTitle}>{t('about.technologyTitle')}</Text>
                    <Text style={styles.description}>
                        {t('about.technologyText')}
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.version}>{t('app.version')}</Text>
                    <Text style={styles.copyright}>{t('app.copyright')}</Text>
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
        marginBottom: spacing.xl,
    },
    content: {
        marginBottom: spacing.xxl,
    },
    sectionTitle: {
        fontFamily: typography.serifBold,
        fontSize: 20,
        color: colors.text,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    description: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    version: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
    },
    copyright: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: spacing.xs,
    },
});
