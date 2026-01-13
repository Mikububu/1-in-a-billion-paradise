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
import { buildNuclearStructure, buildNuclearPartInstructions } from './structures/nuclear';
import { ReadingType } from './structures';

import { buildSystemWeavingSection } from './techniques/system-weaving';
import { env } from '../config/env';

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

  return `Write a 2000 word astrological reading for ${person.name} born ${person.birthDate} at ${person.birthTime} in ${person.birthPlace}.${tragic}

CHART (${systemName}):
${chartSection || `Sun, Moon, Rising positions to be analyzed`}

STYLE: Literary, third person narrative using "${person.name}" (never "you"), flowing prose, no markdown, no bullets.

STRUCTURE:
1. Opening (150 words) - Birth context, what this system reveals
2. Core Identity (500 words) - Primary placements, fundamental drives
3. Emotional Patterns (400 words) - How they feel and process
4. Shadow Work (500 words) - Unconscious patterns, self-sabotage (${shadowEmphasis} emphasis)
5. Gifts (300 words) - Natural talents when conscious
6. Guidance (150 words) - How to love them

RULES: Spell out numbers ("twenty-three degrees"). No em-dashes. Psychological depth. Be honest about shadows. Do not whitewash.

Begin directly with the reading.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE NUCLEAR PART PROMPT BUILDER (Shorter, more reliable)
// ═══════════════════════════════════════════════════════════════════════════

const NUCLEAR_PART_TITLES = [
  { num: 1, title: 'PORTRAITS IN SHADOW', words: 5000, desc: 'Complete profiles through all 5 systems, first collision dynamics' },
  { num: 2, title: 'THE HUNGER', words: 4000, desc: 'Sexual and power dynamics, what draws them together' },
  { num: 3, title: 'THE ABYSS', words: 4000, desc: 'Shadow territory - worst case, danger, mutual destruction potential', shadow: true },
  { num: 4, title: 'THE LABYRINTH', words: 4000, desc: 'Soul contract, communication patterns, what this meeting is FOR' },
  { num: 5, title: 'THE MIRROR BREAKS', words: 3000, desc: 'Transformation potential, practical guidance, final synthesis' },
];

export function buildSimpleNuclearPartPrompt(config: NuclearPartPromptConfig): string {
  const { spiceLevel, person1, person2, chartData, partNumber, previousPartSummary } = config;
  
  const part = NUCLEAR_PART_TITLES[partNumber - 1];
  const shadowEmphasis = part.shadow ? '100%' : (spiceLevel >= 7 ? '35%' : '25%');
  
  // Build concise chart summary
  const chartSummary = `
${person1.name}: ${chartData.western?.split('\n').slice(0, 3).join(', ') || 'Chart data'}
${person2.name}: ${chartData.western?.split('\n').slice(0, 3).join(', ') || 'Chart data'}
Synastry: ${chartData.synastry?.split('\n').slice(0, 5).join(', ') || 'Aspect data'}`;

  const continuity = previousPartSummary 
    ? `\nCONTINUITY: Continue from Part ${partNumber - 1}. Previous summary: ${previousPartSummary.slice(0, 200)}...`
    : '';

  const tragic = (env.TRAGIC_REALISM_LEVEL ?? 0) > 0
    ? `\n\nTRAGIC REALISM LENS (LEVEL ${env.TRAGIC_REALISM_LEVEL}): Make destiny pressure explicit. Name comfort-traps, the cost of the gift, the repeating loop, and the conditional inevitability of consequences. No euphemisms for taboo truth (death, grief, addiction, compulsion, sexual shadow).`
    : '';

  return `Write Part ${partNumber} of 5: "${part.title}" (~${part.words} words) for ${person1.name} & ${person2.name}.${tragic}

${part.desc}${part.shadow ? ' - GO DARK. Show real danger. No safety.' : ''}

CHARTS:${chartSummary}
${continuity}

