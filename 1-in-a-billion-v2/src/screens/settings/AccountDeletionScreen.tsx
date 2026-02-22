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

type Props = NativeStackScreenProps<MainStackParamList, 'AccountDeletion'>;

export const AccountDeletionScreen = ({ navigation }: Props) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const resetOnboarding = useOnboardingStore((state) => state.reset);
    const resetProfile = useProfileStore((state) => state.reset);

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Delete Account?',
            'This will PERMANENTLY delete your account and ALL data. This action CANNOT be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Forever',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await deleteAccount();
                            resetOnboarding();
                            resetProfile();

                            Alert.alert(
                                'Account Deleted',
                                'Your account has been permanently deleted.',
                                [
                                    {
                                        text: 'OK',
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
                            Alert.alert('Error', error.message || 'Failed to delete account.');
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
                <Text style={styles.title}>Delete Account</Text>
                <Text style={styles.subtitle}>
                    We're sad to see you go. Deleting your account will permanently remove all your data.
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What Will Be Deleted</Text>
                    <View style={styles.dataItem}><Text>◉ Your Profile & Birth Data</Text></View>
                    <View style={styles.dataItem}><Text>≡ All Astrological Readings</Text></View>
                    <View style={styles.dataItem}><Text>♪ Saved Audio Files</Text></View>
                </View>

                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteAccount}
                    disabled={isDeleting}
                >
                    <Text style={styles.deleteButtonText}>
                        {isDeleting ? 'Deleting...' : 'Delete My Account'}
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
