/**
 * HUMAN DESIGN SYSTEM GUIDANCE
 * 
 * Expert instructions for Human Design analysis.
 * 
 * Source: Michael's gold prompt documents
 */

export const HUMAN_DESIGN_SYSTEM = {
  name: 'Human Design',
  
  individualCoverage: `
HUMAN DESIGN - INDIVIDUAL ANALYSIS:

Cover these elements in depth:

TYPE (The fundamental operating system):
- Generator (70%): Built to respond, satisfaction/frustration
- Manifesting Generator: Respond + inform, multi-passionate
- Projector (20%): Wait for invitation, success/bitterness
- Manifestor (9%): Inform then act, peace/anger
- Reflector (1%): Lunar cycle, surprise/disappointment

STRATEGY (How to engage with life correctly):
- Generator/MG: Wait to respond
- Projector: Wait for recognition and invitation
- Manifestor: Inform before acting
- Reflector: Wait a lunar cycle for major decisions

AUTHORITY (Decision-making mechanism):
- Emotional: Wait for clarity through the wave
- Sacral: Gut response (uh-huh or uhn-uhn)
- Splenic: Instant intuitive knowing
- Ego: Willpower and heart truth
- Self-Projected: Speak to hear truth
- Mental/Environmental: External sounding board
- Lunar: Full moon cycle

PROFILE (Life purpose framework):
- First number: Conscious theme
- Second number: Unconscious theme
- How others perceive them vs how they see themselves

DEFINITION (Energy flow pattern):
- Single: Self-contained, independent
- Split: Needs bridging, seeks completion
- Triple Split: Multiple parts needing connection
- Quadruple Split: Very fixed energy
- No Definition (Reflector): Completely open

ALL 9 CENTERS:
For each center (Head, Ajna, Throat, G, Heart, Sacral, Spleen, Solar Plexus, Root):
- Defined: Consistent energy, can influence others
- Open/Undefined: Amplifies energy, takes in from others
- Not-self conditioning in open centers
- Wisdom potential in open centers

CHANNELS AND GATES:
- Key channels and their life force themes
- Significant gate activations

INCARNATION CROSS:
- Their specific life purpose
- How Sun and Earth positions define the cross

7-YEAR DECONDITIONING:
- What they're unlearning
- How conditioning shows up
`,

  synastryAdditions: `
HUMAN DESIGN SYNASTRY ADDITIONS:

For relationship analysis, also cover:
- Type Interaction Dynamics
  → Generator + Projector: Energy meets guidance
  → Two Generators: Energy amplification
  → Manifestor + anyone: Informing dynamics
  → Reflector: Being influenced by partner's design

- Electromagnetic Connections
  → Where one is defined and other undefined
  → Who overwhelms whom?
  → Where each loses themselves

- Channels and Gates Together
  → Compromise channels (each has one gate)
  → What they create electromagnetically
  → New channels formed together

- Authority Clash/Complement
  → Can they respect each other's decision process?
  → Emotional Authority + Sacral: timing tension

- Not-Self Amplification
  → Which Not-Self themes get triggered?
  → Frustration, bitterness, anger, disappointment patterns

- Signature vs Not-Self States
  → When together, are they in Signature or Not-Self?
  → What pulls them toward correct operation?
`,

  emphasis: 'Mechanics, practical living, deconditioning, correct operation',
  
  avoid: `
AVOID:
- Making it too mechanical without human depth
- Ignoring the living experience of the design
- Treating type as personality instead of energy
- Forgetting the 7-year deconditioning journey
`,

  typeDetails: `
TYPE DETAILS FOR REFERENCE:

GENERATOR (70% of population):
- Defined Sacral center
- Strategy: Wait to respond
- Signature: Satisfaction
- Not-Self: Frustration
- Built to do work they love

MANIFESTING GENERATOR:
- Generator with motor to Throat
- Strategy: Wait to respond, then inform
- Multi-passionate, skipping steps
- Signature: Satisfaction
- Not-Self: Frustration and anger

PROJECTOR (20% of population):
- No Sacral definition
- Strategy: Wait for invitation
- Signature: Success
- Not-Self: Bitterness
- Here to guide, not to do

MANIFESTOR (9% of population):
- Motor connected to Throat (not Sacral)
- Strategy: Inform before acting
- Signature: Peace
- Not-Self: Anger
- Here to initiate impact

REFLECTOR (1% of population):
- No defined centers
- Strategy: Wait lunar cycle (28 days)
- Signature: Surprise
- Not-Self: Disappointment
- Mirrors the health of community
`,
};

/**
 * Build Human Design system guidance section
 */
export function buildHumanDesignSection(isRelationship: boolean): string {
  let section = `
═══════════════════════════════════════════════════════════════════════════════
SYSTEM: ${HUMAN_DESIGN_SYSTEM.name}
═══════════════════════════════════════════════════════════════════════════════

${HUMAN_DESIGN_SYSTEM.individualCoverage}

${HUMAN_DESIGN_SYSTEM.typeDetails}

EMPHASIS: ${HUMAN_DESIGN_SYSTEM.emphasis}

${HUMAN_DESIGN_SYSTEM.avoid}
`;

  if (isRelationship) {
    section += HUMAN_DESIGN_SYSTEM.synastryAdditions;
  }

  return section;
}
