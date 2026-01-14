# JYOTISH API AND PAYLOAD SPECIFICATION

**VERSION:** 1.0  
**SYSTEM:** Jyotish API Contract Layer  
**DEPENDS ON:**
- JYOTISH_CROSS_MATCHING_ENGINE_SPEC.md
- JYOTISH_INTERPRETATION_LAYER_SPEC.md
- JYOTISH_STORAGE_AND_CACHING_SPEC.md

---

## CORE PURPOSE

Define:

- Canonical API endpoints
- Payload schemas
- Deterministic request signatures
- Versioned responses
- Worker-safe contracts

This spec ensures:

- Frontend cannot corrupt astrology logic
- Backend can scale independently
- Workers can be replaced without breaking meaning

---

## API DESIGN PRINCIPLES

- Stateless requests
- Explicit versioning
- Immutable responses for calculations
- Separation of calculation and interpretation
- No hidden defaults

---

## GLOBAL HEADERS

All requests MUST include:

- `X-Engine-Version`
- `X-System` = "vedic"
- `X-Client-Version`
- `X-Request-Id`

Optional:

- `X-Debug` = true

---

## AUTH MODEL

- Auth handled outside Jyotish logic
- Jyotish engine receives resolved `user_id`
- Engine never sees tokens

---

## CORE ENDPOINTS

---

### 1. CREATE OR UPDATE PROFILE

**Endpoint:** `POST /api/jyotish/profile`

**Purpose:** Create immutable astrological profile

**Request:**

```json
{
  "user_id": "uuid",
  "name": "string",
  "birth_data": {
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "timezone": "IANA",
    "latitude": number,
    "longitude": number
  }
}
```

**Response:**

```json
{
  "profile_id": "uuid",
  "user_id": "uuid",
  "nakshatra_attributes": {
    "nakshatra": "string",
    "pada": 1-4,
    "yoni": "string",
    "gana": "deva|manushya|rakshasa",
    "nadi": "adi|madhya|antya",
    "varna": "string",
    "vashya": "string"
  },
  "calculation_version": "1.0.0",
  "created_at": "ISO8601"
}
```

**Behavior:**
- Triggers Swiss Ephemeris calculation
- Stores immutable profile
- Returns computed Nakshatra attributes
- Idempotent: same birth data = same profile_id

---

### 2. ANALYZE COMPATIBILITY (ONE-TO-ONE)

**Endpoint:** `POST /api/jyotish/matches/analyze`

**Purpose:** Detailed compatibility analysis between two profiles

**Request:**

```json
{
  "profile_a_id": "uuid",
  "profile_b_id": "uuid",
  "male_first": boolean
}
```

**Response:**

```json
{
  "match_id": "uuid",
  "profile_a": {
    "profile_id": "uuid",
    "name": "string",
    "nakshatra_attributes": {}
  },
  "profile_b": {
    "profile_id": "uuid",
    "name": "string",
    "nakshatra_attributes": {}
  },
  "ashtakoota": {
    "varna": { "score": 0-1, "max_score": 1 },
    "vashya": { "score": 0-2, "max_score": 2 },
    "tara": { "score": 0-3, "max_score": 3 },
    "yoni": { "score": 0-4, "max_score": 4, "relationship_type": "friendly|neutral|enemy" },
    "graha_maitri": { "score": 0-5, "max_score": 5 },
    "gana": { "score": 0-6, "max_score": 6, "pairing": "string" },
    "bhakoot": { "score": 0-7, "max_score": 7, "dosha_present": boolean },
    "nadi": { "score": 0-8, "max_score": 8, "dosha_present": boolean, "dosha_cancelled": boolean },
    "total_score": 0-36
  },
  "dosha_flags": ["string"],
  "compatibility_level": "low|average|very_good|exceptional",
  "engine_version": "1.0.0",
  "created_at": "ISO8601"
}
```

**Caching:**
- Results cached by `(profile_a_id, profile_b_id, engine_version)`
- Immutable once created

---

### 3. DISCOVER MATCHES (ONE-TO-MANY)

**Endpoint:** `POST /api/jyotish/matches/discover`

**Purpose:** Find compatible matches from candidate pool

**Request:**

