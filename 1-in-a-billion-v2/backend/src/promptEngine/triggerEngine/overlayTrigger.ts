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
    `You are reading the relational field between ${person1Name} and ${person2Name}. Describe what the charts reveal about this connection. Write in PRESENT TENSE - what this dynamic IS, not what it "would be."`,
    '',
    systemInstruction,
    '',
    `Find the ${relationalTrigger}. Not person1 trigger. Not person2 trigger.`,
    'Name the dynamic that exists when these two fields collide.',
    'What one has that the other is unconsciously organized around needing.',
    'How they damage each other if unconscious.',
    'What the pull is made of.',
    'What this connection is FOR - its purpose according to the charts.',
    '',
    'Write one paragraph. 80-120 words exactly.',
    'Third person. Use both names - ALTERNATE who you mention first.',
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
  overlayGuidance?: string;
}): string {
  const { person1Name, person2Name, narrativeTrigger, strippedChartData, narratorIdentity, targetWords, overlayGuidance } = params;
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
    `${relationalTriggerTitle} - THIS IS THE SPINE OF EVERYTHING YOU WRITE:`,
    narrativeTrigger,
    `Every paragraph must connect to this ${relationalTrigger} or deepen it.`,
    'If a paragraph does not serve this dynamic, it does not belong here.',
    '══════════════════════════════════════════════════════════',
    '',
    // System-specific overlay guidance - tells the LLM HOW to layer relationship data
    ...(overlayGuidance ? [
      'DATA LAYERING - HOW TO USE THE CHART DATA:',
      overlayGuidance,
      '',
    ] : []),
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
    'CHART DATA (authoritative - do not invent or contradict):',
    strippedChartData,
    '',
    `Write the reading of ${person1Name} and ${person2Name} now.`,
    '',
    'THEN, after the prose ends, append a MINI COMPATIBILITY SNAPSHOT for this system only.',
    'Format it EXACTLY like this - no markdown, no asterisks, clean plain text, each score with 2 sentences.',
    'CRITICAL: The all-caps labels (e.g. "SEXUAL CHEMISTRY:") MUST remain in EXACT ENGLISH so our system can parse them. ONLY translate the description text beneath them into the target language.',
    '',
    `COMPATIBILITY SNAPSHOT: ${person1Name} & ${person2Name}`,
    '',
    'SEXUAL CHEMISTRY: [0-100]',
    '[2 sentences: what kind of sexual dynamic these charts suggest. Whether the bedroom would liberate or consume.]',
    '',
    'PAST LIFE CONNECTION: [0-100]',
    '[2 sentences: how strongly this system\'s placements suggest pre - existing soul familiarity.Recognition or repetition.]',
  '',
    'WORLD-CHANGING POTENTIAL: [0-100]',
    '[2 sentences: what these two could build or ignite externally if they combined forces. Private connection or larger purpose.]',
    '',
    'KARMIC VERDICT: [0-100]',
    '[2 sentences: comfort trap or genuine crucible of transformation? Does this collision serve evolution or repetition.]',
    '',
    'MAGNETIC PULL: [0-100]',
    '[2 sentences: the raw gravitational force regardless of wisdom. How hard it would be to walk away.]',
    '',
    'SHADOW RISK: [0-100]',
    '[2 sentences: destruction potential if both remain unconscious. What this looks like at its worst.]',
    '',
    'SCORING RULES (PREVENT AI INFLATION):',
    '- DO NOT default to high scores (70-90) out of generic "AI positivity."',
    '- Anchor scores in strict mathematical friction. If there are squares, oppositions, or a lack of major connective tissue in THIS specific system\'s chart data, the score MUST drop to the 30 - 50 range.',
  '- A score of 90+ requires rare, exceptionally tight alignments (e.g., exact conjunctions, full channel completions).',
    '- Use the full 0-100 spectrum. A 25 is just as likely as a 75 if the charts clash.',
    '- These scores are derived from THIS system\'s chart data only - not a guess across all systems.',
  ].join('\n');
}

// ─── OVERLAY-SPECIFIC EXTRACTION HELPERS ─────────────────────────────────────
// Overlay strip functions keep MORE data than individual strips because
// the LLM needs relationship-critical placements to analyze dynamics between
// two charts. These helpers extract data from raw chart strings that the
// individual strip functions intentionally drop.

/**
 * Western overlay: re-extract JUPITER from raw chart (dropped by individual strip).
 * Jupiter contacts are major in synastry for growth, opportunity, and expansion.
 */
function extractWesternOverlayExtras(raw: string): string {
  const extras: string[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (/^- JUPITER:/i.test(t)) { extras.push(line); break; }
  }
  return extras.length > 0 ? '\nRELATIONSHIP PLANETS (restored for overlay):\n' + extras.join('\n') : '';
}

