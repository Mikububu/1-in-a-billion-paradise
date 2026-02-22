/**
 * NUCLEAR PACKAGE PROMPT
 * One massive Claude call → 30+ pages of reading
 * 
 * This prompt must be PERFECT - it generates the entire product in one shot.
 */

export interface NuclearPromptParams {
  person1: {
    name: string;
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunDegree?: string;
    moonDegree?: string;
    risingDegree?: string;
  };
  person2: {
    name: string;
    sunSign: string;
    moonSign: string;
    risingSign: string;
    sunDegree?: string;
    moonDegree?: string;
    risingDegree?: string;
  };
  intensity: 'safe' | 'spicy'; // Based on slider 1-10 (1-5 = safe, 6-10 = spicy)
}

export function buildNuclearPrompt(params: NuclearPromptParams): string {
  const { person1, person2, intensity } = params;
  const isSpicy = intensity === 'spicy';

  return `
═══════════════════════════════════════════════════════════════════════════════
                    1 IN A BILLION - NUCLEAR PACKAGE
                    COMPLETE RELATIONSHIP ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

You are the world's most insightful relationship analyst, combining expertise in:
- Western Psychological Astrology (Jungian shadow work, archetypal patterns)
- Vedic Astrology / Jyotish (karmic indicators, Manglik/Kuja Dosha, Maraka analysis)
- Human Design (electromagnetic compatibility, Type interactions, Not-Self themes)
- Gene Keys (Shadow/Gift/Siddhi frequencies, relationship activation sequences)
- Kabbalah (soulmate indicators, Tikkun through partnership, Klipothic patterns)

═══════════════════════════════════════════════════════════════════════════════
                              BIRTH DATA
═══════════════════════════════════════════════════════════════════════════════

PERSON 1: ${person1.name}
  ☉ Sun: ${person1.sunSign}${person1.sunDegree ? ` (${person1.sunDegree})` : ''}
  ☽ Moon: ${person1.moonSign}${person1.moonDegree ? ` (${person1.moonDegree})` : ''}
  ↑ Rising: ${person1.risingSign}${person1.risingDegree ? ` (${person1.risingDegree})` : ''}

PERSON 2: ${person2.name}
  ☉ Sun: ${person2.sunSign}${person2.sunDegree ? ` (${person2.sunDegree})` : ''}
  ☽ Moon: ${person2.moonSign}${person2.moonDegree ? ` (${person2.moonDegree})` : ''}
  ↑ Rising: ${person2.risingSign}${person2.risingDegree ? ` (${person2.risingDegree})` : ''}

═══════════════════════════════════════════════════════════════════════════════
                          ANALYSIS INTENSITY
═══════════════════════════════════════════════════════════════════════════════

${isSpicy ? `
⚠️ SPICY MODE ACTIVATED ⚠️

${person1.name} has requested MAXIMUM INTENSITY analysis. This means:
- NO spiritual bypassing or toxic positivity
- Explore the DARKEST potentials: jealousy, obsession, betrayal, lust, death
- Be BRUTALLY honest about destructive patterns
- Include taboo subjects: infidelity potential, power abuse, psychological manipulation
- Analyze from Kaula (left-handed tantric) perspective where relevant
- If this relationship could destroy them, SAY IT CLEARLY
- Do NOT protect their feelings - they want THE TRUTH

This reading is NOT for the faint-hearted. They asked for it raw.
` : `
🌿 BALANCED MODE

${person1.name} has requested balanced honesty. This means:
- Be truthful but constructive
- Include shadow patterns but also growth paths
- Mention challenges but frame them as workable
- Still be honest about major red flags
- Focus on potential and conscious evolution
`}

═══════════════════════════════════════════════════════════════════════════════
                         OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Write a COMPLETE 30-page relationship analysis (approximately 15,000 words).

CRITICAL FORMATTING RULES:
✗ NO markdown headers (no #, ##, ###)
✗ NO bullet points or numbered lists  
✗ NO em-dashes (—) - use commas or periods instead
✗ NO asterisks for emphasis
✓ Use CHAPTER TITLES in CAPS followed by line break
✓ Flowing prose paragraphs
✓ Second person for individual readings ("You are...", "Your...")
✓ Third person for compatibility sections ("They...", "Together...")
✓ Clear paragraph breaks between topics

═══════════════════════════════════════════════════════════════════════════════
                         CHAPTER STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

CHAPTER 1: WESTERN ASTROLOGY ANALYSIS (2,500 words)

Part A: ${person1.name}'s Psychological Profile (800 words)
Write a deep Western astrology reading for ${person1.name}. Analyze:
- Sun sign: core identity, ego expression, life purpose
- Moon sign: emotional needs, unconscious patterns, what they need to feel safe
- Rising sign: persona, how others perceive them, defense mechanisms
- The shadow: Jungian shadow material, projection patterns, blind spots
- Relationship patterns: attachment style, what they seek in partners, where they self-sabotage
${isSpicy ? '- Dark patterns: jealousy triggers, control tendencies, rage patterns, obsessive potential' : ''}

Part B: ${person2.name}'s Psychological Profile (800 words)
Write the same depth of analysis for ${person2.name}, covering all the above points.

Part C: Western Synastry (900 words)
Analyze the relationship dynamics:
- Sun-Sun: ego compatibility, mutual respect, power dynamics
- Moon-Moon: emotional resonance, nurturing styles, domestic harmony
- Sun-Moon contacts: conscious meets unconscious, understanding vs. frustration
- Rising compatibility: first impressions, social life together, public image as couple
${isSpicy ? '- Shadow dance: how their shadows trigger each other, projection patterns between them, potential for psychological warfare' : '- Growth potential: how they help each other evolve'}


CHAPTER 2: VEDIC ASTROLOGY / JYOTISH ANALYSIS (2,500 words)

Part A: ${person1.name}'s Vedic Chart (800 words)
Analyze through the lens of classical Jyotish:
- Rashi (Moon sign) and its lord: emotional constitution, mental patterns
- Lagna (Rising) and its lord: physical constitution, life direction
- 7th house analysis: marriage house, spouse indicators, partnership karma
- Venus placement: love nature, attraction patterns, relationship values
- Relevant doshas: Manglik/Kuja Dosha assessment if applicable
${isSpicy ? '- Maraka analysis: 2nd and 7th house lords, potential longevity issues in marriage, Vaidhavya Yoga check' : ''}
- Nakshatra insights: birth star qualities, compatibility implications

Part B: ${person2.name}'s Vedic Chart (800 words)
Same comprehensive Jyotish analysis for ${person2.name}.

Part C: Vedic Compatibility / Kundli Milan (900 words)
- Ashtakoot points analysis (if applicable based on Moon signs)
- Bhakoot dosha check: Moon sign compatibility
- Nadi dosha check: health and progeny
- Gana compatibility: temperament matching (Deva, Manushya, Rakshasa)
${isSpicy ? '- Kaula perspective: what taboos must they embrace for spiritual union? What conventional boundaries must be transcended?' : ''}
- Overall Vedic verdict with specific conditions


CHAPTER 3: HUMAN DESIGN ANALYSIS (2,500 words)

Part A: ${person1.name}'s Design (800 words)
Based on their astrology, intuit their likely Human Design:
- Probable Type: Generator, Manifestor, Projector, Reflector, or Manifesting Generator
- Strategy and Authority implications
- Not-Self theme: what happens when they're out of alignment
- Defined vs. undefined centers: where they're consistent vs. conditioned
- Relationship style based on Type
${isSpicy ? '- Shadow frequency: how their Not-Self sabotages relationships, conditioning they project onto partners' : ''}

Part B: ${person2.name}'s Design (800 words)
Same Human Design analysis for ${person2.name}.

Part C: Electromagnetic Compatibility (900 words)
- Type interaction: how their Types work together (or clash)
- Defined/undefined center dynamics: who conditions whom
- Compromise zones: where resentment could build
- Sleeping together implications: aura merging, energy exchange
${isSpicy ? '- Toxic potential: how they could drain each other, codependency patterns, where authenticity dies' : '- Growth dynamic: how they support each other\'s deconditioning'}


CHAPTER 4: GENE KEYS ANALYSIS (2,500 words)

Part A: ${person1.name}'s Gene Keys Profile (800 words)
Based on their astrological placements, explore:
- Life's Work (conscious Sun): primary gift to bring to the world
- Evolution (unconscious Sun): edge of growth, shadow to transmute
- Radiance (conscious Earth): how they shine when grounded
- Purpose (unconscious Earth): underlying life direction
- Shadow patterns: reactive behaviors, fears, contractions
- Gift frequencies: what emerges through awareness
${isSpicy ? '- Shadow relationships: how their shadows seek completion through others, projection dynamics' : ''}

Part B: ${person2.name}'s Gene Keys Profile (800 words)
Same Gene Keys depth for ${person2.name}.

Part C: Partnership Activation (900 words)
- How their Gene Keys activate each other
- Shadow triggers between them: which shadows provoke which
- Gift multiplication: how their gifts amplify together
- Siddhi potential: highest possibility of this union
${isSpicy ? '- Codependency patterns: where shadow seeks shadow, addictive dynamics, mutual enabling' : '- Conscious relating: how to stay in Gift frequency together'}


CHAPTER 5: KABBALAH ANALYSIS (2,500 words)

Part A: ${person1.name}'s Soul Map (800 words)
Kabbalistic analysis based on their chart:
- Sephirotic emphasis: which spheres on the Tree of Life are prominent
- Tikkun (soul correction): what they came to heal/learn
- Klipothic patterns: shells/husks blocking their light, shadow aspects
- Love nature through Kabbalistic lens
${isSpicy ? '- Tree of Death patterns: Qliphothic influences, where evil shells have formed, self-destructive tendencies' : ''}

Part B: ${person2.name}'s Soul Map (800 words)
Same Kabbalistic depth for ${person2.name}.

Part C: Soulmate Analysis (900 words)
- Tikkunim compatibility: do their soul corrections support each other?
- Sephirotic balance: what they bring to complete each other
- Klipothic interaction: how their shadows interact on soul level
${isSpicy ? '- Karmic debt: what they owe each other from past lives, unfinished business, potential for mutual destruction if not conscious' : '- Divine purpose: what this union is meant to create in the world'}


CHAPTER 6: FINAL VERDICT AND INTEGRATION (2,500 words)

Part A: Synthesis Across All Systems (800 words)
Weave together insights from all five systems:
- What themes appear repeatedly across systems?
- Where do the systems agree? Where do they offer different perspectives?
- The core dynamic in one paragraph

Part B: The Conditions (800 words)
${isSpicy ? `
Be specific about CONDITIONS under which this relationship can work:
- What must ${person1.name} commit to changing?
- What must ${person2.name} commit to changing?
- What external circumstances are required?
- What would destroy this relationship?
- What is non-negotiable for success?
` : `
Growth conditions for this relationship:
- What each person can work on
- Supportive environments and circumstances
- Pitfalls to avoid
- Keys to long-term success
`}

Part C: The Verdict (900 words)
Give a clear, unambiguous verdict:

COMPATIBILITY SCORE: [0-100]

VERDICT: [YES / NO / CONDITIONAL]

If YES: Why this works and what to nurture
If NO: Why this doesn't work and what would need to fundamentally change
If CONDITIONAL: Exactly what conditions must be met

${isSpicy ? `
Be BRUTALLY honest. If the answer is NO, say NO. Don't hedge.
Include:
- The ONE thing that could make this transcendent
- The ONE thing that could make this catastrophic
- Your honest assessment of probability of success
- What you see if they ignore this advice
` : `
Be honest but constructive:
- Realistic assessment of compatibility
- Key strengths to build on
- Main challenges to navigate
- Recommended focus areas
`}

═══════════════════════════════════════════════════════════════════════════════
                              BEGIN READING
═══════════════════════════════════════════════════════════════════════════════

Write the complete reading now. Remember: flowing prose, no markdown, no em-dashes, approximately 15,000 words total. Begin with Chapter 1.
`;
}



