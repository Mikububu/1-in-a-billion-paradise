import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

export const DevResetScreen = () => {
    const clearOnboarding = useOnboardingStore((state) => state.resetOnboarding);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const clearProfile = useProfileStore((state) => state.clearProfile);

    const handleReset = async () => {
        Alert.alert(
            'Reset All Data?',
            'This will wipe all local data and return you to onboarding.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        console.log('🗑️  Wiping all data...');

                        // Clear all stores
                        clearOnboarding?.();
                        clearAuth?.();
                        clearProfile?.();

                        // Clear AsyncStorage
                        const keys = await AsyncStorage.getAllKeys();
                        await AsyncStorage.multiRemove(keys);

                        console.log('✅ Data wiped! Close and restart the app.');

                        Alert.alert(
                            'Data Wiped!',
                            'Please close the app completely and restart it to test from scratch.',
                            [{ text: 'OK' }]
                        );
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Developer Tools</Text>
                <Text style={styles.subtitle}>Reset app to fresh state</Text>

                <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                    <Text style={styles.resetButtonText}>🗑️ Wipe All Data</Text>
                </TouchableOpacity>

                <View style={styles.info}>
                    <Text style={styles.infoText}>
                        This will clear:
                    </Text>
                    <Text style={styles.infoItem}>• All AsyncStorage data</Text>
                    <Text style={styles.infoItem}>• Onboarding state</Text>
                    <Text style={styles.infoItem}>• Auth session</Text>
                    <Text style={styles.infoItem}>• User profile data</Text>
                    <Text style={styles.infoText} style={{ marginTop: 16 }}>
                        After reset, close and restart the app.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.page,
        paddingTop: 60,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 32,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.mutedText,
        marginBottom: spacing.xl,
    },
    resetButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    resetButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 18,
        color: colors.background,
    },
    info: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.cardStroke,
    },
    infoText: {
        fontFamily: typography.sansMedium,
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    infoItem: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        marginLeft: spacing.md,
        marginBottom: 4,
    },
});
