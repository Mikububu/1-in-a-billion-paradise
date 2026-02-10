# JYOTISH STORAGE AND CACHING SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Jyotish Storage and Caching Layer  
**DEPENDS ON:**
- JYOTISH_CROSS_MATCHING_ENGINE_SPEC.md
- JYOTISH_INTERPRETATION_LAYER_SPEC.md

---

## CORE PURPOSE

Define how Jyotish data is:

- Stored
- Versioned
- Cached
- Invalidated
- Audited

while guaranteeing:

- Determinism
- Immutability
- Reproducibility
- Legal deletability

---

## FUNDAMENTAL PRINCIPLE

**Astrology calculations are expensive, deterministic, and sacred.**

Therefore:

- Calculations are performed once per input set
- Results are immutable
- Interpretations may change
- Scores may not

---

## DATA LAYER SEPARATION

### 1. CALCULATION DATA (IMMUTABLE)

**Includes:**
- Birth data snapshot
- Planetary positions
- House placements
- Nakshatra assignments
- Ashtakoota raw scores
- Dosha flags
- Guna totals

**Stored as:**
- Append-only records
- Never overwritten
- Never updated

---

### 2. MATCH RESULT DATA (IMMUTABLE)

**Includes:**
- Pair hash (person A + person B + system)
- Final Guna score
- Ranking position
- Blocking flags

**Rules:**
- One row per unique match hash
- Reused across sessions
- Immutable forever

---

### 3. INTERPRETATION DATA (MUTABLE)

**Includes:**
- Generated narrative text
- Language version
- Tone variant
- Formatting version

**Rules:**
- May be regenerated
- May be deleted independently
- Never modifies underlying scores

---

## STORAGE TABLES

### TABLE: jyotish_profiles

Stores immutable astrological identity.

**Fields:**
- `profile_id`
- `user_id`
- `birth_data_json`
- `calculation_version`
- `created_at`

---

### TABLE: jyotish_calculations

Stores planetary math results.

**Fields:**
- `calculation_id`
- `profile_id`
- `system` (vedic only for now)
- `raw_planetary_data_json`
- `created_at`

---

### TABLE: jyotish_matches

Stores pairwise results.

**Fields:**
- `match_id`
- `profile_A_id`
- `profile_B_id`
- `ashtakoota_breakdown_json`
- `total_guna_score`
- `dosha_flags_json`
- `engine_version`
- `created_at`

**UNIQUE:** `(profile_A_id, profile_B_id, engine_version)`

---

### TABLE: jyotish_interpretations

Stores LLM outputs.

**Fields:**
- `interpretation_id`
- `match_id`
- `mode` (A, B, C)
- `language`
- `spec_version`
- `text`
- `created_at`

---

## CACHING STRATEGY

### WHAT IS CACHED

- Calculations
- Match results
- Rankings

### WHAT IS NOT CACHED

- Interpretations
- UI formatting
- Audio generation

---

### CACHE KEYS

**Calculation cache key:**
```
profile_id + calculation_version
```

**Match cache key:**
```
profile_A_id + profile_B_id + engine_version
```

---

## CACHE INVALIDATION RULES

### VALID INVALIDATIONS

- Birth data changed
- Engine version changed
- System changed (future)

### INVALID INVALIDATIONS

- Interpretation change
- Language change
- Tone change
- UI change

---

## USER DATA DELETION

### LEGAL DELETE BEHAVIOR

When user requests deletion:

**Deleted:**
- Auth user removed
- Profile references removed
- Interpretations deleted
- Audio files deleted

**Retained:**
- Anonymous aggregated match data may remain
- Scores are detached from identity

---

## REPRODUCIBILITY GUARANTEE

Given:
- Same birth data
- Same engine version
- Same system

The system MUST always return:
- Identical scores
- Identical dosha flags
- Identical rankings

**Interpretation may vary.**

---

## AUDIT REQUIREMENTS

Every calculation must log:

- Engine version
- Swiss ephemeris version
- Timestamp
- Input checksum

This allows forensic reconstruction.

---

## MULTI-USER SCALE RULES

At scale:

- No cross-user cache leakage
- No interpretation reuse across matches
- Rankings recomputed per cohort only

---

## FAILURE CONDITIONS

The system must halt if:

- Cached data mismatches engine version
- Calculation data is missing
- Immutable tables are mutated
- Interpretation tries to alter scores

---

## FUTURE EXTENSIONS

Reserved for:

- Transit overlays
- Dasha timing layers
- Multi-partner clustering

**These must create NEW tables.**

---

**END OF DOCUMENT**
