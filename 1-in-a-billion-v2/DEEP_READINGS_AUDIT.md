# Deep Readings Audit — Full Report

**Date:** March 2, 2026
**Scope:** Prompt quality + Full data pipeline + Output expectations
**Coverage:** 5 systems × 3 reading types (individual, overlay, verdict)

---

## CRITICAL ISSUES

### 1. Word Count Contradiction — The LLM Receives Two Conflicting Instructions

**Severity: CRITICAL** — The model is told two different word counts in the same prompt.

**What happens:**
- `buildIndividualStructure()` injects: **"WORD COUNT: 4500 WORDS"** (individual.ts line 56)
- Then `getWordTarget()` injects: **"WORD COUNT: 5000-10000 words"** (wordCounts.ts line 20)
- Both appear in the same prompt (builder.ts lines 204 and 223)

**Same problem for overlays:**
- `buildOverlayStructure()` injects: **"WORD COUNT: 3000 WORDS"** (overlay.ts line 64)
- Then `getWordTarget()` injects: **"WORD COUNT: 5000-10000 words"** (builder.ts lines 318 and 348)

**Impact:** The LLM has to choose between contradictory instructions. It likely settles on one or averages, making output length unpredictable.

**Fix:** Remove the hardcoded word counts from `buildIndividualStructure()` and `buildOverlayStructure()`. Let `getWordTarget()` be the single source of truth. Update the structure section breakdowns to sum to the centralized target (7000 words).

---

### 2. Overlay Structure Object vs. Overlay Prompt — Completely Different Documents

**Severity: CRITICAL** — Two separate "overlay" definitions describe entirely different readings.

**overlay.ts line 9-52** — The `OVERLAY_STRUCTURE` object:
- **12,000 words**, 90 minutes audio
- 7 sections: Opening (500) + Person A (2500) + Person B (2500) + The Dynamic (4000) + Shadow Work (2000) + Gift Potential (1500) + Closing (500)
- This is a massive, full-portrait document

**overlay.ts line 58-87** — The `buildOverlayStructure()` function:
- **3,000 words**, 18-20 minutes audio
- 5 sections: Attraction (700) + Friction (600) + Sexual Chemistry (700) + Shadow Dance (700) + Gift (300)
- This is a focused relational snapshot

**Impact:** The `OVERLAY_STRUCTURE` object is exported but **never used anywhere** — it's dead code from an earlier design. Only `buildOverlayStructure()` is called. But anyone reading the file would assume 12,000 words is the target, and `totalWords: 12000` is misleading metadata if referenced for analytics or pricing.

**Fix:** Either delete the `OVERLAY_STRUCTURE` object or update it to match the actual output. Add a comment clarifying which is canonical.

---

### 3. Verdict Prompt Has Two Separate Implementations

**Severity: CRITICAL** — There are two different verdict prompt builders, and they produce very different outputs.

**A. `paidReadingPrompts.ts` line 494** — `buildVerdictPrompt()`:
- 4,500 words minimum
- 5-part structure with compatibility scores
- Receives narrative triggers from all prior readings
- Includes style, spice, forbidden sections
- **This is the one actually used** (called from textWorker.ts line 752)

**B. `verdictTrigger.ts` line 87** — `buildVerdictWritingPrompt()`:
- Uses `targetWords` parameter (flexible)
- 4-6 section headlines, no compatibility scores
- Minimal instructions ("precise narrator delivering a final synthesis")
- No style/forbidden sections
- **This is NOT used for bundle_verdict jobs** — only exists in the trigger engine

**Impact:** The trigger engine verdict is dead code or a fallback. If someone refactors and accidentally routes to it, the verdict quality drops dramatically.

**Fix:** Mark `verdictTrigger.ts`'s `buildVerdictWritingPrompt` as deprecated or remove it. Ensure all verdict routing goes through `paidReadingPrompts.buildVerdictPrompt`.

---

## MAJOR ISSUES

### 4. Spice Level Not Applied in System Trigger Prompts

**Severity: MAJOR** — Spice level affects individual/overlay prompts via `builder.ts` (through `buildSpiceSection`), but the trigger engine's system-specific prompts (westernTrigger.ts, vedicTrigger.ts, humanDesignTrigger.ts, geneKeysTrigger.ts, kabbalahTrigger.ts) have **zero spice awareness**.

The trigger call (80-120 words) determines the narrative spine for the entire reading. If the trigger is generated without spice calibration, the writing call inherits a sanitized spine even if spice is cranked to 10.

**Fix:** Pass `spiceLevel` to all trigger prompt builders and add a brief spice calibration line to the trigger prompt (e.g., "Shadow depth: 8/10 — lean into taboo, addiction patterns, sexual shadow").

---

### 5. Human Design Strip Drops ~77% of Planetary Activations

**Severity: MAJOR** — `stripHDChartData()` (humanDesignTrigger.ts line 26) keeps only Sun, Earth, Moon from both Personality and Design activations. All other planetary gates (North/South Node, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto) are silently dropped.

Additionally, the entire "ALL ACTIVE GATES" section is dropped.

**Impact for HD readings:** Many of the most interesting HD dynamics come from defined channels (two gates connecting), which require knowing ALL active gates. With only 6 gates preserved (3 per side), channel completion detection is severely limited.

**Fix:** Expand `KEEP_PLANETS` to include at least the personal planets (Mercury, Venus, Mars) and Nodes. Consider keeping the full gate list in a compressed format (just gate numbers).

---

### 6. Verdict Has No System-Specific Guidance

**Severity: MAJOR** — The verdict prompt (paidReadingPrompts.ts lines 525-613) asks the LLM to synthesize "all five systems" and produce compatibility scores per system, but it **never injects any of the system guidance files** (western.ts, vedic.ts, human-design.ts, gene-keys.ts, kabbalah.ts).

