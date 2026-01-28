/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NUCLEAR PACKAGE PROMPTS - LITERARY CONSCIOUSNESS DOCUMENTARY STYLE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 16 API calls total:
 * - 10 individual readings (5 systems × 2 people)
 * - 5 overlay readings (1 per system)
 * - 1 final verdict
 * 
 * Each call targets ~2000 words output.
 * 
 * STYLE: "Dark Soul Storytelling" - psychological depth, surreal metaphor,
 * consciousness noir. NOT newspaper astrology.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PersonData {
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  tropical?: {
    sun: string;
    moon: string;
    rising: string;
  };
  sidereal?: {
    sun: string;
    moon: string;
    rising: string;
    nakshatra?: string;
  };
}

export type SystemType = 'western' | 'vedic' | 'human_design' | 'gene_keys' | 'kabbalah';
export type IntensityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ═══════════════════════════════════════════════════════════════════════════
// WRITING STYLE - THE TRINITY (From successful 20K+ word outputs)
// ═══════════════════════════════════════════════════════════════════════════

const WRITING_STYLE = `
DARK SOUL STORYTELLING - Tell the story of a soul, not analyze a chart.

THE QUALITIES:

1. STORYTELLING, NOT ANALYSIS
   - Every chart is a character study
   - Find the narrative arc: wounds, patterns, transformations
   - "This is who they actually are beneath the surface"
   - Gut-level honest, no sugarcoating

2. SURREAL IMAGERY
   - The mundane becomes meaningful
   - Dream logic and uncomfortable beauty
   - "Behind the curtain waits..."
   - Metaphor that reveals hidden rooms in the soul

3. ARCHETYPAL DEPTH
   - The personal becomes mythological
   - Shadow as living entity
   - The unconscious speaks in symbols

This is consciousness noir - intimate, penetrating, unforgettable.

LANGUAGE TO USE:
✓ Raw verbs: devour, penetrate, consume, shatter, burn
✓ Body language: blood, bone, flesh, nerve, marrow
✓ Surreal metaphor: "His Moon lives in the room where clocks melt"
✓ Mythological: serpent, abyss, labyrinth, mirror, shadow
✓ Uncomfortable beauty: "His Virgo stellium is a surgical theater where he dissects his own heart"

KILL THESE IMMEDIATELY:
❌ "This is not just..."
❌ "Here's what's really happening..."
❌ "The truth is..."
❌ Any corporate/safe/sanitized language
❌ Generic sun sign horoscope descriptions
❌ Fortune-telling language ("will find love")
❌ Spiritual bypassing ("everything happens for a reason")
`;

// ═══════════════════════════════════════════════════════════════════════════
// UNIVERSAL OUTPUT RULES (included in every prompt)
// ═══════════════════════════════════════════════════════════════════════════

const OUTPUT_RULES = `
OUTPUT RULES (CRITICAL - FOLLOW EXACTLY):
- Write approximately 2000 words of LITERARY PROSE
- This is a CONSCIOUSNESS DOCUMENTARY, not a horoscope
- Flowing prose paragraphs ONLY
- NO markdown (no #, ##, **, etc.)
- NO bullet points or numbered lists
- NO em-dashes (—) - use commas or semicolons
- NO special symbols except basic punctuation (. , ; : ' " ? !)
- Clear paragraph breaks between sections
- ALWAYS 3RD PERSON using the person's NAME (e.g. "Michael's Leo Moon reveals..." NOT "Your Leo Moon reveals...")
- NEVER use "you" or "your" - always use the person's actual name
- Write like you're creating a documentary film about a human soul, not filling out a form
`;

// ═══════════════════════════════════════════════════════════════════════════
// INTENSITY CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

