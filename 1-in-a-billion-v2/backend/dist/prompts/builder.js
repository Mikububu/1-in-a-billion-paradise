"use strict";
/**
 * PROMPT BUILDER
 *
 * The orchestrator that assembles modular prompt components
 * into complete prompts for different reading types.
 *
 * This is the main entry point for prompt generation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIndividualPrompt = buildIndividualPrompt;
exports.buildSimpleIndividualPrompt = buildSimpleIndividualPrompt;
exports.buildOverlayPrompt = buildOverlayPrompt;
exports.buildPrompt = buildPrompt;
const forbidden_1 = require("./core/forbidden");
const output_rules_1 = require("./core/output-rules");
const quality_checks_1 = require("./core/quality-checks");
const styles_1 = require("./styles");
const transformations_1 = require("./examples/transformations");
const levels_1 = require("./spice/levels");
const systems_1 = require("./systems");
const individual_1 = require("./structures/individual");
const overlay_1 = require("./structures/overlay");
const env_1 = require("../config/env");
const wordCounts_1 = require("./config/wordCounts");
// ═══════════════════════════════════════════════════════════════════════════
// PSYCHOLOGICAL PROVOCATIONS
// Questions force deep thinking. Instructions force compliance.
// ═══════════════════════════════════════════════════════════════════════════
function getProvocationIntensity(spiceLevel) {
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
function buildPersonProvocations(personName, spiceLevel) {
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
// INDIVIDUAL PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════
function buildIndividualPrompt(config) {
    const { style, spiceLevel, system, voiceMode, person, chartData, personalContext } = config;
    const systemName = systems_1.SYSTEM_DISPLAY_NAMES[system];
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

${(0, styles_1.buildStyleSection)(style)}

${(0, forbidden_1.buildForbiddenSection)(style)}

${(0, levels_1.buildSpiceSection)(spiceLevel, style)}

${(0, output_rules_1.buildOutputRulesSection)('individual', voiceMode, person.name)}
${contextSection}
${(0, systems_1.buildSystemSection)(system, false, spiceLevel)}

${(0, individual_1.buildIndividualStructure)(person.name)}

${style === 'spicy_surreal' ? (0, transformations_1.buildTransformationsSection)(2) : ''}

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

${(0, quality_checks_1.buildQualitySection)(style, 'individual')}

${(0, wordCounts_1.getWordTarget)()}

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE THE INDIVIDUAL ANALYSIS.
Begin directly with the Opening. No preamble.
═══════════════════════════════════════════════════════════════════════════════
`;
}
// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE INDIVIDUAL PROMPT BUILDER (Compact version for API reliability)
// ═══════════════════════════════════════════════════════════════════════════
function buildSimpleIndividualPrompt(config) {
    const { spiceLevel, system, person, chartData } = config;
    const systemName = systems_1.SYSTEM_DISPLAY_NAMES[system];
    const chartSection = chartData[system === 'gene_keys' ? 'geneKeys' : system === 'human_design' ? 'humanDesign' : system] || '';
    const shadowEmphasis = spiceLevel >= 7 ? '35%' : spiceLevel >= 5 ? '25%' : '15%';
    const tragic = (env_1.env.TRAGIC_REALISM_LEVEL ?? 0) > 0
        ? `\n\nTRAGIC REALISM LENS (LEVEL ${env_1.env.TRAGIC_REALISM_LEVEL}): Poetic and brutal honesty. Name the cost of the gift, the repeating loop, and the destiny pressure (conditional inevitability, not prophecy). Allow taboo truth (death, grief, addiction, compulsion, sexual shadow) without moralizing.`
        : '';
    return `${(0, wordCounts_1.getWordTarget)()}

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
function buildOverlayPrompt(config) {
    const { style, spiceLevel, system, person1, person2, chartData, relationshipContext } = config;
    const systemName = systems_1.SYSTEM_DISPLAY_NAMES[system];
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

${(0, styles_1.buildStyleSection)(style)}

${(0, forbidden_1.buildForbiddenSection)(style)}

${(0, levels_1.buildSpiceSection)(spiceLevel, style)}

${(0, output_rules_1.buildOutputRulesSection)('overlay')}

${(0, systems_1.buildSystemSection)(system, true, spiceLevel)}

${(0, overlay_1.buildOverlayStructure)(person1.name, person2.name)}

${style === 'spicy_surreal' ? (0, transformations_1.buildTransformationsSection)(3) : ''}

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

${(0, quality_checks_1.buildQualitySection)(style, 'overlay')}

${(0, wordCounts_1.getWordTarget)()}

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE THE OVERLAY ANALYSIS.
Begin directly with the Opening. No preamble.
═══════════════════════════════════════════════════════════════════════════════
`;
}
// ═══════════════════════════════════════════════════════════════════════════
// MAIN BUILDER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
function buildPrompt(config) {
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
//# sourceMappingURL=builder.js.map