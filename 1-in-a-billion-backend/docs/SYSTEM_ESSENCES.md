# System Essences - Key Identifiers for Each Astrological System

## Overview
Each astrological system has an "essence" - a set of key identifiers that summarize the most important aspects of a person's chart in that system. These should be displayed as chips under the system name in the reading interface.

## Current Implementation

### Western Astrology ✅ IMPLEMENTED
**The Big 3:**
- ☉ Sun Sign (e.g., Sagittarius) - Core identity, ego
- ☽ Moon Sign (e.g., Cancer) - Emotional nature, inner self
- ↑ Rising Sign/Ascendant (e.g., Scorpio) - Outward personality, how others see you

**Data source:** Stored in `person.placements` object
**Display format:** 3 chips with symbols

---

## To Be Defined

### Vedic Astrology (Jyotish) 🔍 RESEARCH NEEDED
**Possible essence components:**
- Rashi (Moon sign in Vedic system)
- Nakshatra (Lunar mansion - 27 divisions)
- Lagna (Ascendant/Rising sign)
- Sun sign (Rasi)

**Question:** What are the 2-3 most important identifiers in Vedic astrology that a person would recognize themselves by?

**Data source:** TBD - Extract from Vedic calculations or reading text
**Display format:** TBD

---

### Human Design 🔍 RESEARCH NEEDED
**Known essence components:**
- **Type:** Manifestor, Generator, Manifesting Generator, Projector, Reflector
- **Profile:** e.g., 1/3, 2/4, 3/5, etc. (12 possible combinations)
- **Authority:** e.g., Emotional, Sacral, Splenic, Ego, Self-Projected, Mental, Lunar

**Question:** Which 2-3 of these should we show as the "essence"? 
- Most likely: Type + Profile (e.g., "Manifesting Generator 3/5")
- Or: Type + Authority?

**Data source:** TBD - Extract from Human Design calculations or reading text
**Display format:** TBD (chips or text)

---

### Gene Keys 🔍 RESEARCH NEEDED
**Possible essence components:**
- Life's Work (Gene Key from Sun)
- Evolution (Gene Key from Earth)
- Radiance (Gene Key from Venus)
- Purpose (Gene Key from South Node)

**Question:** What are the key identifiers in Gene Keys? Is there a "profile" or "type"?

**Data source:** TBD - Extract from Gene Keys calculations or reading text
**Display format:** TBD

---

### Kabbalah (Tree of Life) 🔍 RESEARCH NEEDED
**Possible essence components:**
- Life Path Number or equivalent
- Key Sephirot placements
- Dominant path or archetype

**Question:** What are the key identifiers in Kabbalistic astrology that would be meaningful to show?

**Data source:** TBD - Extract from Kabbalah calculations or reading text
**Display format:** TBD

---

### The Verdict (Synthesis) 🔍 RESEARCH NEEDED
**Possible essence components:**
- This is the synthesis/summary reading
- Might pull key elements from all systems
- Or have its own unique summary

**Question:** What should be shown as the "essence" for the Verdict?

**Data source:** TBD - Synthesized from all systems
**Display format:** TBD

---

## Implementation Plan

### Phase 1: Research & Define
1. ✅ Document Western (already implemented)
2. ⏳ Research Vedic essence components → Ask LLM or consult Vedic astrology resources
3. ⏳ Research Human Design essence → Likely Type + Profile
4. ⏳ Research Gene Keys essence → Need to understand the system better
5. ⏳ Research Kabbalah essence → Need to understand the system better
6. ⏳ Define Verdict essence → Depends on synthesis approach

### Phase 2: Data Extraction
- Determine how to extract/compute essence data for each system
- Options:
  1. Extract from existing reading text using LLM
  2. Store in job metadata during generation
  3. Compute from birth data during display
  4. Hybrid approach

### Phase 3: Data Storage
- Extend person profile schema to include essences for each system
- Schema suggestion:
```typescript
interface PersonEssences {
  western?: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
  };
  vedic?: {
    // TBD based on research
    moonSign?: string;
    nakshatra?: string;
    lagna?: string;
  };
  humanDesign?: {
    type: string;  // "Manifestor" | "Generator" | "Manifesting Generator" | "Projector" | "Reflector"
    profile?: string;  // e.g., "3/5"
    authority?: string;
  };
  geneKeys?: {
    // TBD based on research
  };
  kabbalah?: {
    // TBD based on research
  };
  verdict?: {
    // TBD based on research
  };
}
```

### Phase 4: UI Component
- Make the essence display modular:
```tsx
<SystemEssence systemId={systemId} essences={person.essences} />
```
- Component handles different display formats for each system

---

## Research Questions to Answer

### For Each System, We Need:
1. **What are the 2-4 key identifiers** that someone would use to describe themselves in this system?
2. **How do we extract/compute them?** From birth data calculations or from reading text?
3. **What's the best display format?** Chips, text, symbols?
4. **Where should this data live?** Person profile, job metadata, computed on-the-fly?

### Next Steps:
1. Use LLM to analyze existing readings and identify what each system considers "key identifiers"
2. Research each system's fundamentals
3. Design data schema
4. Implement extraction/computation
5. Build modular display component

---

## Notes
- The "essence" should be immediately recognizable to someone familiar with the system
- It should be brief (2-4 elements max) to fit in the UI
- It should be stored/cached to avoid recomputation
- The display should be consistent but adaptable to each system's unique characteristics
