/**
 * PROMPT BUILDER
 * 
 * The orchestrator that assembles modular prompt components
 * into complete prompts for different reading types.
 * 
 * This is the main entry point for prompt generation.
 */

import { buildForbiddenSection } from './core/forbidden';
import { buildOutputRulesSection } from './core/output-rules';
import { buildQualitySection } from './core/quality-checks';

import { StyleName, buildStyleSection, getStyleConfig } from './styles';

import { buildTransformationsSection } from './examples/transformations';
import { buildSurrealMetaphorsSection } from './examples/surreal-metaphors';

import { SpiceLevel, buildSpiceSection } from './spice/levels';

import { AstroSystem, buildSystemSection, buildAllSystemsSection, SYSTEM_DISPLAY_NAMES } from './systems';

import { buildIndividualStructure } from './structures/individual';
import { buildOverlayStructure } from './structures/overlay';
import { ReadingType } from './structures';

import { env } from '../config/env';
import { getWordTarget } from './config/wordCounts';

// ═══════════════════════════════════════════════════════════════════════════
// PSYCHOLOGICAL PROVOCATIONS
// Questions force deep thinking. Instructions force compliance.
// ═══════════════════════════════════════════════════════════════════════════

function getProvocationIntensity(spiceLevel: number): {
  shadowPercentage: number;
  sexExplicitness: 'implied' | 'suggestive' | 'direct' | 'unflinching';
  honestyLevel: 'gentle' | 'balanced' | 'honest' | 'raw' | 'nuclear';
} {
  if (spiceLevel <= 2) {
    return { shadowPercentage: 20, sexExplicitness: 'implied', honestyLevel: 'gentle' };
  }
  if (spiceLevel <= 4) {
    return { shadowPercentage: 25, sexExplicitness: 'suggestive', honestyLevel: 'balanced' };
  }
  if (spiceLevel <= 6) {
    return { shadowPercentage: 30, sexExplicitness: 'suggestive', honestyLevel: 'honest' };
  }
  if (spiceLevel <= 8) {
    return { shadowPercentage: 40, sexExplicitness: 'direct', honestyLevel: 'raw' };
  }
  return { shadowPercentage: 50, sexExplicitness: 'unflinching', honestyLevel: 'nuclear' };
}

