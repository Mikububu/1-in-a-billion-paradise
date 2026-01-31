/**
 * PAID READING PROMPTS
 * 
 * Builds prompts for all paid/deep readings - individual, overlay, and verdict.
 * 
 * ARCHITECTURE:
 * - The MD file (deep-reading-prompt.md) is the SINGLE SOURCE OF TRUTH for voice/style
 * - Language instruction is injected for non-English output
 * - TypeScript handles ONLY data interpolation, language routing, and provocations
 */

import { env } from '../../config/env';
import { loadMasterPrompt } from '../promptLoader';
import { OutputLanguage, DEFAULT_OUTPUT_LANGUAGE, getLanguageInstruction } from '../../config/languages';

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

// ═══════════════════════════════════════════════════════════════════════════
// NUCLEAR DOCS STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

export interface NuclearDoc {
  id: string;
  system: SystemName;
  docType: DocType;
  title: string;
  wordTarget: number;
}

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

// ═══════════════════════════════════════════════════════════════════════════
// PSYCHOLOGICAL PROVOCATIONS
// Questions force deep thinking. Instructions force compliance.
// ═══════════════════════════════════════════════════════════════════════════

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

function buildOverlayProvocations(person1Name: string, person2Name: string, spiceLevel: number): string {
  const base = `
BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${person1Name.toUpperCase()} AND ${person2Name.toUpperCase()}:

THE MEETING:
1. What does each person see in the other that they can't find in themselves?
2. What wound in one fits perfectly into the wound of the other?
3. What will they use each other for - consciously or not?
`;

  const sex = spiceLevel >= 5 ? `
SEX BETWEEN THEM:
4. Who dominates? Who submits? Who pretends?
5. Is the sex a doorway to transformation or a drug to avoid intimacy?
6. What fetish or hunger does one awaken in the other?
7. How could the sex destroy them? How could it liberate them?
` : `
INTIMACY BETWEEN THEM:
4. How do they affect each other emotionally?
5. What do they unlock in each other that was previously closed?
`;

  const danger = `
THE DANGER:
8. How could this connection destroy them both?
9. When they're unconscious, how do they use each other's wounds as weapons?

THE POSSIBILITY:
10. What could they become together that neither could become alone?
11. Is this a comfort trap or a crucible that transforms?

YOUR TASK: Tell the story of these two souls colliding.
`;

  return `${base}${sex}${danger}`;
}

function buildVerdictProvocations(person1Name: string, person2Name: string, spiceLevel: number): string {
  return `
THE FINAL QUESTIONS:

You have seen ${person1Name} and ${person2Name} through every lens. Now answer honestly:

1. Is this connection a doorway to evolution, or a comfortable trap?
2. If they stay together, what will they become in 10 years?
3. If they walk away, what will each lose - and what will each gain?
4. What is the ONE TRUTH about this relationship that neither wants to hear?

YOUR VERDICT MUST BE HONEST:
- If it's toxic, say so. Don't sugarcoat.
- If it's golden, say so. Don't manufacture problems.
- If it's conditional, name the exact conditions.

The worst thing you can do is be polite. Tell the truth.
`;
}

function getSpiceCalibration(spiceLevel: number): string {
  if (spiceLevel <= 3) {
    return `SPICE: ${spiceLevel}/10 | Shadow: 25% | Sex: implied, psychological`;
  }
  if (spiceLevel <= 6) {
    return `SPICE: ${spiceLevel}/10 | Shadow: 35% | Sex: direct but not graphic`;
  }
  return `SPICE: ${spiceLevel}/10 | Shadow: 40-50% | Sex: direct, specific, unflinching`;
}

