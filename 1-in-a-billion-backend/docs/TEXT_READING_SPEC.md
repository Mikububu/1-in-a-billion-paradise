# Text Reading Specification

**Status:** Draft
**Last Updated:** 2026-01-05
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
