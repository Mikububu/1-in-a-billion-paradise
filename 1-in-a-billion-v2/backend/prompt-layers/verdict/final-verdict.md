# Final Verdict (Bundle Only)

## Scope
- This layer is only for bundle final-verdict documents (16th reading in bundle_verdict jobs).
- The Final Verdict is an independent reading — the same weight and importance as any of the 15 system readings.
- Input is synthesis summaries from all generated system readings.
- You must integrate evidence from all systems into one coherent conclusion.

## Required Verdict Logic
1. State what all systems strongly agree on.
2. State where systems diverge and why.
3. Deliver one clear verdict band:
   - GO
   - CONDITIONAL
   - NO GO
4. Explain what would need to change for verdict improvement.
5. Define concrete red flags and concrete non-negotiables.

## Behavioral Grounding
- Keep verdict tied to behavior loops, attachment patterns, conflict dynamics, repair capacity, and long-term sustainability.
- Do not hide behind vague spirituality.

## Structure (internal guidance)
- Synthesis of cross-system agreement
- Core risk map
- Core growth map
- Final verdict band
- Practical path forward

## Output Constraint
- Return continuous prose only.
- No markdown in final output.
- No bullet points in final output.

---

## SCORING PIPELINE IMPROVEMENT PLAN (TODO)

### Current Problem
The verdict prompt asks one LLM call to write 4500 words of prose AND invent 13 compatibility scores from scratch, all at once. The scores have no mathematical basis — they're whatever the model "feels" after writing an essay. The big Overall Alignment number (e.g., "2/10") has no grounding in actual cross-system data.

### What Currently Happens
1. Each of the 5 overlay readings generates a COMPATIBILITY SNAPSHOT with 6 scored categories:
   - Sexual Chemistry [0-100]
   - Past Life Connection [0-100]
   - World-Changing Potential [0-100]
   - Karmic Verdict [0-100]
   - Magnetic Pull [0-100]
   - Shadow Risk [0-100]
2. These 30 scores (5 systems × 6 categories) are **buried in the text output** and never extracted.
3. The verdict prompt receives only `narrativeTrigger` paragraphs (1 per reading = 15 total) + 600-char excerpts.
4. The verdict re-invents ALL scores from scratch — no connection to the per-system scores.
5. Result: the final big number feels arbitrary, not computed.

### What Should Happen Instead

#### Step 1: Extract per-overlay scores from completed tasks
- When each overlay text_generation task completes, **parse the COMPATIBILITY SNAPSHOT** from the output text.
- Store the 6 scores as structured data in `task.output.scores` (alongside existing `narrativeTrigger`, `excerpt`, etc.).
- Regex pattern: `CATEGORY_NAME: [number]` at start of line.

#### Step 2: Feed structured scores into the verdict
- When the verdict task runs, collect all completed overlay task outputs.
- Build a **CROSS-SYSTEM SCORE MATRIX** as structured input:
  ```
  CROSS-SYSTEM COMPATIBILITY DATA:

  SEXUAL CHEMISTRY:
    Western: 82  |  Vedic: 45  |  Human Design: 73  |  Gene Keys: 91  |  Kabbalah: 58
    Mean: 69.8  |  Spread: 46  |  Agreement: LOW

  PAST LIFE CONNECTION:
    Western: 34  |  Vedic: 88  |  Human Design: 22  |  Gene Keys: 67  |  Kabbalah: 91
    Mean: 60.4  |  Spread: 69  |  Agreement: VERY LOW
  ...
  ```
- The verdict prompt can now reference REAL numbers from REAL chart analysis.

#### Step 3: Compute the big number mathematically
- **Overall Alignment** = weighted aggregation of per-category cross-system means.
- Weights TBD (e.g., Karmic Verdict and Long-Term Sustainability weighted higher than Sexual Chemistry).
- The LLM writes the prose interpretation of what a 67/100 means for THIS specific couple — but does NOT invent the 67.
- Alternatively: LLM gets the pre-computed score + the score matrix and writes a verdict AROUND the number, not inventing it.

#### Step 4: Separate scoring from prose (two LLM calls)
- **Call 1: Verdict essay** — uses narrativeTriggers + pre-computed score matrix as context. Writes the 4500-word synthesis. Focuses on storytelling and insight, not number-crunching.
- **Call 2: Score block** — uses the 30 overlay scores as hard input. Produces the final 13 scored categories with 4-sentence verdicts anchored in cross-system mathematics. Overall Alignment is computed, not vibed.

### Implementation Order
1. Add score extraction to textWorker overlay output parsing
2. Store scores in task output JSON
3. Build score matrix aggregation function
4. Update `buildVerdictPrompt()` to include score matrix
5. Split verdict into two LLM calls (prose + scores)
6. Compute Overall Alignment mathematically
7. Test with real bundle_verdict job

### Open Questions
- What should the category weights be for Overall Alignment?
- Should the GO / CONDITIONAL / NO GO band be derived from the score (e.g., >70 = GO, 40-70 = CONDITIONAL, <40 = NO GO)?
- Should we display the per-system breakdown in the app UI alongside the big number?
- Do we want the score to be 0-100 or normalized to 0-10 for the "big number"?
