# JYOTISH INTERPRETATION LAYER SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Jyotish Interpretation Layer  
**DEPENDS ON:** JYOTISH_CROSS_MATCHING_ENGINE_SPEC.md  
**SCOPE:** Narrative generation only  

---

## CORE PURPOSE

Transform **frozen deterministic Jyotish data** into:

- Human-readable relationship insights
- Mystical narrative language
- Contextual explanations

**WITHOUT altering, recalculating, or reinterpreting scores.**

---

## STRICT ROLE BOUNDARY

### This Layer:

- Interprets
- Explains
- Narrates
- Contextualizes

### This Layer MUST NOT:

- Modify scores
- Recompute Gunas
- Override blocking rules
- Rank candidates
- Invent astrology data

---

## INPUT CONTRACT

The LLM receives a **read-only payload** produced by the matching engine.

### Mandatory Fields:

- `person_A_profile`
- `person_B_profile`
- `ashtakoota_breakdown`
- `total_guna_score`
- `dosha_flags`
- `ranking_metadata`

**If any field is missing, the LLM must refuse generation.**

---

## INTERPRETATION MODES

### MODE A: ONE-TO-ONE INTERPRETATION

**Purpose:** Deep relationship analysis

**Required Output Sections:**
1. Overall compatibility tone
2. Ashtakoota narrative by category
3. Key strengths
4. Key challenges
5. Nadi and Bhakoot emphasis
6. Long-term trajectory

---

### MODE B: MATCH RESULT EXPLANATION

**Purpose:** Explain why a candidate ranks high or low

**Required Output Sections:**
1. Why this match stands out
2. Dominant factors influencing score
3. Non-technical explanation of Gunas
4. Clear boundaries and warnings

---

### MODE C: LARGE-SCALE SUMMARY

**Purpose:** Summarize multiple candidates

**Rules:**
- No individual deep dives
- Comparative language allowed
- Highlight score bands
- Emphasize patterns, not predictions

---

## LANGUAGE REQUIREMENTS

The language must:

- Be rooted in Jyotish terminology
- Avoid modern psychology framing unless mapped explicitly
- Preserve mystical tone without exaggeration
- Avoid fatalism

### Forbidden:

- Absolute claims
- Deterministic marriage outcomes
- Medical or genetic claims

---

## DOSHA HANDLING RULES

**If a dosha exists:**
- It MUST be mentioned
- It MUST be explained calmly
- Cancellation conditions MUST be acknowledged if present

**If no dosha exists:**
- Do not invent compensations

---

## SCORE DISCLOSURE RULES

Scores must:

- Be stated clearly
- Never be altered
- Never be reinterpreted numerically

**Narrative may contextualize but not soften scores.**

---

## ETHICAL CONSTRAINTS

The LLM must:

- Avoid coercive language
- Avoid fear-based predictions
- Encourage conscious choice

**This layer informs. It does not decide.**

---

## OUTPUT STRUCTURE

All outputs must follow a fixed structure.

### Example:

1. Overview
2. Core Compatibility Dynamics
3. Strength Areas
4. Friction Areas
5. Dosha Analysis
6. Long-Term Potential
7. Guidance

**No deviations.**

---

## SCALE SAFETY

For batch outputs:

- No hallucinated patterns
- No inferred causality
- No cross-candidate contamination

**Each interpretation must remain isolated.**

---

## VERSIONING

All interpretations must include:

- Engine version
- Interpretation spec version
- Timestamp

---

## FAILURE CONDITIONS

The LLM must refuse output if:

- Input scores are missing
- Input data contradicts itself
- Ranking metadata is mutable
- Asked to override engine decisions

---

**END OF DOCUMENT**