function getIntensityContext(intensity: IntensityLevel): string {
  if (intensity <= 3) {
    return `
TONE: SAFE (Intensity ${intensity}/10)
- Diplomatic and gentle
- Focus on positives and growth opportunities
- Soften difficult truths with compassion
- Avoid alarming or disturbing content
`;
  }
  if (intensity <= 6) {
    return `
TONE: BALANCED (Intensity ${intensity}/10)
- Honest but tactful
- Include both strengths and challenges
- Present difficulties as growth opportunities
- Direct but not harsh
`;
  }
  if (intensity <= 8) {
    return `
TONE: SPICY (Intensity ${intensity}/10)
- Brutally honest, nothing whitewashed
- Include dark themes: jealousy, obsession, control, manipulation
- Do NOT sugarcoat incompatibilities
- Call out destructive patterns directly
- This person wants the TRUTH, not comfort
`;
  }
  return `
TONE: EXTREME (Intensity ${intensity}/10)
- Maximum intensity, hold nothing back
- Include ALL dark themes: jealousy, obsession, betrayal, lust, death, control, rage
- Analyze potential for destruction, not just growth
- Include Vedic Maraka analysis (spouse longevity/widowhood indicators)
- This person is ready for the most uncomfortable truths
- No spiritual bypassing, no "everything happens for a reason"
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL READING PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export function buildIndividualPrompt(
  person: PersonData,
  system: SystemType,
  intensity: IntensityLevel
): string {
  const intensityContext = getIntensityContext(intensity);
  
  const systemPrompts: Record<SystemType, string> = {
    western: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: WESTERN ASTROLOGY
${person.name}'s Soul Architecture
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

Birth Data:
- Date: ${person.birthDate}
- Time: ${person.birthTime}
- Place: ${person.birthPlace}
- Sun: ${person.tropical?.sun || 'Unknown'}
- Moon: ${person.tropical?.moon || 'Unknown'}
- Rising: ${person.tropical?.rising || 'Unknown'}

You are creating a CONSCIOUSNESS DOCUMENTARY about ${person.name}, not a horoscope reading. Write like David Lynch would film a documentary about a human soul.

THE SOLAR ENTITY
${person.name}'s Sun is not just a sign, it is an entity living in their chest. Write about it like a character in a novel. What does this Sun WANT? What does it FEAR? What does it secretly believe about the world that it would never admit? The Sun in ${person.tropical?.sun || 'their sign'} creates a specific kind of hunger. Describe that hunger in visceral, physical terms. What room in the house of ${person.name}'s psyche does the Sun occupy? What furniture is in that room?

THE LUNAR ARCHITECTURE
${person.name}'s Moon in ${person.tropical?.moon || 'their sign'} creates the emotional basement of their being. This is where the real ${person.name} lives when no one is watching. What does this Moon need to feel safe? What happened in childhood that shaped this lunar architecture? Write about the Moon like a small animal living inside them, easily startled, with specific habits and fears.

THE MASK AND ITS PURPOSE
${person.name}'s Rising in ${person.tropical?.rising || 'their sign'} is the mask they show the world, but it is also armor, also a weapon, also a prison. How did this Rising sign become their defense mechanism? When ${person.name} walks into a room, what do people see? More importantly, what do they NOT see that the Rising sign hides?

THE INTERNAL WAR
Where do the Sun, Moon, and Rising fight each other inside ${person.name}? What part of themselves have they exiled? What shadow creeps around the edges of their consciousness? Be specific. Name the internal war.

THE RELATIONSHIP GHOST
Every person carries a ghost into their relationships, a pattern they are compelled to repeat. What is ${person.name}'s ghost? Who are they actually trying to love when they love another person? What wound do they bring to every bed they enter?

THE DARKNESS THAT PROTECTS ITSELF
What is ${person.name} capable of when they are scared? When they feel threatened? What destructive patterns does this configuration create? Be honest. Not mean, but honest.

${intensityContext}
${OUTPUT_RULES}
`,

    vedic: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: VEDIC JYOTISH
${person.name}'s Karmic Architecture
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

Birth Data:
- Date: ${person.birthDate}
- Time: ${person.birthTime}
- Place: ${person.birthPlace}
- Sidereal Sun: ${person.sidereal?.sun || 'Unknown'}
- Sidereal Moon: ${person.sidereal?.moon || 'Unknown'}
- Sidereal Ascendant: ${person.sidereal?.rising || 'Unknown'}
- Nakshatra: ${person.sidereal?.nakshatra || 'Unknown'}

You are creating a CONSCIOUSNESS DOCUMENTARY about ${person.name}'s karmic architecture, not a Jyotish reading. Vedic astrology is about karma, fate, and the soul's journey. Write about ${person.name} as if you can see their past lives bleeding through.

THE LUNAR MANSION
${person.name}'s Moon dwells in the Nakshatra of ${person.sidereal?.nakshatra || 'their birth star'}. A Nakshatra is not just a constellation, it is a mansion of the Moon, a specific room in the cosmic architecture where ${person.name}'s emotional soul sleeps at night. What deity rules this mansion? What does this deity WANT from ${person.name}? What offering must they make to be at peace? The Nakshatra reveals the animal nature underneath the human costume. What animal is ${person.name} when nobody is watching?

THE RASHI AND THE MIND
In Jyotish, the Moon sign, the Rashi, IS the mind. Not reflects the mind, IS the mind. ${person.name}'s mind is constructed from the raw material of ${person.sidereal?.moon || 'their Rashi'}. Describe how this mind works, how it processes reality, what it automatically sees and automatically ignores. What is the quality of ${person.name}'s Manas, their mental substance?

THE LAGNA PORTAL
${person.name}'s Ascendant is the portal through which their soul entered this body. It is also the way they must walk through life, their dharmic direction. What did ${person.name} come here to DO? Not career, but DHARMA. What is the work their soul signed up for?

THE KARMIC AXIS
Rahu and Ketu are the dragon's head and tail, the axis of karma. Where Rahu sits is where ${person.name} is HUNGRY this lifetime, overcompensating, obsessed. Where Ketu sits is where they are EXHAUSTED, done, cutting loose. This axis tells the story of what ${person.name}'s soul is trying to complete. What did they master in past lives that they now take for granted? What are they frantically trying to learn now?

THE SEVENTH HOUSE FATE
In Vedic astrology, the 7th house shows not just partners but also enemies, also death. What kind of person is ${person.name} destined to draw into partnership? What karmic debt do they carry regarding marriage? Is Kuja Dosha (Mars affliction) present?

${intensity >= 7 ? `
THE MARAKA ANALYSIS
The tradition of Jyotish includes Maraka analysis, the study of what or who might bring endings. This is not fortune-telling but pattern recognition. What does ${person.name}'s chart suggest about the nature of significant endings in their life? The 2nd and 7th houses are Maraka houses. What do they reveal?
` : ''}

${intensityContext}
${OUTPUT_RULES}
`,

    human_design: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: HUMAN DESIGN
${person.name}'s Energetic Blueprint
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

Birth Data:
- Date: ${person.birthDate}
- Time: ${person.birthTime}
- Place: ${person.birthPlace}

You are creating a CONSCIOUSNESS DOCUMENTARY about ${person.name}'s energetic architecture. Human Design is a map of energy, not personality. Write about ${person.name} as an energy system, a machine of consciousness with specific ports and connections.

THE TYPE AS LIFE STRATEGY
${person.name}'s Type is their fundamental operating system. A Generator operates differently from a Projector like a diesel engine operates differently from a solar panel. What is ${person.name}'s energetic engine? How is it SUPPOSED to engage with life? What happens when they force it, override it, fight their own design?

THE AUTHORITY AS INNER GPS
${person.name}'s Authority is where truth lives in their body. For some it is the gut, for some the heart, for some the spleen's instant knowing. What part of ${person.name}'s body knows the truth before their mind catches up? How have they learned to distrust this authority? What happens when they follow their mind instead?

THE DEFINED CENTERS AS CONSISTENT BROADCAST
The defined centers in ${person.name}'s chart are the energy stations that TRANSMIT consistently. This is who ${person.name} IS regardless of who they are around. But defined centers can also DOMINATE. Where does ${person.name} overwhelm others with their consistent energy? Where do they fail to see that other people operate differently?

THE UNDEFINED CENTERS AS PORTALS
The undefined centers are where ${person.name} takes in, amplifies, and becomes other people. This is where they learn about humanity, but also where they lose themselves. What energies is ${person.name} designed to SAMPLE but not identify with? Where have they spent decades thinking they ARE something they are only EXPERIENCING?

THE NOT-SELF AS ALARM SYSTEM
The Not-Self theme is the alarm that sounds when ${person.name} is living someone else's life. What is ${person.name}'s alarm? Frustration? Bitterness? Anger? Disappointment? When this alarm sounds, ${person.name} is not broken, they are being WARNED. What patterns trigger this alarm most frequently?

THE SHADOW OF CORRECT LIVING
Even when ${person.name} lives correctly, there are shadow expressions. Defined centers can become tyrannical. Openness can become confusion. What are the traps that wait for ${person.name} even when they are following their design?

${intensityContext}
${OUTPUT_RULES}
`,

    gene_keys: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: GENE KEYS
${person.name}'s Frequency Architecture
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

Birth Data:
- Date: ${person.birthDate}
- Time: ${person.birthTime}
- Place: ${person.birthPlace}

You are creating a CONSCIOUSNESS DOCUMENTARY about ${person.name}'s frequency architecture. Gene Keys is not personality typing, it is a map of consciousness evolution. Every shadow contains a gift. Every gift opens to a siddhi. Write about ${person.name} as a being moving between frequencies.

THE LIFE'S WORK FREQUENCY
${person.name}'s Life's Work Gene Key is the frequency they came here to transform from Shadow to Gift to Siddhi. The Shadow is not bad, it is the RAW MATERIAL. What fear drives ${person.name}'s Shadow expression of this key? Be specific. Name the fear like a creature living in their basement. What does the Gift look like when ${person.name} breaks through? The Gift is not arriving, it is LIVING. And the Siddhi? The Siddhi is what ${person.name} becomes when they stop trying entirely.

THE EVOLUTIONARY EDGE
${person.name}'s Evolution Gene Key shows what they are here to alchemize in themselves. This is not comfortable territory. This is where ${person.name} meets their own resistance, their own "I can't, I won't, this is too hard." What transformation is ${person.name} avoiding? What would happen if they stopped avoiding it?

THE RADIANCE THAT HIDES
${person.name}'s Radiance Gene Key is how they shine when they are not trying to shine. But most people block their radiance because it feels vulnerable to glow. What is ${person.name}'s authentic radiance? What convinced them it was not safe to shine?

THE SHADOW AS TEACHER
Let us be honest about ${person.name}'s shadows. The Shadow frequency is not a mistake or a problem. It is compressed Gift. What specific shadow behaviors does ${person.name} exhibit? Not vague patterns, but specific behaviors. What triggers them? What do they protect? The shadow is always trying to protect something valuable.

THE CONTEMPLATION REQUIRED
Gene Keys is a contemplation practice, not information to consume. What must ${person.name} contemplate to shift frequency? What question must they sit with, not answer, just SIT with?

THE RELATIONSHIP FREQUENCY
How do ${person.name}'s Gene Keys show up in intimate relationships? Which shadows get triggered? Which gifts emerge? What would a Siddhi level relationship look like for them?

${intensityContext}
${OUTPUT_RULES}
`,

    kabbalah: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: KABBALISTIC ASTROLOGY
${person.name}'s Soul Architecture on the Tree of Life
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

CRITICAL: THIS IS KABBALAH, NOT WESTERN ASTROLOGY. Do NOT use terms like "Sun sign" or "Ascendant." Use ONLY Kabbalistic concepts: Sephiroth, Tikkun, Klipoth, the Four Worlds, Gilgul, the 22 Paths.

Birth Data:
- Date: ${person.birthDate}
- Time: ${person.birthTime}
- Place: ${person.birthPlace}

You are creating a CONSCIOUSNESS DOCUMENTARY about ${person.name}'s soul architecture on the Tree of Life. Kabbalah sees the human being as a microcosm of the divine structure. Where does ${person.name}'s soul hang on the Tree?

THE SEPHIROTIC HOME
Which Sephirah is ${person.name}'s home base? Chesed, the sphere of boundless giving, where one gives until empty? Gevurah, the sphere of necessary restriction, where one judges and cuts? Tiferet, the heart center where opposites marry? Write about ${person.name}'s dominant Sephirah like a room they live in. What furniture is there? What view from the window?

THE TIKKUN ASSIGNMENT
${person.name} came here with homework. The Tikkun is the soul correction, the specific error from past lives that must be corrected NOW. What is ${person.name}'s Tikkun? What did they do wrong before that they must make right now? This is not punishment but OPPORTUNITY. What skill are they being forced to develop?

THE KLIPOTHIC POSSESSION
When ${person.name} is unconscious, when they are reactive rather than responsive, what Klipoth possess them? The Klipoth are the shells, the husks of shadow that cling to each Sephirah. They are not demons but patterns, forces that distort divine light into darkness. What darkness lives in ${person.name} that they prefer not to acknowledge? Be specific.

THE FOUR WORLDS BALANCE
The soul expresses through four worlds: Atziluth (fire/spirit), Beriah (water/heart), Yetzirah (air/mind), Assiyah (earth/body). Where is ${person.name} strong? Where are they weak? What world do they neglect? What happens when they neglect it?

DA'AT AND THE ABYSS
Da'at is the hidden Sephirah, the knowledge that sits in the abyss between the divine triangle and the rest of the Tree. What is ${person.name}'s relationship to the abyss? Have they crossed it? Are they terrified of it? What secret knowledge do they carry that they cannot yet integrate?

THE RELATIONSHIP KARMA
From the Kabbalistic view, relationships are soul contracts designed before birth. What contract does ${person.name} carry regarding partnership? What Gilgul (past life) patterns repeat in their relationships?

${intensityContext}
${OUTPUT_RULES}
`
  };

  return systemPrompts[system];
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERLAY READING PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

