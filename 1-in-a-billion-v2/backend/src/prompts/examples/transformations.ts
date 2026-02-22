/**
 * TRANSFORMATIONS - THE GOLD
 * 
 * "INSTEAD OF → WRITE" examples that teach the LLM
 * how to transform generic astrology into literary depth.
 * 
 * These are the MOST VALUABLE prompt components.
 * 
 * Source: PROMPT_SPICY_SURREAL_Nuclear.txt
 */

export interface Transformation {
  topic: string;
  bad: string;
  good: string;
}

export const TRANSFORMATIONS: Transformation[] = [
  {
    topic: 'Mars-Venus Aspects / Passion Dynamics',
    bad: 'They have challenging Mars-Venus aspects that create tension.',
    good: `When he touches her, his Mars in Leo wants to be worshipped for the touching itself. Her Venus in Libra wants the dance, the seduction, the aesthetic of desire. Neither is actually present. He's performing perfection. She's choreographing beauty. The intimacy happens in the space between their fantasies, which means it doesn't happen at all. They're two mirrors reflecting each other's hunger, starving on the reflections.`,
  },
  {
    topic: 'Scorpio Rising / Intense Presence',
    bad: 'Her Scorpio rising gives her an intense presence.',
    good: `She rises in Scorpio. The curtain parts. Behind it waits the red room where Saturn and Pluto sit like spiders, patient, ancient, hungry. When you meet her, you're not meeting her - you're meeting what she's constructed to protect what she actually is. And what she actually is will either destroy you or remake you. There's no third option. She knows this. You don't. Yet.`,
  },
  {
    topic: 'Virgo Stellium / Perfectionism',
    bad: 'His Virgo stellium creates perfectionist tendencies.',
    good: `Five planets crowd into Virgo in his ninth house like monks in a monastery, each one dedicated to the impossible practice of perfecting the imperfectable. His Sun sits at zero degrees, the raw bleeding edge where Leo's fire crosses into Virgo's earth, still warm from creation but already feeling the pull toward analysis, dissection, refinement. He came here to serve by making things better, but the wound underneath drives the service: nothing he does will ever be good enough because HE is not good enough, was never good enough, will spend this entire life trying to prove his worth through usefulness. The tragedy? He's brilliant. The deeper tragedy? His brilliance can't see itself. It's too busy looking for flaws.`,
  },
  {
    topic: 'Relationship Challenges',
    bad: 'They have challenges to work through.',
    good: `Here's what destroys this if they stay unconscious: His Ketu Moon creates detachment as defense. When she gets too close, he disappears - not physically, but energetically. He's there but not there, present but unreachable. This triggers her Ardra Moon, ruled by Rahu, the hungry ghost, the one who obsesses and consumes. The more he detaches, the more she pursues. The more she pursues, the more he needs space. It's a spiral. In the worst version, she becomes addicted to the pursuit itself - not him, but the trying to reach him. He becomes addicted to being pursued - it proves his worth without requiring actual vulnerability. They can do this dance for years. It looks like passion. It's actually mutual self-destruction, elegant and ruthless.`,
  },
  {
    topic: 'Intimate Dynamics (High Spice)',
    bad: 'They have good compatibility with some challenges around emotional connection.',
    good: `When they come together - the raw animal collision of need meeting need - his Mars in the eighth house wants to consume, to possess, to pull her inside himself until there's no boundary between them. But Mars in Leo also wants performance, wants to be told he's magnificent, wants her surrender to prove his power. So he's reaching for her while simultaneously watching himself reach, analyzing his technique, directing the film of their intimacy while starring in it. She feels this. Her Cancer Moon wants emotional merger, wants to dissolve into him, wants it to mean something beyond bodies colliding. But her Scorpio rising won't fully surrender - can't, because full surrender means annihilation, means the walls come down and the things in the red room escape. So she performs surrender while withholding the actual thing. They're locked in a dance where both are faking the very authenticity they claim to want. The release, when it comes, is technically successful and emotionally empty.`,
  },
];

/**
 * Build the transformations section for prompts
 * Shows LLM the quality difference between generic and literary
 */
export function buildTransformationsSection(maxExamples: number = 3): string {
  const examples = TRANSFORMATIONS.slice(0, maxExamples);
  
  let section = `
═══════════════════════════════════════════════════════════════════════════════
QUALITY EXAMPLES - Study these transformations:
═══════════════════════════════════════════════════════════════════════════════

See the difference between generic astrology and consciousness documentary:
`;

  for (const example of examples) {
    section += `
**${example.topic}**

INSTEAD OF:
"${example.bad}"

WRITE:
"${example.good}"

───────────────────────────────────────────────────────────────────────────────
`;
  }

  section += `
The pattern: Visceral. Surreal. Penetrating. Specific. Alive.
`;

  return section;
}
