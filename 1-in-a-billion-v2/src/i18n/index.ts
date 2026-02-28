/**
 * INTERNATIONALIZATION (i18n) SETUP
 *
 * Provides translation infrastructure using a lightweight approach.
 * Currently English only, but structured for easy language additions.
 */

import en from './en.json';

type TranslationKey = keyof typeof en;
type Translations = Record<string, Record<string, string>>;

const translations: Translations = { en };
let currentLanguage = 'en';

/**
 * Set the active language.
 */
export function setLanguage(lang: string) {
  if (translations[lang]) {
    currentLanguage = lang;
  }
}

/**
 * Get the current language code.
 */
export function getLanguage(): string {
  return currentLanguage;
}

/**
 * Translate a key. Returns the key itself if no translation found.
 * Supports simple interpolation: t('greeting', { name: 'Michael' })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = translations[currentLanguage] || translations.en;
  let value = dict[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{{${k}}}`, String(v));
    }
  }

  return value;
}