/**
 * Vedic overlay: re-extract Shukra (Venus), Guru (Jupiter), Budha (Mercury)
 * and the 7th Bhava (partnerships) section from raw chart.
 * These are the core relationship indicators in Jyotish.
 */
function extractVedicOverlayExtras(raw: string): string {
  const extras: string[] = [];
  const lines = raw.split('\n');
  let in7th = false;

  for (const line of lines) {
    const t = line.trim();
    // Re-extract relationship grahas
    const lc = t.toLowerCase();
    if (/^- /.test(t) && (lc.includes('shukra') || lc.includes('guru') || lc.includes('budha'))) {
      extras.push(line);
    }
    // Re-extract 7th Bhava block
    if (/^7TH BHAVA/.test(t)) { in7th = true; extras.push(line); continue; }
    if (in7th) {
      if (/^- /.test(t)) { extras.push(line); }
      else if (t === '' || /^[A-Z]/.test(t)) { in7th = false; }
    }
  }
  return extras.length > 0 ? '\nRELATIONSHIP DATA (restored for overlay):\n' + extras.join('\n') : '';
}

/**
 * HD overlay: re-extract ALL ACTIVE GATES list.
 * Needed so the LLM can spot electromagnetic connections (hanging gates
 * that one person completes for the other).
 */
function extractHDOverlayExtras(raw: string): string {
  for (const line of raw.split('\n')) {
    if (/^ALL ACTIVE GATES:/.test(line.trim())) {
      return '\n' + line.trim();
    }
  }
  return '';
}

/**
 * Kabbalah overlay: re-extract active Klipoth details and hard aspects.
 * The klipothic interference between two people is a core overlay dynamic.
 */
function extractKabbalahOverlayExtras(raw: string): string {
  const extras: string[] = [];
  let inKlipoth = false;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (/^KLIPOTHIC RISK/.test(t)) { inKlipoth = true; continue; }
    if (inKlipoth) {
      if (/^- (Active Klipoth|Hard Aspects):/.test(t)) { extras.push(line); }
      else if (/^[A-Z]/.test(t) && !/^- /.test(t)) { inKlipoth = false; }
    }
  }
  return extras.length > 0 ? '\nKLIPOTHIC DETAILS (restored for overlay):\n' + extras.join('\n') : '';
}

// ─── OVERLAY STRIP FUNCTIONS ─────────────────────────────────────────────────

export function stripWesternOverlayData(person1Raw: string, person2Raw: string): string {
  const p1Extra = extractWesternOverlayExtras(person1Raw);
  const p2Extra = extractWesternOverlayExtras(person2Raw);
  return [
    'PERSON1 CHART:',
    stripWesternChartData(person1Raw) + p1Extra,
    '',
    'PERSON2 CHART:',
    stripWesternChartData(person2Raw) + p2Extra,
  ].join('\n');
}

export function stripVedicOverlayData(person1Raw: string, person2Raw: string): string {
  const p1Extra = extractVedicOverlayExtras(person1Raw);
  const p2Extra = extractVedicOverlayExtras(person2Raw);
  return [
    'PERSON1 CHART:',
    stripVedicChartData(person1Raw) + p1Extra,
    '',
    'PERSON2 CHART:',
    stripVedicChartData(person2Raw) + p2Extra,
  ].join('\n');
}

export function stripHDOverlayData(person1Raw: string, person2Raw: string): string {
  const p1Extra = extractHDOverlayExtras(person1Raw);
  const p2Extra = extractHDOverlayExtras(person2Raw);
  return [
    'PERSON1 CHART:',
    stripHDChartData(person1Raw) + p1Extra,
    '',
    'PERSON2 CHART:',
    stripHDChartData(person2Raw) + p2Extra,
  ].join('\n');
}

export function stripGeneKeysOverlayData(person1Raw: string, person2Raw: string): string {
  // Gene Keys already keeps everything - no extras needed
  return combineLabeled(stripGeneKeysChartData(person1Raw), stripGeneKeysChartData(person2Raw));
}

export function stripKabbalahOverlayData(person1Raw: string, person2Raw: string): string {
  const p1Extra = extractKabbalahOverlayExtras(person1Raw);
  const p2Extra = extractKabbalahOverlayExtras(person2Raw);
  return [
    'PERSON1 CHART:',
    stripKabbalahChartData(person1Raw) + p1Extra,
    '',
    'PERSON2 CHART:',
    stripKabbalahChartData(person2Raw) + p2Extra,
  ].join('\n');
}

