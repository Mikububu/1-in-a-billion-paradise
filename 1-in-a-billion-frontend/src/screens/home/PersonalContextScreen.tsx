/**
 * PERSONAL CONTEXT SCREEN
 * 
 * Allows users to optionally ask a question or share feelings about an individual reading
 * before generation. This infuses the reading with personalized context.
 */

import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'PersonalContext'>;

const MAX_CHARS = 500;

export const PersonalContextScreen = ({ navigation, route }: Props) => {
    const { personName, readingType, ...restParams } = route.params;
    const [context, setContext] = useState('');

    const isSelf = readingType === 'self';

    const handleSkip = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            personalContext: undefined,
            readingType: 'individual',
        });
    };

    const handleContinue = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            personalContext: context.trim() || undefined,
            readingType: 'individual',
        });
    };

    const charsRemaining = MAX_CHARS - context.length;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>
                            {isSelf 
                                ? 'Would you like to focus on something specific in your reading?'
                                : `Would you like to focus on something specific in ${personName}'s reading?`
                            }
                        </Text>
                        <Text style={styles.subheadline}>
                            Share any questions, feelings, or areas of life you'd like the reading to address
                        </Text>
                    </View>

                    {/* Text Input */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            multiline
                            placeholder="Share your questions or focus areas here..."
                            placeholderTextColor={colors.mutedText}
                            value={context}
                            onChangeText={setContext}
                            maxLength={MAX_CHARS}
                            autoFocus
                            textAlignVertical="top"
                        />
                        <Text style={styles.charCount}>
                            {charsRemaining} characters remaining
                        </Text>
                    </View>
                </ScrollView>

                {/* Bottom Buttons */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleContinue}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.continueButtonText}>
                            {context.trim() ? 'CONTINUE WITH CONTEXT' : 'SKIP'}
                        </Text>
                    </TouchableOpacity>

                    {context.trim() && (
                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={handleSkip}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.skipButtonText}>Skip and Continue</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.page,
        paddingTop: spacing.xl,
    },
    header: {
        marginBottom: spacing.xl,
    },
    headline: {
        fontFamily: typography.headline,
        fontSize: 28,
        color: colors.text,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    subheadline: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.mutedText,
        textAlign: 'center',
        lineHeight: 24,
    },
    inputContainer: {
        flex: 1,
        marginBottom: spacing.lg,
    },
    textInput: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        padding: spacing.md,
        minHeight: 180,
        maxHeight: 300,
        borderWidth: 1,
        borderColor: colors.border,
    },
    charCount: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        textAlign: 'right',
        marginTop: spacing.xs,
    },
    buttonContainer: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.lg,
        gap: spacing.sm,
    },
    continueButton: {
        backgroundColor: colors.primary,
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    continueButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.background,
        letterSpacing: 0.5,
    },
    skipButton: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    skipButtonText: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
    },
});

