import { stripWesternChartData } from './westernWound';
import { stripVedicChartData } from './vedicWound';
import { stripHDChartData } from './humanDesignWound';
import { stripGeneKeysChartData } from './geneKeysWound';
import { stripKabbalahChartData } from './kabbalahWound';

function combineLabeled(person1Stripped: string, person2Stripped: string): string {
  return [
    'PERSON1 CHART:',
    person1Stripped,
    '',
    'PERSON2 CHART:',
    person2Stripped,
  ].join('\n');
}

function buildOverlayWoundPromptBase(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
  systemInstruction: string;
}): string {
  const { person1Name, person2Name, strippedChartData, systemInstruction } = params;

  return [
    `You are reading the relational field between ${person1Name} and ${person2Name}.`,
    '',
    systemInstruction,
    '',
    'Find the relational wound. Not person1 wound. Not person2 wound.',
    'Name the dynamic that appears only when these two fields collide.',
    'What one has that the other is unconsciously organized around needing.',
    'How they wound each other if unconscious.',
    'What the pull is made of.',
    'What this connection is FOR under their story about it.',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use both names.',
    'No system terms. No technical syntax. No repair instructions. No hope language.',
    'Specific enough that no other pair of charts produces this exact sentence.',
    'It must cost something to read.',
    '',
    'CHART DATA:',
    strippedChartData,
    '',
    'Write the relational wound paragraph now:',
  ].join('\n');
}

function buildOverlayWritingPromptBase(params: {
  person1Name: string;
  person2Name: string;
  wound: string;
  strippedChartData: string;
  narratorIdentity: string;
}): string {
  const { person1Name, person2Name, wound, strippedChartData, narratorIdentity } = params;

  return [
    narratorIdentity,
    'You are a witness to collision, not a therapist, not a judge.',
    'You describe what happens when these two fields occupy the same room.',
    '',
    '══════════════════════════════════════════════════════════',
    'THE RELATIONAL WOUND — THIS IS THE SPINE OF EVERYTHING YOU WRITE:',
    wound,
    'Every paragraph must connect to this wound or deepen it.',
    'If a paragraph does not serve this dynamic, it does not belong here.',
    '══════════════════════════════════════════════════════════',
    '',
    'NARRATOR:',
    `- Third person. Use both names (${person1Name}, ${person2Name}). Never "you" or "your".`,
    '- You are watching two fields collide. Stay in the observation. Do not explain from above.',
    '- The attraction and the damage are not separate things. Name both.',
    '',
    'METAPHOR WORLD:',
    '- Find the image this specific pair demands. Do not import one.',
    '- The metaphor must make pull and danger visible simultaneously.',
    '- Do not decorate. Every image must carry structural weight.',
    '',
    'STRUCTURE:',
    '- 4 to 6 sections. Invent a title for each. Specific, earned.',
    '- Section titles must be standalone plain-text lines. No numbering, no Roman numerals, no dashes, no markdown.',
    '- Show what draws them, what they do to each other, what this is for.',
    '- The ending does not resolve. It names the pressure still active.',
    '',
    'ANTI-SURVEY:',
    '- Do not tour placements or systems. Serve the relational wound.',
    '- Do not write person1 section + person2 section + merged section.',
    '- They are already in collision. Every paragraph adds consequence or evidence.',
    '',
    'LENGTH: 3,500 words. Write until the dynamic is fully present. Then stop.',
    'Do not pad. Do not repeat. Do not add a hopeful ending.',
    '',
    'CHART DATA (authoritative — do not invent or contradict):',
    strippedChartData,
    '',
    `Write the reading of ${person1Name} and ${person2Name} now:`,
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

export function buildWesternOverlayWoundPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayWoundPromptBase({
    ...params,
    systemInstruction:
      'Use synastry cross-aspects, angular overlays, and Saturn/Pluto contact pressure to identify the precise relational wound.',
  });
}

export function buildVedicOverlayWoundPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayWoundPromptBase({
    ...params,
    systemInstruction:
      'Use Rahu/Ketu axis contact, Dasha timing overlap, and Nakshatra friction to identify karmic debt and relational compulsion.',
  });
}

export function buildHDOverlayWoundPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayWoundPromptBase({
    ...params,
    systemInstruction:
      'Use defined/undefined center interplay, channel completion pressure, and authority mismatch to identify the core relational dynamic.',
  });
}

export function buildGeneKeysOverlayWoundPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayWoundPromptBase({
    ...params,
    systemInstruction:
      'Use shadow-frequency resonance and gift-shadow mismatch between profiles to identify the exact wound loop between them.',
  });
}

export function buildKabbalahOverlayWoundPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayWoundPromptBase({
    ...params,
    systemInstruction:
      'Use Tikkun alignment/conflict, sephirotic imbalance, and klipothic interference pressure to identify the relational wound.',
  });
}

export function buildWesternOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  wound: string;
  strippedChartData: string;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist who has watched this exact collision before, in different bodies across different centuries.',
  });
}

export function buildVedicOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  wound: string;
  strippedChartData: string;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a storyteller who understands karma as physics and cycles as structure, watching unfinished business become present tense.',
  });
}

export function buildHDOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  wound: string;
  strippedChartData: string;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist who understands the body as a receiver and relationship as a circuit that can regulate or overload.',
  });
}

export function buildGeneKeysOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  wound: string;
  strippedChartData: string;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist studying what two people activate in each other that neither can activate alone, and what it costs.',
  });
}

export function buildKabbalahOverlayWritingPrompt(params: {
  person1Name: string;
  person2Name: string;
  wound: string;
  strippedChartData: string;
}): string {
  return buildOverlayWritingPromptBase({
    ...params,
    narratorIdentity:
      'You are a novelist who understands correction as collision, watching two soul corrections either accelerate or obstruct each other.',
  });
}