export function buildWesternOverlayTriggerPrompt(params: {
  person1Name: string;
  person2Name: string;
  strippedChartData: string;
}): string {
  return buildOverlayTriggerPromptBase({
    ...params,
    systemInstruction:
      `Use synastry cross-aspects (especially Venus, Mars, Jupiter contacts), angular overlays, and Saturn/Pluto contact pressure to identify the precise ${RELATIONAL_TRIGGER_LABEL}.`,
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
      'Use Rahu/Ketu axis contact, Dasha timing overlap, Nakshatra friction, and the Ashtakoot Kundali Milan scores (if provided) to identify karmic debt and relational compulsion. Low Nadi or Bhakoot scores signal specific friction points; high Guna total signals deep compatibility. If Ashtakoot data is not provided, acknowledge that Kundali Milan requires precise Moon placement data and focus on Nakshatra compatibility, Rahu-Ketu axis interplay, and Dasha timing instead.',
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
      'Use defined/undefined center interplay, channel completion pressure (check active gates for electromagnetic connections), and authority mismatch to identify the core relational dynamic.',
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
      `Use specific Gene Key numbers and their Shadow frequency names. Identify shadow-frequency resonance, gift-shadow mismatch, and Programming Partner dynamics between profiles to find the exact ${RELATIONAL_TRIGGER_LABEL} loop. Name the Keys involved (e.g., "Gene Key 44 Shadow of Interference triggering Gene Key 22 Shadow of Dishonour").`,
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
      `Use Tikkun alignment/conflict, sephirotic imbalance, and klipothic interference pressure (check active klipoth shells and hard aspects for specific shadow interactions) to identify the ${RELATIONAL_TRIGGER_LABEL}.`,
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
      'You are a novelist who has seen charts like these before, and you know what this collision would look like if it happened - because you have watched similar mathematics play out in different bodies across different centuries.',
    overlayGuidance: [
      'You have TWO charts and one relational trigger. Layer the data like evidence in a courtroom - each placement deepens the case.',
      'PRIORITY 1 - Cross-aspects: Where person1\'s planets land near person2\'s (same degree range). Venus-Mars contacts = desire. Moon-Moon/Sun = emotional current. Saturn contacts = pressure/commitment. Pluto contacts = transformation/obsession. Jupiter contacts = where they expand each other.',
      'PRIORITY 2 - Angular overlays: What planets land on each other\'s Ascendant, MC, IC, DC? These are visceral.',
      'PRIORITY 3 - Nodal connections: North/South Node contacts between charts reveal karmic pull.',
      'WEAVING RULE: Never list aspects. Each aspect enters the narrative as a scene, a felt experience, a consequence. "Her Venus sits exactly where his Pluto lives" → what does that FEEL like? What does it DO to them?',
      'USE system vocabulary: aspects, houses, signs, degrees. Name them as evidence. Explain naturally on first use.',
    ].join('\n'),
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
      'You are a storyteller who understands karma as physics and cycles as structure, exploring what unfinished karmic business these charts suggest would surface if these souls met. You think in Vedic terms only - Grahas, Bhavas, Nakshatras, Dashas. Explain every Vedic term immediately like a grandfather telling a fairy tale.',
    overlayGuidance: [
      'You have TWO Vedic charts plus Ashtakoot Kundali Milan scores (if present). Layer them like chapters of a karmic story.',
      'PRIORITY 1 - Ashtakoot (if provided): The TOTAL score is the headline. Weave the LOW-scoring kootas into the narrative as specific friction points (e.g., Nadi 0/8 = health/progeny shadow; Bhakoot 0/7 = financial/emotional drag; Yoni mismatch = physical incompatibility). High kootas = where the pull is strongest. Do NOT list all 8 as a scorecard - pick the 3-4 that matter most for this specific trigger and make them visceral. IF ASHTAKOOT DATA IS NOT PROVIDED: Do not invent scores. Instead, acknowledge that Kundali Milan requires precise Moon nakshatra data, and focus analysis on Nakshatra lord compatibility, Rahu-Ketu axis interplay, and Dasha timing overlap.',
      'PRIORITY 2 - Rahu-Ketu axis interaction: Where one person\'s Rahu meets the other\'s planets = obsessive pull. Rahu-Ketu contacts between charts = past life karma surfacing.',
      'PRIORITY 3 - 7th Bhava cross-analysis: Each person\'s partnership house (sign, lord, occupants) - what kind of partner their chart demands vs what the other person IS.',
      'PRIORITY 4 - Dasha overlap: Are their cosmic seasons aligned or conflicting? One in Shani Mahadasha while the other is in Rahu?',
      'PRIORITY 5 - Shukra (Venus) and Guru (Jupiter): Where love and dharma live in each chart. Cross-contacts = where desire meets wisdom.',
      'DOSHA ALERTS (if present): Nadi Dosha, Bhakoot Dosha, Manglik Dosha - weave these as narrative consequences, not bullet points. Deliver with fatalistic irony.',
      'USE Vedic terms only: Grahas (Surya, Chandra, Mangal, Budha, Guru, Shukra, Shani, Rahu, Ketu), Bhavas, Rashis, Nakshatras. NEVER Western names. Explain each term immediately like "Astrology for Dummies" - sweet, fairy-tale explanations.',
    ].join('\n'),
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
      'You are a novelist who understands the body as a receiver and relationship as a circuit - exploring what would regulate and what would overload if these two designs shared a space.',
    overlayGuidance: [
      'You have TWO bodygraphs. This relationship is a CIRCUIT - what happens when these two designs plug into each other?',
      'PRIORITY 1 - Center conditioning: Where person1 has a DEFINED center and person2 has it UNDEFINED (or vice versa). The defined person broadcasts; the undefined person amplifies. This is where one person overwhelms, conditions, or distorts the other. Name the specific centers and what they do.',
      'PRIORITY 2 - Channel completion (electromagnetic attraction): Check the active gates list. If person1 has Gate X and person2 has Gate Y, and X-Y forms a channel, that is electromagnetic attraction - an almost chemical pull. Name these connections.',
      'PRIORITY 3 - Type interaction: Generator + Projector = recognition dynamic. Manifestor + Generator = initiation/response tension. Two Generators = sacral resonance. Name what their Type combination creates.',
      'PRIORITY 4 - Authority clash: If their authorities conflict (e.g., Emotional vs Sacral), decisions become a battlefield. One needs time; the other responds in the moment.',
      'PRIORITY 5 - Profile dynamics: How their conscious/unconscious roles interact. 1/3 meets 5/1 = very different life experiments.',
      'USE HD vocabulary: Type, Strategy, Authority, Centers (defined/undefined), Channels, Gates, Profile, Incarnation Cross, Not-Self theme. Explain each term on first use like a patient guide explaining energy mechanics.',
    ].join('\n'),
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
      'You are a Gene Keys reader and novelist studying what two people could activate in each other that neither could activate alone. Name specific Gene Key numbers, Shadow frequencies, and Gift potentials. Use Gene Keys terminology: Shadow, Gift, Siddhi, frequency, contemplation, Activation Sequence, Venus Sequence. Explain terms naturally on first use. Ground every insight in specific Keys from the chart data.',
    overlayGuidance: [
      'You have TWO hologenetic profiles - every sphere is a frequency conversation between two people.',
      'PRIORITY 1 - Shadow resonance: Where person1\'s Shadow meets person2\'s Shadow. Same Shadow in different spheres = mutual triggering. Complementary Shadows = unconscious contracts. Name the KEY NUMBERS and Shadow names.',
      'PRIORITY 2 - Gift activation: Where person1\'s Gift could unlock person2\'s Shadow (and vice versa). This is the growth potential - but it requires moving through the Shadow first.',
      'PRIORITY 3 - Venus Sequence cross-reading: Their Attraction keys (what draws them in), their EQ keys (emotional patterns), their SQ keys (spiritual lessons). These directly describe relationship dynamics.',
      'PRIORITY 4 - Programming Partners: If any of their Keys are Programming Partners (complementary pairs), that is a deep frequency lock.',
      'WEAVING RULE: Walk the Shadow → Gift → Siddhi spectrum for the KEY relationships. Don\'t just name Keys - show the frequency journey between them.',
    ].join('\n'),
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
    overlayGuidance: [
      'You have TWO Trees of Life. When two souls collide, their Tikkunim (corrections) either accelerate or obstruct each other.',
      'PRIORITY 1 - Tikkun interaction: Are their soul corrections aligned, complementary, or in direct conflict? Same Tikkun = mirror dynamic (they see their own correction in each other). Opposing Tikkunim = friction that forces growth.',
      'PRIORITY 2 - Sefirotic complement: Where person1 is STRONG, is person2 VOID (or vice versa)? The strong one fills the void - but this creates dependency. Where both are void = shared blind spot.',
      'PRIORITY 3 - Klipothic interference: Check the active klipoth shells and hard aspects. When two people\'s klipothic patterns interact, shadow possesses the relationship. Name the specific klipah shells and what they trigger in each other.',
      'PRIORITY 4 - Four Worlds balance: Are they both dominant in the same World (Atziluth, Beriah, Yetzirah, Assiyah), or do they balance each other across the Worlds?',
      'USE Kabbalistic terminology: Sephiroth, Tikkun, Klipoth, the Four Worlds, Pillar of Mercy/Severity/Middle. NEVER Western astrology terms. Explain each term on first use like a patient grandfather explaining something sacred.',
    ].join('\n'),
  });
}