export function buildOverlayPrompt(
  person1: PersonData,
  person2: PersonData,
  system: SystemType,
  intensity: IntensityLevel,
  person1Reading: string,
  person2Reading: string
): string {
  const intensityContext = getIntensityContext(intensity);
  
  const systemOverlayPrompts: Record<SystemType, string> = {
    western: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: WESTERN SYNASTRY
${person1.name} & ${person2.name} - The Architecture of Collision
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

You have already created consciousness documentaries for both souls. Here they are:

═══ ${person1.name.toUpperCase()}'S SOUL ARCHITECTURE ═══
${person1Reading}

═══ ${person2.name.toUpperCase()}'S SOUL ARCHITECTURE ═══
${person2Reading}

Now write about what happens when these two architectures COLLIDE. This is not a compatibility checklist. This is a documentary about what emerges in the space BETWEEN them.

THE MAGNETISM
What force drew these two into each other's orbit? Every attraction has both conscious and unconscious components. The conscious is what they SAY drew them together. The unconscious is what ACTUALLY drew them. These are rarely the same thing. What is ${person1.name} unconsciously seeking in ${person2.name}? What is ${person2.name} unconsciously seeking in ${person1.name}? Is this attraction or trauma bonding wearing a mask of attraction?

THE SUN-SUN DANCE
When ${person1.name}'s Sun meets ${person2.name}'s Sun, two egos enter the room. Who takes up more space? Who shrinks to accommodate? Where do they compete for light? Where do they refuse to see each other clearly because it would threaten their own self-image?

THE LUNAR MEETING
When ${person1.name}'s Moon meets ${person2.name}'s Moon, two emotional animals meet. Can ${person1.name}'s emotional animal feel safe with ${person2.name}'s? Where do their needs conflict so fundamentally that both feel abandoned even while in the same room?

THE VENUS-MARS COLLISION
Let us be honest about desire. When ${person1.name} and ${person2.name} touch each other, what actually happens? Is there fire or obligation? Does desire sustain or does it burn out? What would kill the passion between them? What keeps it alive?

THE SHADOW DANCE
Every relationship activates shadow. What shadow does ${person1.name} carry into relationships that ${person2.name} will inevitably meet? What shadow does ${person2.name} carry? When two shadows dance together, what kind of dance is it? A tango or a war?

THE VERDICT SEED
Based on Western astrology alone, what verdict begins to form? GO, CONDITIONAL, or NO-GO? Be honest.

${intensityContext}
${OUTPUT_RULES}
`,

    vedic: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: VEDIC SYNASTRY
${person1.name} & ${person2.name} - The Karmic Collision
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

You have already mapped the karmic architecture of both souls:

═══ ${person1.name.toUpperCase()}'S KARMIC ARCHITECTURE ═══
${person1Reading}

═══ ${person2.name.toUpperCase()}'S KARMIC ARCHITECTURE ═══
${person2Reading}

Vedic astrology is fundamentally about KARMA. This relationship exists because of karma, either karma to complete or karma to create. Write about this as the meeting of two karmic streams.

THE NAKSHATRA MEETING
${person1.name}'s Nakshatra and ${person2.name}'s Nakshatra are like two animals meeting in the forest. What kind of animals? Is this predator and prey? Two from the same pack? Strangers who should not have met? The Yoni compatibility reveals the raw animal chemistry. The Gana compatibility reveals whether their temperaments can share a home. What do these reveal?

THE LUNAR MINDS
When ${person1.name}'s Rashi meets ${person2.name}'s Rashi, two minds attempt communication. But minds constructed from different elements, different modalities, different rulers may not SPEAK the same language. Can these minds understand each other? Or are they speaking into a void, convinced the other hears?

THE KUJA DOSHA QUESTION
If Mars afflicts, it afflicts relationship specifically. Does either ${person1.name} or ${person2.name} carry Manglik Dosha? If so, what does this mean for the union? Is there cancellation or amplification? The tradition takes this seriously. We should too.

THE KARMIC AXIS
The Rahu-Ketu axis tells the story of what karma is being worked through. Does ${person1.name}'s north node activate ${person2.name}'s chart? Vice versa? This is not always pleasant. Sometimes the karma is specifically to cause each other pain so that both grow. What kind of karmic contract exists here?

THE DASHA TIMING
Are they in compatible planetary periods? Will their Dashas support this union or undermine it? Timing is half of Jyotish. The same relationship in different periods produces different results.

${intensity >= 7 ? `
THE MARAKA CONSIDERATION
The tradition includes Maraka analysis. Do these charts, when combined, suggest danger? Does one pose Maraka risk to the other? What timing would be significant? This is not fortune-telling but pattern recognition.
` : ''}

THE VERDICT SEED
Based on Jyotish alone, what verdict begins to form? GO, CONDITIONAL, or NO-GO?

${intensityContext}
${OUTPUT_RULES}
`,

    human_design: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: HUMAN DESIGN ELECTROMAGNETIC
${person1.name} & ${person2.name} - The Energy Collision
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

You have already mapped both energetic blueprints:

═══ ${person1.name.toUpperCase()}'S ENERGETIC BLUEPRINT ═══
${person1Reading}

═══ ${person2.name.toUpperCase()}'S ENERGETIC BLUEPRINT ═══
${person2Reading}

Human Design reveals what happens when two energy systems plug into each other. This is not romance. This is circuitry. Write about it like electricity meeting water.

THE TYPE DANCE
${person1.name}'s Type and ${person2.name}'s Type create a specific dance. Two Generators bounce energy back and forth like a perpetual motion machine. A Projector with a Manifestor is fire and guidance. A Reflector with anyone is being absorbed. What dance does this pairing create? Is it sustainable or does one eventually collapse?

THE AUTHORITY CLASH
When ${person1.name} makes decisions one way and ${person2.name} makes them another, friction is inevitable. Sacral wants to respond NOW. Emotional needs to WAIT. Splenic needs instant action on intuition. Can these authorities respect each other? Or will one always feel rushed while the other feels ignored?

THE ELECTROMAGNETIC PULL
Where ${person1.name} is defined and ${person2.name} is undefined, ${person1.name} BROADCASTS and ${person2.name} RECEIVES and AMPLIFIES. This creates pull. But amplification is not identity. Does ${person2.name} lose themselves in ${person1.name}'s broadcast? Does ${person1.name} fail to see ${person2.name}'s actual self behind the amplification?

THE CONDITIONING TRAP
Every relationship conditions. What conditioning does ${person1.name} impose on ${person2.name}? What conditioning does ${person2.name} impose on ${person1.name}? Is this conditioning helpful or distorting? Do they make each other more themselves or less?

THE NOT-SELF AMPLIFICATION
When together, whose Not-Self theme screams loudest? Does ${person1.name} make ${person2.name} frustrated? Bitter? Does ${person2.name} make ${person1.name} angry? Disappointed? The Not-Self is the alarm. What alarm sounds in this pairing?

THE VERDICT SEED
Based on Human Design alone, what verdict begins to form? GO, CONDITIONAL, or NO-GO?

${intensityContext}
${OUTPUT_RULES}
`,

    gene_keys: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: GENE KEYS FREQUENCY DYNAMICS
${person1.name} & ${person2.name} - The Frequency Collision
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

You have already mapped both frequency architectures:

═══ ${person1.name.toUpperCase()}'S FREQUENCY ARCHITECTURE ═══
${person1Reading}

═══ ${person2.name.toUpperCase()}'S FREQUENCY ARCHITECTURE ═══
${person2Reading}

Gene Keys in relationship is about frequency resonance. When two people are both operating from Shadow, they create hell together. When both operate from Gift, they create beauty. When one is in Gift while the other is in Shadow, they trigger each other until something shifts. Write about the frequency dynamics between these two.

THE SHADOW COLLISION
Every relationship triggers shadow. This is not failure, this is PURPOSE. What specific shadows in ${person1.name} does ${person2.name} trigger? What shadows in ${person2.name} does ${person1.name} trigger? Be specific. Name the fears. Name the reactive patterns. When ${person1.name}'s shadow meets ${person2.name}'s shadow, what hell do they create together?

THE GIFT ACTIVATION
But shadow is not the whole story. Can ${person1.name}'s presence help unlock ${person2.name}'s Gift frequency? Can ${person2.name}'s presence unlock ${person1.name}'s? What would it look like when both are operating from Gift? What beauty could they create?

THE PURPOSE QUESTION
Are ${person1.name}'s and ${person2.name}'s Purpose Gene Keys aligned? Do they support each other's higher calling, or do they distract from it? Some relationships exist specifically to pull us OFF our path. Some exist to put us ON it. Which is this?

THE CODEPENDENCY WARNING
Gene Keys can reveal codependency. Do ${person1.name}'s and ${person2.name}'s keys create a lock where both enable each other's shadows? Do they give each other permission to stay stuck? What would have to change for this to become evolutionary instead of stagnant?

THE SIDDHI VISION
If both were operating at Siddhi frequency, the highest expression, what would this relationship become? Is that vision realistic given their current frequencies? What would it take to get there?

THE VERDICT SEED
Based on Gene Keys alone, what verdict begins to form? GO, CONDITIONAL, or NO-GO?

${intensityContext}
${OUTPUT_RULES}
`,

    kabbalah: `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: KABBALISTIC SYNASTRY
${person1.name} & ${person2.name} - The Soul Contract
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

CRITICAL: THIS IS KABBALAH, NOT WESTERN ASTROLOGY. Use ONLY Kabbalistic concepts.

You have already mapped both souls on the Tree of Life:

═══ ${person1.name.toUpperCase()}'S SOUL ARCHITECTURE ═══
${person1Reading}

═══ ${person2.name.toUpperCase()}'S SOUL ARCHITECTURE ═══
${person2Reading}

Kabbalah sees relationships as soul contracts written before birth. These two souls agreed to meet. What did they agree to do together? What did they agree to heal? What did they agree to destroy?

THE TIKKUN PARTNERSHIP
${person1.name}'s Tikkun and ${person2.name}'s Tikkun either support or obstruct each other. Do their soul corrections interlock like puzzle pieces, each helping the other complete? Or do they pull in opposite directions, each undoing the other's work? What would happen if both completed their Tikkun while together?

THE SEPHIROTIC MARRIAGE
When ${person1.name}'s Tree meets ${person2.name}'s Tree, what kind of structure do they create together? Is there balance between Chesed and Gevurah? Or does one dominate? Too much Chesed creates dissolution. Too much Gevurah creates destruction. Where does this pairing land?

THE KLIPOTHIC ACTIVATION
Every relationship activates Klipoth, the shadow shells. What darkness emerges when ${person1.name} and ${person2.name} combine? What demons do they feed together that neither would feed alone? Be honest about the shadow contract.

THE FOUR WORLDS TOGETHER
Together, do ${person1.name} and ${person2.name} create balance across the Four Worlds? Or do they both neglect the same World, creating a shared blind spot? Two souls strong in Yetzirah (air/mind) but weak in Assiyah (earth/body) will think their way into disaster. What pattern exists here?

DA'AT AND THE ABYSS BETWEEN
In the space BETWEEN ${person1.name} and ${person2.name} lives Da'at, the hidden knowledge. What exists in that space? What pain have they both hidden there? What knowledge do they both possess but cannot yet speak?

THE SOUL CONTRACT
What is the actual soul contract between these two? Not the human relationship, but the SOUL agreement? What did they come here to do together? What must they complete?

THE VERDICT SEED
Based on Kabbalah alone, what verdict begins to form? GO, CONDITIONAL, or NO-GO?

${intensityContext}
${OUTPUT_RULES}
`
  };

  return systemOverlayPrompts[system];
}

