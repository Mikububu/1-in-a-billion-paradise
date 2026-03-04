/**
 * INTERNATIONALIZATION (i18n) ENGINE
 *
 * Provides translation infrastructure for 5 launch languages:
 *   en (English), de (German), es (Spanish), fr (French), zh (Chinese)
 *
 * Architecture:
 *   - All translation JSON files are loaded statically (no async import)
 *   - Language preference is persisted to AsyncStorage
 *   - setLanguage() updates the active language and notifies listeners
 *   - t(key, params?) returns translated string with interpolation
 *   - getLocale() returns the BCP-47 locale for Intl formatting
 *
 * OVERLAY PRINCIPLE:
 *   English is the source of truth. Other languages fall back to English
 *   for any missing key. The core app uses t() calls — changing English
 *   values in en.json propagates automatically. Translations are updated
 *   independently without touching app logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en.json';
import de from './de.json';
import es from './es.json';
import fr from './fr.json';
import zh from './zh.json';
import ja from './ja.json';
import ko from './ko.json';
import hi from './hi.json';
import pt from './pt.json';
import it from './it.json';

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTED LANGUAGES
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ['en', 'de', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'pt', 'it'] as const;
export type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_META: Record<LanguageCode, {
  name: string;
  nativeName: string;
  locale: string;    // BCP-47 locale for Intl.DateTimeFormat etc.
}> = {
  en: { name: 'English', nativeName: 'English', locale: 'en-US' },
  de: { name: 'German', nativeName: 'Deutsch', locale: 'de-DE' },
  es: { name: 'Spanish', nativeName: 'Español', locale: 'es-ES' },
  fr: { name: 'French', nativeName: 'Français', locale: 'fr-FR' },
  zh: { name: 'Chinese', nativeName: '中文', locale: 'zh-CN' },
  ja: { name: 'Japanese', nativeName: '日本語', locale: 'ja-JP' },
  ko: { name: 'Korean', nativeName: '한국어', locale: 'ko-KR' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', locale: 'hi-IN' },
  pt: { name: 'Portuguese', nativeName: 'Português', locale: 'pt-BR' },
  it: { name: 'Italian', nativeName: 'Italiano', locale: 'it-IT' },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATION DICTIONARIES
// ─────────────────────────────────────────────────────────────────────────────

type TranslationDict = Record<string, string>;
type Translations = Record<LanguageCode, TranslationDict>;

const translations: Translations = {
  en: en as TranslationDict,
  de: de as TranslationDict,
  es: es as TranslationDict,
  fr: fr as TranslationDict,
  zh: zh as TranslationDict,
  ja: ja as TranslationDict,
  ko: ko as TranslationDict,
  hi: hi as TranslationDict,
  pt: pt as TranslationDict,
  it: it as TranslationDict,
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@app_language';
let currentLanguage: LanguageCode = 'en';
type LanguageListener = (lang: LanguageCode) => void;
const listeners: Set<LanguageListener> = new Set();

/**
 * Initialize language from persisted preference.
 * Call once at app startup (e.g. in App.tsx useEffect).
 */
export async function initLanguage(): Promise<LanguageCode> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && isValidLanguage(stored)) {
      currentLanguage = stored;
    }
  } catch {
    // Silently default to 'en'
  }
  return currentLanguage;
}

/**
 * Set the active language and persist preference.
 */
export async function setLanguage(lang: string): Promise<void> {
  if (!isValidLanguage(lang)) return;
  currentLanguage = lang;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Non-fatal: language works in memory even if persistence fails
  }
  // Notify all listeners (e.g. React components re-render)
  listeners.forEach((fn) => fn(currentLanguage));
}

/**
 * Get the current language code.
 */
export function getLanguage(): LanguageCode {
  return currentLanguage;
}

/**
 * Get the BCP-47 locale for the current language.
 * Useful for Intl.DateTimeFormat, Intl.NumberFormat, etc.
 */
export function getLocale(): string {
  return LANGUAGE_META[currentLanguage]?.locale || 'en-US';
}

/**
 * Subscribe to language changes. Returns unsubscribe function.
 */
export function onLanguageChange(fn: LanguageListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Check if a language code is supported.
 */
export function isValidLanguage(lang: string): lang is LanguageCode {
  return SUPPORTED_LANGUAGES.includes(lang as LanguageCode);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate a key. Falls back to English, then to the key itself.
 *
 * Supports interpolation:  t('greeting', { name: 'Michael' })  -> "Hello Michael"
 * Supports pluralization:  t('peopleList.count', { count: 1 })  -> uses _one variant
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = translations[currentLanguage] || translations.en;
  const enDict = translations.en;

  // Simple pluralization: if params.count === 1, try key_one first
  let lookupKey = key;
  if (params && typeof params.count === 'number' && params.count === 1) {
    const oneKey = `${key}_one`;
    if (dict[oneKey] || enDict[oneKey]) {
      lookupKey = oneKey;
    }
  }

  // Look up: current language -> English fallback -> raw key
  let value = dict[lookupKey] || enDict[lookupKey] || key;

  // Interpolate {{placeholders}}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }

  return value;
}

/**
 * Format a date using the current locale.
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const defaultOpts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  };
  return new Intl.DateTimeFormat(getLocale(), options || defaultOpts).format(d);
}

/**
 * Format a number using the current locale.
 */
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getLocale(), options).format(num);
}
