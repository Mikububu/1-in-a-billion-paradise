/**
 * LANGUAGE CONFIGURATION
 *
 * Central source of truth for all language-related settings.
 *
 * ARCHITECTURE:
 * - OutputLanguage: The language readings are generated in
 * - LLM generates NATIVELY in each target language (no translation step)
 * - Each language has a prompt instruction block appended to the system prompt
 *
 * LAUNCH LANGUAGES: en, de, es, fr, zh (5 total)
 * Adding a language: add entry here + frontend JSON + voice registry entry
 */

/**
 * Supported output languages for reading generation.
 * Add new languages here when ready to support them.
 */
export const OUTPUT_LANGUAGES = ['en', 'de', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'pt', 'it'] as const;
export type OutputLanguage = typeof OUTPUT_LANGUAGES[number];

/**
 * Default output language for all readings.
 */
export const DEFAULT_OUTPUT_LANGUAGE: OutputLanguage = 'en';

/**
 * Shared prompt preamble for ALL non-English languages.
 * Appended before the language-specific instructions.
 */
const NATIVE_GENERATION_PREAMBLE = `
CRITICAL: Generate NATIVELY in the target language specified below.
- Internalize the voice, style, and psychological depth from the English examples above
- Do NOT translate English phrases — CREATE content from scratch in the target language
- Apply the same shadow percentages, forbidden pattern concepts, and quality standards
- The output must feel NATIVE to a speaker of this language, not translated
- Avoid filler phrases and clichés equivalent to the English forbidden phrases
- Maintain the same word count, depth, and analytical rigor as the English version
- Astrological terms (zodiac signs, planets, houses) should use standard local terminology
`;

/**
 * Language metadata for UI, prompts, and TTS.
 */
