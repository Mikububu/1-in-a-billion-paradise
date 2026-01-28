# JYOTISH MATCHING SPECIFICATION

**Version:** 1.0  
**Type:** Backend Canonical Specification  
**Status:** Part I - Foundations and Data Model

---

## I. PURPOSE AND SCOPE

This specification defines the authoritative backend logic for Vedic Jyotish relationship matching used by the platform. It governs one-to-one compatibility analysis and large-scale matchmaking queries.

The system is designed to be:
- **Deterministic**
- **Scalable**
- **Explainable**
- **Extensible by astrologers without code rewrites**

**This document is the single source of truth.**  
Frontend, admin, and narrative layers must not override it.

---

## II. INPUT DATA REQUIREMENTS

### A. Individual Chart Data (Required)

Each person must provide or already have computed:
- Date of birth
- Time of birth
- Timezone
- Latitude
- Longitude

From this, the backend must compute and store:
- Moon sign (Rāśi)
- Moon Nakshatra
- Nakshatra Pada
- Lagna sign
- Planetary placements (sign + house)
- Mars position for Manglik analysis
- Current Mahadasha and Antardasha (optional but supported)

**All matching logic assumes sidereal zodiac (Lahiri ayanamsa) unless explicitly versioned otherwise.**

---

## III. CORE MATCHING SYSTEM: ASHTAKOOTA

Ashtakoota matching is the primary compatibility scoring system.

**Total possible points:** 36

**Minimum recommended threshold for partnership consideration:** 18

---

## IV. ASHTAKOOTA COMPONENT DEFINITIONS

### 1. VARNA KOOTA (1 point)

**Domain:** Spiritual maturity and ego alignment

**Derived from:** Moon sign caste classification

**Hierarchy:**
- Brahmin
- Kshatriya
- Vaishya
- Shudra

**Rule:**
- Male Varna must be equal or higher than female Varna
- Otherwise score = 0

**Output:**
- `score_varna`: 0 or 1
- `varna_relation`: accepted | rejected

---

### 2. VASHYA KOOTA (2 points)

**Domain:** Mutual influence and control dynamics

**Derived from:** Moon sign influence groups

**Rule:**
- Predefined sign dominance matrix
- Mutual influence yields full points
- One-way influence yields partial
- No influence yields zero

**Output:**
- `score_vashya`: 0–2
- `vashya_direction`: mutual | one_way | none

---

### 3. TARA KOOTA (3 points)

**Domain:** Health, fortune, longevity of relationship

**Derived from:** Distance between Moon Nakshatras

**Computation:**
- Count Nakshatra distance mod 9
- Map to Tara category:
  - Janma
  - Sampat
  - Vipat
  - Kshema
  - Pratyari
  - Sadhaka
  - Vadha
  - Mitra
  - Parama Mitra

**Rule:**
- Auspicious categories score
- Inauspicious score reduced or zero

**Output:**
- `tara_type`
- `score_tara`: 0–3

---

### 4. YONI KOOTA (4 points)

**Domain:** Sexual, instinctual, biological compatibility

**Derived from:** Nakshatra animal symbolism

**Key rules:**
- Same Yoni = full score
- Friendly Yoni = high score
- Enemy Yoni = zero
- Predator-prey pairs = zero with warning flag

**Output:**
- `yoni_male`
- `yoni_female`
- `yoni_relation`: same | friendly | neutral | enemy
- `score_yoni`: 0–4
- `yoni_warning`: boolean

---

### 5. GRAHA MAITRI (5 points)

**Domain:** Mental compatibility and emotional rapport

**Derived from:** Moon sign lords and planetary friendships

**Rules:**
- Same planetary lord = full score
- Mutual friendship = high score
- Neutral = partial
- Enmity = low or zero

**Output:**
- `lord_male`
- `lord_female`
- `friendship_type`
- `score_graha_maitri`: 0–5

---

### 6. GANA KOOTA (6 points)

**Domain:** Temperament and psychological nature

**Ganas:**
- Deva
- Manushya
- Rakshasa