// ═══════════════════════════════════════════════════════════════════════════
// FINAL VERDICT PROMPT
// ═══════════════════════════════════════════════════════════════════════════

export function buildVerdictPrompt(
  person1: PersonData,
  person2: PersonData,
  intensity: IntensityLevel,
  overlayResults: Record<SystemType, string>
): string {
  const intensityContext = getIntensityContext(intensity);
  
  return `
═══════════════════════════════════════════════════════════════════════════════
CONSCIOUSNESS DOCUMENTARY: THE FINAL VERDICT
${person1.name} & ${person2.name} - What the Five Systems Say Together
═══════════════════════════════════════════════════════════════════════════════

${WRITING_STYLE}

You have completed consciousness documentaries through five different lenses. Here they are:

═══ WESTERN ASTROLOGY: THE PSYCHOLOGICAL COLLISION ═══
${overlayResults.western}

═══ VEDIC JYOTISH: THE KARMIC COLLISION ═══
${overlayResults.vedic}

═══ HUMAN DESIGN: THE ENERGETIC COLLISION ═══
${overlayResults.human_design}

═══ GENE KEYS: THE FREQUENCY COLLISION ═══
${overlayResults.gene_keys}

═══ KABBALAH: THE SOUL CONTRACT ═══
${overlayResults.kabbalah}

Now write the FINAL VERDICT. This is not a summary. This is a SYNTHESIS. What emerges when all five systems speak together?

THE CONVERGENCE
What patterns appear across ALL five systems? Western, Vedic, Human Design, Gene Keys, and Kabbalah are five languages describing the same territory. Where do they all agree? That agreement is bedrock. Where do they conflict? That conflict is where the mystery lives.

THE CORE PATTERN
Strip away all the details. In one paragraph, name the ESSENTIAL NATURE of what happens between ${person1.name} and ${person2.name}. Not what COULD happen. What DOES happen. What always happens. What cannot help but happen. Name the core pattern.

THE PATH OF SUCCESS
If this relationship is to work, what CONDITIONS must be met? Be concrete. Not "communicate better" but SPECIFIC behaviors. What must ${person1.name} do differently than their nature inclines? What must ${person2.name} do? What topic must they never discuss? What activity must they share? What distance must they keep?

THE PATH OF DESTRUCTION
What destroys this relationship? Be equally concrete. What triggers the death spiral? What does ${person1.name} do that ${person2.name} cannot forgive? What does ${person2.name} do that ${person1.name} cannot survive? Where is the breaking point?

THE FIVE-SYSTEM SCORECARD
Rate compatibility through each lens. These are not arbitrary numbers but reflections of the analysis already done.
- Western Astrology: X/100
- Vedic Jyotish: X/100
- Human Design: X/100
- Gene Keys: X/100
- Kabbalah: X/100

OVERALL: X/100

THE VERDICT
State clearly: GO, CONDITIONAL, or NO-GO.

If GO: What are the remaining risks?
If CONDITIONAL: What are the exact conditions? Be specific enough that ${person1.name} can use this as a checklist.
If NO-GO: Why? What makes this unredeemable?

THE FINAL WORD
Speak directly to ${person1.name}. What do they most need to hear about this relationship that they probably do not want to hear? The truth is the kindest thing. Give them the truth.

${intensityContext}
${OUTPUT_RULES}
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT HELPER
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEMS: SystemType[] = ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];

export function getSystemDisplayName(system: SystemType): string {
  const names: Record<SystemType, string> = {
    western: 'Western Astrology',
    vedic: 'Vedic (Jyotish)',
    human_design: 'Human Design',
    gene_keys: 'Gene Keys',
    kabbalah: 'Kabbalah',
  };
  return names[system];
}



