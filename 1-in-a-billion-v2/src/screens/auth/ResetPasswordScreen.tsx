import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { Button } from '@/components/Button';
import { supabase } from '@/services/supabase';
import { t } from '@/i18n';

type Props = NativeStackScreenProps<any, 'ResetPassword'>;

export const ResetPasswordScreen = ({ navigation }: Props) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleResetPassword = async () => {
        if (!password.trim()) {
            Alert.alert(t('common.error'), t('resetPassword.enterNewPassword'));
            return;
        }

        if (password.length < 8) {
            Alert.alert(t('common.error'), t('resetPassword.passwordTooShort'));
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(t('common.error'), t('resetPassword.passwordsDoNotMatch'));
            return;
        }

        try {
            setIsSubmitting(true);
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            Alert.alert(
                t('resetPassword.success'),
                t('resetPassword.successMessage'),
                [{
                    text: t('common.ok'),
                    onPress: () => {
                        // Navigate back to sign in or home
                        if (navigation.canGoBack()) {
                            navigation.popToTop();
                        }
                    },
                }]
            );
        } catch (error: any) {
            console.error('❌ Password reset error:', error.message);
            Alert.alert(t('common.error'), error.message || t('resetPassword.failed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.title}>{t('resetPassword.title')}</Text>
                    <Text style={styles.subtitle}>{t('resetPassword.subtitle')}</Text>

                    <TextInput
                        style={styles.input}
                        placeholder={t('resetPassword.newPasswordPlaceholder')}
                        placeholderTextColor={colors.mutedText}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                    />

                    <TextInput
                        style={styles.input}
                        placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                        placeholderTextColor={colors.mutedText}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    {isSubmitting ? (
                        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
                    ) : (
                        <Button
                            label={t('resetPassword.setNewPassword')}
                            onPress={handleResetPassword}
                            style={styles.button}
                        />
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: spacing.page,
        paddingTop: spacing.xl * 2,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 28,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 20,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        marginBottom: spacing.md,
    },
    button: {
        marginTop: spacing.md,
    },
});
