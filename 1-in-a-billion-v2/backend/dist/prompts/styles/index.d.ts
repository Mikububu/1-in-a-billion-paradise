/**
 * STYLES INDEX
 *
 * Exports all writing style modules and provides style selection.
 */
export { PRODUCTION_STYLE, buildProductionStyleSection } from './production';
export { SPICY_SURREAL_STYLE, buildSpicySurrealStyleSection } from './spicy-surreal';
export type StyleName = 'production' | 'spicy_surreal';
/**
 * Get style configuration by name
 */
export declare function getStyleConfig(style: StyleName): {
    name: string;
    systemPrompt: string;
    tone: string;
    voiceRules: string;
    shadowEmphasis: number;
    exampleTransformation: {
        bad: string;
        good: string;
    };
} | {
    name: string;
    systemPrompt: string;
    voiceTrinity: string;
    tone: string;
    requiredLanguage: string;
    shadowEmphasis: number;
    shadowInstructions: string;
    sexInstructions: string;
};
/**
 * Build style section for prompt
 */
export declare function buildStyleSection(style: StyleName): string;
/**
 * Get shadow emphasis percentage for style
 */
export declare function getShadowEmphasis(style: StyleName): number;
/**
 * Get the LLM system prompt for a given style, doc type, and optionally system.
 * This is the "system" message sent to the LLM API, not the user prompt.
 *
 * When outputLanguage is provided and is non-English, the language instruction
 * is appended to the system prompt so ALL code paths (including fast-path
 * per-system engines that bypass the v2 prompt engine) generate natively
 * in the target language.
 */
export declare function getSystemPromptForStyle(style: StyleName, docType?: 'individual' | 'overlay' | 'verdict', system?: string, outputLanguage?: string): string;
//# sourceMappingURL=index.d.ts.map