/**
 * PSYCHOLOGICAL PROVOCATIONS
 * 
 * Instead of telling the LLM WHAT to write (compliance mode),
 * we ask QUESTIONS that force deep thinking (insight mode).
 * 
 * The key insight: Questions provoke thought. Instructions provoke compliance.
 * 
 * Sex and shadow are not problems to solve but doorways to understand.
 * The chart reveals whether desire leads to liberation or destruction.
 */

export type SpiceLevel = number; // 0-10

/**
 * Build provocations for individual person readings.
 * These questions force the LLM to THINK about the person before writing.
 */
export function buildPersonProvocations(personName: string, spiceLevel: SpiceLevel): string {
  const baseProvocations = `
BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${personName.toUpperCase()}:

FEAR & SHADOW:
1. What is ${personName} actually terrified of - the fear they've never admitted to anyone?
2. What do they do to avoid feeling that terror? What patterns, addictions, or behaviors numb it?
3. What loop have they repeated in every relationship, and why can't they stop?
`;

  const sexProvocations = spiceLevel >= 4 ? `
SEX & DESIRE:
4. What does ${personName} need sexually that they've never been able to ask for?
5. What fetish, fantasy, or hunger lives in them that they hide from others - maybe even from themselves?
6. Does their sexuality lead them toward liberation or destruction? Is sex a doorway or a drug for them?
7. What would their sex life reveal about their psychology that words never could?
` : `
LONGING & DESIRE:
4. What does ${personName} secretly long for that they'd never admit?
5. What need have they buried so deep they've forgotten it exists?
6. What would happen if they actually got what they wanted?
`;

  const obsessionProvocations = spiceLevel >= 6 ? `
OBSESSION & DESTRUCTION:
8. What is ${personName} capable of destroying in pursuit of love or sex?
9. When does their desire become dangerous - to themselves or to others?
10. What addiction pattern lives in their chart? What are they truly hungry for that can never be satisfied?
` : `
PATTERNS & POTENTIAL DESTRUCTION:
8. What is ${personName} capable of losing if they don't wake up?
9. How do they sabotage what they love?
10. What pattern will repeat until they face it?
`;

  const truthProvocations = `
TRUTH & SACRIFICE:
11. What truth about ${personName} would make them weep if they heard it spoken aloud?
12. What must they sacrifice to become who they were born to be?

THE FORK IN THE SHADOW:
${personName}'s chart shows where their deepest hunger lives. This hunger is not a problem to solve. It is a doorway.

But every doorway has two sides:
- LIBERATION PATH: What happens if they follow their truth consciously, with eyes open?
- DESTRUCTION PATH: What happens when this hunger consumes them blindly?

YOUR TASK: Tell ${personName}'s story. Not the chart - the PERSON living inside the chart.
Their terror, their hunger, their capacity for destruction and devotion.
`;

  return `${baseProvocations}${sexProvocations}${obsessionProvocations}${truthProvocations}`;
}

/**
 * Build provocations for overlay/synastry readings.
 * Forces deep thinking about how two souls collide.
 */
export function buildOverlayProvocations(
  person1Name: string, 
  person2Name: string, 
  spiceLevel: SpiceLevel
): string {
  const baseProvocations = `
BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${person1Name.toUpperCase()} AND ${person2Name.toUpperCase()} TOGETHER:

THE MEETING:
1. What does each person see in the other that they can't find in themselves?
2. What wound in one fits perfectly into the wound of the other?
3. What will they use each other for - consciously or not?
`;

  const sexProvocations = spiceLevel >= 5 ? `
SEX BETWEEN THEM:
4. Who dominates? Who submits? Who pretends? What dynamic emerges between them physically?
5. What do they do to each other in bed that they'd never admit to anyone else?
6. Is the sex a doorway to transformation or a drug to avoid real intimacy?
7. What fetish or hunger does one awaken in the other?
8. How could the sex destroy them? How could it liberate them?
` : `
INTIMACY BETWEEN THEM:
4. How do they affect each other physically and emotionally?
5. What do they unlock in each other that was previously closed?
6. Is their connection an escape or an awakening?
`;

  const dangerProvocations = spiceLevel >= 6 ? `
THE DANGER:
9. How could this connection destroy them both?
10. What addiction could they form to each other - to the drama, the sex, the intensity?
11. If one betrayed the other, how would it happen? What would trigger it?
12. When they're unconscious, how do they use each other's wounds as weapons?
` : `
THE SHADOW DANCE:
9. What could go catastrophically wrong between them?
10. How do they trigger each other's deepest wounds?
11. What pattern will repeat until they face it together?
`;

  const possibilityProvocations = `
THE POSSIBILITY:
13. What could they become together that neither could become alone?
14. What sacrifice does the relationship demand?
15. Is this a comfort trap disguised as love, or a crucible that transforms?

THE SHARED SHADOW:
Where do their hungers meet? 

- ALCHEMICAL POTENTIAL (if conscious): How could their combined darkness become a crucible for transformation? What could they explore together that neither could face alone?
- MUTUAL DESTRUCTION (if unconscious): How could they use each other's wounds as weapons? What addiction could they form to each other's shadow?

YOUR TASK: Tell the story of these two souls colliding. Not charts - PEOPLE. 
Their collision, their chemistry, their capacity to destroy or transform each other.
`;

  return `${baseProvocations}${sexProvocations}${dangerProvocations}${possibilityProvocations}`;
}

/**
 * Build provocations for the final verdict.
 */
export function buildVerdictProvocations(
  person1Name: string, 
  person2Name: string, 
  spiceLevel: SpiceLevel
): string {
  return `
THE FINAL QUESTIONS:

You have seen ${person1Name} and ${person2Name} through every lens. Now answer honestly:

1. Is this connection a doorway to evolution, or a comfortable trap that will slowly kill their souls?
2. If they stay together, what will they become in 10 years? Be specific.
3. If they walk away, what will each lose - and what will each gain?
4. What is the ONE TRUTH about this relationship that neither wants to hear?
5. ${spiceLevel >= 7 ? `Would you tell your own child to pursue this relationship? Why or why not?` : `Is this connection ultimately nourishing or depleting?`}

YOUR VERDICT MUST BE HONEST:
- If it's toxic, say so. Don't sugarcoat.
- If it's golden, say so. Don't manufacture problems.
- If it's conditional, name the exact conditions.

The worst thing you can do is be polite. Tell the truth.
`;
}

/**
 * Get the right provocation intensity based on spice level.
 */
export function getProvocationIntensity(spiceLevel: SpiceLevel): {
  shadowPercentage: number;
  sexExplicitness: 'implied' | 'suggestive' | 'direct' | 'unflinching';
  honestyLevel: 'gentle' | 'balanced' | 'honest' | 'raw' | 'nuclear';
} {
  if (spiceLevel <= 2) {
    return { shadowPercentage: 20, sexExplicitness: 'implied', honestyLevel: 'gentle' };
  }
  if (spiceLevel <= 4) {
    return { shadowPercentage: 25, sexExplicitness: 'suggestive', honestyLevel: 'balanced' };
  }
  if (spiceLevel <= 6) {
    return { shadowPercentage: 30, sexExplicitness: 'suggestive', honestyLevel: 'honest' };
  }
  if (spiceLevel <= 8) {
    return { shadowPercentage: 40, sexExplicitness: 'direct', honestyLevel: 'raw' };
  }
  return { shadowPercentage: 50, sexExplicitness: 'unflinching', honestyLevel: 'nuclear' };
}