**Rules:**
- Same Gana = full score
- Deva–Manushya acceptable
- Rakshasa with Deva = problematic
- Rakshasa–Rakshasa acceptable but intense

**Output:**
- `gana_male`
- `gana_female`
- `gana_relation`
- `score_gana`: 0–6
- `temperament_warning`: boolean

---

### 7. BHAKOOT KOOTA (7 points)

**Domain:** Emotional bonding, family harmony, financial stability

**Derived from:**
- Moon sign distance (6th, 8th, 12th positions)

**Rules:**
- 6/8 or 12/2 relationships trigger Bhakoot Dosha
- Certain cancellations apply if lords are friendly

**Output:**
- `moon_distance`
- `bhakoot_dosha`: boolean
- `score_bhakoot`: 0 or 7
- `bhakoot_cancellation_applied`: boolean

---

### 8. NADI KOOTA (8 points)

**Domain:** Genetics, health, progeny, karmic lineage

**Nadis:**
- Aadi
- Madhya
- Antya

**Rules:**
- Same Nadi = Nadi Dosha (score 0)
- Different Nadis = full score
- Cancellations possible only under strict conditions

**This is non-negotiable in strict Jyotish.**

**Output:**
- `nadi_male`
- `nadi_female`
- `nadi_dosha`: boolean
- `score_nadi`: 0 or 8
- `nadi_override_allowed`: false by default

---

## V. TOTAL SCORE CALCULATION

The total Ashtakoota score is the sum of all 8 component scores:

```
total_score = 
  varna + 
  vashya + 
  tara + 
  yoni + 
  graha_maitri + 
  gana + 
  bhakoot + 
  nadi
```

**Range:** 0–36

### Classification:

- **< 18**: Not recommended
- **18–24**: Average
- **25–32**: Very good
- **33–36**: Exceptional

---

## VI. DOSHA ANALYSIS (ADDITIVE, NOT SCORING)

Doshas are **structural warnings** that operate independently of the Guna score.

### Manglik Dosha

**Trigger:** Mars in houses 1, 2, 4, 7, 8, 12

**Behavior:**
- Requires cancellation logic
- Does **not** change Guna score
- Adds warnings and severity flag

### Other Doshas:

- **Bhakoot Dosha** (covered in Bhakoot Koota)
- **Nadi Dosha** (covered in Nadi Koota)

**Important:** Doshas affect final recommendation layer, not raw score.

---

## VII. OUTPUT CONTRACT (BACKEND)

The backend must output a **fully structured object**, never prose.

### Required Fields:

```json
{
  "individual_scores": {
    "varna": 0-1,
    "vashya": 0-2,
    "tara": 0-3,
    "yoni": 0-4,
    "graha_maitri": 0-5,
    "gana": 0-6,
    "bhakoot": 0-7,
    "nadi": 0-8
  },
  "total_score": 0-36,
  "dosha_flags": {
    "nadi_dosha": boolean,
    "bhakoot_dosha": boolean,
    "manglik_dosha": boolean
  },
  "cancellation_flags": {
    "bhakoot_cancelled": boolean,
    "nadi_cancelled": boolean,
    "manglik_cancelled": boolean
  },
  "severity_indicators": {
    "manglik_severity": 0-100,
    "yoni_warning": boolean,
    "temperament_warning": boolean
  },
  "engine_version": "1.0.0"
}
```

**Narrative generation happens elsewhere.**

---

## VIII. LARGE-SCALE MATCHING SUPPORT

For N-to-N matching:

### Optimization Strategy:

1. **Precompute** Moon Nakshatra, Yoni, Gana, Nadi for all profiles
2. **Use vectorized scoring** for batch calculations
3. **Apply hard filters first:**
   - Nadi Dosha exclusion
   - Bhakoot Dosha exclusion
   - Minimum Guna threshold
4. **Rank by:**
   - Total score (primary)
   - Yoni/Gana priority (secondary)
   - Dosha severity (tertiary)

### Performance Requirements:

- Support 10,000+ candidate evaluations
- Deterministic ranking
- Cacheable results
- Idempotent operations

