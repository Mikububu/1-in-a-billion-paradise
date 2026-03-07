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
export { buildPrompt, buildIndividualPrompt, buildSimpleIndividualPrompt, buildOverlayPrompt, type PromptConfig, type IndividualPromptConfig, type OverlayPromptConfig, type NuclearPromptConfig, type NuclearPartPromptConfig, type PersonData, type ChartData, } from './builder';
export * from './core';
export { StyleName, buildStyleSection, getStyleConfig } from './styles';
export { SpiceLevel, buildSpiceSection, getSpiceConfig, getShadowPercent } from './spice';
export { AstroSystem, ALL_SYSTEMS, SYSTEM_DISPLAY_NAMES, buildSystemSection, buildAllSystemsSection, } from './systems';
export { ReadingType, READING_CONFIGS, NUCLEAR_PARTS, getNuclearPart, } from './structures';
export { TRANSFORMATIONS, buildTransformationsSection } from './examples';
export { buildSystemWeavingSection } from './techniques';
//# sourceMappingURL=index.d.ts.map