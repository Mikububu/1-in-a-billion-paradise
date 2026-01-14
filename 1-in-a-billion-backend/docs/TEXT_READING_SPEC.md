# Text Reading Specification

**Status:** Draft
**Last Updated:** 2026-01-14
**Consumer:** Text Generators (LLM Prompts)

This document serves as the **AUTHORITATIVE CONTRACT** for Text generation. The generation logic must adhere strictly to these structural rules.

---

## 1. Markdown Structure
**Goal:** Clean, structured source text for generation.

### 1.1 Hierarchy
- `# Title` (The Book Title - logic must strip this if generating a chapter)
- `## Chapter Title` (Used for Audio Split)
- `### Section` (Logical grouping)

### 1.2 Formatting Rules
- **Bold:** `**text**` for emphasis.
- **Italic:** `*text*` for sub-emphasis.
- **Lists:** `-` for bullet points.
- **No HTML:** Raw markdown only.

## 2. Content Structure
- **Introduction:** Brief hook.
- **Body:** Structured sections based on astrological placements.
- **Conclusion:** Synthesis of the reading.

---

## 3. Reading Types & Document Contract (Job → Tasks → Text)

Text generation is driven by `job_tasks` rows of `task_type = 'text_generation'`.

### 3.1 Job Types

- **extended**: 1 doc per selected system
- **synastry** (aka compatibility overlay): 3 docs per selected system (**NO verdict**)
- **nuclear_v2**: 16 docs total (5 systems × 3 docs + 1 verdict synthesis)

### 3.2 Doc Types (task.input.docType)

Valid `docType` values:

- `individual` (extended)
- `person1` (synastry + nuclear_v2)
- `person2` (synastry + nuclear_v2)
- `overlay` (synastry + nuclear_v2)
- `verdict` (nuclear_v2 only; docNum 16)

### 3.3 Critical Data-Scoping Rule (Prevents Audio/Text Mismatch)

When generating text for a doc:

- **docType = person1**: the prompt must include **ONLY person1 chart data** (no person2 placements/birthdata/name)
- **docType = person2**: the prompt must include **ONLY person2 chart data**
- **docType = overlay**: the prompt must include **BOTH** people’s chart data (because it is the relationship analysis)

This scoping is non-negotiable: mixing chart data across doc types creates “wrong-person / wrong-reading” outputs that then cascade into audio/PDF artifacts.
