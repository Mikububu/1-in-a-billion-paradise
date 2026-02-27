import {
  CORE_FAIRYTALE_SEED_OVERLAY,
  RELATIONAL_TRIGGER_LABEL,
  RELATIONAL_TRIGGER_TITLE,
} from './triggerConfig';
import { stripWesternChartData } from './westernTrigger';
import { stripVedicChartData } from './vedicTrigger';
import { stripHDChartData } from './humanDesignTrigger';
import { stripGeneKeysChartData } from './geneKeysTrigger';
import { stripKabbalahChartData } from './kabbalahTrigger';

function combineLabeled(person1Stripped: string, person2Stripped: string): string {
  return [
    'PERSON1 CHART:',
    person1Stripped,
    '',
    'PERSON2 CHART:',
    person2Stripped,
  ].join('\n');
}

function buildOverlayTriggerPromptBase(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
  systemInstruction: string;
}): string {
  const { person1Name, person2Name, strippedChartData, systemInstruction } = params;
  const relationalTrigger = RELATIONAL_TRIGGER_LABEL;

  return [
    `You are reading the relational field between ${person1Name} and ${person2Name}. Describe what the charts reveal about this connection. Write in PRESENT TENSE — what this dynamic IS, not what it "would be."`,
    '',
    systemInstruction,
    '',
    `Find the ${relationalTrigger}. Not person1 trigger. Not person2 trigger.`,
    'Name the dynamic that exists when these two fields collide.',
    'What one has that the other is unconsciously organized around needing.',
    'How they damage each other if unconscious.',
    'What the pull is made of.',
    'What this connection is FOR — its purpose according to the charts.',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use both names — ALTERNATE who you mention first.',
    'Use system terms only when they are chart-grounded, and explain first use in plain language. No technical report syntax. No repair instructions. No hope language.',
    'Specific enough that no other pair of charts produces this exact sentence.',
    'It must cost something to read.',
    'PRESENT TENSE. Not "would", not "could". Describe the dynamic as it IS.',
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    `Write the ${relationalTrigger} paragraph now:`,
  ].join('\n');
}

