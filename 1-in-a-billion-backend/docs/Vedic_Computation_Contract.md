# Vedic Computation Contract

**MASTER CONTRACT PROMPT**

## Vedic Compatibility and Reading Engine Specification

You are implementing a deterministic Vedic astrology computation system. This system must strictly separate computation from interpretation and must support three execution modes without leakage between them.

---

## 1. Core Principle

All Vedic calculations are **factual, numeric, and non-narrative**.

Interpretation is always layered afterward and is **mode-dependent**.

The computation core must **never** contain explanatory, psychological, relational, or poetic language.

---

## 2. Execution Modes

The system operates in exactly **three modes**:

- `single_reading`
- `overlay_reading`
- `batch_matching`

The execution mode is **mandatory input** and determines which computations are called and how outputs are interpreted.

---

## 3. Vedic Core Computation Layer

This layer is **mode-agnostic** and identical across all use cases.

It includes only the following primitives:

### Ashtakoota computation using exact numeric tables:
- Varna
- Vashya
- Tara
- Yoni
- Graha Maitri
- Gana
- Bhakoot
- Nadi

### Additional primitives:
- **Yoni compatibility matrix** returning numeric score and conflict flag
- **Gana compatibility matrix** returning numeric score and conflict flag
- **Nadi Dosha detection** returning severity flag
- **Manglik Dosha detection** using Mars house placement
- **Seventh house condition** evaluation
- **Dasha overlap computation** returning temporal alignment scores

### Output types:
All outputs are **numbers, enums, or booleans only**.

Example outputs:
```
ashtakoota_total
yoni_score
gana_conflict
nadi_dosha_level
manglik_status
seventh_house_strength
dasha_alignment_score
```

**No text is allowed in this layer.**

---

## 4. Execution Router

A router decides which core primitives are called.

### Rules:

#### If mode is `single_reading`:
- Do **not** call Ashtakoota totals
- Do **not** compute partner-dependent scores
- Only compute self-relevant primitives

#### If mode is `overlay_reading`:
- Compute all pairwise primitives including Ashtakoota, Yoni, Gana, Nadi, Manglik, Seventh house

#### If mode is `batch_matching`:
- Compute numeric primitives only
- **No** Dasha narrative
- **No** house interpretation
- **No** text generation

**The core must not be aware of the mode. Only the router is.**

---

## 5. Interpretation Layer

Interpretation is **downstream** and **mode-specific**.

The same numeric output may produce different text depending on mode.

- **Single reading interpretation** focuses on self patterns.
- **Overlay reading interpretation** focuses on relational dynamics.
- **Batch matching** produces no narrative text.

**Interpretation must never alter computation.**

---

## 6. Validation Rules

- The same two charts must always produce **identical numeric outputs** regardless of mode.
- Only interpretation may differ.

### Deterministic Truth Guard (V2)
- **Sidereal Robustness:** If the Swiss Ephemeris library's sidereal flag (`SEFLG_SIDEREAL`) fails to return house data (e.g., `swe_houses_ex` error), the system MUST perform a **manual sidereal adjustment**.
- **The Formula:** `Sidereal = Tropical - Lahiri Ayanamsa`.
- **Hallucination Prevention:** The `textWorker` MUST NEVER fall back to `0°` longitude if calculation data is missing. If calculation fails, the task must **fail loudly**. Fallback to zero is a **fatal error** as it causes LLM hallucinations (e.g., "Pisces/Revati" for an October birth).

**Fatal errors:**
- Any leakage of partner logic into single reading is a **fatal error**.
- Any narrative text in the core layer is a **fatal error**.
- **Hallucination on missing data (falling back to 0) is a fatal error.**

---

## 7. Authority

This specification is the **source of truth**.

**No creative extrapolation is allowed beyond it.**

---

**⸻**

That is the prompt.

**One document. One contract. One source of truth.**
