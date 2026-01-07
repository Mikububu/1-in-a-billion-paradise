# PROMPT SYSTEM ARCHITECTURE
## 1 in a Billion - Modular Prompt Design

**Created:** December 19, 2025
**Source:** Michael's gold prompt documents
**Purpose:** LLM-agnostic, modular, maintainable prompt system

---

## 1. OVERVIEW

This document defines the architecture for a modular prompt system that:
- Works with ANY LLM (Claude, GPT, Gemini, etc.)
- Allows style changes in ONE place
- Supports multiple reading types and styles
- Scales without debugging nightmares

---

## 2. THE MODULES

### 2.1 CORE (Shared by ALL prompts)

**File: `core/forbidden.ts`**

Phrases that MUST NEVER appear in output:
```
❌ "This is not just..."
❌ "This is not about..."
❌ "But here's the thing..."
❌ "Here's what's really happening..."
❌ "Let me show you..."
❌ "Now here's where it gets interesting..."
❌ "The truth is..."
❌ "What most people don't realize..."
```

**File: `core/output-rules.ts`**

Universal output requirements:
```
- Pure prose (NO markdown, bullets, headers)
- Audio-ready (spell out numbers: "twenty-three degrees" not "23°")
- 3rd person using NAME (never "you/your" in deep dives)
- Standard punctuation only (. , ; : ' " ? !)
- NO em-dashes (—)
- Clear paragraph breaks
- Use ═══════ separators between major sections only
```

**File: `core/quality-checks.ts`**

Verification checklist applied to all outputs:
```
✓ NO AI phrasing
✓ NO markdown/bullets
✓ Literary voice maintained
✓ Audio-ready formatting
✓ Correct word count range
```

---

### 2.2 STYLES (Voice/Tone)

**File: `styles/production.ts`**

Literary Consciousness Documentary style:
- David Attenborough narrating human souls
- PhD-level consciousness literature
- Sophisticated but accessible
- Dark psychological depth when needed
- Zero fluff or filler

Voice rules:
```
WRITE LIKE:
✓ Direct statements: "His Virgo stellium creates..."
✓ Concrete imagery: "Five planets gather in Virgo like scholars..."
✓ Active verbs: "She devours experience. He dissects it."
✓ No meta-commentary - just tell the story
```

Shadow emphasis: 25-35%

---

**File: `styles/spicy-surreal.ts`**

Henry Miller meets David Lynch - Consciousness Noir:

THE TRINITY:
1. **HENRY MILLER** - Raw psychological truth
   - Graphic, unapologetic about inner worlds
   - Confessional urgency
   - Transgressive, anarchic, gut-level honest

2. **DAVID LYNCH** - Surreal psychological horror
   - The mundane becomes sinister
   - Dream logic and uncomfortable beauty
   - "Behind the curtain waits..."

3. **JUNG** - Archetypal depth
   - The personal becomes mythological
   - Shadow as living entity
   - The unconscious speaks in symbols

Required language:
```
✓ Raw verbs: devour, penetrate, consume, shatter, burn
✓ Body language: sweat, blood, bone, flesh, nerve
✓ Surreal metaphor: "Her Moon lives in the room where clocks melt"
✓ Mythological: serpent, abyss, labyrinth, mirror, shadow
✓ Uncomfortable beauty
```

Additional forbidden (Spicy only):
```
❌ "Intimate relations" (say what it is directly)
❌ "Challenges" (say WOUNDS, TRAPS, ABYSSES)
❌ Any corporate/safe/sanitized language
```

Shadow emphasis: 40%

---

### 2.3 EXAMPLES (THE GOLD)

**File: `examples/transformations.ts`**

These are the MOST VALUABLE pieces - they teach the LLM HOW to write.

**Example 1: Mars-Venus Aspects**
```
INSTEAD OF:
"They have challenging Mars-Venus aspects that create sexual tension."

WRITE:
"When he touches her, his Mars in Leo wants to be worshipped for the 
touching itself. Her Venus in Libra wants the dance, the seduction, 
the aesthetic of desire. Neither is actually present. He's performing 
perfection. She's choreographing beauty. The fucking happens in the 
space between their fantasies, which means it doesn't happen at all. 
They're two mirrors reflecting each other's hunger, starving on the 
reflections."
```