function buildOverlayWritingPromptBase(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  narratorIdentity: string;
  targetWords: number;
}): string {
  const { person1Name, person2Name, narrativeTrigger, strippedChartData, narratorIdentity, targetWords } = params;
  const relationalTrigger = RELATIONAL_TRIGGER_LABEL;
  const relationalTriggerTitle = RELATIONAL_TRIGGER_TITLE;

  return [
    narratorIdentity,
    CORE_FAIRYTALE_SEED_OVERLAY,
    'You are reading a collision of energies, not a therapist, not a judge.',
    'You describe what the charts reveal about the dynamic between these two people.',
    '',
    'CRITICAL FRAMING:',
    '- Write in PRESENT TENSE. Describe what the connection IS, not what it "would be."',
    '- Do NOT use "would" or "could" repeatedly. Use present tense: "this dynamic creates", "the pull between them is", "this connection demands."',
    '- You are reading CHART ENERGIES, not narrating a relationship story. The charts speak in the present.',
    '- Do NOT structure the reading by seasons (spring, summer, autumn, winter). Structure by DYNAMICS and THEMES.',
    `- ALTERNATE who you mention first. Do not always lead with the same person. This is about the PAIR.`,
    '',
    '══════════════════════════════════════════════════════════',
    `${relationalTriggerTitle} — THIS IS THE SPINE OF EVERYTHING YOU WRITE:`,
    narrativeTrigger,
    `Every paragraph must connect to this ${relationalTrigger} or deepen it.`,
    'If a paragraph does not serve this dynamic, it does not belong here.',
    '══════════════════════════════════════════════════════════',
    '',
    'NARRATOR:',
    `- Third person. Use both names (${person1Name}, ${person2Name}). Never "you" or "your". Alternate who you mention first.`,
    '- You are reading what happens when two fields collide. Stay in the chart analysis.',
    '- The attraction and the damage are not separate things. Name both.',
    'STRUCTURE:',
    '- One continuous essay. NO section titles, NO chapter headings, NO standalone headline lines.',
    '- Show what draws them together, what they do to each other, what the charts say this connection is for.',
    '- NEVER structure by seasons or time periods (spring, summer, autumn, winter). Structure by relational dynamics.',
    '- The ending does not resolve. It names the pressure that remains active.',
    '',
    'ANTI-SURVEY:',
    `- Do not tour placements or systems. Serve the ${relationalTrigger}.`,
    '- Do not write person1 section + person2 section + merged section.',
    '- Explain system terms in plain language the first time they appear.',
    '- Treat the collision as vivid and real. Do not narrate actual events, meetings, or shared history.',
    '',
    `LENGTH: ${targetWords.toLocaleString('en-US')} words. Write until the dynamic is fully present. Then stop.`,
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write the reading of ${person1Name} and ${person2Name} now.`,
  ].join('\n');
}

export function stripWesternOverlayData(person1Raw: string, person2Raw: string): string {
  return combineLabeled(stripWesternChartData(person1Raw), stripWesternChartData(person2Raw));
}

export function stripVedicOverlayData(person1Raw: string, person2Raw: string): string {
  return combineLabeled(stripVedicChartData(person1Raw), stripVedicChartData(person2Raw));
}

export function stripHDOverlayData(person1Raw: string, person2Raw: string): string {
  return combineLabeled(stripHDChartData(person1Raw), stripHDChartData(person2Raw));
}

export function stripGeneKeysOverlayData(person1Raw: string, person2Raw: string): string {
  return combineLabeled(stripGeneKeysChartData(person1Raw), stripGeneKeysChartData(person2Raw));
}

export function stripKabbalahOverlayData(person1Raw: string, person2Raw: string): string {
  return combineLabeled(stripKabbalahChartData(person1Raw), stripKabbalahChartData(person2Raw));
}

export function buildWesternOverlayTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayTriggerPromptBase({
    ...params,
    systemInstruction:
      `Use synastry cross-aspects, angular overlays, and Saturn/Pluto contact pressure to identify the precise ${RELATIONAL_TRIGGER_LABEL}.`,
  });
}

export function buildVedicOverlayTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayTriggerPromptBase({
    ...params,
    systemInstruction:
      'Use Rahu/Ketu axis contact, Dasha timing overlap, and Nakshatra friction to identify karmic debt and relational compulsion.',
  });
}

export function buildHDOverlayTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayTriggerPromptBase({
    ...params,
    systemInstruction:
      'Use defined/undefined center interplay, channel completion pressure, and authority mismatch to identify the core relational dynamic.',
  });
}

export function buildGeneKeysOverlayTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayTriggerPromptBase({
    ...params,
    systemInstruction:
      `Use shadow-frequency resonance and gift-shadow mismatch between profiles to identify the exact ${RELATIONAL_TRIGGER_LABEL} loop between them.`,
  });
}

export function buildKabbalahOverlayTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayTriggerPromptBase({
    ...params,
    systemInstruction:
      `Use Tikkun alignment/conflict, sephirotic imbalance, and klipothic interference pressure to identify the ${RELATIONAL_TRIGGER_LABEL}.`,
  });
}

export function buildWesternOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist who has seen charts like these before, and you know what this collision would look like if it happened — because you have watched similar mathematics play out in different bodies across different centuries.',
  });
}

export function buildVedicOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a storyteller who understands karma as physics and cycles as structure, exploring what unfinished karmic business these charts suggest would surface if these souls met.',
  });
}

export function buildHDOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist who understands the body as a receiver and relationship as a circuit — exploring what would regulate and what would overload if these two designs shared a space.',
  });
}

export function buildGeneKeysOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist studying what two people could activate in each other that neither could activate alone — and what the charts suggest it would cost.',
  });
}

export function buildKabbalahOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  narrativeTrigger: string;
  strippedChartData: string;
  targetWords: number;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist who understands correction as collision, exploring what would happen if two soul corrections either accelerated or obstructed each other.',
  });
}
