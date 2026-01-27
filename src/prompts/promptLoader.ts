/**
 * PROMPT LOADER
 * 
 * Loads the master prompt MD file as the SINGLE SOURCE OF TRUTH
 * for all reading voice, style, and instructions.
 * 
 * ARCHITECTURE:
 * - One English "perfume" file defines all voice/style/approach
 * - Language parameter adds instruction for non-English output
 * - LLM internalizes English examples, generates natively in target language
 * 
 * TypeScript handles ONLY:
 * - Loading the MD file
 * - Data interpolation (names, birth data, chart data)
 * - Language instruction injection
 * - Reading type routing (hook vs deep, which LLM)
 * 
 * The MD file handles:
 * - Voice/tone ("the perfume")
 * - Forbidden phrases
 * - Quality examples
 * - Structure guidelines
 * - All creative direction
 */

import * as fs from 'fs';
import * as path from 'path';
import { OutputLanguage, DEFAULT_OUTPUT_LANGUAGE, getLanguageInstruction } from '../config/languages';

// Cache the loaded prompt to avoid re-reading
let cachedPrompt: string | null = null;
let cachedTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // Re-read every 60 seconds in case file changes

/**
 * Load the master prompt MD file.
 * Returns the full content as a string.
 * 
 * NOTE: This is always the English "perfume" file.
 * Language-specific output is achieved via instruction injection, not separate files.
 */
export function loadMasterPrompt(): string {
  const now = Date.now();
  
  // Return cached version if fresh
  if (cachedPrompt && (now - cachedTimestamp) < CACHE_TTL_MS) {
    return cachedPrompt;
  }
  
  // Path to the MD file (relative to backend root)
  const mdPath = path.resolve(__dirname, '../../prompts/deep-reading-prompt.md');
  
  try {
    cachedPrompt = fs.readFileSync(mdPath, 'utf-8');
    cachedTimestamp = now;
    return cachedPrompt;
  } catch (error) {
    console.error('Failed to load master prompt:', error);
    throw new Error(`Could not load master prompt from ${mdPath}`);
  }
}

/**
 * Extract a specific section from the MD file by part number.
 * Parts are delimited by "## PART X:" headers.
 */
export function extractSection(partNumber: number): string {
  const content = loadMasterPrompt();
  
  // Match the section start
  const startPattern = new RegExp(`## PART ${partNumber}[:\\s]`, 'i');
  const startMatch = content.match(startPattern);
  
  if (!startMatch || startMatch.index === undefined) {
    return '';
  }
  
  const startIndex = startMatch.index;
  
  // Find the next section or end of file
  const nextPartPattern = new RegExp(`## PART ${partNumber + 1}[:\\s]`, 'i');
  const nextMatch = content.slice(startIndex + 10).match(nextPartPattern);
  
  const endIndex = nextMatch && nextMatch.index !== undefined
    ? startIndex + 10 + nextMatch.index
    : content.length;
  
  return content.slice(startIndex, endIndex).trim();
}

/**
 * Extract the forbidden phrases section for quick reference.
 */
export function getForbiddenPhrases(): string {
  return extractSection(13); // Part 13 is Forbidden Phrases
}

/**
 * Extract the voice lock section (quality calibration).
 */
export function getVoiceLock(): string {
  return extractSection(18); // Part 18 is Voice Lock
}

/**
 * Extract the output format rules.
 */
export function getOutputFormat(): string {
  return extractSection(14); // Part 14 is Output Format
}

/**
 * Get condensed voice guidance for hook readings.
 * Extracts the essential "perfume" without the full length.
 */
export function getCondensedVoice(): string {
  // Extract key sections for hook readings
  const style = extractSection(3);  // Writing Style
  const forbidden = extractSection(13); // Forbidden Phrases
  
  // Create a condensed version
  return `
VOICE & STYLE (from master prompt):

${style.slice(0, 1500)}

FORBIDDEN (always applies):

${forbidden.slice(0, 800)}
`.trim();
}

/**
 * Build the full prompt for deep readings.
 * Combines MD file content with interpolated data and language instruction.
 */
export function buildDeepReadingPrompt(params: {
  person1Name: string;
  person2Name?: string;
  person1Data?: { birthDate: string; birthTime: string; birthPlace: string };
  person2Data?: { birthDate: string; birthTime: string; birthPlace: string };
  chartData: string;
  spiceLevel: number;
  readingType: 'individual' | 'overlay' | 'verdict';
  systemName?: string;
  wordTarget?: number;
  outputLanguage?: OutputLanguage;
}): string {
  const {
    person1Name,
    person2Name,
    person1Data,
    person2Data,
    chartData,
    spiceLevel,
    readingType,
    systemName,
    wordTarget = 3000,
    outputLanguage = DEFAULT_OUTPUT_LANGUAGE
  } = params;
  
  // Load the full master prompt (English "perfume")
  const masterPrompt = loadMasterPrompt();
  
  // Build the data section
  const dataSection = readingType === 'individual'
    ? `
PERSON DATA:
- Name: ${person1Name}
${person1Data ? `- Born: ${person1Data.birthDate} at ${person1Data.birthTime}
- Location: ${person1Data.birthPlace}` : ''}

CHART DATA${systemName ? ` (${systemName})` : ''}:
${chartData}
`
    : `
RELATIONSHIP DATA:
Person 1: ${person1Name}
${person1Data ? `- Born: ${person1Data.birthDate} at ${person1Data.birthTime}
- Location: ${person1Data.birthPlace}` : ''}

Person 2: ${person2Name || 'Unknown'}
${person2Data ? `- Born: ${person2Data.birthDate} at ${person2Data.birthTime}
- Location: ${person2Data.birthPlace}` : ''}

COMBINED CHART DATA${systemName ? ` (${systemName})` : ''}:
${chartData}
`;

  // Build spice calibration
  const spiceCalibration = `
SPICE LEVEL: ${spiceLevel}/10
${spiceLevel >= 7 ? 'SHADOW EMPHASIS: 40-50%. Sex content: direct, specific, unflinching.' : 
  spiceLevel >= 5 ? 'SHADOW EMPHASIS: 35%. Sex content: direct but not graphic.' :
  'SHADOW EMPHASIS: 25%. Sex content: implied, psychological.'}
`;

  // Build word target
  const wordSection = `
WORD TARGET: ${wordTarget} words minimum.
This becomes ${Math.round(wordTarget / 150)} minutes of audio.
`;

  // Get language instruction (empty for English)
  const languageInstruction = getLanguageInstruction(outputLanguage);

  // Combine everything
  return `
${masterPrompt}

═══════════════════════════════════════════════════════════════════════════════
READING PARAMETERS
═══════════════════════════════════════════════════════════════════════════════

READING TYPE: ${readingType.toUpperCase()}
${dataSection}
${spiceCalibration}
${wordSection}
${languageInstruction}
═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE THE READING
Begin directly. No preamble.
═══════════════════════════════════════════════════════════════════════════════
`.trim();
}