function tragicRealismBlock(): string {
  const level = env.TRAGIC_REALISM_LEVEL ?? 0;
  if (level <= 0) return '';
  
  return `
TRAGIC REALISM (LEVEL ${level}):
- Name the COST OF THE GIFT: what must be sacrificed to live it cleanly
- Name the LOOP: the repeating failure pattern
- Speak in destiny language: "If they keep choosing X, fate delivers Y"
- Allow taboo truth: death, grief, addiction, sexual shadow. No euphemism.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS
// Combine: MD file (voice) + Data (interpolation) + Provocations + Language
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build prompt for individual person reading
 */
export function buildPersonPrompt(params: {
  system: SystemName;
  personName: string;
  personData: { birthDate: string; birthTime: string; birthPlace: string };
  chartData: string;
  spiceLevel: number;
  style: 'production' | 'spicy_surreal';
  personalContext?: string;
  outputLanguage?: OutputLanguage;
}): string {
  const { 
    system, 
    personName, 
    personData, 
    chartData, 
    spiceLevel, 
    personalContext,
    outputLanguage = DEFAULT_OUTPUT_LANGUAGE 
  } = params;
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  
  // Load master prompt (the perfume - always English)
  const masterPrompt = loadMasterPrompt();
  
  // Get language instruction (empty for English)
  const languageInstruction = getLanguageInstruction(outputLanguage);

  return `
${masterPrompt}

═══════════════════════════════════════════════════════════════════════════════
READING: ${personName} through ${systemName}
═══════════════════════════════════════════════════════════════════════════════

PERSON DATA:
- Name: ${personName}
- Born: ${personData.birthDate} at ${personData.birthTime}
- Location: ${personData.birthPlace}

CHART DATA:
${chartData}
${personalContext ? `
PERSONAL CONTEXT (7% weight): "${personalContext}"
` : ''}

${buildPersonProvocations(personName, spiceLevel)}

${getSpiceCalibration(spiceLevel)}
${tragicRealismBlock()}

WORD TARGET: 2500-3000 words (15-20 minutes audio)
${languageInstruction}
Begin directly with the reading. No preamble.
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
  outputLanguage?: OutputLanguage;
}): string {
  const { 
    system, 
    person1Name, 
    person2Name, 
    chartData, 
    spiceLevel, 
    relationshipContext,
    outputLanguage = DEFAULT_OUTPUT_LANGUAGE 
  } = params;
  const systemName = SYSTEM_DISPLAY_NAMES[system];
  
  // Load master prompt (the perfume - always English)
  const masterPrompt = loadMasterPrompt();
  
  // Get language instruction (empty for English)
  const languageInstruction = getLanguageInstruction(outputLanguage);

  return `
${masterPrompt}

═══════════════════════════════════════════════════════════════════════════════
SYNASTRY: ${person1Name} & ${person2Name} through ${systemName}
═══════════════════════════════════════════════════════════════════════════════

COMBINED CHART DATA:
${chartData}
${relationshipContext ? `
RELATIONSHIP CONTEXT (7% weight): "${relationshipContext}"
` : ''}

${buildOverlayProvocations(person1Name, person2Name, spiceLevel)}

${getSpiceCalibration(spiceLevel)}
${tragicRealismBlock()}

WORD TARGET: 3000+ words (18-20 minutes audio)
${languageInstruction}
Begin directly with the reading. No preamble.
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
  outputLanguage?: OutputLanguage;
}): string {
  const { 
    person1Name, 
    person2Name, 
    allReadingsSummary, 
    spiceLevel,
    outputLanguage = DEFAULT_OUTPUT_LANGUAGE 
  } = params;
  
  // Load master prompt (the perfume - always English)
  const masterPrompt = loadMasterPrompt();
  
  // Get language instruction (empty for English)
  const languageInstruction = getLanguageInstruction(outputLanguage);

  return `
${masterPrompt}

═══════════════════════════════════════════════════════════════════════════════
FINAL VERDICT: ${person1Name} & ${person2Name}
═══════════════════════════════════════════════════════════════════════════════

You have analyzed this couple through all 5 systems. Now deliver the FINAL VERDICT.

SUMMARY OF ALL READINGS:
${allReadingsSummary}

${buildVerdictProvocations(person1Name, person2Name, spiceLevel)}

${getSpiceCalibration(spiceLevel)}
${tragicRealismBlock()}

WORD TARGET: 2800+ words (18-20 minutes audio)
${languageInstruction}
Deliver the verdict now. No preamble.
`.trim();
}
