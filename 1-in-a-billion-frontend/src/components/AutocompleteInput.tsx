import { useMemo, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography, radii } from '@/theme/tokens';

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
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!options || !Array.isArray(options)) return [];
    if (!query) {
      return options.slice(0, 6);
    }
    const normalized = query.toLowerCase();
    return options.filter(
      (option) =>
        option.primary.toLowerCase().includes(normalized) ||
        option.secondary?.toLowerCase().includes(normalized)
    ).slice(0, 6);
  }, [options, query]);

  const handleSelect = (option: AutocompleteOption<T>) => {
    Keyboard.dismiss();
    onSelect(option.value);
    setQuery(option.primary);
    setIsOpen(false);
  };

  const handleClear = () => {
    Keyboard.dismiss();
    onSelect(undefined);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          value={query || selectedLabel}
          onChangeText={(text) => {
            setQuery(text);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          onFocus={() => setIsOpen(true)}
        />
        {/* Clear button - show when optional and has value */}
        {optional && selectedLabel && !isOpen ? (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearText}>X</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {isOpen && filtered.length > 0 ? (
        <View style={styles.suggestionBox}>
          {/* Clear option for optional fields */}
          {optional && selectedLabel ? (
            <TouchableOpacity 
              style={[styles.option, styles.optionBorder]} 
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Text style={styles.clearOptionText}>Remove selection</Text>
            </TouchableOpacity>
          ) : null}
          {/* Dismiss option */}
          <TouchableOpacity 
            style={[styles.option, styles.optionBorder]} 
            onPress={() => {
              Keyboard.dismiss();
              setIsOpen(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissText}>Close</Text>
          </TouchableOpacity>
          {filtered.map((item, index) => (
            <TouchableOpacity 
              key={item.id} 
              style={[
                styles.option,
                index < filtered.length - 1 && styles.optionBorder
              ]} 
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionPrimary}>{item.primary}</Text>
              {item.secondary ? <Text style={styles.optionSecondary}>{item.secondary}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingRight: 44,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
  },
  clearButton: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  clearText: {
    fontSize: 16,
    color: colors.mutedText,
  },
  helper: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
  },
  suggestionBox: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    backgroundColor: colors.background,
    marginTop: spacing.xs,
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  optionPrimary: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: colors.text,
  },
  optionSecondary: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  dismissText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
  },
  clearOptionText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
  },
});
