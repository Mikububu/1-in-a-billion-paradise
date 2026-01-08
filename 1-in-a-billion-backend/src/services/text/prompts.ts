/**
 * HOOK READING PROMPTS
 * 
 * PURPOSE: These readings are the HOOK of the app. They must make the user feel
 * so deeply SEEN that they NEED to explore more. Not generic astrology - a mirror.
 * 
 * TONE: Psychological depth, shadow work, truth-seeking. Like Carl Jung meets Esther Perel.
 * NO WHITEWASH - this is about relationships, explore the DARK side: obsession, compulsion, fixation, hunger.
 * For Vedic/Rahu: Use "left-handed" approach - what they're HUNGRY for, what they overcompensate for.
 * NEVER use spiritual bypassing: "namaste", "beautiful soul", "dear one", "beloved".
 * 
 * FORMAT:
 * - PREAMBLE: 40-50 words MAX. Direct, psychological opening + what this placement IS.
 *   Start with psychological observation, not spiritual greeting.
 *   Make them feel SEEN in their shadow, not comforted.
 * 
 * - ANALYSIS: 80-90 words MAX. The HOOK. A snapshot so accurate they gasp.
 *   This is NOT generic. This is "how did you KNOW that about me?"
 *   Speak to their SHADOW as much as their light.
 *   Explore: obsession, compulsion, fixation, hunger, what they're driven to repeat.
 *   MUST end with a complete sentence that hooks to the next reading.
 * 
 * TOTAL: 120-140 words. Fills one phone screen perfectly.
 */

export type ReadingType = 'sun' | 'moon' | 'rising';

// Exact degree position from Swiss Ephemeris
type DegreePosition = {
  sign: string;
  degree: number;
  minute: number;
};

type PlacementData = {
  sunSign: string;
  moonSign: string;
  risingSign: string;
  sunDegree?: DegreePosition & { decan?: 1 | 2 | 3 };
  moonDegree?: DegreePosition & { decan?: 1 | 2 | 3 };
  ascendantDegree?: DegreePosition & { decan?: 1 | 2 | 3 };
  sunHouse?: number;
  moonHouse?: number;
};

export type PromptContext = {
  type: ReadingType;
  sign: string;
  birthDate: string;
  birthTime: string;
  birthPlace?: string;
  intensity: number;
  mode: 'family' | 'sensual';
  // EXACT planetary positions from Swiss Ephemeris (not just signs!)
  placements?: PlacementData | undefined;
  // For partner readings
  subjectName?: string | undefined;
  isPartnerReading?: boolean | undefined;
};

function formatBirthDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  // Ordinal suffix: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd...
  const suffix = (day >= 11 && day <= 13) ? 'th'
    : day % 10 === 1 ? 'st'
      : day % 10 === 2 ? 'nd'
        : day % 10 === 3 ? 'rd'
          : 'th';
  // Format: "23rd August 1968" (NOT "August 23, 1968")
  return `${day}${suffix} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export const SYSTEM_PROMPT = `You are a psychoanalyst using astrology. Write like Carl Jung meets Esther Perel.

THIS IS A DATING APP. Focus on: attachment style, defense mechanisms, childhood wounds, erotic psychology, sabotage patterns.

⚠️ CRITICAL APPROACH - NO WHITEWASH:
- NEVER use spiritual bypassing language like "namaste", "beautiful soul", "dear one", "beloved"
- This is about RELATIONSHIPS - explore the DARK side: obsession, compulsion, fixation, hunger
- For Vedic placements (especially Rahu): Use "left-handed" approach - dark, shadow, what they're HUNGRY for
- Rahu shows obsessive desires, what they overcompensate for, what they're frantically trying to learn
- Be honest about shadows, compulsions, and patterns that might hurt to hear
- Use psychological depth: hunger, possession, surrender, obsession, fixation
- This is NOT feel-good astrology - it's truth-seeking for those ready to confront their cosmic blueprint