function buildPersonProvocations(personName: string, spiceLevel: number): string {
  const base = `
BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${personName.toUpperCase()}:

FEAR & SHADOW:
1. What is ${personName} actually terrified of - the fear they've never admitted?
2. What do they do to avoid feeling that terror? What patterns numb it?
3. What loop have they repeated in every relationship, and why can't they stop?
`;

  const sex = spiceLevel >= 4 ? `
SEX & DESIRE:
4. What does ${personName} need sexually that they've never asked for?
5. What hunger lives in them that they hide - maybe even from themselves?
6. Does their sexuality lead toward liberation or destruction?
7. What would their sex life reveal about their psychology?
` : `
LONGING & DESIRE:
4. What does ${personName} secretly long for that they'd never admit?
5. What need have they buried so deep they've forgotten it exists?
`;

  const truth = `
TRUTH & SACRIFICE:
8. What truth about ${personName} would make them weep if spoken aloud?
9. What must they sacrifice to become who they were born to be?

YOUR TASK: Tell ${personName}'s story. Not the chart - the PERSON inside the chart.
`;

  return `${base}${sex}${truth}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

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
  western?: string;   // Formatted Western chart data
  vedic?: string;     // Formatted Vedic chart data
  geneKeys?: string;  // Formatted Gene Keys data
  humanDesign?: string; // Formatted Human Design data
  kabbalah?: string;  // Formatted Kabbalah data
  synastry?: string;  // Formatted synastry data (for overlays/nuclear)
}

export interface IndividualPromptConfig {
  type: 'individual';
  style: StyleName;
  spiceLevel: SpiceLevel;
  system: AstroSystem;
  voiceMode: 'self' | 'other';
  person: PersonData;
  chartData: ChartData;
  personalContext?: string; // Optional context for individual reading personalization
}

export interface OverlayPromptConfig {
  type: 'overlay';
  style: StyleName;
  spiceLevel: SpiceLevel;
  system: AstroSystem;
  person1: PersonData;
  person2: PersonData;
  chartData: ChartData;
  relationshipContext?: string; // Optional context for interpretation framing (synastry purchases)
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

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildIndividualPrompt(config: IndividualPromptConfig): string {
  const { style, spiceLevel, system, voiceMode, person, chartData, personalContext } = config;

  const systemName = SYSTEM_DISPLAY_NAMES[system];
  const chartSection = chartData[system === 'gene_keys' ? 'geneKeys' : system === 'human_design' ? 'humanDesign' : system] || '';
  const intensity = getProvocationIntensity(spiceLevel);

  const contextSection = personalContext ? `
═══════════════════════════════════════════════════════════════════════════════
PERSONAL CONTEXT:
"${personalContext}"

INSTRUCTION: Give this context approximately 7% consideration in your reading. Use it ONLY for subtle interpretive framing:
- Address themes naturally if they align with astrological findings
- Let the reading illuminate these areas organically
- DO NOT let this context dominate or override astrological calculations
- The reading must remain 93% astrology-first, with context as a subtle 7% enhancement
═══════════════════════════════════════════════════════════════════════════════
` : '';

  return `
═══════════════════════════════════════════════════════════════════════════════
INDIVIDUAL DEEP DIVE: ${systemName}
${person.name}
═══════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════
PSYCHOLOGICAL PROVOCATIONS - THINK BEFORE YOU WRITE
═══════════════════════════════════════════════════════════════════════════════

${buildPersonProvocations(person.name, spiceLevel)}

═══════════════════════════════════════════════════════════════════════════════
STYLE & INTENSITY
═══════════════════════════════════════════════════════════════════════════════

SPICE LEVEL: ${spiceLevel}/10
SHADOW PERCENTAGE: ${intensity.shadowPercentage}%
SEX EXPLICITNESS: ${intensity.sexExplicitness}
HONESTY LEVEL: ${intensity.honestyLevel}

${buildStyleSection(style)}

${buildForbiddenSection(style)}

${buildSpiceSection(spiceLevel, style)}

${buildOutputRulesSection('individual', voiceMode, person.name)}
${contextSection}
${buildSystemSection(system, false, spiceLevel)}

${buildIndividualStructure(person.name)}

${style === 'spicy_surreal' ? buildTransformationsSection(2) : ''}

═══════════════════════════════════════════════════════════════════════════════
BIRTH DATA:
═══════════════════════════════════════════════════════════════════════════════
Name: ${person.name}
Birth Date: ${person.birthDate}
Birth Time: ${person.birthTime}
Birth Place: ${person.birthPlace}

═══════════════════════════════════════════════════════════════════════════════
CHART DATA (${systemName}):
═══════════════════════════════════════════════════════════════════════════════
${chartSection || '[Chart data to be provided]'}

${buildQualitySection(style, 'individual')}

${getWordTarget()}

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE THE INDIVIDUAL ANALYSIS.
Begin directly with the Opening. No preamble.
═══════════════════════════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE INDIVIDUAL PROMPT BUILDER (Compact version for API reliability)
// ═══════════════════════════════════════════════════════════════════════════

export function buildSimpleIndividualPrompt(config: IndividualPromptConfig): string {
  const { spiceLevel, system, person, chartData } = config;
  
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  const chartSection = chartData[system === 'gene_keys' ? 'geneKeys' : system === 'human_design' ? 'humanDesign' : system] || '';
  
  const shadowEmphasis = spiceLevel >= 7 ? '35%' : spiceLevel >= 5 ? '25%' : '15%';

  const tragic = (env.TRAGIC_REALISM_LEVEL ?? 0) > 0
    ? `\n\nTRAGIC REALISM LENS (LEVEL ${env.TRAGIC_REALISM_LEVEL}): Poetic and brutal honesty. Name the cost of the gift, the repeating loop, and the destiny pressure (conditional inevitability, not prophecy). Allow taboo truth (death, grief, addiction, compulsion, sexual shadow) without moralizing.`
    : '';

  return `${getWordTarget()}

Write an astrological reading for ${person.name} born ${person.birthDate} at ${person.birthTime} in ${person.birthPlace}.${tragic}

CHART (${systemName}):
${chartSection || `Sun, Moon, Rising positions to be analyzed`}

STYLE: Literary, third person narrative using "${person.name}" (never "you"), flowing prose, no markdown, no bullets.

STRUCTURE:
1. Opening - Birth context, what this system reveals
2. Core Identity - Primary placements, fundamental drives
3. Emotional Patterns - How they feel and process
4. Shadow Work - Unconscious patterns, self-sabotage (${shadowEmphasis} emphasis)
5. Gifts - Natural talents when conscious
6. Guidance - How to love them

RULES: Spell out numbers ("twenty-three degrees"). No em-dashes. Psychological depth. Be honest about shadows. Do not whitewash.

Begin directly with the reading.`;
}


// ═══════════════════════════════════════════════════════════════════════════
// OVERLAY PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildOverlayPrompt(config: OverlayPromptConfig): string {
  const { style, spiceLevel, system, person1, person2, chartData, relationshipContext } = config;
  
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  const chartKey = system === 'gene_keys' ? 'geneKeys' : system === 'human_design' ? 'humanDesign' : system;
  const chartSection = chartData[chartKey] || '';
  const synastrySection = chartData.synastry || '';

  // Optional relationship context (7% interpretive framing, never overrides astrology)
  const contextSection = relationshipContext
    ? `

RELATIONSHIP CONTEXT: ${relationshipContext}

INSTRUCTION: Give this context approximately 7% consideration in your reading. Use it ONLY for subtle interpretive framing:
- Emphasize life areas relevant to this relationship type (if they align with the system findings)
- Tailor tone and examples appropriately
- Adjust practical guidance to fit their dynamic

DO NOT:
- Invent facts about their relationship
- Assume intentions or outcomes
- Override the system's findings
- Let context dominate the reading
`
    : '';

  return `
═══════════════════════════════════════════════════════════════════════════════
SINGLE SYSTEM OVERLAY: ${systemName}
${person1.name} & ${person2.name}
═══════════════════════════════════════════════════════════════════════════════

${buildStyleSection(style)}

${buildForbiddenSection(style)}

${buildSpiceSection(spiceLevel, style)}

${buildOutputRulesSection('overlay')}

${buildSystemSection(system, true, spiceLevel)}

${buildOverlayStructure(person1.name, person2.name)}

${style === 'spicy_surreal' ? buildTransformationsSection(3) : ''}

═══════════════════════════════════════════════════════════════════════════════
BIRTH DATA:
═══════════════════════════════════════════════════════════════════════════════

${person1.name}:
Birth Date: ${person1.birthDate}
Birth Time: ${person1.birthTime}
Birth Place: ${person1.birthPlace}

${person2.name}:
Birth Date: ${person2.birthDate}
Birth Time: ${person2.birthTime}
Birth Place: ${person2.birthPlace}

═══════════════════════════════════════════════════════════════════════════════
CHART DATA (${systemName}):
═══════════════════════════════════════════════════════════════════════════════
${chartSection || '[Chart data to be provided]'}

═══════════════════════════════════════════════════════════════════════════════
SYNASTRY DATA:
═══════════════════════════════════════════════════════════════════════════════
${synastrySection || '[Synastry data to be provided]'}${contextSection}

${buildQualitySection(style, 'overlay')}

${getWordTarget()}

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE THE OVERLAY ANALYSIS.
Begin directly with the Opening. No preamble.
═══════════════════════════════════════════════════════════════════════════════
`;
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN BUILDER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function buildPrompt(config: PromptConfig): string {
  switch (config.type) {
    case 'individual':
      return buildIndividualPrompt(config);
    case 'overlay':
      return buildOverlayPrompt(config);
    case 'nuclear':
      // Nuclear prompts are built via paidReadingPrompts.ts, not here
      throw new Error('Nuclear prompts should use paidReadingPrompts.ts');
  }
}
