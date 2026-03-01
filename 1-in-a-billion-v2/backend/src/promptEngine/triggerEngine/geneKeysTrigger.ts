import {
  CORE_FAIRYTALE_SEED,
  NARRATIVE_TRIGGER_LABEL,
  NARRATIVE_TRIGGER_TITLE,
} from './triggerConfig';
import { buildGeneKeysSection } from '../../prompts/systems/gene-keys';

/**
 * GENE KEYS TRIGGER ENGINE
 *
 * Two-call architecture for individual Gene Keys readings.
 *
 * 1. stripGeneKeysChartData()        — light cleanup, keeps ALL sequences
 * 2. buildGeneKeysTriggerPrompt()    — trigger call → 80-120 word paragraph
 * 3. buildGeneKeysWritingPrompt()    — writing call → configurable word target
 */

// ─── 1. STRIP ────────────────────────────────────────────────────────────────

/**
 * Gene Keys chart data is already concise.
 * Keeps: Activation Sequence, Venus Sequence, AND Pearl Sequence.
 * Only trims blank/duplicate lines — the LLM needs all three sequences
 * to produce a reading that covers the full spectrum of consciousness.
 */
export function stripGeneKeysChartData(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue; // skip blank lines
    out.push(line);
  }

  return out.join('\n').trim();
}

// ─── 2. TRIGGER PROMPT ───────────────────────────────────────────────────────

export function buildGeneKeysTriggerPrompt(params: {
  personName: string;
  strippedChartData: string;
}): string {
  const { personName, strippedChartData } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;

  return [
    `You are a Gene Keys reader analyzing ${personName}'s hologenetic profile to find the central ${trigger}.`,
    '',
    `In Gene Keys, the ${trigger} lives in the Shadow frequency — the fear-based, contracted expression of a Gene Key.`,
    'Look at the Shadow of Life\'s Work (Personality Sun): this is what the person compulsively does instead of their purpose.',
    'Look at the Shadow of Evolution (Personality Earth): this is the developmental trap they keep falling into.',
    'Together they form the specific flavor of unconscious self-sabotage.',
    '',
    'NAME the specific Gene Key numbers involved (e.g., "Gene Key 44 in its Shadow of Interference").',
    'NAME the Shadow frequency names from their chart.',
    `The ${trigger} is the lived behavior pattern that these specific shadow frequencies produce in this person.`,
    'The thing they apologize for, perform around, or cannot see in themselves.',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Reference Gene Key numbers and Shadow names explicitly.',
    'Explain Gene Keys terms naturally on first use (e.g., "the Shadow — the fear-based expression — of Gene Key 44").',
    'No repair instructions. No Gift or Siddhi consolation. No softening.',
    'Specific enough that no other profile produces this exact sentence.',
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

export function buildGeneKeysWritingPrompt(params: {
  personName: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  const { personName, narrativeTrigger, strippedChartData, targetWords } = params;
  const trigger = NARRATIVE_TRIGGER_LABEL;
  const triggerTitle = NARRATIVE_TRIGGER_TITLE;

  // Inject the Gene Keys system guidance so the LLM knows the full framework
  const geneKeysGuidance = buildGeneKeysSection(false);

  return [
    'You are a Gene Keys reader and literary novelist.',
    'You think in codon sequences, frequency shifts, DNA memory, and the Spectrum of Consciousness.',
    'You have read Richard Rudd, Carlos Castaneda, Rainer Maria Rilke, and Ursula Le Guin.',
    CORE_FAIRYTALE_SEED,
    '',
    'You are telling the story of a consciousness learning to inhabit itself — through the lens of their Gene Keys profile.',
    'This is NOT a generic spiritual essay. It is a Gene Keys reading: grounded in specific Key numbers, Shadow names, Gift potentials, and the architecture of their hologenetic profile.',
    '',
    geneKeysGuidance,
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
    `- Shadow frequencies are not villains — they are the form the ${trigger} takes in daily life.`,
    '- The body carries the frequency. The nervous system is the site of the story.',
    '- Name Gene Key numbers explicitly (e.g., "Gene Key 22", "the Shadow of Dishonour in Key 10").',
    '- Walk through the Shadow → Gift → Siddhi journey for each key sphere you cover.',
    '- Explain Gene Keys terms naturally on first use, then use them freely.',
    '',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- Cover the Activation Sequence in depth (Life\'s Work, Evolution, Radiance, Purpose).',
    '- Touch on Venus Sequence (relationship patterns) and Pearl Sequence (prosperity) where relevant.',
    '- Move from shadow (the problem) through the gift (the breakthrough) toward the specific gap (what is not yet available).',
    '- The ending does not resolve. It leaves the frequency question open.',
    '',
    'GENE KEYS VOICE:',
    '- USE Gene Keys terminology throughout: Shadow, Gift, Siddhi, frequency, contemplation, Activation Sequence, Venus Sequence, Pearl Sequence.',
    '- Reference specific Gene Key numbers from the chart data — these are the evidence for everything you write.',
    '- Every paragraph must add new consequence or evidence rooted in their specific keys.',
    '- Do not be generic. Ground every insight in a specific Key number and its Shadow/Gift/Siddhi spectrum.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the ${trigger} is fully present. Then stop.`,
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write ${personName}'s Gene Keys reading now:`,
  ].join('\n');
}