---

## PART I COMPLETE

**Covered:**
- ✅ Purpose and scope
- ✅ Input data requirements
- ✅ Ashtakoota system (8 Kootas)
- ✅ Total score calculation
- ✅ Classification bands
- ✅ Dosha analysis
- ✅ Output contract
- ✅ Large-scale matching support

---

# PART II: DASHA AND TRANSIT OVERLAY ENGINE

## II.1 PURPOSE

The Dasha and Transit Overlay Engine augments Ashtakoota matching with time-based relationship viability.

**It does not modify Guna scores.**  
**It modifies timing, risk weighting, and recommendation confidence.**

This layer answers one question only:

> Is this relationship likely to activate harmoniously now or in the near future?

---

## II.2 SUPPORTED SYSTEMS

The backend shall support the following Jyotish timing systems:

1. Vimshottari Mahadasha
2. Vimshottari Antardasha
3. Current Gochar (transits) of Saturn, Jupiter, Rahu, Ketu
4. Optional future window simulation (up to 36 months)

**All calculations are sidereal (Lahiri).**

---

## II.3 INPUT REQUIREMENTS

### For Each Person:

1. Birth data already resolved into natal chart
2. Current Mahadasha lord
3. Current Antardasha lord
4. Current Dasha period start and end timestamps
5. Planetary house placements relative to Lagna and Moon

**Transit data is global and computed once per request.**

---

## II.4 DASHA COMPATIBILITY LOGIC

### II.4.1 Dasha Nature Classification

Each active Dasha lord is classified as:

1. **Benefic**
2. **Functional benefic**
3. **Neutral**
4. **Functional malefic**
5. **Malefic**

**Classification depends on:**
- Planet nature
- House ownership
- House placement

This classification is **precomputed and cached**.

---

### II.4.2 Relationship Activation Rules

**A relationship window is considered SUPPORTED when at least one of the following is true:**

1. Both partners are in benefic or functional benefic Mahadasha
2. One partner is in benefic Mahadasha and the other is not under severe malefic influence
3. Antardasha lords form mutual friendship or trinal relation

**A relationship window is considered CHALLENGED when:**

1. Both partners are under malefic Mahadasha
2. Saturn, Rahu, or Ketu is the active Antardasha lord for both
3. Dasha lord occupies 6th, 8th, or 12th from Moon or Lagna

---

### II.4.3 Dasha Interaction Matrix

The backend shall compute:

1. Male Mahadasha lord vs female Mahadasha lord relation
2. Male Antardasha lord vs female Antardasha lord relation
3. Cross-influence on 7th house and its lord

**Each interaction yields a categorical result:**

1. **Supportive**
2. **Neutral**
3. **Frictional**
4. **Blocking**

**This result does not change points.**  
**It changes confidence weighting.**

---

## II.5 TRANSIT OVERLAY LOGIC

### II.5.1 Key Transit Planets

Only the following planets are considered for relationship viability:

1. Saturn
2. Jupiter
3. Rahu
4. Ketu

**Inner planet transits are ignored at backend level.**

---

### II.5.2 Transit Impact Zones

For each person, compute transit positions relative to:

1. Natal Moon
2. Natal Lagna
3. Natal Venus
4. Natal 7th house

**Impact zones:**

1. Supportive houses
2. Neutral houses
3. Challenging houses

**Special rules:**
- Saturn in 7th from Moon is always flagged
- Jupiter in 7th from Lagna is always supportive

---

### II.5.3 Transit Severity Flags

Each person receives:

1. `transit_support_score`
2. `transit_challenge_score`
3. `transit_blocking_flag`

**These values are normalized between 0 and 1.**

---

## II.6 COMBINED TIME VIABILITY SCORE

The backend computes a **Time Viability Index**.

### Formula (Conceptual):

```
Time Viability Index = 
  Dasha Support Weight + 
  Transit Support Weight - 
  Transit Challenge Weight
```

**This index never alters Guna score.**  
**It alters recommendation tone and urgency.**

---

