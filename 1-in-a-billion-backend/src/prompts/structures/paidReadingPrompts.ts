/**
 * PAID READING PROMPTS
 * 
 * Prompts for all paid/deep readings - individual, overlay, and verdict.
 * Can be used for single-system purchases or the full "nuclear" package.
 * 
 * KEY PHILOSOPHY: Questions provoke thought. Instructions provoke compliance.
 * These prompts ask the LLM to THINK deeply before writing, not just follow rules.
 */

import { env } from '../../config/env';
import { buildForbiddenSection } from '../core/forbidden';
import { 
  buildPersonProvocations, 
  buildOverlayProvocations, 
  buildVerdictProvocations,
  getProvocationIntensity 
} from '../core/psychological-provocations';

export const SYSTEMS = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'] as const;
export type SystemName = typeof SYSTEMS[number];

export const SYSTEM_DISPLAY_NAMES: Record<SystemName, string> = {
  western: 'Western Astrology',
  vedic: 'Vedic Astrology (Jyotish)',
  human_design: 'Human Design',
  gene_keys: 'Gene Keys',
  kabbalah: 'Kabbalah',
};

export type DocType = 'person1' | 'person2' | 'overlay';

function tragicRealismLensBlock(context: 'person' | 'overlay' | 'verdict'): string {
  const level = env.TRAGIC_REALISM_LEVEL ?? 0;
  if (level <= 0) return '';
  const focus =
    context === 'overlay'
      ? `Overlay focus: Comfort Trap vs Evolution Path. Name the predictable failure mechanism and the sacrifice required to evolve.`
      : context === 'verdict'
        ? `Verdict focus: Do not sell comfort as love. If it's convenient, say what it costs. If it's transformative, name the price and the conditions.`
        : `Person focus: Name the cost of the gift, the repeating loop, and the fate-pressure that tightens when they avoid truth.`;

  return `
TRAGIC REALISM LENS (LEVEL ${level}) - REQUIRED:
- Poetic and brutal honesty. No whitewash. No spiritual comfort language.
- The tragedy must be EARNED by the chart. Every hard statement must be traceable to a system mechanism.
- Name the COST OF THE GIFT: what must be sacrificed to live it cleanly (comfort, status, snobbery, numbness, control, addiction).
- Name the LOOP: the repeating failure pattern and the trigger that starts it.
- Speak in destiny language without fatalism: conditional inevitability, not prophecy.
  "If they keep choosing the comfort of X, the consequence will be Y."
  "If they refuse the sacrifice, the pattern repeats."
- Allow taboo truth (death, grief, addiction, compulsion, sexual shadow). No euphemism. No moral sermon. Clarity.
- ${focus}
`.trim();
}

// For backwards compatibility with nuclear package structure
export interface NuclearDoc {
  id: string;
  system: SystemName;
  docType: DocType;
  title: string;
  wordTarget: number;
}

// Generate the 15 system documents (for full package)
export const NUCLEAR_DOCS: NuclearDoc[] = (() => {
  const docs: NuclearDoc[] = [];
  let id = 1;

  for (const system of SYSTEMS) {
    docs.push({
      id: `${id++}`,
      system,
      docType: 'person1' as DocType,
      title: `${SYSTEM_DISPLAY_NAMES[system]} - Person 1`,
      wordTarget: 2000,
    });
    docs.push({
      id: `${id++}`,
      system,
      docType: 'person2' as DocType,
      title: `${SYSTEM_DISPLAY_NAMES[system]} - Person 2`,
      wordTarget: 2000,
    });
  }

  for (const system of SYSTEMS) {
    docs.push({
      id: `${id++}`,
      system,
      docType: 'overlay' as DocType,
      title: `${SYSTEM_DISPLAY_NAMES[system]} - Synastry`,
      wordTarget: 2000,
    });
  }

  return docs;
})();

export const VERDICT_DOC = {
  id: '16',
  title: 'Final Verdict',
  wordTarget: 1500,
};

export const TOTAL_DOCS = NUCLEAR_DOCS.length + 1;

export function getDocInfo(docNum: number): { title: string; wordTarget: number; system?: SystemName; docType?: DocType } {
  if (docNum === 16) {
    return VERDICT_DOC;
  }
  const doc = NUCLEAR_DOCS[docNum - 1];
  if (!doc) {
    throw new Error(`Invalid doc number: ${docNum}`);
  }
  return doc;
}

