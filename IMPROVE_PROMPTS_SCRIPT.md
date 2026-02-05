# SCRIPT FOR LLM: Fix Individual Reading Prompts

## THE PROBLEM

My app generates astrology readings. Individual readings are only 11-14 minutes when they should be ~30 minutes.

**Root cause:** There are two different prompt builders for what should be the SAME product:

| Builder | Used By | Has Provocations | Word Count |
|---------|---------|------------------|------------|
| `buildPersonPrompt` (paidReadingPrompts.ts) | nuclear_v2 jobs | ✅ YES | 3000 words |
| `buildIndividualPrompt` (builder.ts) | extended, synastry jobs | ❌ NO | 3000 words |

The `buildPersonPrompt` has **PSYCHOLOGICAL PROVOCATIONS** - 9 deep questions that force the LLM to think before writing. This produces richer, longer output.

The `buildIndividualPrompt` is MISSING these provocations, producing thin, short readings.

---

## THE FIX

### 1. Update `src/prompts/config/wordCounts.ts`

Change from 3000 words to 4500 words:

```typescript
export const STANDARD_READING = {
  min: 4200,
  target: 4500,
  max: 4800,
  audioMinutes: '28-32',
};
```

### 2. Update `src/prompts/structures/individual.ts`

Update the structure to 4500 words total:

```typescript
export const INDIVIDUAL_STRUCTURE = {
  name: 'Individual Deep Dive',
  totalWords: 4500, // 1000+1000+1400+600+500 = 4500 words (~30 min audio)
  audioMinutes: '28-32',

  sections: [
    {
      name: 'Who They Fundamentally ARE',
      words: 1000,
      description: 'Core identity, what makes them THEM, primary drives and motivations, the soul beneath the surface',
    },
    {
      name: 'How They Love, Attach, and Relate',
      words: 1000,
      description: 'Emotional patterns, attachment style, what they need from partners, how they show love, intimacy patterns',
    },
    {
      name: 'Shadow - Wounds, Patterns, Self-Sabotage, Sexual Shadow',
      words: 1400,
      description: 'Unconscious patterns, repeating loops, what they avoid, sexual psychology, the abyss, addiction potential',
      isShadow: true,
    },
    {
      name: 'Gifts When Conscious',
      words: 600,
      description: 'Natural talents, how they shine when awake, their superpower, what they become when evolved',
    },
    {
      name: 'How to Love Them - and What Destroys Them',
      words: 500,
      description: 'Practical guidance for partners, triggers, what they need to feel safe, what breaks them',
    },
  ],
};
```

And update `buildIndividualStructure` function to say "4500 WORDS" with updated section word counts.

### 3. Update `src/prompts/builder.ts`

Add these two functions after the imports:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// PSYCHOLOGICAL PROVOCATIONS
// Questions force deep thinking. Instructions force compliance.
// ═══════════════════════════════════════════════════════════════════════════

function getProvocationIntensity(spiceLevel: number): {
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

function buildPersonProvocations(personName: string, spiceLevel: number): string {
  const base = `
BEFORE YOU WRITE, CONTEMPLATE THESE ABOUT ${personName.toUpperCase()}:

FEAR & SHADOW:
1. What is ${personName} actually terrified of - the fear they've never admitted?
2. What do they do to avoid feeling that terror? What patterns numb it?
3. What loop have they repeated in every relationship, and why can't they stop?
`;

  const sex = spiceLevel >= 4 ? `
SEX & DESIRE:
4. What does ${personName} need sexually that they've never asked for?
5. What hunger lives in them that they hide - maybe even from themselves?
6. Does their sexuality lead toward liberation or destruction?
7. What would their sex life reveal about their psychology?
` : `
LONGING & DESIRE:
4. What does ${personName} secretly long for that they'd never admit?
5. What need have they buried so deep they've forgotten it exists?
`;

  const truth = `
TRUTH & SACRIFICE:
8. What truth about ${personName} would make them weep if spoken aloud?
9. What must they sacrifice to become who they were born to be?

YOUR TASK: Tell ${personName}'s story. Not the chart - the PERSON inside the chart.
`;

  return `${base}${sex}${truth}`;
}
```

Then update `buildIndividualPrompt` to include the provocations. Add after the title block:

```typescript
═══════════════════════════════════════════════════════════════════════════════
PSYCHOLOGICAL PROVOCATIONS - THINK BEFORE YOU WRITE
═══════════════════════════════════════════════════════════════════════════════

${buildPersonProvocations(person.name, spiceLevel)}

═══════════════════════════════════════════════════════════════════════════════
STYLE & INTENSITY
═══════════════════════════════════════════════════════════════════════════════

SPICE LEVEL: ${spiceLevel}/10
SHADOW PERCENTAGE: ${intensity.shadowPercentage}%
SEX EXPLICITNESS: ${intensity.sexExplicitness}
HONESTY LEVEL: ${intensity.honestyLevel}
```

---

## FILES TO MODIFY

1. `src/prompts/config/wordCounts.ts` - Change 3000 → 4500
2. `src/prompts/structures/individual.ts` - Update structure and word counts
3. `src/prompts/builder.ts` - Add provocations functions and update buildIndividualPrompt

---

## WHY THIS WORKS

1. **PROVOCATIONS force deep thinking** - The 9 questions make the LLM contemplate before writing, producing richer content
2. **4500 words = ~30 minutes** - Explicit word count target gives the length we need
3. **INTENSITY calibration** - Shadow %, sex explicitness, and honesty level are explicit
4. **Consistent product** - Now `extended`, `synastry`, and `nuclear_v2` all produce the same quality

---

## JOB TYPES CONTEXT

- `nuclear_v2` = 16 documents (5 systems × 2 people + 5 overlays + 1 verdict)
- `extended` = 1-5 individual readings for 1 person
- `synastry` = 3 documents per system (person1 + person2 + overlay)

All individual readings should be identical regardless of which job type creates them.
