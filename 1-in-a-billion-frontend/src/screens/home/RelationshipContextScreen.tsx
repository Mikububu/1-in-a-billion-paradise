/**
 * RELATIONSHIP CONTEXT SCREEN
 * 
 * Allows users to optionally share feelings/context about the other person
 * before generating an overlay reading. This infuses the reading with subtle
 * emotional context without affecting astrological calculations.
 */

import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { MainStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'RelationshipContext'>;

const MAX_CHARS = 700;

export const RelationshipContextScreen = ({ navigation, route }: Props) => {
    const { partnerName, ...restParams } = route.params;
    const [context, setContext] = useState('');

    const handleSkip = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            relationshipContext: undefined,
        });
    };

    const handleContinue = () => {
        navigation.navigate('SystemSelection', {
            ...restParams,
            relationshipContext: context.trim() || undefined,
        });
    };

    const charsRemaining = MAX_CHARS - context.length;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>
                            Would you like to tell us more about this soul connection?
                        </Text>
                        <Text style={styles.subheadline}>
                            {partnerName}, please feel free to share how you're related and how you feel toward them.
                        </Text>
                    </View>

                    {/* Text Input */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            multiline
                            placeholder="Share your feelings, thoughts, or context here..."
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
                        style={[styles.button, styles.skipButton]}
                        onPress={handleSkip}
                    >
                        <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.continueButton]}
                        onPress={handleContinue}
                    >
                        <Text style={styles.continueButtonText}>Continue</Text>
                    </TouchableOpacity>
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
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.page,
    },
    header: {
        marginBottom: spacing.xl,
        marginTop: spacing.lg,
    },
    headline: {
        fontFamily: typography.headline,
        fontSize: 18,
        color: colors.text,
        marginBottom: spacing.md,
        lineHeight: 24,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    subheadline: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        lineHeight: 20,
        textAlign: 'center',
    },
    inputContainer: {
        flex: 1,
        minHeight: 200,
    },
    textInput: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: radii.lg,
        padding: spacing.lg,
        height: 300,
    },
    charCount: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
        marginTop: spacing.sm,
        textAlign: 'right',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.page,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radii.button,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
    },
    skipButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    continueButton: {
        backgroundColor: colors.primary,
    },
    continueButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.background,
    },
});
