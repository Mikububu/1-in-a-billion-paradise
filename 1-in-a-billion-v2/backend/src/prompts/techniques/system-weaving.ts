/**
 * SYSTEM WEAVING TECHNIQUE
 * 
 * Instructions for synthesizing 5 systems into ONE narrative.
 * Critical for Nuclear Package readings.
 * 
 * Source: PROMPT_SPICY_SURREAL_Nuclear.txt (THE GOLD)
 */

export const SYSTEM_WEAVING_INSTRUCTIONS = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM WEAVING TECHNIQUE - CRITICAL FOR NUCLEAR
═══════════════════════════════════════════════════════════════════════════════

DO NOT write sections like:
"In Western astrology, his Sun is Virgo. In Vedic astrology, his Sun is Leo. In Gene Keys, it's the 16th key."

This is LISTING. We want WEAVING.

INSTEAD, synthesize like this:

"He's born as the Sun crosses from Leo into Virgo at zero degrees, that razor 
edge between fire and earth, creation and analysis. Western astrology sees him 
at the beginning of Virgo. Vedic astrology, accounting for the slow wobble of 
Earth's axis, places him at seven degrees Leo still - the king's throne, the 
performer's stage. Both are true simultaneously, which creates a specific 
torture: he wants to create and be celebrated for creating (Leo), but his own 
critical eye won't let him enjoy anything he makes (Virgo).

The Gene Keys system calls this position the sixteenth frequency - Versatility 
in the gift state, Indifference in shadow, Mastery in the siddhi. He's a 
Renaissance human who trusts none of his talents because he has too many. 
Human Design sees him as a Generator with a defined Sacral, meant to wait and 
respond to life rather than initiate. But his Virgo nature wants to plan, to 
prepare, to make things happen through analysis and effort. Kabbalah connects 
his solar energy to Hod, the Sephirah of form and intellect and communication.

Five different systems, five angles on the same consciousness, all pointing to 
one truth: he came here to refine multiplicity into excellence, but the 
mechanism that drives the refinement is the wound that says he's not enough."

See the pattern?
- One placement explored through multiple lenses
- Systems WOVEN into narrative, not listed
- Each system adds a layer of understanding
- All systems point to ONE TRUTH about the person

THE GOAL: Make it feel like five witnesses describing the same crime scene 
from different angles, building a complete picture through convergence.
`;

export const SYSTEM_WEAVING_EXAMPLE_RELATIONSHIP = `
RELATIONSHIP WEAVING EXAMPLE:

"So when these two meet - if they meet - what's actually meeting?

His need to perfect through multiplicity meets her need to transform through 
intensity. His detachment meets her obsession. His analysis meets her direct 
knowing. His earth meets her fire.

Western astrology calls this a square aspect, ninety degrees of friction. 
Vedic astrology sees karmic work, old souls with unfinished business. Gene 
Keys sees shadow activation potential and gift cooperation possibility. Human 
Design sees mechanical incompatibility that requires extra awareness. Kabbalah 
sees Hod meeting Geburah, form meeting severity, communication meeting 
transformation.

Every system agrees: this is not comfortable. This is not easy. This is 
alchemical - meaning it involves fire, dissolution, and the death of who 
they were before they met."

ALL FIVE SYSTEMS SPEAK TO THE SAME TRUTH - that's weaving.
`;

/**
 * Build the system weaving instructions section
 */
export function buildSystemWeavingSection(): string {
  return `
${SYSTEM_WEAVING_INSTRUCTIONS}

${SYSTEM_WEAVING_EXAMPLE_RELATIONSHIP}
`;
}