STYLE: Dark soul storytelling. Third person ("${person1.name}" and "${person2.name}", never "you"). Flowing prose, no markdown, no bullets. Weave all 5 systems (Western, Vedic, Gene Keys, Human Design, Kabbalah) together naturally.

Shadow emphasis: ${shadowEmphasis}. Spell out numbers. No em-dashes. Psychological depth.

Begin Part ${partNumber} directly.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERLAY PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export function buildOverlayPrompt(config: OverlayPromptConfig): string {
  const { style, spiceLevel, system, person1, person2, chartData } = config;
  
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  const chartKey = system === 'gene_keys' ? 'geneKeys' : system === 'human_design' ? 'humanDesign' : system;
  const chartSection = chartData[chartKey] || '';
  const synastrySection = chartData.synastry || '';

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
${synastrySection || '[Synastry data to be provided]'}

${buildQualitySection(style, 'overlay')}

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE THE OVERLAY ANALYSIS.
Begin directly with the Opening. No preamble.
═══════════════════════════════════════════════════════════════════════════════
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// NUCLEAR PROMPT BUILDER (Full overview - for reference)
// ═══════════════════════════════════════════════════════════════════════════

export function buildNuclearPromptOverview(config: NuclearPromptConfig): string {
  const { style, spiceLevel, person1, person2 } = config;

  return `
═══════════════════════════════════════════════════════════════════════════════
NUCLEAR PACKAGE: ALL 5 SYSTEMS
${person1.name} & ${person2.name}
30,000 Words | 5 Parts | ~2.5 Hours Audio
═══════════════════════════════════════════════════════════════════════════════

This reading will be generated across 5 API calls:
- Part 1: Portraits in Shadow (7,000 words)
- Part 2: The Hunger (6,000 words)
- Part 3: The Abyss (6,000 words) ← THE RED ROOM
- Part 4: The Labyrinth (6,000 words)
- Part 5: The Mirror Breaks (5,000 words)

Style: ${style === 'spicy_surreal' ? 'Dark Soul Storytelling' : 'Literary Consciousness Documentary'}
Intensity: ${spiceLevel}/10

Each part will receive its own detailed prompt.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// NUCLEAR PART PROMPT BUILDER (For each of the 5 API calls)
// ═══════════════════════════════════════════════════════════════════════════

export function buildNuclearPartPrompt(config: NuclearPartPromptConfig): string {
  const { style, spiceLevel, person1, person2, chartData, partNumber, previousPartSummary } = config;

  // Build all chart data section
  const allCharts = `
WESTERN ASTROLOGY:
${chartData.western || '[Western data]'}

VEDIC ASTROLOGY:
${chartData.vedic || '[Vedic data]'}

GENE KEYS:
${chartData.geneKeys || '[Gene Keys data]'}

HUMAN DESIGN:
${chartData.humanDesign || '[Human Design data]'}

KABBALAH:
${chartData.kabbalah || '[Kabbalah data]'}

SYNASTRY:
${chartData.synastry || '[Synastry data]'}
`;

  return `
═══════════════════════════════════════════════════════════════════════════════
NUCLEAR PACKAGE: PART ${partNumber} OF 5
${person1.name} & ${person2.name}
═══════════════════════════════════════════════════════════════════════════════

${buildStyleSection(style)}

${buildForbiddenSection(style)}

${buildSpiceSection(spiceLevel, style)}

${buildOutputRulesSection('nuclear')}

${buildSystemWeavingSection()}

${style === 'spicy_surreal' ? buildTransformationsSection(3) : ''}
${style === 'spicy_surreal' ? buildSurrealMetaphorsSection() : ''}

${buildNuclearPartInstructions(partNumber, person1.name, person2.name, previousPartSummary)}

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
ALL CHART DATA (5 SYSTEMS):
═══════════════════════════════════════════════════════════════════════════════
${allCharts}

${buildQualitySection(style, 'nuclear', partNumber)}

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE PART ${partNumber}.
Begin directly. No preamble. Maintain continuity with previous parts.
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
      return buildNuclearPromptOverview(config);
  }
}