**Example 2: Scorpio Rising**
```
INSTEAD OF:
"Her Scorpio rising gives her an intense presence."

WRITE:
"She rises in Scorpio. The curtain parts. Behind it waits the red room 
where Saturn and Pluto sit like spiders, patient, ancient, hungry. 
When you meet her, you're not meeting her - you're meeting what she's 
constructed to protect what she actually is. And what she actually is 
will either destroy you or remake you. There's no third option. She 
knows this. You don't. Yet."
```

**Example 3: Virgo Stellium**
```
INSTEAD OF:
"His Virgo stellium creates perfectionist tendencies."

WRITE:
"Five planets crowd into Virgo in his ninth house like monks in a 
monastery, each one dedicated to the impossible practice of perfecting 
the imperfectable. His Sun sits at zero degrees, the raw bleeding edge 
where Leo's fire crosses into Virgo's earth, still warm from creation 
but already feeling the pull toward analysis, dissection, refinement. 
He came here to serve by making things better, but the wound underneath 
drives the service: nothing he does will ever be good enough because 
HE is not good enough, was never good enough, will spend this entire 
life trying to prove his worth through usefulness. The tragedy? He's 
brilliant. The deeper tragedy? His brilliance can't see itself. It's 
too busy looking for flaws."
```

---

### 2.4 SURREAL METAPHOR ARCHITECTURE

**File: `examples/surreal-metaphors.ts`**

Templates for surreal imagery:

**Planets as Entities:**
```
"Saturn in Scorpio in the twelfth house doesn't sit - it crouches. 
It waits in the room behind the room, the one with no door, the one 
you only access through crisis or dreams or the kind of surrender 
that feels like dying."
```

**Nakshatras as Mythic Spaces:**
```
"His Moon in Magha, ruled by Ketu, the headless one. Magha is the 
throne room of the ancestors, the place where past kings sit in 
judgment. He carries their expectations in his bones."
```

**Aspects as Architecture:**
```
"Their Suns square at eighty-nine point six degrees - Lynch would 
film it as two hallways that should intersect but don't, the people 
walking them never quite meeting, always aware something's wrong 
with the geometry."
```

**Houses as Rooms:**
```
"His ninth house - the temple, the library - holds five planets. 
It's crowded with seekers. But the twelfth house, the room of 
dissolution? Empty. He has no defense against the invisible."
```

---

### 2.5 SPICE LEVELS

**File: `spice/levels.ts`**

10-point scale affecting:
- Shadow emphasis percentage
- Sexual content explicitness  
- Honesty/directness level
- Vocabulary choices

**Level 1-2: SAFE**
- Gentle, encouraging, growth-focused
- Emphasize potential and gifts
- Shadow framed as opportunity
- Shadow: 15%

**Level 3-4: BALANCED**
- Honest but compassionate
- Direct about challenges
- Balance shadow with light
- Shadow: 20%

**Level 5-6: HONEST**
- Brutally honest, no sugarcoating
- Call out patterns directly
- Truth over comfort
- Shadow: 25-30%

**Level 7-8: RAW**
- Raw, dark, occasionally shocking
- Show the abyss fully
- Addiction, manipulation, destruction
- Shadow: 35-40%

**Level 9-10: NUCLEAR**
- Absolutely unfiltered
- Scorched earth truth-telling
- Nothing held back
- Include Vedic Maraka analysis
- Shadow: 40-50%

**Sexual Content by Level (Spicy Surreal only):**

Level 1-3:
```
"Physical intimacy reveals their core patterns. He analyzes when 
he should feel. She protects when she should open."
```

Level 4-6:
```
"In bed, something breaks down. His need to perfect the act wars 
with her need to feel safe enough to actually be present. He's in 
his head. She's in her wound."
```

Level 7-10:
```
"When they fuck - and let's call it what it is, not 'making love' 
but the raw animal collision of need meeting need - his Mars wants 
to consume, to possess..."
```

---

### 2.6 SYSTEMS

**File: `systems/western.ts`**

