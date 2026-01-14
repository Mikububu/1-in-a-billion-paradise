# JYOTISH CROSS-MATCHING ENGINE SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Vedic Matchmaking Engine  
**SCOPE:** Large-scale partner matching  
**APPLIES TO:** One-to-one and one-to-many matching  
**ENFORCEMENT:** Mandatory  

---

## CORE GOAL

Enable deterministic, scalable, non-interpretive Jyotish matchmaking across:

- One user to one user
- One user to many users
- Many users to many users

The engine must rank, filter, and score compatibility using **only precomputed Vedic data**.

---

## SEPARATION OF CONCERNS

### This Engine:

- Computes scores
- Applies filters
- Produces ranked results

### This Engine Does NOT:

- Generate interpretations
- Generate text
- Perform astrology calculations
- Perform LLM reasoning

---

## REQUIRED INPUT DATA MODEL

Each person record MUST contain:

- `user_id`
- `person_id`
- `moon_nakshatra`
- `nakshatra_lord`
- `rashi`
- `gana`
- `yoni`
- `nadi`
- `dasha_snapshot` (optional)

**Records missing any required field are excluded.**

---

## MATCHING MODES

### MODE A: ONE-TO-ONE

**Input:**
- Person A
- Person B

**Output:**
- Full Ashtakoota breakdown
- Total Guna score
- Dosha flags

**Used for:** Detailed overlays

---

### MODE B: ONE-TO-MANY

**Input:**
- Person A
- Candidate set B1...Bn

**Output per candidate:**
- Total Guna score
- Blocking flags
- Rank index

**Used for:** Partner discovery

---

### MODE C: MANY-TO-MANY

**Input:**
- Set A
- Set B

**Output:**
- Compatibility matrix
- Top N matches per entity

**Used for:** Batch matching

---

## ASHTAKOOTA COMPUTATION RULES

Ashtakoota scoring MUST be computed exactly once per pair.

### Rules:

- Moon Nakshatra-based
- No approximations
- No rounding
- No normalization

**Total range:** 0 to 36

---

## BLOCKING RULES

A match is BLOCKED if any of the following are true:

- Nadi score equals zero AND no cancellation
- Bhakoot score equals zero AND no cancellation
- Explicit user preference exclusion

**Blocked matches must not appear in ranked results.**

---

## WEIGHTING RULES

### Default Weight Distribution:

- Total Guna score: 60%
- Nadi weight: 20%
- Gana compatibility: 10%
- Yoni compatibility: 10%

**Weights must be configurable but default enforced.**

---

## RANKING RULES

Ranking must:

- Sort by weighted score (descending)
- Break ties by total Guna score
- Break further ties by Nadi presence
- Preserve deterministic ordering

**No randomness allowed.**

---

## FILTERING RULES

The engine must support filters:

- Minimum Guna threshold
- Exclude Nadi Dosha
- Exclude Gana incompatibility
- Exclude Yoni incompatibility
- Active Dasha overlap (optional)

**Filters are applied BEFORE ranking.**

---

## PERFORMANCE CONSTRAINTS

- Must support 10,000 candidates per query
- Must operate without LLM calls
- Must be cacheable
- Must be idempotent

---

## OUTPUT CONTRACT

The engine outputs DATA ONLY.

### Example Structure:

```json
{
  "candidate_person_id": "string",
  "total_guna_score": 0-36,
  "ashtakoota_breakdown": {},
  "dosha_flags": [],
  "rank_position": 0
}
```

**No text.**  
**No interpretation.**

---

## LLM INTEGRATION BOUNDARY

LLM may only be called AFTER:

- Matching engine completes
- Candidate selected
- Output data frozen

**LLM receives engine output as read-only input.**

---

## FAILURE CONDITIONS

The engine must fail if:

- Required fields missing
- Scores do not reconcile
- Duplicate person records detected
- Determinism violated

---

**END OF DOCUMENT**