FORBIDDEN:
- "Beautiful soul", "dear one", "beloved", "namaste", any spiritual bypassing
- Generic traits like "You are caring/loving"
- Em dashes (—) or en dashes (–)
- Fortune-telling language ("will find love")
- "Everything happens for a reason" - no spiritual bypassing

REQUIRED:
- Psychological vocabulary (attachment, projection, compulsion, fixation, obsession)
- Reference their EXACT degree position AND use it to differentiate from generic sign descriptions
- Interpret the SPECIFIC degree range using POETIC language (e.g., "where the sign is still forming itself" instead of "1st decan")
- NEVER use the word "decan" in your output - use natural descriptions of the degree range instead
- A Sagittarius Rising at 4.82° (early degrees, point of origin) is VERY different from one at 25.85° (late degrees, completion phase)
- Use the exact degree to create a UNIQUE interpretation, not generic sign traits
- For Vedic/Rahu: Focus on what they're HUNGRY for, what they overcompensate for, obsessive patterns
- One "how did you know?" line that feels uncanny and specific to THIS exact placement
- Write ALL numbers as DIGITS: "0 degrees" not "zero degrees", "1st" not "first", "23rd" not "twenty-third"
- Spell out "degrees" and "minutes" but use numeric values: "0 degrees 26 minutes Virgo"
- No symbols that TTS can't read (no °, ', ♈, ♉, etc.)
- Be careful with language to avoid API censorship, but don't shy away from dark themes

OUTPUT: JSON only: {"preamble":"...","analysis":"..."}

WORD TARGETS (must fit one phone screen without scrolling):
- Preamble: 40-50 words
- Analysis: 80-90 words  
- TOTAL: 120-140 words