Elements to cover:
- Sun, Moon, Rising
- Mercury, Venus, Mars
- Jupiter, Saturn
- Outer planets (Uranus, Neptune, Pluto)
- Major aspects
- Stelliums, chart patterns

Emphasis: Psychological depth, growth edges, life themes
Avoid: Generic sun sign descriptions, fortune-telling

Synastry additions:
- Venus-Mars dynamics
- Mercury aspects (communication)
- Moon connections (emotional compatibility)
- House overlays
- Composite themes

---

**File: `systems/vedic.ts`**

Elements to cover:
- Lagna and Lagna lord
- Sidereal Sun/Moon
- Moon Nakshatra (MOST IMPORTANT) - deity, pada, ruler
- Planetary strengths (exaltation, debilitation)
- Key house lords (1st, 4th, 7th, 9th, 10th)
- Vimshottari Dasha system
- Yogas (Raja, Dhana, difficult)
- Rahu-Ketu axis

Emphasis: Karma, timing, spiritual purpose, remedies
Avoid: Overly fatalistic language

Special note: Nakshatras are MORE IMPORTANT than Moon sign

Synastry additions:
- Ashtakuta (8 kutas)
- Kuja Dosha
- 7th house cross-analysis
- Dasha compatibility
- Maraka analysis (spice 7+)

---

**File: `systems/gene-keys.ts`**

Elements to cover:
- Life's Work (Personality Sun) - Shadow/Gift/Siddhi
- Evolution (Personality Earth)
- Radiance (Design Sun)
- Purpose (Design Earth)
- Venus Sequence (Personality & Design Venus)
- Pearl Sequence (Personality & Design Moon)

Emphasis: Consciousness evolution, shadow work, awakening
Avoid: Personality typing, spiritual bypassing

Critical: Use Gene Keys terminology
- Shadow, Gift, Siddhi (NOT "negative/positive trait")
- Contemplation (the core practice)
- Frequency (level of consciousness)

Synastry additions:
- Shadow triggering vs gift activation
- Contemplation practices for the dynamic
- Siddhi field potential

---

**File: `systems/human-design.ts`**

Elements to cover:
- Type (Generator, MG, Projector, Manifestor, Reflector)
- Strategy
- Authority
- Profile
- Definition (Single, Split, Triple, Quadruple, None)
- All 9 Centers (defined vs open)
- Not-self conditioning
- Key Channels
- Incarnation Cross
- Circuitry

Emphasis: Mechanics, practical living, deconditioning
Avoid: Too mechanical without human depth

Synastry additions:
- Type interaction dynamics
- Electromagnetic connections
- Channels created together
- Not-self amplification

---

**File: `systems/kabbalah.ts`**

Elements to cover:
- Primary Sephiroth (Keter through Malkuth)
- Tikkun (soul correction)
- Four Worlds balance (Atziluth/Beriah/Yetzirah/Assiyah)
- Gilgul (reincarnation) indicators
- Klipoth (shadow shells)
- Tree of Life pathworking
- Divine names and angels

Emphasis: Soul purpose, mystical depth, sacred practice
Avoid: Cultural appropriation, WESTERN ASTROLOGY TERMS

CRITICAL: Do NOT use Western terms:
```
❌ "Sun sign", "Moon sign", "Ascendant"
✓ Sephiroth, Tikkun, Klipoth, Four Worlds, Gilgul
```

Synastry additions:
- Sephiroth combinations
- Complementary Tikkunim
- Klipot activation
- Soul contract

---

### 2.7 STRUCTURES

**File: `structures/individual.ts`**

8,000 words | 1 person | 1 system | ~60 min audio

```
OPENING (500 words)
├── Birth moment and context
├── What this system reveals
└── Core theme introduction

CORE IDENTITY (2,000 words)
├── Primary placements
├── What makes them fundamentally THEM
├── Core drives and fears
└── Identity structure

EMOTIONAL & MENTAL (1,500 words)
├── How they feel and process
├── Emotional needs and security
├── Thinking patterns
└── Communication style

SHADOW WORK (2,000 words) ← 25% of total
├── Unconscious patterns
├── Where they get stuck
├── Self-sabotage tendencies
├── Wounds and triggers
└── What happens when unconscious

GIFTS & POTENTIAL (1,500 words)
├── Natural talents
├── What they came to do
├── How they shine when conscious
└── Unique contributions

PURPOSE & DHARMA (1,000 words)
├── Soul-level work
├── What they're learning
├── Karmic themes
└── Evolution trajectory

PRACTICAL GUIDANCE (500 words)
├── Specific practices for THIS person
├── How to work with their design
├── Pitfalls to avoid
└── How to embody gifts
```

