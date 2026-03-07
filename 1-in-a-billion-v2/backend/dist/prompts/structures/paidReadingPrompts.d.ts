/**
 * PAID READING PROMPTS
 *
 * Builds prompts for all paid/deep readings - individual, overlay, and verdict.
 *
 * ARCHITECTURE:
 * - TypeScript is the SINGLE SOURCE OF TRUTH for voice/style (no MD file)
 * - Language instruction is injected for non-English output
 * - Modular functions build each section
 */
import { OutputLanguage } from '../../config/languages';
export declare const SYSTEMS: readonly ["western", "vedic", "human_design", "gene_keys", "kabbalah"];
export type SystemName = typeof SYSTEMS[number];
export declare const SYSTEM_DISPLAY_NAMES: Record<SystemName, string>;
export type DocType = 'person1' | 'person2' | 'overlay';
export interface NuclearDoc {
    id: string;
    system: SystemName;
    docType: DocType;
    title: string;
    wordTarget: number;
}
export declare const NUCLEAR_DOCS: NuclearDoc[];
export declare const VERDICT_DOC: {
    id: string;
    title: string;
    wordTarget: number;
};
export declare const TOTAL_DOCS: number;
export declare function getDocInfo(docNum: number): {
    title: string;
    wordTarget: number;
    system?: SystemName;
    docType?: DocType;
};
/**
 * Build prompt for individual person reading
 */
export declare function buildPersonPrompt(params: {
    system: SystemName;
    personName: string;
    personData: {
        birthDate: string;
        birthTime: string;
        birthPlace: string;
    };
    chartData: string;
    spiceLevel: number;
    style: 'production' | 'spicy_surreal';
    personalContext?: string;
    outputLanguage?: OutputLanguage;
}): string;
/**
 * Build prompt for overlay/synastry reading
 */
export declare function buildOverlayPrompt(params: {
    system: SystemName;
    person1Name: string;
    person2Name: string;
    chartData: string;
    spiceLevel: number;
    style: 'production' | 'spicy_surreal';
    relationshipContext?: string;
    outputLanguage?: OutputLanguage;
}): string;
/**
 * Build prompt for final verdict
 */
export declare function buildVerdictPrompt(params: {
    person1Name: string;
    person2Name: string;
    allReadingsSummary?: string;
    person1Triggers?: string[];
    person2Triggers?: string[];
    overlayTriggers?: string[];
    spiceLevel: number;
    style: 'production' | 'spicy_surreal';
    outputLanguage?: OutputLanguage;
}): string;
//# sourceMappingURL=paidReadingPrompts.d.ts.map