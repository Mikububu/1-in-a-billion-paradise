/**
 * LANGUAGE PICKER
 *
 * A beautiful bottom-sheet modal for selecting the app language.
 * Triggered by a small pill button on the HomeScreen (top-left).
 *
 * Design:
 *   - Transparent backdrop with fade animation
 *   - Bottom sheet with language options
 *   - Each language shown in its native name
 *   - Active language highlighted with primary color
 *   - Tapping a language switches instantly and closes the sheet
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '@/theme/tokens';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  getLanguage,
  setLanguage,
  onLanguageChange,
  t,
  type LanguageCode,
} from '@/i18n';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePicker({ visible, onClose }: LanguagePickerProps) {
  const insets = useSafeAreaInsets();
  const [activeLang, setActiveLang] = useState<LanguageCode>(getLanguage());

  // Stay in sync if language changes externally
  useEffect(() => {
    return onLanguageChange(setActiveLang);
  }, []);

  const handleSelect = useCallback(async (lang: LanguageCode) => {
    await setLanguage(lang);
    onClose();
  }, [onClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          // Prevent backdrop press from bubbling through the sheet
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>{t('languagePicker.title')}</Text>

          <View style={styles.options}>
            {SUPPORTED_LANGUAGES.map((code) => {
              const meta = LANGUAGE_META[code];
              const isActive = code === activeLang;

              return (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.option,
                    isActive && styles.optionActive,
                  ]}
                  onPress={() => handleSelect(code)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${meta.name} language`}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[
                    styles.optionNative,
                    isActive && styles.optionTextActive,
                  ]}>
                    {meta.nativeName}
                  </Text>
                  <Text style={[
                    styles.optionEnglish,
                    isActive && styles.optionSubActive,
                  ]}>
                    {meta.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
  options: {
    gap: spacing.sm,
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
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  optionNative: {
    fontFamily: typography.sansSemiBold,
    fontSize: 17,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primary,
  },
  optionEnglish: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: colors.textDim,
  },
  optionSubActive: {
    color: colors.primary,
  },
});
