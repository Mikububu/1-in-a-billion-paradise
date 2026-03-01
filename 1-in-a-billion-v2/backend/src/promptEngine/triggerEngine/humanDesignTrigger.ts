import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
} from './triggerConfig';
import { buildHumanDesignSection } from '../../prompts/systems/human-design';

/**
 * HUMAN DESIGN TRIGGER ENGINE
 *
 * Two-call architecture for individual Human Design readings.
 *
 * 1. stripHDChartData()      — pure code, ~30 highest-signal lines
 * 2. buildHDTriggerPrompt()    — trigger call → 80-120 word paragraph
 * 3. buildHDWritingPrompt()  — writing call → configurable word target
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Reduces HD chart data to highest-signal lines.
 * Keeps: Type, Strategy, Authority, Profile, Definition, Incarnation Cross,
 *        Defined Centers, Open Centers, Active Channels.
 * Drops: All gate activations (personality/design lines), full active gates list.
 */
export function stripHDChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  let inPersonality = false;
  let inDesign = false;
  let inGates = false;

  for (const line of lines) {
    const t = line.trim();

    if (/^ALL ACTIVE GATES:/.test(t)) { inGates = true; continue; }
    if (/^PERSONALITY ACTIVATIONS/.test(t)) { inPersonality = true; inDesign = false; inGates = false; out.push(line); continue; }
    if (/^DESIGN ACTIVATIONS/.test(t)) { inDesign = true; inPersonality = false; inGates = false; out.push(line); continue; }

    if (inGates) { continue; }

    // In personality/design sections: keep only top 3 activations (most important planets)
    const KEEP_PLANETS = new Set(['sun', 'earth', 'moon']);
    if (inPersonality || inDesign) {
      if (/^- /.test(t)) {
        const lc = t.toLowerCase();
        if ([...KEEP_PLANETS].some(p => lc.includes(p))) {
          out.push(line);
        }
      } else if (t === '') {
        out.push(line);
      } else if (/^[A-Z][A-Z0-9\s()\-—]+:$/.test(t)) {
        // Leave activation mode only when the next section actually starts.
        inPersonality = false;
        inDesign = false;
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }

  return out.filter(Boolean).join('\n').trim();
}

// ─── 2. TRIGGER PROMPT ───────────────────────────────────────────────────────

export function buildHDTriggerPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;

  return [
    `You are a Human Design reader analyzing ${personName}'s bodygraph to find the central ${trigger}.`,
    '',
    `In Human Design, the ${trigger} lives in the open (undefined) centers — think of them as receivers, places where this person absorbs and amplifies others' energy.`,
    'They become an expert at what they cannot embody.',
    'They perform the thing they most need to receive.',
    '',
    'NAME the specific Type (Generator, Projector, Manifestor, Reflector, or Manifesting Generator) and what their Not-Self theme reveals.',
    'NAME the Authority (Emotional, Sacral, Splenic, etc.) — how they override their own body\'s knowing.',
    'NAME the open centers and what conditioning they absorb.',
    `The Profile is the costume the ${trigger} wears in public.`,
    `The Incarnation Cross is the pressure the ${trigger} organizes itself around.`,
    '',
    `The ${trigger} is the specific behavior pattern that emerges from the collision of what this person absorbs (open centers) and how they try to be loved (profile).`,
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use Human Design terminology and explain each term naturally on first use — like a patient guide explaining energy mechanics.',
    'No repair instructions. No softening.',
    'Specific enough that no other chart produces this exact sentence.',
    'It must cost something to read.',
    '',
    `Name the ${trigger}. Stop.`,
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    `Write the ${trigger} paragraph now:`,
  ].join('\n');
}

// ─── 3. WRITING PROMPT ───────────────────────────────────────────────────────

export function buildHDWritingPrompt(params: {
  personName: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  const { personName, narrativeTrigger, strippedChartData, targetWords } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;
  const triggerTitle = NARRATIVE_TRIGGER_TITLE;

  // Inject the Human Design system guidance — Types, Strategy, Authority, Centers, Channels
  const hdGuidance = buildHumanDesignSection(false);

  return [
    'You are a Human Design reader and literary novelist.',
    'You think in bodies, in waiting, in the slow damage of performing the wrong role.',
    'You have read Virginia Woolf, Clarice Lispector, and Franz Kafka.',
    CORE_FAIRYTALE_SEED,
    '',
    'You are telling the story of a body learning to trust itself — through the lens of its Human Design.',
    'This is NOT a generic spiritual essay. It is a Human Design reading: grounded in specific Type, Strategy, Authority, Centers, Channels, and the Incarnation Cross.',
    '',
    hdGuidance,
    '',
    '══════════════════════════════════════════════════════════',
    `${triggerTitle} — THIS IS THE SPINE OF EVERYTHING YOU WRITE:`,
    narrativeTrigger,
    `Every paragraph must connect to this ${trigger} or deepen it.`,
    `If a paragraph does not serve the ${trigger}, it does not belong here.`,
    '══════════════════════════════════════════════════════════',
    '',
    'NARRATOR:',
    '- Third person only. Never "you" or "your". Use the name.',
    '- The body is the center of this story. What it feels. What it absorbs. What it performs.',
    `- The undefined centers are not deficits — they are the site of the ${trigger}.`,
    '- Name the Type, Strategy, and Authority explicitly — these define how this body operates.',
    '- Name open/defined centers and what conditioning they create.',
    '- Explain Human Design terms naturally on first use — like a patient guide explaining energy mechanics.',
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- The Type and its Not-Self theme reveal the operating pattern — frustration, bitterness, anger, or disappointment.',
    '- The Incarnation Cross is the life theme — enter it at least once, indirectly.',
    '- The ending does not resolve. It names where the conditioning is still running.',
    '',
    'HUMAN DESIGN VOICE:',
    '- USE Human Design terminology throughout: Type, Strategy, Authority, Centers (defined/undefined), Channels, Gates, Profile, Incarnation Cross, Not-Self, Signature.',
    '- Reference specific Centers, Channels, and Gate activations from the chart data — these are the evidence.',
    '- Every paragraph must add new consequence or evidence rooted in their specific bodygraph.',
    '- Do not be generic. Ground every insight in a specific Center, Channel, or Gate.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the ${trigger} is fully present. Then stop.`,
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s Human Design reading now:`,
  ].join('\n');
}
