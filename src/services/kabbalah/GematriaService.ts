// @ts-ignore
import gematria from 'gematria';

// Standard English to Hebrew transliteration map for Kabbalistic purposes
const TRANSLITERATION_MAP: Record<string, string> = {
  'a': 'א',
  'b': 'ב',
  'c': 'כ',
  'd': 'ד',
  'e': 'ה',
  'f': 'ו',
  'g': 'ג',
  'h': 'ח',
  'i': 'י',
  'j': 'י',
  'k': 'כ',
  'l': 'ל',
  'm': 'מ',
  'n': 'נ',
  'o': 'ו',
  'p': 'פ',
  'q': 'ק',
  'r': 'ר',
  's': 'ס',
  't': 'ת',
  'u': 'ו',
  'v': 'ו',
  'w': 'ו',
  'x': 'ס',
  'y': 'י',
  'z': 'ז',
};

// Final forms of Hebrew letters
const FINAL_FORMS: Record<string, string> = {
  'כ': 'ך',
  'מ': 'ם',
  'נ': 'ן',
  'פ': 'ף',
  'צ': 'ץ',
};

export interface GematriaInfo {
  secular: string;
  hebrew: string;
  letters: string[];
  gematria: number;
}

export class GematriaService {
  /**
   * Transliterate English name to Hebrew letters
   */
  transliterate(name: string): string {
    const clean = name.toLowerCase().replace(/[^a-z]/g, '');
    let hebrew = '';
    
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      let hChar = TRANSLITERATION_MAP[char] || '';
      
      // If it's the last character and has a final form, use it
      if (i === clean.length - 1 && FINAL_FORMS[hChar]) {
        hChar = FINAL_FORMS[hChar];
      }
      
      hebrew += hChar;
    }
    
    return hebrew;
  }

  /**
   * Get gematria value for a Hebrew string
   */
  calculateGematria(hebrew: string): number {
    try {
      return gematria(hebrew);
    } catch (e) {
      console.warn('Gematria calculation failed for:', hebrew, e);
      return 0;
    }
  }

  /**
   * Process a name into full gematria info
   */
  processName(name: string): GematriaInfo {
    const hebrew = this.transliterate(name);
    const letters = hebrew.split('');
    const value = this.calculateGematria(hebrew);
    
    return {
      secular: name,
      hebrew,
      letters,
      gematria: value,
    };
  }
}

export const gematriaService = new GematriaService();