## II.7 OUTPUT CONTRACT FOR PART II

The backend must output a structured object:

```json
{
  "current_dasha_male": {
    "mahadasha_lord": "string",
    "antardasha_lord": "string",
    "period_start": "ISO8601",
    "period_end": "ISO8601",
    "nature": "benefic|neutral|malefic"
  },
  "current_dasha_female": {
    "mahadasha_lord": "string",
    "antardasha_lord": "string",
    "period_start": "ISO8601",
    "period_end": "ISO8601",
    "nature": "benefic|neutral|malefic"
  },
  "dasha_interaction_result": "supportive|neutral|frictional|blocking",
  "transit_summary_male": {
    "transit_support_score": 0-1,
    "transit_challenge_score": 0-1,
    "transit_blocking_flag": boolean
  },
  "transit_summary_female": {
    "transit_support_score": 0-1,
    "transit_challenge_score": 0-1,
    "transit_blocking_flag": boolean
  },
  "time_viability_index": 0-1,
  "timing_window_recommendation": "favorable|neutral|challenging|wait"
}
```

**No prose. No interpretation.**

---

## II.8 LARGE-SCALE MATCHING USE

For batch matching:

1. Time viability is **optional but recommended**
2. Can be used as **secondary ranking factor**
3. Can be used as **filter for active matches only**

This allows the system to surface matches that are **alive now**.

---

## II.9 STRICT SEPARATION RULE

Dasha and Transit overlays:

1. **Must never modify Ashtakoota score**
2. **Must never override Nadi or Bhakoot Dosha**
3. **Must never be interpreted as destiny**

**They indicate timing, not fate.**

---

## PART II COMPLETE

**Covered:**
- ✅ Dasha and transit overlay purpose
- ✅ Supported timing systems
- ✅ Dasha compatibility logic
- ✅ Transit overlay logic
- ✅ Time viability index calculation
- ✅ Structured output contract
- ✅ Large-scale matching integration
- ✅ Strict separation rules

---

# PART III: VERSIONING, OVERRIDE, AND SAFETY LOGIC

## III.1 PURPOSE

This section defines how Jyotish matchmaking logic is versioned, locked, overridden, and protected at scale.

Its goal is to prevent:
- Silent logic drift
- Accidental regressions
- Uncontrolled interpretation changes when the system evolves

**This is a governance layer, not astrology logic.**

---

## III.2 VERSIONING MODEL

All Jyotish matchmaking outputs must declare a version header.

### Mandatory Fields:

```json
{
  "system_version": "1.0.0",
  "ashtakoota_version": "1.0.0",
  "dasha_engine_version": "1.0.0",
  "transit_engine_version": "1.0.0",
  "interpretation_schema_version": "1.0.0"
}
```

**These values are immutable per generated result and stored with the match record.**

---

## III.3 BACKWARD COMPATIBILITY RULES

Once a version is deployed:

1. **Existing matches must never be recalculated automatically**
2. **New logic applies only to newly generated matches**
3. **Recalculation requires explicit user action or admin flag**

This ensures users do not experience shifting results over time.

---

## III.4 OVERRIDE HIERARCHY

Overrides may exist at **four levels only**.

### Level 1: Global System Override

- Used only for critical bug fixes
- Applied by backend configuration only

### Level 2: System-Specific Override

- Example: Vedic only
- Used to tune Ashtakoota thresholds or Dosha severity

### Level 3: Match-Specific Override

- Used for experimental analysis or research
- **Never shown to end users**

### Level 4: User-Facing Explanation Override

- Changes wording only
- **Never changes scores or logic**

**Overrides never change raw calculated values.**  
**They only affect downstream interpretation layers.**

---

## III.5 HARD BLOCK SAFETY RULES

The following conditions **cannot be overridden by any level**:

1. Nadi Dosha (severe conflict)
2. Severe Bhakoot Dosha without cancellation
3. Genetic or progeny risk flag
4. Explicit blocking Dasha + Saturn transit overlap

**If any of the above are present, the system must label the match as "structurally challenged" regardless of overrides.**

