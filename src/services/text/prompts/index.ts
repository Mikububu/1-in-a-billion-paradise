/**
 * PROMPT SYSTEM - MAIN EXPORTS
 * 
 * The complete prompt generation system for 1 in a Billion readings.
 */

// Types
export * from './types';

// Styles
export { 
  FORBIDDEN_PHRASES, 
  PRODUCTION_STYLE, 
  SPICY_SURREAL_STYLE,
  getSpiceInstructions,
  getStyleConfig,
  getStyleInstructions,
} from './styles';

// Systems
export {
  WESTERN_GUIDANCE,
  VEDIC_GUIDANCE,
  GENE_KEYS_GUIDANCE,
  HUMAN_DESIGN_GUIDANCE,
  KABBALAH_GUIDANCE,
  getSystemGuidance,
  getSystemPromptSection,
} from './systems';

// Prompt Builder
export {
  buildIndividualPrompt,
  buildSingleOverlayPrompt,
  buildNuclearPrompt,
} from './builder';

