/**
 * PROMPT BUILDER
 *
 * The orchestrator that assembles modular prompt components
 * into complete prompts for different reading types.
 *
 * This is the main entry point for prompt generation.
 */
import { StyleName } from './styles';
import { SpiceLevel } from './spice/levels';
import { AstroSystem } from './systems';
export interface PersonData {
    name: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
}
export interface ChartData {
    western?: string;
    vedic?: string;
    geneKeys?: string;
    humanDesign?: string;
    kabbalah?: string;
    synastry?: string;
}
export interface IndividualPromptConfig {
    type: 'individual';
    style: StyleName;
    spiceLevel: SpiceLevel;
    system: AstroSystem;
    voiceMode: 'self' | 'other';
    person: PersonData;
    chartData: ChartData;
    personalContext?: string;
}
export interface OverlayPromptConfig {
    type: 'overlay';
    style: StyleName;
    spiceLevel: SpiceLevel;
    system: AstroSystem;
    person1: PersonData;
    person2: PersonData;
    chartData: ChartData;
    relationshipContext?: string;
}
export interface NuclearPromptConfig {
    type: 'nuclear';
    style: StyleName;
    spiceLevel: SpiceLevel;
    person1: PersonData;
    person2: PersonData;
    chartData: ChartData;
}
export interface NuclearPartPromptConfig extends NuclearPromptConfig {
    partNumber: 1 | 2 | 3 | 4 | 5;
    previousPartSummary?: string;
}
export type PromptConfig = IndividualPromptConfig | OverlayPromptConfig | NuclearPromptConfig;
export declare function buildIndividualPrompt(config: IndividualPromptConfig): string;
export declare function buildSimpleIndividualPrompt(config: IndividualPromptConfig): string;
export declare function buildOverlayPrompt(config: OverlayPromptConfig): string;
export declare function buildPrompt(config: PromptConfig): string;
//# sourceMappingURL=builder.d.ts.map