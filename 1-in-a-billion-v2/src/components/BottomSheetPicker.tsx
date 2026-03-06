/**
 * BOTTOM SHEET PICKER
 *
 * A generic, reusable bottom-sheet modal for selecting from a list of options.
 * Based on the proven LanguagePicker pattern — slides up from bottom, has search,
 * uses FlatList for performant scrolling of 100+ items.
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

import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import { t } from '@/i18n';

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
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>

          {searchable ? (
            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder || t('common.search')}
                placeholderTextColor={colors.mutedText}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
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
      </Pressable>
    </Modal>
  );
}

const SHEET_MAX_HEIGHT = '70%';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.page,
    maxHeight: SHEET_MAX_HEIGHT,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.sansSemiBold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
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
