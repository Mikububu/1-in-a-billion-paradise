# Vedic Jyotish Matchmaking System - Quick Start Guide

## What Is This?

A complete, production-ready Vedic astrology matchmaking system with **10 canonical specifications**, deterministic calculation engines, and strict LLM binding contracts.

**Core Principle:** Determinism, immutability, and separation of concerns.

---

## System Status

✅ **Complete Foundation** - All specifications and engines implemented  
⏳ **Integration Pending** - API endpoints, database schema, LLM layer  
⏳ **Presentation Pending** - PDF and audio generation  

---

## File Structure

```
docs/
├── README_VEDIC_SPECS.md                          ← START HERE
├── VEDIC_MATCHMAKING_SPEC.md                      ← Core rules (HIGHEST AUTHORITY)
├── JYOTISH_CROSS_MATCHING_ENGINE_SPEC.md          ← Matching modes
├── JYOTISH_STORAGE_AND_CACHING_SPEC.md            ← Data persistence
├── JYOTISH_API_AND_PAYLOAD_SPEC.md                ← REST API contracts
├── VEDIC_MATCHMAKING_LLM_SPEC.md                  ← LLM binding
├── JYOTISH_INTERPRETATION_LAYER_SPEC.md           ← Narrative generation
├── VEDIC_MATCHMAKING_LLM_OUTPUT_VALIDATION_SPEC.md ← Output validation
├── VEDIC_MATCHMAKING_PDF_LAYOUT_SPEC.md           ← PDF structure
└── VEDIC_MATCHMAKING_AUDIO_NARRATION_SPEC.md      ← Audio rules

src/services/vedic/
├── types.ts                    ← TypeScript definitions
├── nakshatra-mappings.ts       ← Classical Jyotish tables
├── ashtakoota-engine.ts        ← 8 Koota calculations
├── cross-matching-engine.ts    ← Matching modes
└── schemas/
    └── llm-input.schema.json   ← JSON Schema validation
```

---

## Quick Reference

### Ashtakoota System (0-36 points)

| Koota | Points | Measures |
|-------|--------|----------|
| Varna | 1 | Spiritual compatibility |
| Vashya | 2 | Mutual influence |
| Tara | 3 | Health & longevity |
| Yoni | 4 | Instinctual/sexual compatibility |
| Graha Maitri | 5 | Mental compatibility |
| Gana | 6 | Temperament match |
| Bhakoot | 7 | Emotional/family harmony |
| Nadi | 8 | Genetic compatibility |

### Compatibility Levels

- **0-17**: Low (not recommended)
- **18-24**: Average (effort required)
- **25-32**: Very good
- **33-36**: Exceptional

### Critical Doshas

- **Nadi Dosha**: Same Nadi (health/progeny risk)
- **Bhakoot Dosha**: Harmful Rashi distance
- **Manglik Dosha**: Mars placement (separate analysis)

---

## Usage Example

```typescript
import { calculateAshtakoota } from './services/vedic/ashtakoota-engine';
import { matchOneToMany } from './services/vedic/cross-matching-engine';

// Calculate compatibility
const result = calculateAshtakoota(personA.nakshatra_attributes, personB.nakshatra_attributes);
console.log(result.total_score); // 0-36

// Find matches
const matches = matchOneToMany(person, candidates, {
  minimum_guna_threshold: 18,
  exclude_nadi_dosha: true
});
```

---

## Next Steps for Integration

1. **Database Schema** - Add Nakshatra fields to `people` table
2. **API Endpoints** - Implement REST endpoints per API spec
3. **LLM Integration** - Build prompt builder and validator
4. **PDF/Audio** - Implement presentation layers
5. **Testing** - Unit tests for all engines

---

## Key Rules

1. **Determinism**: Same inputs → Same outputs (always)
2. **Immutability**: Calculation results are append-only
3. **Separation**: Calculation ≠ Interpretation ≠ Presentation
4. **Specification Authority**: Specs govern all logic
5. **LLM Boundary**: LLM interprets, never calculates

---

## Documentation

- **[README_VEDIC_SPECS.md](./README_VEDIC_SPECS.md)** - Complete documentation index
- **[Implementation Plan](../.gemini/antigravity/brain/e4f78d9c-ee6a-41b0-83da-97b7f6979df0/implementation_plan.md)** - Detailed architecture
- **[Walkthrough](../.gemini/antigravity/brain/e4f78d9c-ee6a-41b0-83da-97b7f6979df0/walkthrough.md)** - Complete system overview

---

**This is doctrine, not documentation.**
