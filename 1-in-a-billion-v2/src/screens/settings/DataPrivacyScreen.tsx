/**
 * DATA PRIVACY SCREEN
 */

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'DataPrivacy'>;

export const DataPrivacyScreen = ({ navigation }: Props) => {
    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{t('dataPrivacy.title')}</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionContent}>
                        {t('dataPrivacy.intro')}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('dataPrivacy.shareTitle')}</Text>
                    <Text style={styles.sectionContent}>
                        {t('dataPrivacy.shareText')}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('dataPrivacy.privacyTitle')}</Text>
                    <Text style={styles.sectionContent}>
                        {t('dataPrivacy.privacyText')}
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
});
