/**
 * BOTTOM SHEET PICKER
 *
 * A generic, reusable bottom-sheet modal for selecting from a list of options.
 * Uses iOS native formSheet presentation for reliable keyboard handling.
 * FlatList for performant scrolling of 100+ items.
 *
 * Usage:
 *   <BottomSheetPicker
 *     visible={isOpen}
 *     onClose={() => setIsOpen(false)}
 *     title="Select Language"
 *     options={languageOptions}
 *     onSelect={(value) => handleSelect(value)}
 *     selectedId="en"
 *     searchPlaceholder="Search languages..."
 *   />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { t } from '@/i18n';
import { TexturedBackground } from '@/components/TexturedBackground';

export interface PickerOption<T> {
  id: string;
  primary: string;
  secondary?: string;
  value: T;
}

interface BottomSheetPickerProps<T> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<T>[];
  onSelect: (value: T | undefined) => void;
  selectedId?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  optional?: boolean;
}

export function BottomSheetPicker<T>({
  visible,
  onClose,
  title,
  options,
  onSelect,
  selectedId,
  searchable = true,
  searchPlaceholder,
  optional = false,
}: BottomSheetPickerProps<T>) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Auto-focus search input when sheet opens
  useEffect(() => {
    if (visible && searchable) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, [visible, searchable]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const normalized = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.primary.toLowerCase().includes(normalized) ||
        opt.secondary?.toLowerCase().includes(normalized),
    );
  }, [options, query]);

  const handleSelect = useCallback(
    (option: PickerOption<T>) => {
      onSelect(option.value);
      setQuery('');
      onClose();
    },
    [onSelect, onClose],
  );

  const handleClear = useCallback(() => {
    onSelect(undefined);
    setQuery('');
    onClose();
  }, [onSelect, onClose]);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: PickerOption<T> }) => {
      const isActive = item.id === selectedId;
      return (
        <TouchableOpacity
          style={[styles.option, isActive && styles.optionActive]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
        >
          <View style={styles.optionTextWrap}>
            <Text
              style={[styles.optionPrimary, isActive && styles.optionPrimaryActive]}
              numberOfLines={1}
            >
              {item.primary}
            </Text>
            {item.secondary ? (
              <Text
                style={[styles.optionSecondary, isActive && styles.optionSecondaryActive]}
                numberOfLines={1}
              >
                {item.secondary}
              </Text>
            ) : null}
          </View>
          {isActive ? <Text style={styles.checkmark}>✓</Text> : null}
        </TouchableOpacity>
      );
    },
    [selectedId, handleSelect],
  );

  return (
    <Modal
      visible={visible}
      presentationStyle="formSheet"
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TexturedBackground>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {/* Header with cancel button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.cancelButton} />
        </View>

        {searchable ? (
          <View style={styles.searchWrap}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder || t('common.search')}
              placeholderTextColor={colors.mutedText}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        ) : null}

        {optional && selectedId ? (
          <TouchableOpacity
            style={styles.clearRow}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={styles.clearText}>{t('common.removeSelection')}</Text>
          </TouchableOpacity>
        ) : null}

        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('common.noResults')}</Text>
          }
        />
      </View>
      </TexturedBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  cancelButton: {
    width: 70,
  },
  cancelText: {
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.primary,
  },
  title: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    flex: 1,
  },
  searchWrap: {
    marginBottom: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  clearRow: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardStroke,
    marginBottom: spacing.xs,
  },
  clearText: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: colors.primary,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    marginBottom: spacing.xs,
  },
  optionActive: {
    borderColor: colors.primary,
  },
  optionTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  optionPrimary: {
    fontFamily: typography.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  optionPrimaryActive: {
    color: colors.primary,
  },
  optionSecondary: {
    fontFamily: typography.sansRegular,
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  optionSecondaryActive: {
    color: colors.primary,
  },
  checkmark: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.primary,
  },
  emptyText: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