The LLM is asked to produce Vedic-specific verdicts ("Name the Nakshatra compatibility, Rahu/Ketu axis interplay") but has no Vedic terminology guidance, no sidereal calculation context, and no system-specific rules. It relies entirely on its training data.

**Impact:** Verdict compatibility scores may use incorrect terminology or miss system-specific nuances that the individual/overlay prompts handle correctly via system guidance injection.

**Fix:** Inject a compressed version of each system's guidance (key terms + core principles) into the verdict prompt, or at minimum, inject the terminology sections.

---

## MODERATE ISSUES

### 7. Vedic Terminology Enforcement is Post-Hoc Only

**Severity: MODERATE** — The Vedic system guidance (vedic.ts, 533 lines) has a massive 180-line TERMINOLOGY section that tells the LLM to use Sanskrit terms with explanations. But this is purely instructional — there's no validation, no post-processing check, and no hard constraint preventing the LLM from using Western terminology like "Mercury retrograde" instead of "Budha vakri."

The individual and overlay builders inject `buildSystemSection(system, ...)` which includes the Vedic guidance. But the trigger call (which sets the narrative spine) doesn't include system guidance in the trigger engine path, so the spine might use Western terminology.

**Fix:** Add a brief Vedic terminology reminder to the trigger prompt when `system === 'vedic'`. Consider a post-processing validation step that flags Western terminology in Vedic readings.

---

### 8. Ashtakoot Score Data is Conditional with No Fallback

**Severity: MODERATE** — The overlay prompt for Vedic readings includes Ashtakoot (8 Kootas, 36 Gunas) scoring data "if provided." If the data isn't available or calculation fails, the prompt says nothing about how to handle the absence. The LLM might:
- Silently skip it (losing a key Vedic overlay feature)
- Hallucinate scores
- Mention it's missing (breaking the reading's flow)

**Fix:** Add explicit fallback language: "If Ashtakoot data is not provided, acknowledge that Kundali Milan requires precise Moon placement data and focus on Nakshatra compatibility and Dasha timing instead."

---

### 9. Two Prompt Paths Exist — builder.ts vs. triggerEngine

**Severity: MODERATE** — There are effectively two parallel prompt architectures:

1. **`prompts/builder.ts`** — Rich prompts with style, spice, forbidden, system guidance, structure, quality sections, word targets
2. **`promptEngine/triggerEngine/`** — Lean two-call architecture (strip → trigger → writing) with minimal instructions

`textWorker.ts` routes to the builder.ts path for most readings. The trigger engine's writing prompts appear to be used only in specific contexts or as fallbacks. But both exist, and it's unclear which should be canonical going forward.

**Fix:** Document which path is canonical. If builder.ts is the production path, consider marking the trigger engine writing prompts as deprecated or integrating them.

---

### 10. Individual Structure Section Totals Don't Match Target

**Severity: MODERATE** — The individual structure sections sum to:
- 1000 + 1000 + 1400 + 600 + 500 = **4,500 words**

But `getWordTarget()` says **5,000-10,000 words** (target 7,000).

The LLM receives both. If it follows the structure breakdowns (4,500 total), it'll produce a reading that's below the minimum floor of the centralized config. If it follows `getWordTarget()`, the section breakdowns are misleading.

**Fix:** Update section word counts to sum to 7,000 (the target from wordCounts.ts). For example: 1400 + 1400 + 2000 + 1200 + 1000.

---

## MINOR ISSUES

### 11. Dead Code: OVERLAY_STRUCTURE Export

The `OVERLAY_STRUCTURE` constant (overlay.ts lines 9-52) is exported but imported nowhere. Same for its metadata (`totalWords: 12000`, `audioMinutes: 90`). Safe to remove.

### 12. Inconsistent Comment Headers

`individual.ts` line 4 says "Word count controlled by src/prompts/config/wordCounts.ts" but then hardcodes 4,500 in the function. `overlay.ts` line 4 says "12,000 words" which doesn't match either path.

---

## QUALITY SCORECARD

| Category | Grade | Notes |
|---|---|---|
| Trigger prompt clarity | **A** | Clean two-call architecture, narrative spine concept is strong |
| System guidance depth | **A** | Especially Vedic (533 lines), rich terminology sections |
| Writing prompt quality | **A-** | Builder.ts prompts are comprehensive and well-structured |
| Documentation consistency | **D** | Three conflicting word count sources, dead code, misleading comments |
| Guardrails & validation | **C** | No post-processing term checks, no output length enforcement |
| Chart stripping | **B-** | Western/Vedic good, HD too aggressive, Gene Keys/Kabbalah acceptable |
| Verdict synthesis | **B** | Good structure with compatibility scores, but missing system guidance |
| Spice consistency | **C+** | Applied in builder.ts path, missing from trigger engine path |

---

## RECOMMENDED FIX PRIORITY

1. **Word count unification** (Critical #1, #10) — 30 min fix, biggest impact on output consistency
2. **Delete dead overlay structure** (Critical #2, Minor #11) — 5 min cleanup
3. **Clarify verdict routing** (Critical #3) — 15 min to deprecate/remove unused path
4. **Expand HD strip** (Major #5) — 20 min, improves HD reading quality significantly
5. **Add spice to triggers** (Major #4) — 30 min across 5 trigger files
6. **Inject system guidance in verdict** (Major #6) — 45 min, compressed system summaries
7. **Vedic terminology in triggers** (Moderate #7) — 15 min
8. **Ashtakoot fallback language** (Moderate #8) — 10 min
9. **Document canonical path** (Moderate #9) — 15 min, add architecture comments