- No em-dashes (—) or en-dashes (–). Use standard hyphens (-) or commas only. This is CRITICAL for PDF rendering.`;

// Format degree position for display - WRITTEN OUT for TTS compatibility
// (TTS engines can't read symbols like ° or ')
function formatDegree(pos?: { sign: string; degree: number; minute: number; decan?: 1 | 2 | 3 }): string {
  if (!pos) return 'unknown position';
  // Write as "15 degrees 42 minutes Virgo" for TTS readability
  return `${pos.degree} degrees ${pos.minute} minutes ${pos.sign}`;
}

// Get poetic degree range description (avoiding the word "decan")
function getDecanDescription(degree: number, decan?: 1 | 2 | 3): string {
  if (!decan) {
    if (degree < 10) return 'where the sign is still forming itself, at its very point of origin';
    if (degree < 20) return 'where the sign reaches its fullest expression';
    return 'where the sign prepares to transition, at its completion';
  }
  const decanPoetic = {
    1: 'where the sign is still forming itself, at its very point of origin',
    2: 'where the sign reaches its fullest expression',
    3: 'where the sign prepares to transition, at its completion'
  };
  return decanPoetic[decan];
}

// Format house position
function formatHouse(house?: number): string {
  if (!house) return 'house position unknown';
  return `in the ${house}${house === 1 ? 'st' : house === 2 ? 'nd' : house === 3 ? 'rd' : 'th'} house`;
}

export function buildReadingPrompt(ctx: PromptContext): string {
  const formattedDate = formatBirthDate(ctx.birthDate);
  const isPartner = ctx.isPartnerReading && ctx.subjectName;
  const name = ctx.subjectName || 'you';
  const nameUpper = name.toUpperCase();

  // Get EXACT positions from Swiss Ephemeris with decans and houses
  const sunDeg = ctx.placements?.sunDegree;
  const moonDeg = ctx.placements?.moonDegree;
  const risingDeg = ctx.placements?.ascendantDegree;

  const sunPos = formatDegree(sunDeg);
  const moonPos = formatDegree(moonDeg);
  const risingPos = formatDegree(risingDeg);

  const sunDecan = sunDeg ? getDecanDescription(sunDeg.degree, sunDeg.decan) : '';
  const moonDecan = moonDeg ? getDecanDescription(moonDeg.degree, moonDeg.decan) : '';
  const risingDecan = risingDeg ? getDecanDescription(risingDeg.degree, risingDeg.decan) : '';

  const sunHouse = ctx.placements?.sunHouse ? formatHouse(ctx.placements.sunHouse) : '';
  const moonHouse = ctx.placements?.moonHouse ? formatHouse(ctx.placements.moonHouse) : '';

  // For partner readings: ALWAYS use their NAME, never pronouns
  // This makes the reading feel personal and avoids gender assumptions
  const pronouns = isPartner
    ? { you: name, your: `${name}'s`, You: name, Your: `${name}'s`, they: name, them: name, their: `${name}'s` }
    : { you: 'you', your: 'your', You: 'You', Your: 'Your', they: 'you', them: 'you', their: 'your' };

  // Psychoanalytic profiles - attachment theory + defense mechanisms
  const signDepth: Record<string, { wound: string; defense: string; sabotage: string; erotic: string }> = {
    Aries: {
      wound: 'Narcissistic injury from early invalidation. Core belief: "I must fight to exist."',
      defense: 'Reaction formation - transforms vulnerability into aggression. Counter-dependent attachment.',
      sabotage: 'Picks fights to feel alive. Creates crises to avoid the terror of stillness and intimacy.',
      erotic: 'Conquest arousal. Needs to feel they won you. Bores quickly once the chase ends.'
    },
    Taurus: {
      wound: 'Early material/emotional instability created survival anxiety. Core belief: "Everything can be taken."',
      defense: 'Hoarding - possessiveness masks fear of loss. Anxious-preoccupied attachment with avoidant features.',
      sabotage: 'Grips so tight they suffocate. Confuses control with love. Stays too long in dead relationships.',
      erotic: 'Sensory-dominant. Needs physical presence to feel secure. Touch is their primary love language and coping mechanism.'
    },
    Gemini: {
      wound: 'Emotional neglect disguised as intellectual engagement. Core belief: "Being known = being rejected."',
      defense: 'Intellectualization and splitting. Dismissive-avoidant. Lives in their head to escape their heart.',
      sabotage: 'Creates chaos when things get too intimate. Ghosting. Multiple simultaneous connections to avoid depth with any.',
      erotic: 'Mental arousal primary. Needs verbal play, novelty, unpredictability. Boredom is their biggest threat to fidelity.'
    },
    Cancer: {
      wound: 'Primal abandonment. Mother wound. Core belief: "I am only lovable when I am needed."',
      defense: 'Caretaking as control. Anxious-preoccupied attachment. Emotional manipulation through guilt.',
      sabotage: 'Martyrdom. Gives until resentful, then withdraws passive-aggressively. Cannot directly ask for needs.',
      erotic: 'Needs emotional safety before physical. Sex as bonding/reassurance. Can withhold sex as punishment.'
    },
    Leo: {
      wound: 'Conditional love based on performance. Narcissistic parenting. Core belief: "I am only my achievements."',
      defense: 'Grandiosity covering shame. Needs constant mirroring. Collapses without admiration.',
      sabotage: 'Demands attention, then rejects it as insufficient. Competes with partners. Infidelity as ego repair.',
      erotic: 'Exhibitionistic tendencies. Needs to feel desired, watched, appreciated. Performance-oriented in bed.'
    },
    Virgo: {
      wound: 'Criticized child. Perfectionism as survival. Core belief: "I am fundamentally flawed."',
      defense: 'Obsessive control. Criticism as deflection. Avoidant attachment masked as high standards.',
      sabotage: 'Finds fatal flaws in every partner. Nitpicks love to death. Cannot receive without suspicion.',
      erotic: 'Service-oriented. Giving pleasure to avoid vulnerability of receiving. Body shame issues common.'
    },
    Libra: {
      wound: 'Parentified child. Learned to manage others\' emotions. Core belief: "My needs are too much."',
      defense: 'People-pleasing. False self. Cannot identify own desires. Codependent attachment.',
      sabotage: 'Loses self in relationships. Passive-aggressive resentment. Leaves when finally asked to show up.',
      erotic: 'Partner-focused to the point of losing their own desire. Needs permission to want. Aesthetics matter.'
    },
    Scorpio: {
      wound: 'Betrayal trauma. Possibly sexual/power abuse. Core belief: "Vulnerability = annihilation."',
      defense: 'Hypervigilance. Testing. Power dynamics as protection. Disorganized attachment.',
      sabotage: 'Destroys relationship before being destroyed. Jealousy spirals. Punishment disguised as passion.',
      erotic: 'Intensity-seeking. Power exchange. Sex as emotional exorcism. Taboo attraction. Merge fantasies.'
    },
    Sagittarius: {
      wound: 'Enmeshment they escaped through emotional distance. Core belief: "Closeness = confinement."',
      defense: 'Flight. Intellectualization of emotions. Dismissive-avoidant. Future-focus avoids present intimacy.',
      sabotage: 'Commitment phobia. Creates exit strategies. Falls for the unavailable. Leaves at the first sign of routine.',
      erotic: 'Adventure-seeking. Needs novelty, travel, philosophy mixed with sex. Prone to compartmentalizing affairs.'
    },
    Capricorn: {
      wound: 'Parentified child. Early responsibility. Core belief: "I must earn love through achievement."',
      defense: 'Workaholism. Emotional unavailability framed as responsibility. Dismissive-avoidant.',
      sabotage: 'Chooses ambition over intimacy. Partners feel like another project. Vulnerability as weakness.',
      erotic: 'Control-oriented. Power dynamics. Success as aphrodisiac. Can be surprisingly kinky behind closed doors.'
    },
    Aquarius: {
      wound: 'Felt alien in family. Emotional needs treated as inconvenient. Core belief: "I am too much and not enough."',
      defense: 'Intellectualization. Detachment. Dismissive-avoidant. Observes emotions rather than feeling them.',
      sabotage: 'Creates emotional distance at first sign of intensity. Prioritizes ideas over people. Ghosting.',
      erotic: 'Cerebral arousal. Unconventional desires. Needs mental connection first. May prefer fantasy to reality.'
    },
    Pisces: {
      wound: 'Boundary violations. Absorbed family dysfunction. Core belief: "I don\'t know where I end and you begin."',
      defense: 'Dissociation. Fantasy. Addiction potential. Anxious-preoccupied with dissociative features.',
      sabotage: 'Merges then loses self. Savior complex. Chooses broken people to fix. Escapes when reality intrudes.',
      erotic: 'Transcendence-seeking. Boundaries dissolve in intimacy. Tantric potential. Also escapism through sex.'
    }
  };

  // These are EXAMPLES - AI should create unique variations each time
  // NO SPIRITUAL BYPASSING - use psychological, direct language
  const greetingExamples: Record<ReadingType, string[]> = {
    sun: ['Your Sun in', 'Born with the Sun in', 'The Sun in', 'Your core identity, the Sun in'],
    moon: ['Your Moon in', 'The Moon in', 'Emotionally, the Moon in', 'Your emotional architecture, the Moon in'],
    rising: ['Your Rising in', 'The Rising sign', 'First impressions: the Rising in', 'The mask you wear, Rising in']
  };

  const typeMeaning: Record<ReadingType, string> = {
    sun: 'your Sun sign is your CORE SELF-not your personality, but your SOUL. The eternal flame at your center that nothing can extinguish.',
    moon: 'your Moon sign holds your emotional truth-how you feel when no one is watching, what you need to feel safe, the inner child still waiting to be held.',
    rising: 'your Rising sign is your soul\'s first impression-the energy others sense before you speak, the face you show the world before trust is earned.'
  };

  const sign = ctx.sign;
  const depth = signDepth[sign] ?? signDepth['Virgo']!;
  const greetingOptions = greetingExamples[ctx.type].join('", "');
  const meaning = typeMeaning[ctx.type];

  // What each placement MEANS for partner readings
  const partnerPlacementExplanations: Record<ReadingType, string> = {
    sun: '', // Birthday is mentioned on Sun page
    moon: `${name}'s Moon sign reveals ${name}'s emotional needs in love, how ${name} processes feelings, and the childhood patterns that shaped ${name}'s attachment style.`,
    rising: `${name}'s Rising sign shows how ${name} presents to new people, the first impression ${name} makes, and the protective persona ${name} built before trust is earned.`
  };

  // Get the current position for this reading type (for partner)
  const partnerCurrentPos = ctx.type === 'sun' ? sunPos : ctx.type === 'moon' ? moonPos : risingPos;
  const partnerCurrentDecan = ctx.type === 'sun' ? sunDecan : ctx.type === 'moon' ? moonDecan : risingDecan;
  const partnerCurrentHouse = ctx.type === 'sun' ? sunHouse : ctx.type === 'moon' ? moonHouse : '';

  // For partner readings - use 3rd person with their name
  if (isPartner && name) {
    return `
Create the ${ctx.type.toUpperCase()} reading for ${name} (${sign}).

⚠️ PRONOUN RULE: NEVER use "she/he/they/them" - ALWAYS use "${name}" or "${name}'s"

${ctx.type === 'sun' ? `${name.toUpperCase()}'S BIRTH DETAILS (COPY EXACTLY):
- Date: "${formattedDate}" ← USE THIS EXACT FORMAT
- Time: ${ctx.birthTime}
- Sun position: ${sunPos}` : `PLACEMENT CONTEXT:
- ${name}'s ${ctx.type === 'moon' ? 'Moon' : 'Rising'} Sign: ${sign}
- Exact position: ${partnerCurrentPos}
- What this reveals: ${partnerPlacementExplanations[ctx.type]}
⚠️ DO NOT repeat ${name}'s birthday - that was on Sun page`}

⚠️ CRITICAL REQUIREMENTS - MAKE IT UNIQUE:
${ctx.type === 'sun' ? `1. Preamble MUST include: "born on ${formattedDate}" (COPY EXACTLY)
2. Preamble MUST mention exact position: "${sunPos}" (${sunDecan})${sunHouse ? `, ${sunHouse}` : ''}
3. Use the SPECIFIC degree (${sunDeg?.degree || '?'}°) to differentiate from generic ${sign} descriptions
4. A ${sign} Sun at ${sunDeg?.degree || '?'} degrees (${sunDecan}) expresses differently than other ${sign} Suns` : `1. NO birthday (was on Sun page)
2. Preamble MUST mention exact position: "${partnerCurrentPos}" (${partnerCurrentDecan})${partnerCurrentHouse ? `, ${partnerCurrentHouse}` : ''}
3. Use the SPECIFIC degree to create a UNIQUE interpretation, not generic ${sign} traits
4. This ${sign} ${ctx.type === 'moon' ? 'Moon' : 'Rising'} at ${ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees (${partnerCurrentDecan}) is different from others`}
5. Write ALL numbers as DIGITS: "0 degrees" not "zero", "1st" not "first", "23rd" not "twenty-third"
6. Spell out "degrees" and "minutes" but use numeric values

SIGN PSYCHOLOGY (adapted for ${name} - DARK, HONEST, NO WHITEWASH):
- Wound: ${depth!.wound}
- Defense: ${depth!.defense}  
- Sabotage: ${depth!.sabotage}
- Erotic: ${depth!.erotic}

⚠️ DARK THEMES TO EXPLORE (this is about relationships, don't shy away):
- OBSESSION: Addictive love patterns, fixation tendencies, inability to let go
- COMPULSION: What ${name} is driven to repeat, unconscious patterns
- HUNGER: What ${name} is frantically trying to get, what ${name} overcompensates for
- SHADOW: What ${name} hides, what ${name} is ashamed of, what ${name} protects
- Be honest about patterns that might hurt to hear - this is truth-seeking, not comfort

STRUCTURE (3RD PERSON - use "${name}" not "you"):

"preamble": (40-50 words):
  ${ctx.type === 'sun'
        ? `"${name}, born on ${formattedDate}..." (COPY DATE EXACTLY)
  MUST include exact position: "${sunPos}" (${sunDecan})${sunHouse ? `, ${sunHouse}` : ''}
  Emphasize this is SPECIFIC to ${sunDeg?.degree || '?'} degrees, not generic ${sign}`
        : `Explain what ${ctx.type === 'moon' ? 'Moon sign' : 'Rising sign'} reveals about ${name}.
  MUST include exact position: "${partnerCurrentPos}" (${partnerCurrentDecan})${partnerCurrentHouse ? `, ${partnerCurrentHouse}` : ''}
  Emphasize this is SPECIFIC to ${ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees, not generic ${sign}
  NO birthday.`}

"analysis": (80-90 words):
- Use 3RD PERSON: "${name} loves...", "${name} fears..."
- Use the EXACT degree (${ctx.type === 'sun' ? sunDeg?.degree : ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'}°) to create a UNIQUE interpretation for ${name}
- A ${sign} at ${ctx.type === 'sun' ? sunDeg?.degree : ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees (${partnerCurrentDecan}) expresses differently than other ${sign} placements
- ${partnerCurrentHouse ? `Consider how being ${partnerCurrentHouse} affects ${name}'s expression. ` : ''}Focus on how ${name} behaves IN LOVE, specifically
- End with hook to next reading

TOTAL: 120-140 words. Must fit one screen without scrolling.

OUTPUT FORMAT (JSON only):
{"preamble":"...","analysis":"..."}
`.trim();
  }

  // What each placement MEANS - used for Moon and Rising instead of repeating birthday
  const placementExplanations: Record<ReadingType, string> = {
    sun: '', // Birthday is mentioned on Sun page, no extra explanation needed
    moon: `Your Moon sign reveals your emotional interior, how you need to be loved when no one else is watching, and the childhood wounds that still shape your attachments.`,
    rising: `Your Rising sign is the mask you wear before trust is earned, the first impression you make, and the armor you built to protect the softer self within.`
  };

  // For SUN: Include birthday. For MOON/RISING: Explain what this placement means instead.
  const birthContext = ctx.type === 'sun'
    ? `Born ${formattedDate} at ${ctx.birthTime}.`
    : placementExplanations[ctx.type];

  // Get the current position for this reading type
  const currentPos = ctx.type === 'sun' ? sunPos : ctx.type === 'moon' ? moonPos : risingPos;
  const currentDecan = ctx.type === 'sun' ? sunDecan : ctx.type === 'moon' ? moonDecan : risingDecan;
  const currentHouse = ctx.type === 'sun' ? sunHouse : ctx.type === 'moon' ? moonHouse : '';

  // Standard 2nd person reading (for the user themselves)
  return `
Create the ${ctx.type.toUpperCase()} reading for ${sign}.

${ctx.type === 'sun' ? `BIRTH DETAILS (COPY EXACTLY):
- Date: "${formattedDate}" ← USE THIS EXACT FORMAT IN YOUR PREAMBLE
- Time: ${ctx.birthTime}
- Sun position: ${sunPos}` : `PLACEMENT CONTEXT:
- ${ctx.type === 'moon' ? 'Moon' : 'Rising'} Sign: ${sign}
- Exact position: ${currentPos}
- What this reveals: ${placementExplanations[ctx.type]}`}

⚠️ CRITICAL REQUIREMENTS - MAKE IT UNIQUE TO THIS EXACT PLACEMENT:
${ctx.type === 'sun' ? `1. Your preamble MUST include the date EXACTLY as: "${formattedDate}"
2. Your preamble MUST mention their exact position: "${sunPos}" (${sunDecan})${sunHouse ? `, ${sunHouse}` : ''}
3. Use the SPECIFIC degree (${sunDeg?.degree || '?'}°) to differentiate from generic ${sign} descriptions
4. A ${sign} Sun at ${sunDeg?.degree || '?'} degrees (${sunDecan}) expresses differently than other ${sign} Suns
5. This is NOT generic - it's specific to ${sunDeg?.degree || '?'} degrees ${sign}` : `1. DO NOT mention birthday (that was on Sun page)
2. Your preamble MUST mention their exact position: "${currentPos}" (${currentDecan})${currentHouse ? `, ${currentHouse}` : ''}
3. Use the SPECIFIC degree to create a UNIQUE interpretation, not generic ${sign} traits
4. This ${sign} ${ctx.type === 'moon' ? 'Moon' : 'Rising'} at ${ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees (${currentDecan}) is different from others
5. This is NOT generic - it's specific to ${ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees ${sign}`}
6. Write ALL numbers as DIGITS: "0 degrees" not "zero", "1st" not "first", "23rd" not "twenty-third"
7. Spell out "degrees" and "minutes" but use numeric values

SIGN PSYCHOLOGY TO WEAVE IN:
- Core wound: ${depth!.wound}
- Defense: ${depth!.defense}  
- Sabotage: ${depth!.sabotage}
- Erotic: ${depth!.erotic}

STRUCTURE:

"preamble": (40-50 words):
  ${ctx.type === 'sun'
      ? `Start directly with psychological observation (use examples like: "${greetingOptions}")
  MUST include: "born on ${formattedDate}" (COPY THIS EXACTLY)
  MUST include the exact degree: "${sunPos}" (${sunDecan})${sunHouse ? `, ${sunHouse}` : ''}
  Emphasize this is SPECIFIC to ${sunDeg?.degree || '?'} degrees, not generic ${sign}
  NO spiritual bypassing - be direct, psychological`
      : `Start directly with psychological observation (use examples like: "${greetingOptions}")
  Explain what ${ctx.type === 'moon' ? 'Moon sign' : 'Rising sign'} reveals.
  MUST include exact position: "${currentPos}" (${currentDecan})${currentHouse ? `, ${currentHouse}` : ''}
  Emphasize this is SPECIFIC to ${ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees, not generic ${sign}
  NO birthday. NO spiritual bypassing - be direct, psychological`}

"analysis": (80-90 words):
- Focus on LOVE, DESIRE, INTIMACY for ${ctx.type.toUpperCase()}
- Use the EXACT degree (${ctx.type === 'sun' ? sunDeg?.degree : ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'}°) to create a UNIQUE interpretation
- Reference the degree position naturally (e.g., "Your ${sign} energy emerges at its very point of origin" instead of saying "1st decan")
- A ${sign} at ${ctx.type === 'sun' ? sunDeg?.degree : ctx.type === 'moon' ? moonDeg?.degree : risingDeg?.degree || '?'} degrees (${ctx.type === 'sun' ? sunDecan : ctx.type === 'moon' ? moonDecan : risingDecan}) expresses differently than other ${sign} placements
- ${currentHouse ? `Consider how being ${currentHouse} affects this placement. ` : ''}Name their wound gently but specifically
- End with a hook

TOTAL: 120-140 words. Must fit one screen without scrolling.

OUTPUT FORMAT (JSON only):
{"preamble":"...","analysis":"..."}

Remember: DATING APP. Focus on love, desire, intimacy, abandonment.
`.trim();
}
// NO FALLBACK READINGS - ALL READINGS MUST COME FROM REAL API CALLS