---

## III.6 SOFT WARNING FLAGS

The following conditions generate warnings but allow continuation:

1. Low Guna score but high Dasha support
2. Strong Yoni conflict with compensating Graha Maitri
3. Temporary transit obstruction

**Warnings must be surfaced clearly but not block matching.**

---

## III.7 INTERPRETATION ISOLATION RULE

Astrological calculation and interpretation must **never live in the same module**.

```
Calculation Layer → Outputs structured facts only
Interpretation Layer → Consumes facts and produces language
```

This allows language updates without touching astrology logic.

---

## III.8 ADMIN AND EXPERIMENTATION MODE

The backend must support an **admin evaluation mode** where:

1. All raw values are visible
2. All overrides are logged
3. No results are persisted
4. No user-facing language is generated

**This mode is used for research, validation, and tuning.**

---

## III.9 AUDIT LOGGING

Every match generation must log:

1. Input hashes
2. Calculation versions
3. Override usage
4. Final output checksum

**This allows full forensic reconstruction of any result.**

---

## III.10 FAILURE MODE HANDLING

If any required component fails:

- Missing transit data
- Incomplete birth data
- Corrupted Dasha window

**The system must degrade gracefully.**

### Allowed Behavior:

1. Return Ashtakoota only
2. Return partial timing overlay with warning
3. **Never fabricate missing data**

---

## PART III COMPLETE

**Covered:**
- ✅ Versioning model with immutable headers
- ✅ Backward compatibility rules
- ✅ Four-level override hierarchy
- ✅ Hard block safety rules (non-overridable)
- ✅ Soft warning flags
- ✅ Interpretation isolation rule
- ✅ Admin and experimentation mode
- ✅ Audit logging requirements
- ✅ Graceful failure mode handling

---

## NEXT PARTS (PENDING)

**Part IV:** Narrative handoff contract  
**Part V:** Validation test matrix  
**Part VI:** Future extension roadmap  

---

**Status:** Parts I, II & III Complete - Ready for Implementation

# PART IV: NARRATIVE HANDOFF AND INTERPRETATION CONTRACT

This section defines how raw Jyotish data is converted into language without contaminating calculation logic.

**This is the most critical boundary in the system.**

---

## IV.1 CORE PRINCIPLE

**Astrology produces facts.**  
**Narrative produces meaning.**

**They must never collapse into each other.**

- No calculation code may contain adjectives, metaphors, advice, or conclusions
- No narrative code may infer or recalculate astrology

---

## IV.2 STRUCTURED FACT OUTPUT FORMAT

The calculation engine must emit a single canonical object.

### Example Conceptual Structure:

```json
{
  "match_core": {},
  "ashtakoota_scores": {},
  "dosha_flags": {},
  "planetary_relationships": {},
  "dasha_alignment": {},
  "transit_pressure": {},
  "override_flags": {},
  "confidence_metrics": {}
}
```

**Every field must be explicit, typed, and enumerable.**

**No free text allowed.**

---

## IV.3 ASHTAKOOTA FACT CONTRACT

Each Koota must expose:

```json
{
  "koota_name": "string",
  "max_points": number,
  "awarded_points": number,
  "status": "pass|partial|fail",
  "reason_codes": ["SYMBOLIC_CODE"],
  "compensation_flags": []
}
```

**Reason codes must be symbolic, not textual.**

### Example:

```
YONI_CONFLICT
YONI_COMPENSATED_BY_MAITRI
```

---

## IV.4 DOSHA FACT CONTRACT

Each Dosha must expose:

```json
{
  "dosha_type": "string",
  "severity": "none|mild|severe",
  "cancellation_present": boolean,
  "cancellation_reason_code": "string",
  "domain_affected": "marriage|health|progeny|longevity"
}
```

**Doshas never disappear.**  
**They may only be cancelled or mitigated.**

---

## IV.5 DASHA AND TIMING FACT CONTRACT

Timing data must expose:

```json
{
  "current_dasha_pair": {},
  "upcoming_dasha_windows": [],
  "supportive_periods": [],
  "challenging_periods": [],
  "hard_block_periods": []
}
```

