/**
 * AUTOCOMPLETE INPUT
 *
 * Renders a styled Pressable row that opens a BottomSheetPicker modal.
 * Same external props API as before — no changes needed in consuming screens.
 *
 * For optional fields: X button to clear selection.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { t } from '@/i18n';
import { BottomSheetPicker, type PickerOption } from './BottomSheetPicker';

export type AutocompleteOption<T> = {
    id: string;
    primary: string;
    secondary?: string;
    value: T;
};

type AutocompleteInputProps<T> = {
    label: string;
    placeholder?: string;
    options: AutocompleteOption<T>[];
    onSelect: (value: T | undefined) => void;
    selectedLabel?: string;
    helperText?: string;
    optional?: boolean;
};

export const AutocompleteInput = <T,>({
    label,
    placeholder,
    options,
    onSelect,
    selectedLabel,
    helperText,
    optional,
}: AutocompleteInputProps<T>) => {
    const [isOpen, setIsOpen] = useState(false);

    // Find the selected option's id for the checkmark
    const selectedId = selectedLabel
        ? options.find((o) => o.primary === selectedLabel)?.id
        : undefined;

    const handleClear = () => {
        onSelect(undefined);
    };

    return (
        <View style={styles.wrapper}>
            <View style={styles.labelRow}>
                <Text style={styles.label}>{label}</Text>
                {optional ? <Text style={styles.optional}>{t('common.optional')}</Text> : null}
            </View>

            <Pressable
                style={styles.inputRow}
                onPress={() => setIsOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={label}
            >
                <Text
                    style={[styles.inputText, !selectedLabel && styles.placeholder]}
                    numberOfLines={1}
                >
                    {selectedLabel || placeholder || t('common.search')}
                </Text>

                {/* Clear button for optional fields with a selection */}
                {optional && selectedLabel ? (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleClear();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.clearText}>✕</Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.chevron}>›</Text>
                )}
            </Pressable>

            {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

            <BottomSheetPicker
                visible={isOpen}
                onClose={() => setIsOpen(false)}
                title={label}
                options={options}
                onSelect={onSelect}
                selectedId={selectedId}
                optional={optional}
                searchPlaceholder={placeholder}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        gap: spacing.xs,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontFamily: typography.sansSemiBold,
        fontSize: 14,
        color: colors.text,
    },
    optional: {
        fontFamily: typography.sansRegular,
        fontSize: 12,
        color: colors.mutedText,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.inputStroke,
        borderRadius: radii.input,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.inputBg,
        minHeight: 48,
    },
    inputText: {
        flex: 1,
        fontFamily: typography.sansRegular,
        fontSize: 16,
        color: colors.text,
    },
    placeholder: {
        color: colors.mutedText,
    },
    clearButton: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    clearText: {
        fontSize: 16,
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
    },
    chevron: {
        fontSize: 22,
        color: colors.mutedText,
        fontFamily: typography.sansRegular,
        marginLeft: spacing.xs,
    },
    helper: {
        fontFamily: typography.sansRegular,
        fontSize: 13,
        color: colors.mutedText,
    },
});
