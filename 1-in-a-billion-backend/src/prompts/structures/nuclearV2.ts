/**
 * NUCLEAR V2 STRUCTURE - 16 Documents
 * 
 * Instead of 5 massive parts (6000 words each), we generate 16 shorter documents:
 * - 5 systems × 3 docs (Person1, Person2, Overlay) = 15 docs
 * - 1 Final Verdict = 1 doc
 * - Total: 16 documents
 * 
 * Benefits:
 * - No LLM timeouts (each doc ~1500-2000 words)
 * - Progressive PDFs (show as available)
 * - Audio at the end
 * - Same spicy depth, modular structure
 */

import { env } from '../../config/env';

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

export interface NuclearDoc {
  id: string;
  system: SystemName;
  docType: DocType;
  title: string;
  wordTarget: number;
}

// Generate the 15 system documents (OPTION B ORDER)
// 1) All solo docs first (per system): Person 1, then Person 2
// 2) Then all synastry docs (per system)
// 3) Final verdict is doc 16
export const NUCLEAR_DOCS: NuclearDoc[] = (() => {
  const docs: NuclearDoc[] = [];
  let id = 1;

  // Solos first: Western P1, Western P2, Vedic P1, Vedic P2, ...
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

  // Then synastry per system: Western Synastry, Vedic Synastry, ...
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

// The final verdict document
export const VERDICT_DOC = {
  id: '16',
  title: 'Final Verdict',
  wordTarget: 1500,
};

export const TOTAL_DOCS = NUCLEAR_DOCS.length + 1; // 16

/**
 * Get the document info by index (1-16)
 */
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
 * Build prompt for individual person reading (Person1 or Person2)
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
  personalContext?: string; // Optional context for individual reading personalization
}): string {
  const { system, personName, personData, chartData, spiceLevel, style, personalContext } = params;
  const systemName = SYSTEM_DISPLAY_NAMES[system];

  const styleInstructions = style === 'spicy_surreal'
    ? `Dark Soul Storytelling - tell the story of a soul, not analyze a chart.
Use visceral language: devour, consume, shatter, burn, dissolve.
Include body language: blood, bone, flesh, nerve, marrow.
Shadow emphasis: ${spiceLevel >= 7 ? '40%' : spiceLevel >= 5 ? '30%' : '20%'} of content should address shadow patterns.`
    : `Write like David Attenborough narrating human consciousness - literary, sophisticated, psychologically deep.
Shadow emphasis: ${spiceLevel >= 7 ? '35%' : spiceLevel >= 5 ? '25%' : '20%'} of content.`;

  return `
NUCLEAR READING: ${personName} through ${systemName}

PERSON DATA:
- Name: ${personName}
- Born: ${personData.birthDate} at ${personData.birthTime}
- Location: ${personData.birthPlace}

CHART DATA:
${chartData}
${personalContext ? `
PERSONAL CONTEXT (User's Focus):
"${personalContext}"

INSTRUCTION: Give this context approximately 7% consideration in your reading. Use it ONLY for subtle interpretive framing:
- Address themes naturally if they align with astrological findings
- Let the reading illuminate these areas organically
- DO NOT let this context dominate or override astrological calculations
- The reading must remain 93% astrology-first, with context as a subtle 7% enhancement
` : ''}
STYLE: ${style === 'spicy_surreal' ? 'DARK SOUL STORYTELLING' : 'PRODUCTION (Literary Documentary)'}
SPICE LEVEL: ${spiceLevel}/10

${styleInstructions}

${tragicRealismLensBlock('person')}

**CRITICAL: WRITE 1500-1800 WORDS. This is essential.**

STRUCTURE (1500-1800 words total):

1. CORE IDENTITY through ${systemName} (400 words)
   - What makes ${personName} fundamentally WHO THEY ARE
   - Primary patterns and drives
   - Deep psychological foundation
   - How this system uniquely reveals ${personName}

2. EMOTIONAL & RELATIONAL PATTERNS (500 words)
   - How ${personName} feels and processes emotions
   - What ${personName} needs from partners
   - Attachment style indicators
   - Emotional triggers and soothing patterns
   - How ${personName} expresses love

3. SHADOW WORK (600 words)
   - ${personName}'s unconscious patterns
   - Self-sabotage tendencies in love
   - Defense mechanisms and armor
   - Where ${personName} gets stuck
   - The wound that keeps reopening
   - What ${personName} hides even from themselves

4. GIFTS & POTENTIAL (250 words)
   - Natural talents in relationship
   - What ${personName} brings to partnership
   - How ${personName} shines when conscious

5. PRACTICAL INSIGHTS (150 words)
   - How to love ${personName}
   - What triggers ${personName}
   - What ${personName} needs to feel safe

WORD COUNT CHECK: Count your words. If under 2000, ADD MORE DEPTH.

OUTPUT RULES:
- **FIRST LINE MUST BE A HEADLINE** (5-8 words max, capturing the essence of ${personName}'s reading)
- After headline, add a blank line, then begin the reading
- Use 3RD PERSON with ${personName}'s name (never "you/your")
- Pure prose, NO markdown or bullets (except the required headline)
- Audio-ready: spell out numbers ("twenty-three degrees" not "23°")
- NO em-dashes (—), use commas or periods
- NO phrases like "This is not just...", "Here's the thing...", "Let me show you..."

EXAMPLE FORMAT:
The Warrior's Tender Heart

[Reading begins here with opening section...]

Write the reading now:
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
  relationshipContext?: string; // NEW: Optional context for interpretation framing
}): string {
  const { system, person1Name, person2Name, chartData, spiceLevel, style, relationshipContext } = params;
  const systemName = SYSTEM_DISPLAY_NAMES[system];

  const styleInstructions = style === 'spicy_surreal'
    ? `Dark Soul Storytelling - tell the story of two souls colliding, not analyze charts.
Intimacy calibrated to spice ${spiceLevel}: ${spiceLevel >= 7 ? 'raw, unflinching' : spiceLevel >= 5 ? 'suggestive, psychological' : 'implied, tasteful'}.
Shadow emphasis: ${spiceLevel >= 7 ? '40%' : '30%'} - show how they could destroy each other.`
    : `Write like David Attenborough narrating the collision of two souls.
Shadow emphasis: ${spiceLevel >= 7 ? '35%' : '25%'}.`;

  // Build relationship context section if provided (contextual infusion)
  const contextSection = relationshipContext ? `

RELATIONSHIP CONTEXT: ${relationshipContext}

INSTRUCTION: Give this context approximately 7% consideration in your reading. Use it ONLY for subtle interpretive framing:
- Emphasize life areas relevant to this relationship type (if they align with astrological findings)
- Tailor tone and examples appropriately
- Adjust practical guidance to fit their dynamic

DO NOT:
- Change any astrological calculations
- Invent facts about their relationship
- Assume intentions or outcomes
- Override astrological findings
- Let context dominate the reading

The reading must remain 93% astrology-first, with context as a subtle 7% enhancement.
` : '';

  return `
NUCLEAR SYNASTRY: ${person1Name} & ${person2Name} through ${systemName}

COMBINED CHART DATA:
${chartData}
${contextSection}
STYLE: ${style === 'spicy_surreal' ? 'SPICY SURREAL' : 'PRODUCTION'}
SPICE LEVEL: ${spiceLevel}/10

${styleInstructions}

${tragicRealismLensBlock('overlay')}

**CRITICAL: WRITE EXACTLY 2200 WORDS MINIMUM. Do NOT write less than 2200 words.**

STRUCTURE (2200+ words total):

1. THE ATTRACTION (500 words)
   - What draws them together magnetically
   - The initial spark through ${systemName}
   - Why they can't look away from each other
   - The chemistry that defies logic

2. THE FRICTION (500 words)
   - Where they clash and collide
   - Incompatibilities and tension points
   - The arguments they'll have repeatedly
   - What drives each other crazy

3. SEXUAL & POWER DYNAMICS (500 words)
   - How desire manifests between them
   - Who holds power, who surrenders
   - The bedroom as battlefield and sanctuary
   - What they unlock in each other physically

4. THE SHADOW DANCE (500 words)
   - How they trigger each other's deepest wounds
   - Projection patterns and blame games
   - What goes catastrophically wrong when unconscious
   - The destruction they're capable of together

5. THE GIFT (200 words)
   - What they activate in each other
   - Growth potential if they stay conscious
   - What they could create together

WORD COUNT CHECK: Count your words. If under 2200, ADD MORE DEPTH.

OUTPUT RULES:
- **FIRST LINE MUST BE A HEADLINE** (5-8 words max, capturing the essence of their dynamic)
- After headline, add a blank line, then begin the reading
- Use both names, never "you/your"
- Pure prose, NO markdown (except the required headline)
- Audio-ready formatting
- NO em-dashes, NO AI phrases

EXAMPLE FORMAT:
Fire Meets Water, Chaos Meets Peace

[Reading begins here with opening section...]

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

  return `
NUCLEAR VERDICT: ${person1Name} & ${person2Name}

You have analyzed this couple through all 5 systems. Now deliver the FINAL VERDICT.

SUMMARY OF ALL READINGS:
${allReadingsSummary}

STYLE: ${style === 'spicy_surreal' ? 'SPICY SURREAL - unflinching truth' : 'PRODUCTION - sophisticated honesty'}
SPICE LEVEL: ${spiceLevel}/10

${tragicRealismLensBlock('verdict')}

**CRITICAL: WRITE EXACTLY 2000 WORDS MINIMUM. Do NOT write less than 2000 words.**

STRUCTURE (2000+ words total):

1. THE SYNTHESIS (500 words)
   - What all 5 systems unanimously agree on
   - The core truth of this connection that cannot be denied
   - The patterns that emerged across every system
   - What cannot be ignored or explained away

2. THE VERDICT (300 words)
   - Deliver ONE of these verdicts with explanation:
     * GO: "This connection is worth pursuing. Here's why..."
     * CONDITIONAL: "This could work IF [specific conditions]..."
     * NO GO: "Walk away. Here's why..."
   - Be HONEST. If it's toxic, say so. If it's golden, say so.

3. IF THEY CHOOSE TO PROCEED (400 words)
   - What they MUST do to make it work
   - Specific practices for THIS couple
   - Non-negotiables
   - Warning signs to watch for

4. THE CLOSING (400 words)
   - The final truth about ${person1Name} and ${person2Name}
   - What this connection is ultimately FOR (even if it ends)
   - End with a line that lands like a bell in a dark room

OUTPUT RULES:
- Pure prose, NO markdown
- Audio-ready
- Unflinching honesty
- NO AI clichés

Deliver the verdict:
`.trim();
}