**No advice or prediction language allowed here.**

---

## IV.6 TRANSIT FACT CONTRACT

Transits must expose:

```json
{
  "planet": "string",
  "house_affected": number,
  "pressure_type": "supportive|obstructive|neutral",
  "duration": "ISO8601_duration",
  "severity_level": 0-1
}
```

**Transits are always time-bounded.**

---

## IV.7 CONFIDENCE AND STABILITY METRICS

The system must compute meta-signals:

```json
{
  "data_completeness_score": 0-1,
  "timing_stability_score": 0-1,
  "interpretation_confidence_level": 0-1
}
```

**These values influence tone, not conclusions.**

---

## IV.8 INTERPRETATION INPUT PAYLOAD

The narrative engine receives exactly:

```json
{
  "facts_object": {},
  "user_context_flags": {},
  "desired_tone": "calm|neutral|direct|mystical",
  "output_format": "text|audio|pdf"
}
```

**No additional hidden context is allowed.**

---

## IV.9 NARRATIVE GENERATION RULES

Narrative must follow strict ordering:

1. **Structural compatibility summary**
2. **Core strengths**
3. **Core challenges**
4. **Timing insights**
5. **Required consciousness and effort**
6. **Final framing**

**Forbidden:**
- No predictions of guaranteed outcomes
- No fear-based language
- No deterministic claims

---

## IV.10 MULTI-SCALE LANGUAGE MODES

The same facts must support:

1. **Minimal technical report**
2. **Human-readable explanation**
3. **Mystical poetic rendering**

**All three must resolve to the same underlying facts.**

---

## IV.11 AUDIO AND PDF CONSTRAINTS

### Audio Narration Rules:

- Neutral pacing
- No dramatic exaggeration
- No absolute statements

### PDF Rules:

- Clear section separation
- Fact tables before interpretation
- Explicit disclaimer of free will

---

## IV.12 FAILURE AND FALLBACK LANGUAGE

If confidence is low:

- Narrative must explicitly state uncertainty
- No softening or masking allowed

**Honesty overrides comfort.**

---

## IV.13 IMMUTABILITY GUARANTEE

Once narrative is generated:

- **Facts are frozen**
- **Narrative is frozen**
- **Only regeneration via explicit request**

This prevents silent rewriting.

---

## PART IV COMPLETE

**Covered:**
- ✅ Core principle: facts ≠ meaning
- ✅ Structured fact output format
- ✅ Ashtakoota fact contract
- ✅ Dosha fact contract
- ✅ Dasha and timing fact contract
- ✅ Transit fact contract
- ✅ Confidence and stability metrics
- ✅ Interpretation input payload
- ✅ Narrative generation rules
- ✅ Multi-scale language modes
- ✅ Audio and PDF constraints
- ✅ Failure and fallback language
- ✅ Immutability guarantee

---

## NEXT PARTS (PENDING)

**Part V:** Validation test matrix  
**Part VI:** Future extension roadmap  

---

**Status:** Parts I, II, III & IV Complete - Ready for Implementation

# PART V: VALIDATION TEST MATRIX AND QUALITY GATES

This section defines how correctness is enforced at scale.

**Nothing proceeds to narrative unless it passes validation.**

---

## V.1 VALIDATION LAYERS

There are **four mandatory layers**. All must pass.

1. **Input integrity**
2. **Astrological correctness**
3. **Logical consistency**
4. **Narrative admissibility**

**Failure at any layer halts the pipeline.**

---

## V.2 INPUT INTEGRITY VALIDATION

Required checks per person:

- `birth_date` present
- `birth_time` present
- `timezone` resolvable
- `latitude`, `longitude` valid
- `ayanamsa` locked

### If birth time uncertainty exceeds threshold:

- Flag `birth_time_confidence` = low
- Restrict house-based conclusions
- Disable certain doshas

---

## V.3 ASHTAKOOTA CALCULATION VALIDATION

Each Koota must satisfy:

- `awarded_points` <= `max_points`
- `total_points` <= 36
- No negative values
- `moon_nakshatra` resolved

### Cross-Checks:

- Nadi cannot be compensated by unrelated factors
- Bhakoot score must reflect rashi distance logic
- Graha Maitri must match planetary lord friendship table

**Any mismatch is fatal.**

---

## V.4 DOSHA LOGIC VALIDATION

Rules enforced:

- Manglik Dosha must be symmetrically checked
- Nadi Dosha cancellation requires explicit rule
- No silent dosha removal

### Each dosha must output:

- `present`: true or false
- `severity`
- `cancellation_logic` (if any)

**Missing cancellation logic equals uncancelled.**

---

## V.5 TIMING CONSISTENCY VALIDATION

### Dasha Rules:

- Current dasha must exist
- Sub-dasha must align with major
- No overlapping incompatible windows

### Transit Rules:

- Transit dates must not exceed ephemeris bounds
- Retrograde flags must be explicit

---

## V.6 INTER-SYSTEM CONSISTENCY CHECKS

Even though only Jyotish is active now, the system must support:

- Moon-based logic consistent with sign logic
- House logic consistent with lagna
- Dasha emphasis consistent with planet strength

**Conflicts are flagged, not resolved silently.**

---

## V.7 MATCHING SCORE SANITY CHECKS

### Hard Rules:

- High Ashtakoota score does **not** override severe dosha
- Low score may be acceptable with strong compensations

**The engine must explain why a score is acceptable or not.**

---

## V.8 LARGE-SCALE MATCH VALIDATION

When matching thousands of users:

- No user may be matched to themselves
- Duplicate profile detection enforced
- Symmetry check: A→B equals B→A

**Caching rules must not leak previous results.**

---

## V.9 NARRATIVE ADMISSIBILITY GATE

Narrative generation is **blocked** if:

- `confidence_score` below threshold
- Key doshas unresolved
- Birth data insufficient

**In such cases, only a technical report is allowed.**

---

## V.10 REGRESSION TEST SETS

The system must include fixed reference couples:

1. **Perfect match example**
2. **High score but failed marriage example**
3. **Low score but successful marriage example**
4. **Severe dosha example**

**Outputs must remain stable across releases.**

---

## V.11 VERSIONED OUTPUT VALIDATION

Each result must include:

- `engine_version`
- `ayanamsa_version`
- `rule_set_version`

**No silent rule changes allowed.**

---

## V.12 FAILURE REPORTING FORMAT

On failure, the system must emit:

```json
{
  "failure_stage": "string",
  "failure_code": "string",
  "human_readable_reason": "string",
  "recommended_corrective_action": "string"
}
```

**No retries without cause resolution.**

---

## V.13 FINAL QUALITY GATE

Only when all validations pass may:

- Audio be generated
- PDF be generated
- Results be stored
- Matches be ranked

**This guarantees integrity at scale.**

---

## PART V COMPLETE

**Covered:**
- ✅ Four-layer validation system
- ✅ Input integrity validation
- ✅ Ashtakoota calculation validation
- ✅ Dosha logic validation
- ✅ Timing consistency validation
- ✅ Inter-system consistency checks
- ✅ Matching score sanity checks
- ✅ Large-scale match validation
- ✅ Narrative admissibility gate
- ✅ Regression test sets
- ✅ Versioned output validation
- ✅ Failure reporting format
- ✅ Final quality gate

---

## NEXT PART (PENDING)

**Part VI:** Future extension roadmap  

---

**Status:** Parts I, II, III, IV & V Complete - Ready for Implementation

# PART VI: SCORING ENGINE AND DECISION MODEL

This section defines how raw astrological data becomes a deterministic matchmaking decision that can scale to thousands or millions of users.

---

## VI.1 SCORING PHILOSOPHY

**The system does not predict happiness.**  
**It evaluates structural compatibility.**

Scores represent alignment capacity under time and pressure.

**No romantic language is used at this layer.**

---

## VI.2 PRIMARY SCORE AXES

The engine produces **four independent axes** before synthesis:

