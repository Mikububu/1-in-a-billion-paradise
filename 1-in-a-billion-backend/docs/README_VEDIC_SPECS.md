# Vedic Jyotish Matchmaking System - Complete Documentation Index

**Version:** 1.0.0  
**Last Updated:** 2026-01-05  
**Status:** Canonical Reference

---

## Overview

This directory contains the complete canonical specification for the Vedic Jyotish matchmaking system. These documents form a **binding contract** that governs all aspects of compatibility calculation, interpretation, and presentation.

**Core Principle:** Determinism, immutability, and separation of concerns.

---

## Document Hierarchy

### Level 1: Core Specification (Highest Authority)

**[VEDIC_MATCHMAKING_SPEC.md](./VEDIC_MATCHMAKING_SPEC.md)**
- Defines the canonical Ashtakoota system
- Specifies all 8 Kootas and their scoring rules
- Defines Dosha detection and cancellation logic
- Establishes compatibility interpretation bands
- **Authority:** Highest - All other documents must comply

---

### Level 2: System Specifications

#### Calculation & Matching

**[JYOTISH_MATCHING_SPEC.md](./JYOTISH_MATCHING_SPEC.md)** ⭐ **Enhanced Specification**
- Complete 6-part canonical specification (Parts I-VI)
- Ashtakoota system with all 8 Kootas
- Dasha and transit timing overlays
- Versioning, override, and safety logic
- Narrative handoff and interpretation contract
- Validation test matrix and quality gates
- Scoring engine and decision model

**[JYOTISH_CROSS_MATCHING_ENGINE_SPEC.md](./JYOTISH_CROSS_MATCHING_ENGINE_SPEC.md)**
- Defines one-to-one, one-to-many, and many-to-many matching modes
- Specifies filtering, ranking, and blocking rules
- Establishes performance requirements (10,000 candidates)
- Defines output data contracts

#### Storage & Caching

**[JYOTISH_STORAGE_AND_CACHING_SPEC.md](./JYOTISH_STORAGE_AND_CACHING_SPEC.md)**
- Defines immutable vs mutable data layers
- Specifies database schema requirements
- Establishes caching strategies and invalidation rules
- Defines audit and reproducibility guarantees

#### API & Payload Contracts

**[JYOTISH_API_AND_PAYLOAD_SPEC.md](./JYOTISH_API_AND_PAYLOAD_SPEC.md)**
- Defines all REST API endpoints
- Specifies request/response payload schemas
- Establishes versioning and caching strategies
- Defines rate limiting and error handling

---

### Level 3: LLM Integration Specifications

**[VEDIC_MATCHMAKING_LLM_SPEC.md](./VEDIC_MATCHMAKING_LLM_SPEC.md)**
- Binds LLM to canonical specification
- Defines forbidden actions and language constraints
- Specifies input requirements and authority hierarchy
- Establishes interpretation rules for each Koota

**[JYOTISH_INTERPRETATION_LAYER_SPEC.md](./JYOTISH_INTERPRETATION_LAYER_SPEC.md)**
- Defines narrative generation modes (A, B, C)
- Specifies output structure requirements
- Establishes ethical constraints
- Defines versioning and failure conditions

**[VEDIC_MATCHMAKING_LLM_OUTPUT_VALIDATION_SPEC.md](./VEDIC_MATCHMAKING_LLM_OUTPUT_VALIDATION_SPEC.md)**
- Defines validation rules for LLM outputs
- Specifies forbidden language and behaviors
- Establishes numeric consistency requirements
- Defines failure handling

---

### Level 4: Presentation Specifications

**[VEDIC_MATCHMAKING_PDF_LAYOUT_SPEC.md](./VEDIC_MATCHMAKING_PDF_LAYOUT_SPEC.md)**
- Defines PDF structure (12 sections)
- Specifies table formatting and score display
- Establishes conditional rendering rules
- Defines metadata and disclaimer requirements

**[VEDIC_MATCHMAKING_AUDIO_NARRATION_SPEC.md](./VEDIC_MATCHMAKING_AUDIO_NARRATION_SPEC.md)**
- Defines voice characteristics and pacing
- Specifies pronunciation and score reading rules
- Establishes section-by-section narration behavior
- Defines chunking and stitching rules

---

## Implementation Files

### Type Definitions

**[../src/services/vedic/types.ts](../src/services/vedic/types.ts)**
- Complete TypeScript type definitions
- Derived from canonical specifications
- Enforces structure at compile time

**[../src/services/vedic/schemas/llm-input.schema.json](../src/services/vedic/schemas/llm-input.schema.json)**
- JSON Schema for LLM input validation
- Enforces structure at runtime