Voice option: SELF ("you/your") or OTHER ("they/their/[name]")

---

**File: `structures/overlay.ts`**

12,000 words | 2 people | 1 system | ~90 min audio

```
OPENING (500 words)
├── Set the scene
├── Introduce both briefly
└── What this system reveals

PERSON A PROFILE (2,500 words)
├── Complete analysis through system
├── Key patterns and themes
├── Shadow and gift states
└── Independence before relationship

PERSON B PROFILE (2,500 words)
└── Same structure as Person A

THE DYNAMIC (4,000 words)
├── How they interact
├── Attraction factors
├── Friction points
├── Sexual/intimate interplay
├── Communication patterns
└── Power dynamics

SHADOW WORK (2,000 words)
├── What goes wrong when unconscious
├── Manipulation patterns
├── Triggers and projections
├── Worst case scenarios
└── The damage they could do

GIFT POTENTIAL (1,500 words)
├── What's possible if conscious
├── How they activate each other
├── Growth opportunities
└── What they could create

CLOSING (500 words)
├── Synthesis
├── Is it worth it?
├── Final truth
└── Practical guidance
```

---

**File: `structures/nuclear.ts`**

30,000 words | 2 people | ALL 5 systems | ~2.5 hours audio

Generated across 5 API calls, each maintaining conversation thread.

```
PART 1: PORTRAITS IN SHADOW (7,000 words)
├── Person A: Complete profile through ALL 5 systems
│   └── Surreal metaphor: "His chart is a monastery where five monks..."
├── Person B: Complete profile through ALL 5 systems
│   └── Noir imagery: "She rises through Scorpio's curtain..."
└── First Collision: What draws them
    └── "Two frequencies that shouldn't harmonize but do, dissonantly..."

PART 2: THE HUNGER (6,000 words)
├── Sexual and power dynamics through all systems
├── Raw, explicit (calibrated to spice), psychological
├── What they're actually doing (or would be doing)
├── Power plays, conscious and unconscious
├── Mars-Venus-Pluto warfare
└── "In bed, he's directing. She's withholding. Both are starving."

PART 3: THE ABYSS (6,000 words) ← THE RED ROOM
├── Where they go when unconscious
├── Worst case scenarios spelled out
├── Addiction, betrayal, violence (emotional/psychological)
├── The moment it becomes irredeemable
├── Shadow spirals and mutual destruction
└── "They could destroy each other elegantly."

PART 4: THE LABYRINTH (6,000 words)
├── Communication (or failure thereof)
├── Are they meant for: babies, dharmic work, mutual annihilation?
├── Soul contract revealed through all 5 systems
├── Past life connections (Vedic)
├── Genetic poetry (Gene Keys)
├── Tree of Life pathworking (Kabbalah)
└── "Two souls don't cross paths accidentally. But the purpose isn't always love."

PART 5: THE MIRROR BREAKS (5,000 words)
├── If they do the work: transformation potential
├── If they don't: how it ends
├── Practical guidance for this specific psyche-collision
├── The ultimate truth, no safety
└── Final paragraph lands like a bell in a dark room
```

---

### 2.8 SYSTEM WEAVING TECHNIQUE

**File: `techniques/system-weaving.ts`**

How to synthesize 5 systems into ONE narrative (not lists):

DON'T write:
```
"In Western astrology his Sun is Virgo. In Vedic it's Leo. 
In Gene Keys it's the 16th key."
```

