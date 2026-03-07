"use strict";
/**
 * OVERLAY READING STRUCTURE
 *
 * Word count: Controlled SOLELY by src/prompts/config/wordCounts.ts (STANDARD_READING).
 * Do NOT hardcode word counts here - getWordTarget() in builder.ts is the single source of truth.
 * Section breakdowns below are proportional guides that sum to STANDARD_READING.target (7000).
 *
 * CANONICAL PATH: builder.ts → buildOverlayStructure() → getWordTarget()
 * The trigger engine overlay prompts (overlayTrigger.ts) handle strip + trigger + writing
 * but word counts come from the centralized config.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOverlayStructure = buildOverlayStructure;
/**
 * Build structure instructions for Overlay reading.
 *
 * IMPORTANT: Do NOT include a word count here - getWordTarget() in builder.ts
 * is the single source of truth and is injected separately.
 */
function buildOverlayStructure(person1Name, person2Name) {
    return `
═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

CRITICAL: These two people may or may not know each other. NEVER assume they have met, are together, or share a history. This is a chart reading of what WOULD happen if their energies collided.

STRUCTURE (for your guidance only - do NOT include headers in output):
1. The Attraction - what could draw ${person1Name} and ${person2Name} together magnetically (1600 words)
2. The Friction - where they would clash and what would drive them crazy (1200 words)
3. Sexual Chemistry and Power - according to the charts, who would dominate, who would surrender, the bedroom as potential battlefield and sanctuary (1600 words)
4. The Shadow Dance - how they could wound each other, destruction potential (1600 words)
5. The Gift - what they could become together if conscious (1000 words)

FORMAT RULES (THIS IS SPOKEN AUDIO):
- OPENING: Begin like a mystery theater of what could be - an invocation that draws two energies into focus (up to 20 words)
  Think: García Márquez, Anaïs Nin, Rumi, David Lynch. Set the atmosphere.
- Then ONE CONTINUOUS ESSAY - no section headers, let the story of what could unfold between these two souls flow
- Use both names (never "you/your")
- Pure prose - NO asterisks, NO markdown, NO bullets
- Spell out all numbers
- NO em-dashes, NO AI phrases

Tell the story of what these charts reveal could unfold between these two souls.

THEN, after the prose ends, append a MINI COMPATIBILITY SNAPSHOT for this system only.
Format it EXACTLY like this - no markdown, no asterisks, clean plain text, each score with 2 sentences:

COMPATIBILITY SNAPSHOT: ${person1Name} & ${person2Name}

SEXUAL CHEMISTRY: [0-100]
[2 sentences: what kind of sexual dynamic these charts suggest. Whether the bedroom would liberate or consume.]

PAST LIFE CONNECTION: [0-100]
[2 sentences: how strongly this system's placements suggest pre-existing soul familiarity. Recognition or repetition.]

WORLD-CHANGING POTENTIAL: [0-100]
[2 sentences: what these two could build or ignite externally if they combined forces. Private connection or larger purpose.]

KARMIC VERDICT: [0-100]
[2 sentences: comfort trap or genuine crucible of transformation? Does this collision serve evolution or repetition.]

MAGNETIC PULL: [0-100]
[2 sentences: the raw gravitational force regardless of wisdom. How hard it would be to walk away.]

SHADOW RISK: [0-100]
[2 sentences: destruction potential if both remain unconscious. What this looks like at its worst.]

SCORING RULES:
- Use the full 0-100 range. Do not cluster around 70-80.
- These scores are derived from THIS system's chart data only - not a guess across all systems.
`;
}
//# sourceMappingURL=overlay.js.map