```json
{
  "profile_id": "uuid",
  "candidate_pool": {
    "user_ids": ["uuid"],
    "filters": {
      "minimum_guna_threshold": 18,
      "exclude_nadi_dosha": boolean,
      "exclude_gana_incompatibility": boolean,
      "exclude_yoni_incompatibility": boolean
    },
    "weights": {
      "total_guna_weight": 0.6,
      "nadi_weight": 0.2,
      "gana_weight": 0.1,
      "yoni_weight": 0.1
    },
    "limit": 50
  }
}
```

**Response:**

```json
{
  "profile_id": "uuid",
  "matches": [
    {
      "candidate_profile_id": "uuid",
      "candidate_name": "string",
      "total_guna_score": 0-36,
      "weighted_score": number,
      "dosha_flags": ["string"],
      "rank_position": number,
      "compatibility_level": "low|average|very_good|exceptional"
    }
  ],
  "total_candidates_evaluated": number,
  "total_matches_found": number,
  "filters_applied": {},
  "engine_version": "1.0.0",
  "created_at": "ISO8601"
}
```

**Behavior:**
- Evaluates all candidates
- Applies blocking rules
- Ranks by weighted score
- Returns top N matches

---

### 4. GENERATE INTERPRETATION (LLM)

**Endpoint:** `POST /api/jyotish/matches/interpret`

**Purpose:** Generate narrative interpretation for a match

**Request:**

```json
{
  "match_id": "uuid",
  "mode": "A|B|C",
  "language": "en",
  "tone": "mystical|analytical|balanced"
}
```

**Response:**

```json
{
  "interpretation_id": "uuid",
  "match_id": "uuid",
  "mode": "A|B|C",
  "language": "en",
  "sections": {
    "overview": "string",
    "core_compatibility_dynamics": "string",
    "strength_areas": ["string"],
    "friction_areas": ["string"],
    "dosha_analysis": "string",
    "long_term_potential": "string",
    "guidance": "string"
  },
  "spec_version": "1.0.0",
  "created_at": "ISO8601"
}
```

**Behavior:**
- Fetches frozen match data
- Calls LLM with specification-bound prompt
- Validates output against validation spec
- Stores interpretation (mutable)

---

### 5. GENERATE PDF REPORT

**Endpoint:** `POST /api/jyotish/matches/pdf`

**Purpose:** Generate PDF report for a match

**Request:**

```json
{
  "match_id": "uuid",
  "interpretation_id": "uuid",
  "include_remedies": boolean
}
```

**Response:**

```json
{
  "pdf_url": "string",
  "expires_at": "ISO8601"
}
```

**Behavior:**
- Fetches match data + interpretation
- Generates PDF following layout spec
- Uploads to storage
- Returns temporary signed URL

---

### 6. GENERATE AUDIO NARRATION

**Endpoint:** `POST /api/jyotish/matches/audio`

**Purpose:** Generate audio narration for a match

**Request:**

```json
{
  "interpretation_id": "uuid",
  "voice": "neutral",
  "speed": 1.0
}
```

**Response:**

```json
{
  "audio_url": "string",
  "duration_seconds": number,
  "expires_at": "ISO8601"
}
```

**Behavior:**
- Fetches interpretation text
- Chunks according to narration spec
- Generates audio sequentially
- Stitches waveforms
- Uploads to storage

---

### 7. GET PROFILE

**Endpoint:** `GET /api/jyotish/profile/:profile_id`

**Purpose:** Retrieve astrological profile

**Response:**

```json
{
  "profile_id": "uuid",
  "user_id": "uuid",
  "name": "string",
  "birth_data": {},
  "nakshatra_attributes": {},
  "calculation_version": "1.0.0",
  "created_at": "ISO8601"
}
```

---

### 8. GET MATCH

**Endpoint:** `GET /api/jyotish/matches/:match_id`

**Purpose:** Retrieve match analysis

**Response:**

```json
{
  "match_id": "uuid",
  "profile_a": {},
  "profile_b": {},
  "ashtakoota": {},
  "dosha_flags": [],
  "compatibility_level": "string",
  "engine_version": "1.0.0",
  "created_at": "ISO8601"
}
```

---

### 9. LIST USER MATCHES

**Endpoint:** `GET /api/jyotish/matches?user_id=:user_id&limit=50`

**Purpose:** List all matches for a user

**Response:**