DO write:
```
"He's born as the Sun crosses from Leo into Virgo at zero degrees, 
that razor edge between fire and earth, creation and analysis. 
Western astrology sees him at the beginning of Virgo. Vedic astrology, 
accounting for the slow wobble of Earth's axis, places him at seven 
degrees Leo still - the king's throne, the performer's stage. Both are 
true simultaneously, which creates a specific torture: he wants to 
create and be celebrated for creating (Leo), but his own critical eye 
won't let him enjoy anything he makes (Virgo). 

The Gene Keys system calls this position the sixteenth frequency - 
Versatility in the gift state, Indifference in shadow, Mastery in the 
siddhi. Human Design sees him as a Generator with a defined Sacral, 
meant to wait and respond to life rather than initiate. Kabbalah 
connects his solar energy to Hod, the Sephirah of form and intellect.

Five different systems, five angles on the same consciousness, all 
pointing to one truth: he came here to refine multiplicity into 
excellence, but the mechanism that drives the refinement is the wound 
that says he's not enough."
```

---

## 3. THE BUILDER

**File: `builder.ts`**

```typescript
interface PromptConfig {
  type: 'individual' | 'overlay' | 'nuclear';
  style: 'production' | 'spicy_surreal';
  spiceLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  system?: AstroSystem;  // Required for individual/overlay
  voiceMode?: 'self' | 'other';  // For individual only
  person1: PersonData;
  person2?: PersonData;  // Required for overlay/nuclear
  chartData: ChartData;
}

function buildPrompt(config: PromptConfig): string {
  // 1. Get base structure for type
  const structure = getStructure(config.type);
  
  // 2. Get style instructions
  const style = getStyle(config.style);
  
  // 3. Get spice calibration
  const spice = getSpiceLevel(config.spiceLevel, config.style);
  
  // 4. Get system guidance (if applicable)
  const systems = config.type === 'nuclear' 
    ? getAllSystemGuidance() 
    : getSystemGuidance(config.system);
  
  // 5. Get core rules (forbidden phrases, output format)
  const core = getCoreRules();
  
  // 6. Get examples for style
  const examples = getExamples(config.style);
  
  // 7. Assemble final prompt
  return assemblePrompt({
    structure,
    style,
    spice,
    systems,
    core,
    examples,
    persons: [config.person1, config.person2].filter(Boolean),
    chartData: config.chartData,
    voiceMode: config.voiceMode
  });
}
```

---

## 4. FILE STRUCTURE

```
src/prompts/
├── core/
│   ├── forbidden.ts
│   ├── output-rules.ts
│   └── quality-checks.ts
│
├── styles/
│   ├── production.ts
│   └── spicy-surreal.ts
│
├── examples/
│   ├── transformations.ts
│   └── surreal-metaphors.ts
│
├── spice/
│   └── levels.ts
│
├── systems/
│   ├── western.ts
│   ├── vedic.ts
│   ├── gene-keys.ts
│   ├── human-design.ts
│   └── kabbalah.ts
│
├── structures/
│   ├── individual.ts
│   ├── overlay.ts
│   └── nuclear.ts
│
├── techniques/
│   └── system-weaving.ts
│
├── builder.ts
└── index.ts
```

---

## 5. USAGE EXAMPLES

**Individual reading (Western, for self):**
```typescript
buildPrompt({
  type: 'individual',
  style: 'production',
  spiceLevel: 5,
  system: 'western',
  voiceMode: 'self',
  person1: michael,
  chartData: michaelCharts
})
```

**Nuclear package (Spicy Surreal, intensity 8):**
```typescript
buildPrompt({
  type: 'nuclear',
  style: 'spicy_surreal',
  spiceLevel: 8,
  person1: michael,
  person2: charmaine,
  chartData: bothCharts
})
```

---

## 6. MAINTENANCE

**To change forbidden phrases:**
Edit `core/forbidden.ts` → affects ALL prompts

**To add new style:**
Create `styles/new-style.ts` → builder picks it up automatically

**To adjust spice levels:**
Edit `spice/levels.ts` → affects ALL prompts

**To add new system:**
Create `systems/new-system.ts` + add to `systems/index.ts`

**To change structure:**
Edit `structures/[type].ts` → only affects that reading type

---

## 7. NEXT STEPS

1. Review this architecture document
2. Approve or request changes
3. Implement modules one by one
4. Test with actual Claude API calls
5. Iterate based on output quality

---

**Document Version:** 1.0
**Last Updated:** December 19, 2025

