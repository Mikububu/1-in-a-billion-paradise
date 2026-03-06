/**
 * CITY SEARCH SHEET
 *
 * Uses iOS native formSheet presentation for proper keyboard handling.
 * The TextInput works reliably because iOS manages the sheet + keyboard natively.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { searchCities } from '@/services/geonames';
import { TexturedBackground } from '@/components/TexturedBackground';
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
      // Auto-focus after modal presentation animation
      setTimeout(() => inputRef.current?.focus(), 500);
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
      visible={visible}
      presentationStyle="formSheet"
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TexturedBackground>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('citySearch.title')}</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Search input */}
        <View style={styles.searchWrap}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('citySearch.placeholder')}
            placeholderTextColor={colors.mutedText}
            autoCorrect={false}
            autoCapitalize="words"
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

        {/* Results */}
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
  closeButton: {
    width: 70,
  },
  closeText: {
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
    flex: 1,
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
