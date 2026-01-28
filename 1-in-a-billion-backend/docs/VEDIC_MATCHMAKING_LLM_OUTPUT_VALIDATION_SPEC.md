# VEDIC MATCHMAKING LLM OUTPUT VALIDATION SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Jyotish Matchmaking  
**SCOPE:** Text generation validation  
**APPLIES TO:** All Vedic overlay outputs  
**ENFORCEMENT:** Mandatory  

---

## CORE PRINCIPLE

The LLM is NOT allowed to invent astrology.  
The LLM is NOT allowed to soften results.  
The LLM is NOT allowed to moralize outcomes.  

**The LLM may only interpret precomputed data.**

---

## ALLOWED INPUT SOURCES

The following data is considered authoritative and immutable:

- Moon Nakshatra for both partners
- Nakshatra Lord
- Rashi placement
- Ashtakoota score breakdown
- Individual Guna scores
- Dosha flags and cancellations
- Dasha periods if provided

**No other astrological data may be referenced.**

---

## FORBIDDEN BEHAVIOR

The LLM must never:

- Invent additional planetary aspects
- Introduce Western astrology concepts
- Add psychological speculation
- Use metaphor or symbolic language
- Use destiny or fate language
- Provide advice unless explicitly requested
- Reframe low scores as positive
- Omit low scores
- Normalize incompatibility

**Any of the above is a hard failure.**

---

## REQUIRED STRUCTURE VALIDATION

The output must strictly follow this section order:

1. Introduction
2. Birth Data
3. Nakshatra Overview
4. Ashtakoota Breakdown
5. Yoni Analysis
6. Gana Analysis
7. Dosha Analysis
8. Timing and Dashas
9. Summary

**If any section is missing or reordered, fail.**

---

## ASHTAKOOTA VALIDATION RULES

For each Koota:

- Name must be correct
- Maximum points must be correct
- Score must match computed value
- Interpretation must align with score

### Example Constraints:

- Varna maximum: 1
- Vashya maximum: 2
- Tara maximum: 3
- Yoni maximum: 4
- Graha Maitri maximum: 5
- Gana maximum: 6
- Bhakoot maximum: 7
- Nadi maximum: 8

**Total maximum: 36**

**If totals do not match sum of components, fail.**

---

## NADI DOSHA RULES

### If Nadi Dosha is PRESENT (score = 0):

- The term "Nadi Dosha" must appear
- At least **2 of the 4 traditional consequences** must be mentioned:
  1. Emotional clashes / marital discord / stubbornness / frequent arguments / potential separation
  2. Financial instability / wealth-building challenges / conflicting money management
  3. Progeny problems / conception difficulties / genetic issues / fertility challenges / offspring health
  4. Weakened vitality / mutual energy drain / chronic health issues / difficulty sustaining partnership
- Cancellation status must be checked and stated if applicable
- If not cancelled, the dosha must materially affect the final recommendation
- Consequences must be framed neutrally, not sensationally
- Must acknowledge that remedies exist and effects vary

### If Nadi Dosha is ABSENT (score = 8):

- Nadi Dosha must NOT be mentioned
- Nadi compatibility may be mentioned as a strength (different Nadis = good energetic alignment)

**No exceptions.**

---

## YONI VALIDATION RULES

Yoni compatibility must:

- Reference animal pair only
- Avoid sexualized language
- Avoid emotional projection

Use only compatibility classification provided.

---

## GANA VALIDATION RULES

Gana interpretation must:

- Reference Deva/Manushya/Rakshasa only
- Avoid moral judgment
- Avoid personality diagnosis

---

## DOSHA VALIDATION RULES

For each Dosha:

- Presence must be stated clearly
- Cancellation must be stated clearly
- Severity must be classified

**Never imply Dosha is irrelevant.**

---

## LANGUAGE CONSTRAINTS

### Forbidden Words and Phrases:

- Soulmates
- Twin flame
- Meant to be
- Divine union
- Guaranteed
- Perfect match

**Use neutral analytical language only.**

---

## NUMERIC CONSISTENCY RULES

- All scores must be numerically accurate
- All totals must reconcile
- Percentages must be derived, not estimated

**Any mismatch is a failure.**

---

## SUMMARY SECTION RULES

The summary must:

- Restate total Guna score
- Restate presence of major Doshas
- Avoid recommendations
- Avoid emotional framing

---

## FAILURE HANDLING

If validation fails:

- Output must be rejected
- No audio generation allowed
- No PDF generation allowed
- Error must be logged with section and reason

---

**END OF DOCUMENT**
