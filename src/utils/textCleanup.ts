/**
 * TEXT CLEANUP UTILITY
 * 
 * Cleans text to be TTS (Text-to-Speech) ready and audio-flawless.
 * Removes all symbols, unicode characters, markdown, and garbage text
 * that could cause issues with audio generation.
 * 
 * Source: OUTPUT_FORMAT_RULES from prompts/core/output-rules.ts
 */

/**
 * Clean text for TTS audio generation
 * 
 * Removes:
 * - All markdown syntax (#, ##, **, __, -, etc.)
 * - Special characters and unicode (♈, ♉, °, ', ", —, –, etc.)
 * - Emojis and symbols
 * - HTML tags and entities
 * - Broken words or unreadable text
 * - Em-dashes and en-dashes (replaces with commas/semicolons)
 * 
 * Ensures:
 * - Headlines have proper spacing after them for TTS pauses
 * - All text is readable and pronounceable
 * - No symbols that would confuse TTS
 */
export function cleanupTextForTTS(text: string): string {
  let cleaned = text;

  // Remove HTML tags and entities
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/&[a-z]+;/gi, '');
  cleaned = cleaned.replace(/&#\d+;/g, '');

  // Remove markdown syntax
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, ''); // Headers (#, ##, ###, etc.)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold **text**
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // Italic *text*
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1'); // Bold __text__
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1'); // Italic _text_
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1'); // Strikethrough ~~text~~
  cleaned = cleaned.replace(/^[-*+]\s+/gm, ''); // Bullet points
  cleaned = cleaned.replace(/^\d+\.\s+/gm, ''); // Numbered lists

  // Replace em-dashes and en-dashes with commas or semicolons
  cleaned = cleaned.replace(/—/g, ', ');
  cleaned = cleaned.replace(/–/g, ', ');

  // Remove special characters and unicode symbols
  // Keep standard punctuation: . , ; : ' " ? !
  cleaned = cleaned.replace(/[♈♉♊♋♌♍♎♏♐♑♒♓]/g, ''); // Zodiac symbols
  cleaned = cleaned.replace(/[°'"]/g, ''); // Degree symbols and quotes (keep standard quotes)
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t.,;:!?'"()\[\]{}]/g, (char) => {
    // Keep printable ASCII + newlines/tabs + standard punctuation
    // Remove everything else (unicode, special symbols)
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) return char; // Printable ASCII
    if (code === 9 || code === 10 || code === 13) return char; // Tab, LF, CR
    return ' '; // Replace with space
  });

  // Remove emojis (common emoji ranges)
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, ''); // Miscellaneous Symbols and Pictographs
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Miscellaneous Symbols
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats

  // Clean up multiple spaces
  cleaned = cleaned.replace(/ +/g, ' ');
  
  // Ensure headlines have space after them (for TTS pauses)
  // Match lines that look like headlines (ALL CAPS or Title Case at start of line)
  cleaned = cleaned.replace(/^([A-Z][A-Z\s]{10,})\n/gm, (match) => {
    // If it's all caps or title case and ends without space, add space
    return match.trimEnd() + ' \n';
  });

  // Clean up multiple newlines (keep max 2 for paragraph breaks)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Validate text is TTS-ready
 * 
 * Checks for common issues that would cause TTS problems:
 * - Unreadable symbols
 * - Broken words
 * - Missing spaces after headlines
 */
export function validateTextForTTS(text: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for problematic characters
  if (/[♈♉♊♋♌♍♎♏♐♑♒♓°—–]/.test(text)) {
    issues.push('Contains zodiac symbols, degree symbols, or em-dashes');
  }

  // Check for markdown
  if (/^#{1,6}\s+/m.test(text) || /\*\*.*\*\*/.test(text) || /__.*__/.test(text)) {
    issues.push('Contains markdown syntax');
  }

  // Check for HTML
  if (/<[^>]+>/.test(text)) {
    issues.push('Contains HTML tags');
  }

  // Check for broken words (consecutive consonants > 5 chars without vowels)
  const brokenWordPattern = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{6,}/;
  if (brokenWordPattern.test(text)) {
    issues.push('May contain broken/unreadable words');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
