/**
 * CITY SEARCH SHEET
 *
 * A specialized bottom-sheet modal for city search with debounced API calls.
 * Same Modal pattern as BottomSheetPicker but with live search against the
 * backend city search API instead of a static options list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { searchCities } from '@/services/geonames';
import type { CityOption } from '@/types/forms';

interface CitySearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (city: CityOption) => void;
  selected?: CityOption | null;
}

export function CitySearchSheet({
  visible,
  onClose,
  onSelect,
  selected,
}: CitySearchSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setIsSearching(false);
      // Auto-focus the search input
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  // Debounced city search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const cities = await searchCities(query);
        setResults(cities);
      } catch {
        // silently fail
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (city: CityOption) => {
      onSelect(city);
      setQuery('');
      setResults([]);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: CityOption }) => {
      const isActive = selected?.id === item.id;
      return (
        <TouchableOpacity
          style={[styles.option, isActive && styles.optionActive]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <View style={styles.optionTextWrap}>
            <Text
              style={[styles.optionPrimary, isActive && styles.optionPrimaryActive]}
              numberOfLines={1}
            >
              {item.name}
              {item.region ? `, ${item.region}` : ''}
            </Text>
            <Text
              style={[styles.optionSecondary, isActive && styles.optionSecondaryActive]}
              numberOfLines={1}
            >
              {item.country}
            </Text>
          </View>
          {isActive ? <Text style={styles.checkmark}>✓</Text> : null}
        </TouchableOpacity>
      );
    },
    [selected, handleSelect],
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

          <Text style={styles.title}>{t('citySearch.title')}</Text>

          <View style={styles.searchWrap}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('citySearch.placeholder')}
              placeholderTextColor={colors.mutedText}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator
                size="small"
                color={colors.mutedText}
                style={styles.spinner}
              />
            ) : null}
          </View>

          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              query.length >= 2 && !isSearching ? (
                <Text style={styles.emptyText}>{t('common.noResults')}</Text>
              ) : query.length < 2 ? (
                <Text style={styles.emptyText}>{t('citySearch.placeholder')}</Text>
              ) : null
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
}

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
    maxHeight: '70%',
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
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.inputStroke,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: 40,
    fontFamily: typography.sansRegular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  spinner: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