---

### Data Tables

**[../src/services/vedic/nakshatra-mappings.ts](../src/services/vedic/nakshatra-mappings.ts)**
- Nakshatra to Yoni mapping (14 animal types)
- Yoni compatibility matrix (14x14)
- Nakshatra to Gana mapping (Deva/Manushya/Rakshasa)
- Gana compatibility matrix
- Nakshatra to Nadi mapping (Adi/Madhya/Antya)
- Nakshatra to Varna mapping
- Varna hierarchy and scoring

---

### Calculation Engines

**[../src/services/vedic/ashtakoota-engine.ts](../src/services/vedic/ashtakoota-engine.ts)**
- Implements all 8 Kootas:
  1. Varna Koota (1 point)
  2. Vashya Koota (2 points)
  3. Tara Koota (3 points)
  4. Yoni Koota (4 points)
  5. Graha Maitri Koota (5 points)
  6. Gana Koota (6 points)
  7. Bhakoot Koota (7 points)
  8. Nadi Koota (8 points)
- Deterministic scoring (0-36 points)
- Dosha detection and cancellation logic

**[../src/services/vedic/cross-matching-engine.ts](../src/services/vedic/cross-matching-engine.ts)**
- One-to-one detailed analysis
- One-to-many partner discovery
- Many-to-many batch matching
- Configurable filtering and weighting
- Deterministic ranking

---

## Specification Compliance

### Determinism Rule

All calculations must be reproducible:
```
Same inputs → Same outputs (always)
```

No randomness, creativity, or improvisation is permitted at the calculation level.

---

### Authority Hierarchy

When conflicts arise, authority flows from top to bottom:

1. **Astronomical calculations** (Swiss Ephemeris)
2. **Nakshatra-derived attributes** (mapping tables)
3. **Ashtakoota scoring** (calculation engine)
4. **Dosha detection** (specification rules)
5. **Chart-based modifiers** (qualitative analysis)
6. **Interpretive language** (LLM layer)

**The LLM may only operate at level 6.**

---

### Separation of Concerns

```
┌─────────────────────────────────────────┐
│   Astronomical Calculations (External)   │
│   Swiss Ephemeris, Birth Data           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Nakshatra Attribute Derivation        │
│   Mapping Tables (Immutable)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Ashtakoota Calculation Engine         │
│   Deterministic Scoring (0-36)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Cross-Matching Engine                 │
│   Filtering, Ranking, Blocking          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Interpretation Layer (LLM)            │
│   Narrative Generation (Read-Only)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Presentation Layer                    │
│   PDF Generation, Audio Narration       │
└─────────────────────────────────────────┘
```

**Each layer may only consume data from layers above it.**  
**No layer may modify data from layers above it.**

---

## Usage Guidelines

### For Developers

1. **Read specifications before coding** - All logic must derive from specs
2. **Never contradict specifications** - If specs are wrong, update specs first
3. **Maintain determinism** - Same inputs must always produce same outputs
4. **Preserve immutability** - Calculation results are append-only
5. **Separate concerns** - Calculation ≠ Interpretation ≠ Presentation

---

### For LLM Integration

1. **Inject specification text** into system prompts
2. **Validate all outputs** against validation spec
3. **Never allow score modification** - LLM receives read-only data
4. **Enforce forbidden language** - Use validation rules
5. **Version all interpretations** - Track spec version used

---

### For Testing

1. **Test determinism** - Run same inputs 100 times, verify identical outputs
2. **Test specification compliance** - Verify all rules are followed
3. **Test immutability** - Ensure calculations cannot be modified
4. **Test validation** - Verify LLM outputs pass validation
5. **Test edge cases** - Dosha cancellation, blocking rules, etc.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-05 | Initial canonical specification release |

---

## Future Extensions

The following are reserved for future implementation:

- **Dashakoota System** (South Indian 10-Koota system)
- **Transit Analysis** (temporal overlays)
- **Dasha Compatibility** (timing synchronization)
- **Rajjju Dosha** (additional dosha type)
- **Vedha Dosha** (additional dosha type)
- **Manglik Severity Grading** (detailed Mars analysis)

All extensions must create new specification documents and preserve backward compatibility.

---

## Contact & Governance

**Specification Owner:** System Architecture Team  
**Review Cycle:** Quarterly  
**Change Process:** Specification changes require architectural review

**Critical Rule:** No component may contradict these specifications. If a specification is found to be incorrect, the specification must be updated first, then the implementation.

---

**This is doctrine, not documentation.**
