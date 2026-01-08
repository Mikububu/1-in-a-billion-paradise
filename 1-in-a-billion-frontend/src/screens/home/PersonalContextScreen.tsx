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

const MAX_CHARS = 700;

export const PersonalContextScreen = ({ navigation, route }: Props) => {
    const { personName, readingType, ...restParams } = route.params;
    const [context, setContext] = useState('');

    const isSelf = readingType === 'self';

    const handleSkip = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            userName: isSelf ? 'You' : personName,
            personalContext: undefined,
            readingType: 'individual',
            forPartner: !isSelf,
        });
    };

    const handleContinue = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            userName: isSelf ? 'You' : personName,
            personalContext: context.trim() || undefined,
            readingType: 'individual',
            forPartner: !isSelf,
        });
    };

    const charsRemaining = MAX_CHARS - context.length;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Back Button */}
                <View style={styles.backButtonContainer}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>
                            {isSelf 
                                ? 'Would you like\nto focus on something\nspecific in your reading?'
                                : `Would you like\nto focus on something\nspecific in ${personName}'s reading?`
                            }
                        </Text>
                        <Text style={styles.subheadline}>
                            {isSelf
                                ? 'Please feel free to share any questions, feelings, or areas of life you\'d like the reading to address.'
                                : `${personName}, please feel free to share any questions, feelings, or areas of life you\'d like the reading to address.`
                            }
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
        backgroundColor: colors.primary, // RED background
    },
    backButtonContainer: {
        paddingHorizontal: spacing.page,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    backButton: {
        paddingVertical: spacing.xs,
    },
    backText: {
        fontFamily: typography.sansMedium,
        fontSize: 16,
        color: colors.background, // White text on red
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.page,
        paddingTop: spacing.md,
    },
    header: {
        marginBottom: spacing.xl,
    },
    headline: {
        fontFamily: typography.headline,
        fontSize: 32, // Even bigger headline
        color: colors.background, // White text on red background
        fontStyle: 'normal',
        textAlign: 'center', // CENTERED
        marginBottom: spacing.md,
        lineHeight: 40,
    },
    subheadline: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.85)', // Light text on red
        textAlign: 'left', // LEFT aligned (only subheadline)
        lineHeight: 24,
    },
    inputContainer: {
        flex: 1,
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    textInput: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        padding: spacing.lg,
        height: 290, // 30% shorter (was 420)
        width: '90%', // Slightly wider (was 85%)
        borderWidth: 2,
        borderColor: colors.primary,
    },
    charCount: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)', // Light text on red
        textAlign: 'right',
        marginTop: spacing.sm,
        width: '85%', // Match input width
    },
    buttonContainer: {
        paddingHorizontal: spacing.page,
        paddingBottom: spacing.xl, // More bottom padding
        gap: spacing.md, // More gap
    },
    continueButton: {
        backgroundColor: colors.background, // WHITE button (was red)
        borderRadius: radii.button,
        paddingVertical: spacing.lg, // More padding
        alignItems: 'center',
    },
    continueButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.primary, // RED text on white button
        letterSpacing: 1, // More letter spacing
    },
    skipButton: {
        backgroundColor: 'transparent',
        borderRadius: radii.button,
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)', // Light border on red
    },
    skipButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.background, // White text
        letterSpacing: 0.5,
    },
});

