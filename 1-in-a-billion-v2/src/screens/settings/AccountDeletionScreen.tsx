/**
 * ACCOUNT DELETION SCREEN
 */

import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import { deleteAccount } from '@/services/accountDeletion';
import { BackButton } from '@/components/BackButton';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<MainStackParamList, 'AccountDeletion'>;

export const AccountDeletionScreen = ({ navigation }: Props) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const resetOnboarding = useOnboardingStore((state) => state.reset);
    const resetProfile = useProfileStore((state) => state.reset);

    const handleDeleteAccount = async () => {
        Alert.alert(
            t('accountDeletion.confirmTitle'),
            t('accountDeletion.confirmMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('accountDeletion.deleteForever'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await deleteAccount();
                            resetOnboarding();
                            resetProfile();

                            Alert.alert(
                                t('accountDeletion.deletedTitle'),
                                t('accountDeletion.deletedMessage'),
                                [
                                    {
                                        text: t('common.ok'),
                                        onPress: () => {
                                            navigation.reset({
                                                index: 0,
                                                routes: [{ name: 'Home' }],
                                            });
                                        },
                                    },
                                ]
                            );
                        } catch (error: any) {
                            Alert.alert(t('common.error'), error.message || t('accountDeletion.deleteFailed'));
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackButton onPress={() => navigation.goBack()} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>{t('accountDeletion.title')}</Text>
                <Text style={styles.subtitle}>
                    {t('accountDeletion.subtitle')}
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('accountDeletion.whatDeleted')}</Text>
                    <View style={styles.dataItem}><Text>◉ {t('accountDeletion.profileData')}</Text></View>
                    <View style={styles.dataItem}><Text>≡ {t('accountDeletion.readings')}</Text></View>
                    <View style={styles.dataItem}><Text>♪ {t('accountDeletion.audioFiles')}</Text></View>
                </View>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteAccount}
                    disabled={isDeleting}
                >
                    <Text style={styles.deleteButtonText}>
                        {isDeleting ? t('accountDeletion.deleting') : t('accountDeletion.deleteMyAccount')}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {isDeleting && (
                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
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
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.mutedText,
        marginBottom: spacing.xl,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontFamily: typography.serifBold,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.md,
    },
    dataItem: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: radii.card,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
    },
    deleteButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        borderRadius: radii.button,
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    deleteButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: '#fff',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
