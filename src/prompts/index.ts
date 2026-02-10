/**
 * MODULAR PROMPT SYSTEM
 * 
 * Main entry point for the prompt generation system.
 * 
 * This system is:
 * - LLM-agnostic (works with Claude, GPT, Gemini, etc.)
 * - Modular (change style in one place, affects everything)
 * - Maintainable (each concern in its own file)
 * 
 * Source: Michael's gold prompt documents
 * Architecture: docs/PROMPT_SYSTEM_ARCHITECTURE.md
 */

// Main builder functions
export {
  buildPrompt,
  buildIndividualPrompt,
  buildSimpleIndividualPrompt,
  buildOverlayPrompt,
  type PromptConfig,
  type IndividualPromptConfig,
  type OverlayPromptConfig,
  type NuclearPromptConfig,
  type NuclearPartPromptConfig,
  type PersonData,
  type ChartData,
} from './builder';

// Core modules
export * from './core';

// Styles
export { StyleName, buildStyleSection, getStyleConfig } from './styles';

// Spice levels
export { SpiceLevel, buildSpiceSection, getSpiceConfig, getShadowPercent } from './spice';

// Systems
export { 
  AstroSystem, 
  ALL_SYSTEMS, 
  SYSTEM_DISPLAY_NAMES,
  buildSystemSection,
  buildAllSystemsSection,
} from './systems';

// Structures
export { 
  ReadingType, 
  READING_CONFIGS,
  NUCLEAR_PARTS,
  getNuclearPart,
} from './structures';

// Examples
export { TRANSFORMATIONS, buildTransformationsSection } from './examples';

// Techniques
export { buildSystemWeavingSection } from './techniques';