1. **Guna alignment score**
2. **Dosha risk score**
3. **Temporal alignment score**
4. **Structural partnership score**

**These are never collapsed prematurely.**

---

## VI.3 ASHTAKOOTA SCORING RULES

Total maximum points is **36**.

Each koota contributes exactly its classical weight:

- Varna: 1
- Vashya: 2
- Tara: 3
- Yoni: 4
- Graha Maitri: 5
- Gana: 6
- Bhakoot: 7
- Nadi: 8

**No redistribution allowed.**

---

## VI.4 NADI DOSHA WEIGHTING

**Nadi has override priority.**

If Nadi is present and uncancelled:

- Cap maximum effective compatibility at "medium"
- Flag health/lineage risk
- Require explicit narrative warning

**Nadi cannot be hidden by high Guna total.**

---

## VI.5 GANA AND YONI EMPHASIS

### Gana Mismatch

Affects daily life friction:

- **Rakshasa vs Deva** = high volatility
- **Manushya mixed** = medium volatility

### Yoni Mismatch

Affects intimacy sustainability:

- **Predator-prey combinations** = increased long-term erosion
- **Neutral combinations** = stable

**These factors directly influence partnership longevity score.**

---

## VI.6 DOSHA RISK SCORING

Each dosha produces a risk weight:

- **Manglik**: minor | medium | severe
- **Nadi**: medium | severe
- **Bhakoot**: moderate | high

**Cancelled doshas reduce weight but do not erase history.**

---

## VI.7 TEMPORAL ALIGNMENT SCORING

Dashas determine timing viability.

### If both partners are in supportive dashas:

- Boost viability window

### If one partner is in crisis dasha:

- Flag asymmetry

### If both are in conflicting dashas:

- Recommend delay regardless of Guna score

---

## VI.8 SYNTHESIS ENGINE

**Final outcome is a vector, not a number.**

### Example Output:

```json
{
  "compatibility_tier": "string",
  "risk_tier": "string",
  "timing_recommendation": "string",
  "stability_outlook": "string"
}
```

**The system never outputs a single magic score alone.**

---

## VI.9 DECISION TIERS

Defined tiers:

1. **Not recommended**
2. **High effort required**
3. **Conditionally favorable**
4. **Strong alignment**
5. **Exceptional alignment**

**Each tier has strict entry criteria.**

---

## VI.10 EXPLANATION OBLIGATION

Every decision must cite:

- Which rules triggered it
- Which scores mattered most
- Which risks dominate

**No vague statements allowed.**

---

## VI.11 SCALE MATCHING CONSTRAINTS

When ranking many matches:

1. **Filter by hard blockers first**
2. **Then by Guna score**
3. **Then by timing**
4. **Then by risk**

This avoids false positives at scale.

---

## VI.12 FUTURE EXTENSION SAFETY

This model allows later integration of:

- Western synastry
- Human Design
- Gene Keys

**Without breaking Jyotish integrity.**

---

## PART VI COMPLETE

**Covered:**
- ✅ Scoring philosophy (structural compatibility)
- ✅ Four independent score axes
- ✅ Ashtakoota scoring rules
- ✅ Nadi dosha override priority
- ✅ Gana and Yoni emphasis
- ✅ Dosha risk scoring
- ✅ Temporal alignment scoring
- ✅ Synthesis engine (vector output)
- ✅ Decision tiers
- ✅ Explanation obligation
- ✅ Scale matching constraints
- ✅ Future extension safety

---

## ALL PARTS COMPLETE

**JYOTISH_MATCHING_SPEC.md Version 1.0**

- ✅ Part I: Ashtakoota System and Scoring
- ✅ Part II: Dasha and Transit Overlays
- ✅ Part III: Versioning and Safety Logic
- ✅ Part IV: Narrative Handoff Contract
- ✅ Part V: Validation Test Matrix
- ✅ Part VI: Scoring Engine and Decision Model

---

**Status:** Complete Canonical Specification - Ready for Implementation

---

**This is doctrine, not documentation.**