/**
 * Build prompt for individual person reading
 * 
 * KEY CHANGE: Uses psychological provocations to force deep thinking
 * instead of just instruction-following.
 */
export function buildPersonPrompt(params: {
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
}): string {
  const { system, personName, personData, chartData, spiceLevel, style, personalContext } = params;
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  const intensity = getProvocationIntensity(spiceLevel);

  return `
DEEP READING: ${personName} through ${systemName}

PERSON DATA:
- Name: ${personName}
- Born: ${personData.birthDate} at ${personData.birthTime}
- Location: ${personData.birthPlace}

CHART DATA:
${chartData}
${personalContext ? `
PERSONAL CONTEXT: "${personalContext}"
(Use this for ~7% subtle framing. The reading remains 93% chart-driven.)
` : ''}

═══════════════════════════════════════════════════════════════════════════════
PSYCHOLOGICAL PROVOCATIONS - THINK BEFORE YOU WRITE
═══════════════════════════════════════════════════════════════════════════════

${buildPersonProvocations(personName, spiceLevel)}

═══════════════════════════════════════════════════════════════════════════════
STYLE & INTENSITY
═══════════════════════════════════════════════════════════════════════════════

STYLE: ${style === 'spicy_surreal' ? 'DARK SOUL STORYTELLING' : 'LITERARY DOCUMENTARY'}
SPICE LEVEL: ${spiceLevel}/10
SHADOW PERCENTAGE: ${intensity.shadowPercentage}%
SEX EXPLICITNESS: ${intensity.sexExplicitness}
HONESTY LEVEL: ${intensity.honestyLevel}

${style === 'spicy_surreal' ? `
Write like you're telling the story of a soul, not analyzing a chart.
Use visceral language: devour, consume, shatter, burn, dissolve, possess.
Include body language: blood, bone, flesh, nerve, marrow, skin.
Sex is a doorway - explore whether it leads to liberation or destruction for this person.
` : `
Write like a literary documentary - sophisticated, psychologically deep, unflinching but elegant.
`}

${tragicRealismLensBlock('person')}

${buildForbiddenSection(style)}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**WORD COUNT: 2500-3000 WORDS MINIMUM. This becomes 15-20 minutes of audio.**

STRUCTURE (for your guidance only - do NOT include headers in output):
1. Who ${personName} fundamentally IS (600 words)
2. How ${personName} loves, attaches, and relates (700 words)
3. ${personName}'s shadow - wounds, patterns, self-sabotage, sexual shadow (800 words)
4. ${personName}'s gifts when conscious (400 words)
5. How to love ${personName} - and what destroys them (300 words)

FORMAT RULES (THIS IS SPOKEN AUDIO):
- FIRST LINE: A single poetic headline (5-8 words max)
- Then ONE CONTINUOUS ESSAY - no section headers
- 3rd person with ${personName}'s name (never "you/your")
- Pure prose - NO asterisks, NO markdown, NO bullets
- Spell out numbers ("twenty-three degrees")
- NO em-dashes (—), use commas or periods
- NO AI phrases ("This is not just...", "Here's the thing...")

Write ${personName}'s reading now:
`.trim();
}

/**
 * Build prompt for overlay/synastry reading
 */
