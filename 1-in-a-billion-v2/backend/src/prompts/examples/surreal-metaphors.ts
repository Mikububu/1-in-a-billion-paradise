/**
 * SURREAL METAPHOR ARCHITECTURE
 * 
 * Templates for weaving surreal imagery throughout readings.
 * These teach the LLM the David Lynch visual language.
 * 
 * Source: PROMPT_SPICY_SURREAL_Nuclear.txt
 */

export interface MetaphorTemplate {
  category: string;
  description: string;
  example: string;
}

export const SURREAL_METAPHORS: MetaphorTemplate[] = [
  {
    category: 'Planets as Entities',
    description: 'Planets are not positions but living entities with personality and agenda',
    example: `Saturn in Scorpio in the twelfth house doesn't sit - it crouches. It waits in the room behind the room, the one with no door, the one you only access through crisis or dreams or the kind of surrender that feels like dying. It's been waiting since before she was born. It knows her. She doesn't know it yet.`,
  },
  {
    category: 'Nakshatras as Mythic Spaces',
    description: 'Nakshatras are not stars but rooms in a cosmic mansion',
    example: `His Moon in Magha, ruled by Ketu, the headless one, the one who let go. Magha is the throne room of the ancestors, the place where past kings sit in judgment. He carries their expectations in his bones. They whisper: 'prove you're worthy of the lineage.' He can't hear them consciously. He just feels inadequate without knowing why.`,
  },
  {
    category: 'Aspects as Architecture',
    description: 'Aspects are spatial relationships, hallways that connect or fail to connect',
    example: `Their Suns square at eighty-nine point six degrees - textbook ninety-degree friction, the corner you can't see around, the wall you keep hitting. Lynch would film it as two hallways that should intersect but don't, just miss each other by inches, the people walking them never quite meeting, always aware something's wrong with the geometry.`,
  },
  {
    category: 'Houses as Rooms',
    description: 'The twelve houses are literal rooms in the house of the psyche',
    example: `His ninth house - the temple, the library, the place where humans reach for gods - holds five planets. It's crowded with seekers. But the twelfth house, the room of dissolution, of hidden enemies, of what you can't see coming? Empty. He has no defense against the invisible. She, meanwhile, has Saturn and Pluto in the twelfth. She LIVES in the room he doesn't know exists. When she enters his life, she's entering from a place he has no map for.`,
  },
  {
    category: 'Signs as Territories',
    description: 'Signs are landscapes with specific weather and terrain',
    example: `Scorpio is not a sign but a country. The border crossing is guarded by something that checks your willingness to die. Most people turn back. She was born there. She knows the language of the dark, the currency of transformation, the rules for navigating the underworld. He's a tourist who thinks he wants to visit.`,
  },
  {
    category: 'The Red Room',
    description: 'The space where unconscious forces gather - pure Lynch',
    example: `Behind every chart there's a red room. The curtains are always moving though there's no wind. Something sits in the corner that you sense but can't see directly. This is where the shadow negotiations happen, where the parts of yourself you've exiled hold their meetings. Her chart has a door directly into this room. His chart pretends it doesn't exist.`,
  },
];

/**
 * Build the surreal metaphor instructions section
 */
export function buildSurrealMetaphorsSection(): string {
  let section = `
═══════════════════════════════════════════════════════════════════════════════
SURREAL METAPHOR ARCHITECTURE
═══════════════════════════════════════════════════════════════════════════════

Weave surreal imagery throughout. Make the abstract viscerally real:
`;

  for (const metaphor of SURREAL_METAPHORS) {
    section += `
**${metaphor.category}:**
${metaphor.description}

Example:
"${metaphor.example}"

`;
  }

  section += `
The goal: Make astrological positions feel like PLACES you could walk through, 
ENTITIES you could meet, ARCHITECTURE you could get lost in.
`;

  return section;
}
