/**
 * PROMPT SYSTEM
 * 
 * ARCHITECTURE:
 * - The MD file (prompts/deep-reading-prompt.md) is the SINGLE SOURCE OF TRUTH
 *   for all voice, style, and instructions ("the perfume")
 * - TypeScript handles ONLY: data interpolation, type definitions, LLM routing
 * - Both paid deep readings AND free hook readings inherit from the same MD file
 */

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT LOADER - Reads the MD file
// ═══════════════════════════════════════════════════════════════════════════

export {
  loadMasterPrompt,
  getCondensedVoice,
  buildDeepReadingPrompt,
} from './promptLoader';

// ═══════════════════════════════════════════════════════════════════════════
// PAID READING PROMPTS - Builds prompts for Claude (paid readings)
// ═══════════════════════════════════════════════════════════════════════════

export {
  buildPersonPrompt,
  buildOverlayPrompt,
  buildVerdictPrompt,
  SYSTEMS,
  SYSTEM_DISPLAY_NAMES,
  NUCLEAR_DOCS,
  VERDICT_DOC,
  TOTAL_DOCS,
  getDocInfo,
  type SystemName,
  type DocType,
  type NuclearDoc,
} from './structures/paidReadingPrompts';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES AND UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export { SpiceLevel, StyleName, getShadowPercent, getSpiceConfig, buildSpiceSection } from './spice/levels';
export { OUTPUT_FORMAT_RULES } from './core/output-rules';
