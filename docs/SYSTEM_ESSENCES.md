# System Essences - Key Identifiers for Each Astrological System

## Quick Reference Summary

| System | Essences | Example Display |
|--------|----------|----------------|
| Western | ☉ Sun / ☽ Moon / ↑ Rising | `☉ Sagittarius` `☽ Cancer` `↑ Scorpio` |
| Vedic | Nakshatra + Lagna | `Magha` `Scorpio Lagna` |
| Human Design | Type + Profile | `Manifesting Generator 3/5` |
| Gene Keys | Life's Work (+ Evolution) | `Gene Key 25` or `GK 25/46` |
| Kabbalah | TBD | TBD |
| Verdict | None (or synthesis) | (no chips) |

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

### Vedic Astrology (Jyotish) ✅ DEFINED
**The Essential Trinity:**
From VEDIC_HOROSCOPE_WRITING_GUIDE.md and PROMPT_SYSTEM_ARCHITECTURE.md:

1. **Moon Nakshatra** (MOST IMPORTANT - "Soul of Jyotish")
   - Example: "Magha", "Ashwini", "Bharani"
   - 27 lunar mansions, each with deity, planetary ruler, pada
   - This is MORE important than Moon sign in Vedic

2. **Lagna** (Ascendant/Rising Sign)
   - Example: "Scorpio", "Cancer", "Aries"
   - The "cosmic doorway you entered through"

3. **Chandra Rashi** (Moon Sign, sidereal)
   - Example: "Leo", "Taurus", "Gemini"
   - "The mind itself, the emotional landscape"

**Alternative (simpler):** Just show Nakshatra + Lagna (2 chips)

**Data source:** 
- Already computed and stored in jyotish_profiles/jyotish_calculations tables
- Fields: `nakshatra`, `pada`, `moon_sign`, `lagna_sign`

**Display format:** 2-3 chips with Sanskrit terms
- Example: `Magha | Scorpio Lagna | Leo Chandra`

---

### Human Design ✅ DEFINED
**The Core Identity:**
From PROMPT_SYSTEM_ARCHITECTURE.md - "Elements to cover" section:

1. **Type** (MOST IMPORTANT)
   - Generator, Manifesting Generator (MG), Projector, Manifestor, or Reflector
   - This is THE primary identifier in Human Design

2. **Profile**
   - e.g., 1/3, 2/4, 3/5, 4/6, 5/1, 6/2
   - 12 possible combinations
   - Describes life theme and role

3. **Authority** (optional, might be too complex)
   - e.g., Emotional, Sacral, Splenic, Ego
   - Decision-making strategy

**Recommended display:** Type + Profile
- Example: "Manifesting Generator 3/5"
- Example: "Projector 2/4"

**Data source:** Extract from reading text using pattern matching or LLM
- Patterns: "You are a [Type]", "Your Profile is [X/Y]", "[Type] with a [X/Y] Profile"

**Display format:** 2 chips or combined text
- Option A: `Manifesting Generator | 3/5 Profile`
- Option B: `Manifesting Generator 3/5` (combined)

---

### Gene Keys ✅ DEFINED
**The Four Prime Gifts:**
From PROMPT_SYSTEM_ARCHITECTURE.md - Gene Keys section:

1. **Life's Work** (Personality Sun) - MOST IMPORTANT
   - Example: "Gene Key 25" or "GK 25"
   - Shadow/Gift/Siddhi triplet
   - Primary life purpose

2. **Evolution** (Personality Earth)
   - The grounding force, complementary to Life's Work

3. **Radiance** (Design Sun) OR **Purpose** (Design Earth)
   - Optional additional identifiers

**Recommended display:** Life's Work + Evolution (the "Golden Path")
- Example: "Life's Work: GK 25 | Evolution: GK 46"
- Or simpler: "Gene Key 25/46"

**Alternative (simpler):** Just Life's Work
- Example: "Gene Key 25"

**Data source:** Extract from reading text
- Patterns: "Life's Work is Gene Key [number]", "GK [number]", "Your [number] Gene Key"

**Display format:** 1-2 chips
- Option A: `Gene Key 25 | GK 46` (Life's Work + Evolution)
- Option B: `GK 25/46` (compact)

---

### Kabbalah (Tree of Life) ⏳ TO BE DEFINED
**Likely essence components:**
- Primary Sephirah (e.g., "Chesed", "Gevurah", "Tiferet")
- Life Path or dominant Tree position
- Key archetypal energy

**Note:** Need to review Kabbalah readings to identify what's most prominent

**Data source:** Extract from reading text using LLM
- Look for: "Your primary Sephirah is...", "You embody [Sephirah]"

**Display format:** TBD - likely 1-2 chips with Hebrew/English names

---

### The Verdict (Synthesis) ⏳ TO BE DEFINED
**Possible approaches:**

**Option A: Pull from all systems**
- Show 1 key element from each system
- Example: "Sagittarius ☉ | Magha | Generator 3/5"

**Option B: Synthesis archetype**
- Create a unique "Verdict archetype" that synthesizes all systems
- Example: "The Visionary Healer" or "The Grounded Catalyst"

**Option C: No essence (just title)**
- The Verdict is the final synthesis, might not need chips
- Just show "The Verdict" as the system name

**Recommendation:** Option C initially (no chips), revisit after seeing Verdict readings

**Data source:** Synthesized or extracted from Verdict reading
**Display format:** TBD

---

## Implementation Plan

### Phase 1: Research & Define ✅ COMPLETE
1. ✅ Western: Sun/Moon/Rising (already implemented)
2. ✅ Vedic: Nakshatra + Lagna (+ optionally Moon sign)
3. ✅ Human Design: Type + Profile
4. ✅ Gene Keys: Life's Work (+ optionally Evolution)
5. ⏳ Kabbalah: Need to review actual readings
6. ⏳ Verdict: Defer decision (likely no chips)

### Phase 2: Data Extraction ✅ IMPLEMENTED
- Determine how to extract/compute essence data for each system
- **Deterministic Strategy (V2):**
  1. **Deterministic Placements:** Western and Vedic essences are now generated directly from Swiss Ephemeris data during job completion. This prevents "LLM Hallucinations" where the reading text might be poetic/wrong.
  2. **Extraction Fallback:** If deterministic data is unavailable, the system extracts essences from the reading text using pattern matching.
  3. **Hybrid Storage:** Both sources are merged to ensure the most accurate display.

### Phase 3: Data Storage ✅ IMPLEMENTED
- Extended `people` table in Supabase with `essences` JSONB column.
- GIN index added for efficient querying.
- Backfill logic implemented for existing Western placements.

### Phase 4: UI Component ✅ IMPLEMENTED
- Modular `SystemEssence` component created.
- Conditionally renders chips based on `systemId` and available `essences` data.
- Styling aligned with the 1inB design system.

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