export const LANGUAGE_CONFIG: Record<OutputLanguage, {
  name: string;
  nativeName: string;
  locale: string;
  promptInstruction: string;
}> = {
  en: {
    name: 'English',
    nativeName: 'English',
    locale: 'en-US',
    promptInstruction: '', // No instruction needed for English
  },
  de: {
    name: 'German',
    nativeName: 'Deutsch',
    locale: 'de-DE',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: German (Deutsch)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native German-speaking depth psychologist (Tiefenpsychologe) would
- Use appropriate German psychological vocabulary (Schatten, Anima/Animus, Individuation)
- Zodiac signs: Widder, Stier, Zwillinge, Krebs, Löwe, Jungfrau, Waage, Skorpion, Schütze, Steinbock, Wassermann, Fische
- Planets: Sonne, Mond, Merkur, Venus, Mars, Jupiter, Saturn, Uranus, Neptun, Pluto
- Use formal-but-warm tone (Du-form for the reader, not Sie)
`,
  },
  es: {
    name: 'Spanish',
    nativeName: 'Español',
    locale: 'es-ES',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Spanish (Español)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Spanish-speaking psychoanalyst would write
- Use tú-form for intimate, personal reading tone
- Zodiac signs: Aries, Tauro, Géminis, Cáncer, Leo, Virgo, Libra, Escorpio, Sagitario, Capricornio, Acuario, Piscis
- Planets: Sol, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, Urano, Neptuno, Plutón
`,
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    locale: 'fr-FR',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: French (Français)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native French-speaking psychoanalyst would write
- Use tu-form for intimate, personal reading tone
- Zodiac signs: Bélier, Taureau, Gémeaux, Cancer, Lion, Vierge, Balance, Scorpion, Sagittaire, Capricorne, Verseau, Poissons
- Planets: Soleil, Lune, Mercure, Vénus, Mars, Jupiter, Saturne, Uranus, Neptune, Pluton
- French astrological tradition uses "maisons" (houses), "ascendant", "thème astral" (birth chart)
`,
  },
  zh: {
    name: 'Chinese',
    nativeName: '中文',
    locale: 'zh-CN',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Chinese (简体中文)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Chinese-speaking psychoanalyst would write
- Use Simplified Chinese characters
- Zodiac signs: 白羊座, 金牛座, 双子座, 巨蟹座, 狮子座, 处女座, 天秤座, 天蝎座, 射手座, 摩羯座, 水瓶座, 双鱼座
- Planets: 太阳, 月亮, 水星, 金星, 火星, 木星, 土星, 天王星, 海王星, 冥王星
- Use appropriate Chinese psychological vocabulary and metaphors
- Character count targets should be ~0.6x the English word count (Chinese is more compact)
- For Vedic terms, provide the Chinese transliteration followed by the Sanskrit in parentheses
`,
  },
  ja: {
    name: 'Japanese',
    nativeName: '日本語',
    locale: 'ja-JP',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Japanese (日本語)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Japanese-speaking depth psychologist (深層心理学者) would write
- Use formal but intimate descriptive tone (Desu/Masu form acceptable if appropriately mysterious, but avoid casual slang)
- Zodiac signs: 牡羊座, 牡牛座, 双子座, 蟹座, 獅子座, 乙女座, 天秤座, 蠍座, 射手座, 山羊座, 水瓶座, 魚座
- Planets: 太陽, 月, 水星, 金星, 火星, 木星, 土星, 天王星, 海王星, 冥王星
- Use appropriate Jungian terminology in Japanese (無意識, シャドウ, アニマ, 投影)
- Character count targets should be ~0.6x the English word count (Japanese is more compact)
`,
  },
  ko: {
    name: 'Korean',
    nativeName: '한국어',
    locale: 'ko-KR',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Korean (한국어)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Korean-speaking psychoanalyst would write
- Use an intimate, penetrating analytical tone (Haera-che / polite but analytical form)
- Zodiac signs: 양자리, 황소자리, 쌍둥이자리, 게자리, 사자자리, 처녀자리, 천칭자리, 전갈자리, 사수자리, 염소자리, 물병자리, 물고기자리
- Planets: 태양, 달, 수성, 금성, 화성, 목성, 토성, 천왕성, 해왕성, 명왕성
- Use appropriate Korean psychological terminology (무의식, 그림자, 투사, 애착)
- Character count targets should be ~0.6x the English word count
`,
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिन्दी',
    locale: 'hi-IN',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Hindi (हिन्दी)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Hindi-speaking depth psychologist/astrologer would write
- Use a profound, slightly poetic but analytical tone (avoiding purely religious vocabulary in favor of psychological depth)
- Zodiac signs: मेष, वृषभ, मिथुन, कर्क, सिंह, कन्या, तुला, वृश्चिक, धनु, मकर, कुंभ, मीन
- Planets: सूर्य, चंद्र, बुध, शुक्र, मंगल, गुरु, शनि, अरुण (Uranus), वरुण (Neptune), यम (Pluto)
- Use standard Devanagari script. Do not use English script (Hinglish).
`,
  },
  pt: {
    name: 'Portuguese',
    nativeName: 'Português',
    locale: 'pt-BR',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Portuguese (Português)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Portuguese-speaking psychoanalyst (psicanalista) would write
- Use 'você' form (Brazilian Portuguese standard) for a direct, intimate, and penetrating tone
- Zodiac signs: Áries, Touro, Gêmeos, Câncer, Leão, Virgem, Libra, Escorpião, Sagitário, Capricórnio, Aquário, Peixes
- Planets: Sol, Lua, Mercúrio, Vênus, Marte, Júpiter, Saturno, Urano, Netuno, Plutão
- Use psychological vocabulary natively (sombra corporificada, ferida de apego, projeção)
`,
  },
  it: {
    name: 'Italian',
    nativeName: 'Italiano',
    locale: 'it-IT',
    promptInstruction: `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT LANGUAGE: Italian (Italiano)
═══════════════════════════════════════════════════════════════════════════════
${NATIVE_GENERATION_PREAMBLE}
LANGUAGE-SPECIFIC NOTES:
- Write as a native Italian-speaking psychoanalyst would write
- Use 'tu' form for an intimate, personal, and profoundly direct reading tone
- Zodiac signs: Ariete, Toro, Gemelli, Cancro, Leone, Vergine, Bilancia, Scorpione, Sagittario, Capricorno, Acquario, Pesci
- Planets: Sole, Luna, Mercurio, Venere, Marte, Giove, Saturno, Urano, Nettuno, Plutone
- Emphasize emotional depth and shadow-work vocabulary (l'ombra, ferita narcisistica, attaccamento)
`,
  },
};

/**
 * Check if a language is supported.
 */
export function isValidLanguage(lang: string): lang is OutputLanguage {
  return OUTPUT_LANGUAGES.includes(lang as OutputLanguage);
}

/**
 * Get language instruction for LLM prompt.
 * Returns empty string for English (no instruction needed).
 */
export function getLanguageInstruction(lang: OutputLanguage): string {
  return LANGUAGE_CONFIG[lang]?.promptInstruction || '';
}

/**
 * Get BCP-47 locale for a language.
 */
export function getLocale(lang: OutputLanguage): string {
  return LANGUAGE_CONFIG[lang]?.locale || 'en-US';
}

/**
 * Safely parse language from unknown input.
 * Returns default if invalid.
 */
export function parseLanguage(input: unknown): OutputLanguage {
  if (typeof input === 'string' && isValidLanguage(input)) {
    return input;
  }
  return DEFAULT_OUTPUT_LANGUAGE;
}
