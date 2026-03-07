"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gematriaService = exports.GematriaService = void 0;
// @ts-ignore
const gematria_1 = __importDefault(require("gematria"));
// Standard English to Hebrew transliteration map for Kabbalistic purposes
const TRANSLITERATION_MAP = {
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
const FINAL_FORMS = {
    'כ': 'ך',
    'מ': 'ם',
    'נ': 'ן',
    'פ': 'ף',
    'צ': 'ץ',
};
class GematriaService {
    /**
     * Transliterate English name to Hebrew letters
     */
    transliterate(name) {
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
    calculateGematria(hebrew) {
        try {
            return (0, gematria_1.default)(hebrew);
        }
        catch (e) {
            console.warn('Gematria calculation failed for:', hebrew, e);
            return 0;
        }
    }
    /**
     * Process a name into full gematria info
     */
    processName(name) {
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
exports.GematriaService = GematriaService;
exports.gematriaService = new GematriaService();
//# sourceMappingURL=GematriaService.js.map