```json
{
  "user_id": "uuid",
  "matches": [
    {
      "match_id": "uuid",
      "partner_profile_id": "uuid",
      "partner_name": "string",
      "total_guna_score": 0-36,
      "compatibility_level": "string",
      "created_at": "ISO8601"
    }
  ],
  "total_count": number
}
```

---

## ERROR RESPONSES

All errors follow this structure:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

**Error Codes:**

- `MISSING_BIRTH_DATA` - Birth data incomplete
- `INVALID_NAKSHATRA` - Nakshatra calculation failed
- `PROFILE_NOT_FOUND` - Profile does not exist
- `MATCH_NOT_FOUND` - Match does not exist
- `ENGINE_VERSION_MISMATCH` - Cached data incompatible
- `INTERPRETATION_FAILED` - LLM generation failed
- `VALIDATION_FAILED` - LLM output validation failed
- `DOSHA_BLOCKING` - Match blocked by Dosha rules

---

## VERSIONING STRATEGY

**Engine Version Format:** `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes to calculation logic
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, no logic changes

**Version Headers:**

```
X-Engine-Version: 1.0.0
X-Spec-Version: 1.0.0
X-Client-Version: 2.1.0
```

**Backward Compatibility:**

- Old engine versions remain cached
- New calculations use latest engine
- Clients specify minimum engine version

---

## RATE LIMITING

**Per User:**

- Profile creation: 10/hour
- Match analysis: 100/hour
- Match discovery: 20/hour
- Interpretation: 50/hour
- PDF generation: 20/hour
- Audio generation: 10/hour

**Exceeded:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retry_after_seconds": 3600
  }
}
```

---

## WEBHOOK SUPPORT (FUTURE)

For long-running operations:

**Request:**

```json
{
  "match_id": "uuid",
  "webhook_url": "https://..."
}
```

**Webhook Payload:**

```json
{
  "event": "match.analyzed",
  "match_id": "uuid",
  "status": "completed|failed",
  "result": {}
}
```

---

## BATCH OPERATIONS (FUTURE)

**Endpoint:** `POST /api/jyotish/matches/batch`

**Purpose:** Analyze multiple matches in one request

**Request:**

```json
{
  "profile_id": "uuid",
  "candidate_profile_ids": ["uuid"],
  "mode": "analyze|discover"
}
```

**Response:**

```json
{
  "batch_id": "uuid",
  "status": "processing|completed",
  "results": []
}
```

---

## DEBUGGING

When `X-Debug: true` is set:

**Response includes:**

```json
{
  "debug": {
    "calculation_time_ms": number,
    "cache_hit": boolean,
    "engine_version": "string",
    "nakshatra_indices": {},
    "intermediate_scores": {}
  }
}
```

---

## IDEMPOTENCY

**Idempotent Endpoints:**

- `POST /api/jyotish/profile` (same birth data = same profile)
- `POST /api/jyotish/matches/analyze` (same pair = same match)

**Non-Idempotent Endpoints:**

- `POST /api/jyotish/matches/interpret` (regenerates interpretation)
- `POST /api/jyotish/matches/pdf` (regenerates PDF)
- `POST /api/jyotish/matches/audio` (regenerates audio)

---

## CACHING HEADERS

**Calculation Responses:**

```
Cache-Control: public, max-age=31536000, immutable
ETag: "match-{match_id}-{engine_version}"
```

**Interpretation Responses:**

```
Cache-Control: private, max-age=3600
ETag: "interpretation-{interpretation_id}"
```

---

## CORS POLICY

**Allowed Origins:**

- `https://app.oneinabillion.com`
- `https://staging.oneinabillion.com`

**Allowed Methods:**

- `GET`, `POST`

**Allowed Headers:**

- `Content-Type`, `Authorization`, `X-*`

---

## SECURITY

**Input Validation:**

- All inputs validated against JSON schema
- Birth dates: 1900-2100
- Coordinates: valid lat/long
- Profile IDs: valid UUIDs

**Output Sanitization:**

- No user-generated content in calculations
- Interpretations sanitized before storage
- PDF/Audio generation sandboxed

---

## MONITORING

**Metrics to Track:**

- Calculation time per Koota
- Cache hit rate
- LLM generation time
- Validation failure rate
- Dosha detection frequency

**Alerts:**

- Engine version mismatch
- Calculation failures
- Validation failures
- Rate limit exceeded

---

**END OF DOCUMENT**