export function buildOverlayPrompt(params: {
  system: SystemName;
  person1Name: string;
  person2Name: string;
  chartData: string;
  spiceLevel: number;
  style: 'production' | 'spicy_surreal';
  relationshipContext?: string;
}): string {
  const { system, person1Name, person2Name, chartData, spiceLevel, style, relationshipContext } = params;
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  const intensity = getProvocationIntensity(spiceLevel);

  return `
SYNASTRY READING: ${person1Name} & ${person2Name} through ${systemName}

COMBINED CHART DATA:
${chartData}
${relationshipContext ? `
RELATIONSHIP CONTEXT: "${relationshipContext}"
(Use this for ~7% subtle framing. The reading remains 93% chart-driven.)
` : ''}

═══════════════════════════════════════════════════════════════════════════════
PSYCHOLOGICAL PROVOCATIONS - THINK BEFORE YOU WRITE
═══════════════════════════════════════════════════════════════════════════════

${buildOverlayProvocations(person1Name, person2Name, spiceLevel)}

═══════════════════════════════════════════════════════════════════════════════
STYLE & INTENSITY
═══════════════════════════════════════════════════════════════════════════════

STYLE: ${style === 'spicy_surreal' ? 'DARK SOUL STORYTELLING' : 'LITERARY DOCUMENTARY'}
SPICE LEVEL: ${spiceLevel}/10
SHADOW PERCENTAGE: ${intensity.shadowPercentage}%
SEX EXPLICITNESS: ${intensity.sexExplicitness}
HONESTY LEVEL: ${intensity.honestyLevel}

${style === 'spicy_surreal' ? `
Write like you're telling the story of two souls colliding, not analyzing charts.
Sex is central - who dominates, who surrenders, what they unlock, what they destroy.
Show how they could transform each other AND how they could annihilate each other.
` : `
Write like a literary documentary about two souls meeting.
`}

${tragicRealismLensBlock('overlay')}

${buildForbiddenSection(style)}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**WORD COUNT: 3000+ WORDS MINIMUM. This becomes 18-20 minutes of audio.**

STRUCTURE (for your guidance only - do NOT include headers in output):
1. The Attraction - what draws them together magnetically (700 words)
2. The Friction - where they clash and what drives them crazy (600 words)
3. Sex & Power - who dominates, who surrenders, bedroom as battlefield and sanctuary (600 words)
4. The Shadow Dance - how they wound each other, destruction potential (700 words)
5. The Gift - what they could become together if conscious (400 words)

FORMAT RULES (THIS IS SPOKEN AUDIO):
- FIRST LINE: A single poetic headline (5-8 words max)
- Then ONE CONTINUOUS ESSAY - no section headers
- Use both names (never "you/your")
- Pure prose - NO asterisks, NO markdown, NO bullets
- Spell out all numbers
- NO em-dashes, NO AI phrases

Write the synastry reading now:
`.trim();
}

/**
 * Build prompt for final verdict
 */
export function buildVerdictPrompt(params: {
  person1Name: string;
  person2Name: string;
  allReadingsSummary: string;
  spiceLevel: number;
  style: 'production' | 'spicy_surreal';
}): string {
  const { person1Name, person2Name, allReadingsSummary, spiceLevel, style } = params;
  const intensity = getProvocationIntensity(spiceLevel);

  return `
FINAL VERDICT: ${person1Name} & ${person2Name}

You have analyzed this couple through all 5 systems. Now deliver the FINAL VERDICT.

SUMMARY OF ALL READINGS:
${allReadingsSummary}

═══════════════════════════════════════════════════════════════════════════════
PSYCHOLOGICAL PROVOCATIONS - THINK BEFORE YOU WRITE
═══════════════════════════════════════════════════════════════════════════════

${buildVerdictProvocations(person1Name, person2Name, spiceLevel)}

═══════════════════════════════════════════════════════════════════════════════
STYLE & INTENSITY
═══════════════════════════════════════════════════════════════════════════════

STYLE: ${style === 'spicy_surreal' ? 'UNFLINCHING TRUTH' : 'SOPHISTICATED HONESTY'}
SPICE LEVEL: ${spiceLevel}/10
HONESTY LEVEL: ${intensity.honestyLevel}

${tragicRealismLensBlock('verdict')}

${buildForbiddenSection(style)}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**WORD COUNT: 2800+ WORDS MINIMUM. This becomes 18-20 minutes of audio.**

STRUCTURE (for your guidance only - do NOT include headers in output):
1. The Synthesis - what all 5 systems agree on, the undeniable truth (700 words)
2. The Verdict - GO / CONDITIONAL / NO GO with honest explanation (300 words)
3. If They Proceed - what they MUST do, non-negotiables, warning signs (400 words)
4. The Closing - final truth, what this is FOR, end with a line that lands (400 words)

FORMAT RULES (THIS IS SPOKEN AUDIO):
- Start directly with the synthesis, NO headline for verdict
- ONE CONTINUOUS ESSAY - no section headers
- Pure prose, NO markdown, NO asterisks
- Spell out all numbers
- UNFLINCHING HONESTY - if it's toxic, say so. If it's golden, say so.

Deliver the verdict:
`.trim();
}
