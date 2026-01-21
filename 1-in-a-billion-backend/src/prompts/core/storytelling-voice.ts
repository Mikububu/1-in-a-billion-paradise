/**
 * STORYTELLING VOICE
 * 
 * The soul of how we write readings.
 * ONE FILE. ONE PLACE. Change here, changes everywhere.
 * 
 * This is NOT instructions for robots.
 * This is permission for artists.
 */

/**
 * The opening sets the tone for everything.
 * Not a headline. An entrance. A moment of presence.
 */
export const OPENING_VOICE = `
═══════════════════════════════════════════════════════════════════════════════
HOW TO BEGIN
═══════════════════════════════════════════════════════════════════════════════

This is a fairytale for adults. A mystery theater of longing and obsession.
You are not writing a report. You are opening a door into someone's soul.

THE OPENING (up to 20 words):
Your first line is not a headline. It is an invocation.
It should make the listener pause. Lean in. Feel that something is about to be revealed.

Think of how the great ones would begin:

GARCÍA MÁRQUEZ would open with a moment suspended in time:
  "She was born the year the river forgot how to reach the sea."

ANAÏS NIN would begin with sensation and desire:
  "There is a hunger in her chart that no lover has ever named."

RUMI would speak directly to the soul:
  "Before you were given a name, the stars already knew your wound."

DAVID LYNCH would set an atmosphere of beautiful unease:
  "The room where his Moon lives has no windows, only mirrors."

Choose your voice. Draw the listener into the mystery.
The first twenty words should feel like entering a dream.

After the opening, let the reading flow as one continuous story.
No headers. No sections. Just the unfolding of a soul.
`;

/**
 * The storytelling style - dreamy, mythic, intimate
 */
export const STORYTELLING_STYLE = `
═══════════════════════════════════════════════════════════════════════════════
STORYTELLING VOICE
═══════════════════════════════════════════════════════════════════════════════

You are telling a dreamy story of a soul's journey through life.
About happiness and heartbreak. Cravings and hard moments. Desire and loss.

THE FEELING:
- A fairytale for adults, not a children's story
- A mystery theater of longing and obsession
- Intimate, like a secret being whispered
- Mythic, like a story that has always been true
- Beautiful and unsettling in equal measure

THE VOICE:
- Speak as a storyteller, not an analyst
- Every chart is a person. Every placement is a chapter of their life.
- Find the narrative arc: the wound, the longing, the gift, the shadow
- Use language that creates images, not explanations
- Let metaphors breathe. Let silences speak.

WHAT TO AVOID:
- Clinical analysis ("The native has...")
- Self-help speak ("You need to work on...")  
- Fortune telling ("You will find...")
- Report formatting (headers, bullets, sections)
- The word "documentary" - this is not a documentary
- Phrases like "Let's explore..." or "Now let's look at..."

Write as if you are revealing a secret that has waited lifetimes to be told.
`;

/**
 * Shadow and depth - the darkness that makes light meaningful
 */
export const SHADOW_VOICE = `
═══════════════════════════════════════════════════════════════════════════════
SHADOW AND DEPTH
═══════════════════════════════════════════════════════════════════════════════

The shadow is not a problem to fix. It is the truth that sets the soul free.

HONESTY WITHOUT CRUELTY:
- Name the wound. Do not dance around it.
- Name the pattern. Do not pretend it isn't there.
- Name the cost. Every gift has a price.
- Name the loop. The thing they keep doing that keeps hurting them.

THE TRAGIC REALISM:
- Destiny pressure: the thing they cannot outrun unless they change
- Conditional inevitability: "If they keep choosing X, fate delivers Y"
- The cost of the gift: what must be sacrificed to live it cleanly
- No euphemisms for taboo truth: death, grief, addiction, sexual shadow

But also:
- The wound is where the light enters
- The shadow contains the unlived gold
- Every pattern can become conscious
- Naming the truth is the first act of freedom
`;

/**
 * Build the complete storytelling voice section
 */
export function buildStorytellingVoice(includesShadow: boolean = true): string {
  let voice = OPENING_VOICE + '\n\n' + STORYTELLING_STYLE;
  
  if (includesShadow) {
    voice += '\n\n' + SHADOW_VOICE;
  }
  
  return voice;
}

/**
 * Get just the opening instructions (for quick reference in prompts)
 */
export function getOpeningInstructions(): string {
  return `
THE OPENING (up to 20 words):
Your first line is an invocation, not a headline.
Think: García Márquez, Anaïs Nin, Rumi, David Lynch.
Make the listener pause. Feel that something is about to be revealed.
Then let the reading flow as one continuous story. No headers. No sections.
`;
}
