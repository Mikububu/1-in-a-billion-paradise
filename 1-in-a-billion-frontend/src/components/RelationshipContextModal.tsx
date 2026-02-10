import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Pressable, TextInput } from 'react-native';
import { colors, spacing, typography, radii } from '@/theme/tokens';

const PREDEFINED_CONTEXTS = [
    'Romantic Partner',
    'Former Partner',
    'Potential Partner',
    'Spouse',
    'Friend',
    'Family Member',
    'Colleague',
    'Teacher',
    'Neutral',
    'Custom',
];

interface RelationshipContextModalProps {
    visible: boolean;
    onCancel: () => void;
    onConfirm: (context?: string) => void;
}

export const RelationshipContextModal: React.FC<RelationshipContextModalProps> = ({
    visible,
    onCancel,
    onConfirm,
}) => {
    const [selectedContext, setSelectedContext] = useState<string | null>(null);
    const [customContext, setCustomContext] = useState('');

    const handleConfirm = () => {
        if (selectedContext === 'Custom') {
            onConfirm(customContext.trim() || undefined);
        } else {
            onConfirm(selectedContext || undefined);
        }
    };

    const handleSkip = () => {
        onConfirm(undefined); // No context provided
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.title}>Relationship Context</Text>
                    <Text style={styles.subtitle}>
                        Help us tailor the reading by describing their role in your life (optional)
                    </Text>

                    <View style={styles.optionsContainer}>
                        {PREDEFINED_CONTEXTS.map((context) => (
                            <TouchableOpacity
                                key={context}
                                style={[
                                    styles.optionButton,
                                    selectedContext === context && styles.selectedOption,
                                ]}
                                onPress={() => setSelectedContext(context)}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        selectedContext === context && styles.selectedOptionText,
                                    ]}
                                >
                                    {context}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {selectedContext === 'Custom' && (
                        <TextInput
                            style={styles.customInput}
                            placeholder="Enter custom relationship description"
                            placeholderTextColor={colors.mutedText}
                            value={customContext}
                            onChangeText={setCustomContext}
                            autoFocus
                            maxLength={50}
                        />
                    )}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, styles.skipButton]}
                            onPress={handleSkip}
                        >
                            <Text style={styles.skipButtonText}>Skip</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.confirmButton,
                                !selectedContext && styles.disabledButton,
                            ]}
                            onPress={handleConfirm}
                            disabled={!selectedContext}
                        >
                            <Text
                                style={[
                                    styles.confirmButtonText,
                                    !selectedContext && styles.disabledButtonText,
                                ]}
                            >
                                Continue
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '90%',
        maxWidth: 500,
        backgroundColor: colors.background,
        borderRadius: radii.modal,
        padding: spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontFamily: typography.headline,
        fontSize: 24,
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.sansRegular,
        fontSize: 14,
        color: colors.mutedText,
        marginBottom: spacing.lg,
        textAlign: 'center',
        lineHeight: 20,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    optionButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.button,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    selectedOption: {
        borderColor: colors.primary,
        backgroundColor: colors.primary,
    },
    optionText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
    },
    selectedOptionText: {
        color: colors.background,
    },
    customInput: {
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.input,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        gap: spacing.md,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radii.button,
        alignItems: 'center',
    },
    skipButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    skipButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.text,
    },
    confirmButton: {
        backgroundColor: colors.primary,
    },
    confirmButtonText: {
        fontFamily: typography.sansSemiBold,
        fontSize: 16,
        color: colors.background,
    },
    disabledButton: {
        backgroundColor: colors.border,
    },
    disabledButtonText: {
        color: colors.mutedText,
    },
});
