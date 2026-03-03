import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { t, getLanguage, LANGUAGE_META, SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'ReadingLanguage'>;

export const ReadingLanguageScreen = ({ navigation, route }: Props) => {
    const { ...restParams } = (route.params || {}) as any;
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(getLanguage());

    const handleContinue = () => {
        navigation.navigate('VoiceSelection', {
            ...restParams,
            readingLanguage: selectedLanguage,
        } as any);
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{t('readingLanguage.title')}</Text>
                <Text style={styles.subtitle}>{t('readingLanguage.subtitle')}</Text>

                <View style={styles.languageList}>
                    {SUPPORTED_LANGUAGES.map((lang) => {
                        const meta = LANGUAGE_META[lang];
                        const isSelected = lang === selectedLanguage;
                        return (
                            <TouchableOpacity
                                key={lang}
                                style={[styles.languageCard, isSelected && styles.languageCardSelected]}
                                onPress={() => setSelectedLanguage(lang)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.languageTextGroup}>
                                    <Text style={[styles.languageNative, isSelected && styles.languageNativeSelected]}>
                                        {meta.nativeName}
                                    </Text>
                                    <Text style={styles.languageEnglish}>{meta.name}</Text>
                                </View>
                                {isSelected && (
                                    <View style={styles.checkmark}>
                                        <Text style={styles.checkmarkText}>✓</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    label={t('readingLanguage.continue')}
                    onPress={handleContinue}
                    style={styles.continueButton}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingTop: 60,
        paddingHorizontal: spacing.page,
        paddingBottom: 100,
        alignItems: 'center',
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 26,
        lineHeight: 34,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        lineHeight: 20,
        color: colors.mutedText,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    languageList: {
        width: '100%',
        gap: spacing.sm,
    },
    languageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
    },
    languageCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.surface,
    },
    languageTextGroup: {
        flex: 1,
    },
    languageNative: {
        fontFamily: typography.sansMedium,
        fontSize: 16,
        color: colors.text,
    },
    languageNativeSelected: {
        color: colors.primary,
    },
    languageEnglish: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: 2,
    },
    checkmark: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.lg,
        paddingTop: spacing.md,
    },
    continueButton: {
        borderRadius: radii.button,
    },
});
