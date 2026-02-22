# Codex Audit Prompt — Full Architecture Review and Bugfix
## 1-in-a-billion-v2 / backend

Paste this entire document as your Codex task prompt.

---

## Context: What This Codebase Does

This is the backend for a luxury astrology/consciousness app called "1 in a Billion." It generates
long-form individual readings (3,500 words each) across five esoteric systems: Western astrology,
Vedic astrology, Human Design, Gene Keys, and Kabbalah. Each reading is later converted to audio
and packaged into a PDF. The main worker that generates these readings is:

`src/workers/textWorker.ts`

## Context: What Was Just Rebuilt

We replaced a failing legacy pipeline with a clean two-call "wound engine" architecture.

**Old pipeline (broken):**
1. Digest call — preliminary LLM call producing structured analysis fields from raw chart data
2. Composition engine — assembled 25,000-character prompts from MD layer files
3. Main writing call — model wrote inside 25k chars of compliance instructions
4. Expansion passes — if output too short, auto-continued 1-3 times (caused quality collapse)

**New architecture (what we built):**
For each of the five individual reading systems, three steps only:
1. `stripXChartData(raw: string)` — pure TypeScript, no LLM, reduces 800-line chart data to ~35
   highest-signal lines
2. `buildXWoundPrompt()` — ~20-line prompt → one 80-120 word wound paragraph naming the central
   psychological friction
3. `buildXWritingPrompt()` — wound paragraph + stripped chart → 3,500-word literary reading

No digest. No expansion passes. No compliance rewrites. Model stops when done.

**Files written:**
```
src/promptEngine/woundEngine/westernWound.ts
src/promptEngine/woundEngine/vedicWound.ts
src/promptEngine/woundEngine/humanDesignWound.ts
src/promptEngine/woundEngine/geneKeysWound.ts
src/promptEngine/woundEngine/kabbalahWound.ts
```

These are wired into `src/workers/textWorker.ts` via a `generationComplete` flag. When the wound
engine runs for a system, it sets `generationComplete = true` and skips the legacy pipeline.

---

## Your Task

**Read these files in full before doing anything:**

```
src/workers/textWorker.ts
src/promptEngine/woundEngine/westernWound.ts
src/promptEngine/woundEngine/vedicWound.ts
src/promptEngine/woundEngine/humanDesignWound.ts
src/promptEngine/woundEngine/geneKeysWound.ts
src/promptEngine/woundEngine/kabbalahWound.ts
src/prompts/config/wordCounts.ts
src/services/chartDataBuilder.ts
```

Then perform a complete audit and fix every bug you find. Known bugs are listed below. You may
find additional bugs — fix those too. Do not refactor working code. Do not touch files not listed
unless a bug requires it.

---

## Known Bugs — Fix All of These

### BUG 1 — Western cost logging fires twice (textWorker.ts)

In the western wound engine block, `getLastUsage()` is called and logged immediately after
`buildWesternWritingPrompt()` is constructed — before the actual writing LLM call runs. At that
moment, `getLastUsage()` returns the wound call's usage, not the writing call's usage. Then it
logs again correctly after the writing call. This double-logs the wound-call cost as writing cost.

**Fix:** Delete the premature `writingUsage2` block. Only call `getLastUsage()` and log cost after
`llmPaid.generateStreaming(writingPrompt, ...)` completes.

Also audit all other four system blocks (vedic, human_design, gene_keys, kabbalah) for the same
pattern. The western block appears to be the only one with this specific bug but verify.

### BUG 2 — Brace structure / generationComplete guard audit (textWorker.ts)

The five wound engine blocks use a `generationComplete` flag to prevent double-execution. Audit
the exact brace nesting in the else branch (lines approximately 590-810). Verify:

- The western block does NOT check `!generationComplete` before entering (it's the first, fine)
- Vedic, HD, gene_keys, kabbalah blocks ALL check `!generationComplete` before entering
- All five blocks are inside the same `else` branch (non-verdict path)
- None of the five blocks are accidentally nested inside each other
- The legacy `composePromptFromJobStartPayload` block only runs when `!generationComplete`

If any block is missing its `!generationComplete` guard, add it. The exact code pattern should be:

```typescript
if (!generationComplete && system === 'vedic' && docType !== 'overlay') {
  // ... vedic wound engine ...
  generationComplete = true;
}
if (!generationComplete && system === 'human_design' && docType !== 'overlay') {
  // etc.
}
```

### BUG 3 — stripVedicChartData broken graha matching (vedicWound.ts)

Current code:
```typescript
const KEEP_GRAHAS = new Set([
  'surya (sun)', 'chandra (moon)', 'mangal (mars)',
  'shani (saturn)', 'rahu', 'ketu',
]);
// ...
if (inGrahas) {
  if (/^- /.test(t)) {
    const lc = t.toLowerCase();
    if (KEEP_GRAHAS.has([...KEEP_GRAHAS].find(g => lc.includes(g)) || '')) {
      out.push(line);
    }
  }
  continue;
}
```

The Set lookup `KEEP_GRAHAS.has(find_result)` is logically redundant and fragile. The `|| ''`
fallback means empty string is checked against the Set (always false, so that part works) but the
overall pattern is confusing and brittle if chart data formatting varies.

**Fix:** Replace with a simple array check:

```typescript
const GRAHA_KEYWORDS = ['surya', 'chandra', 'mangal', 'shani', 'rahu', 'ketu'];

if (inGrahas) {
  if (/^- /.test(t)) {
    const lc = t.toLowerCase();
    if (GRAHA_KEYWORDS.some(g => lc.includes(g))) {
      out.push(line);
    }
  }
  continue;
}
```

This correctly matches "Surya (Sun)", "SURYA", "surya (Sun)" etc.

### BUG 4 — stripHDChartData exits section on empty line (humanDesignWound.ts)

Current code resets `inPersonality` and `inDesign` flags when it encounters an empty line inside
those sections:

```typescript
} else if (t === '') {
  inPersonality = false;
  inDesign = false;
  out.push(line);
}
```

If the raw HD chart data contains any blank lines between planet activation entries (which is the
standard format), all planet entries after the first blank line leak through unfiltered to `out`.

**Fix:** Remove the empty-line exit condition. Section flags should only be cleared when a new
section header is detected. Look at what the actual HD chart data section headers are (check
`src/services/chartDataBuilder.ts` or `src/services/humanDesignCalculator.ts` for the format) and
clear flags only on those. The safe pattern:

```typescript
// Only clear on new section header, not on blank line
if (inPersonality || inDesign) {
  if (/^- /.test(t)) {
    const lc = t.toLowerCase();
    if (['sun', 'earth', 'moon'].some(p => lc.includes(p))) {
      out.push(line);
    }
  } else if (t !== '' && !/^PERSONALITY/.test(t) && !/^DESIGN/.test(t)) {
    // New section header encountered — exit activation tracking
    inPersonality = false;
    inDesign = false;
    out.push(line); // include the new section header
  }
  continue;
}
```

Adjust based on actual chart data format.

### BUG 5 — stripGeneKeysChartData Activation Sequence is implicit fallthrough (geneKeysWound.ts)

Current code:
```typescript
if (/^ACTIVATION SEQUENCE/.test(t)) { inVenus = false; out.push(line); continue; }
```

When ACTIVATION SEQUENCE is detected, it clears `inVenus` but sets no `inActivation` flag.
Activation sequence content then passes through via the final `out.push(line)` at the bottom of
the loop — not because it was explicitly kept, but because no section flag is active to filter it.

This works accidentally now but will break if any section is added between ACTIVATION SEQUENCE
and VENUS SEQUENCE, or if the chart data format changes.

**Fix:** Add an explicit `inActivation` flag:

```typescript
let inActivation = false;

// In the section routing:
if (/^ACTIVATION SEQUENCE/.test(t)) {
  inActivation = true;
  inPearl = false;
  inVenus = false;
  out.push(line);
  continue;
}
if (/^VENUS SEQUENCE/.test(t)) {
  inActivation = false;
  inVenus = true;
  venusCount = 0;
  out.push(line);
  continue;
}

// In the body:
if (inActivation) { out.push(line); continue; }
```

### BUG 6 — wordCounts global change breaks overlay/verdict floor (wordCounts.ts + textWorker.ts)

`WORD_COUNT_LIMITS.min` was changed from 6,500 to 3,000 for individual reading quality. But
`HARD_FLOOR_WORDS` in textWorker uses this same constant for expansion pass logic on ALL docTypes
including `overlay` and `verdict`. Overlay docs contain two people's charts and need to be longer.
Verdict docs synthesize 15 prior readings and also need more than 3,000 words.

**Fix:** Add separate constants to `wordCounts.ts`:

```typescript
export const WORD_COUNT_LIMITS = {
  min: 3000,
  target: 3500,
  max: 4000,
};

export const WORD_COUNT_LIMITS_OVERLAY = {
  min: 5000,
  target: 6000,
  max: 7000,
};

export const WORD_COUNT_LIMITS_VERDICT = {
  min: 4000,
  target: 5000,
  max: 6000,
};
```

In textWorker.ts, import the new constants and set `HARD_FLOOR_WORDS` conditionally:

```typescript
const HARD_FLOOR_WORDS =
  docType === 'overlay' ? WORD_COUNT_LIMITS_OVERLAY.min :
  docType === 'verdict' ? WORD_COUNT_LIMITS_VERDICT.min :
  WORD_COUNT_LIMITS.min;
```

### BUG 7 — chartData vs chartDataForPrompt aliasing (textWorker.ts)

The wound engine blocks use `chartData` (built above by `buildChartDataForSystem`). The legacy
prompt engine path uses `chartDataForPrompt`. Verify these are the same variable or correctly
assigned. If `chartDataForPrompt` is never assigned from `chartData`, overlay docs may receive
stale or empty chart data.

Search for all assignments to `chartDataForPrompt` and trace where it's first set. If it's a
separate variable that needs to equal `chartData`, add the assignment:

```typescript
const chartDataForPrompt = chartData;
```

immediately after `chartData` is built, before any wound engine blocks run.

### BUG 8 — preserveSurrealHeadlines read before generationComplete is set (textWorker.ts)

Current code (appears after the wound engine blocks):
```typescript
let preserveSurrealHeadlines = generationComplete
  ? true
  : String(composedV2?.diagnostics?.styleLayerId || '').includes('incarnation');
```

If this line appears BEFORE the five wound engine if-blocks in the actual file, then
`generationComplete` is always `false` here and the ternary always takes the else branch.
The wound engine blocks themselves call `tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: true }), { preserveSurrealHeadlines: true })` with hardcoded `true`, so this specific variable doesn't affect the wound engine output — but it's still wrong.

**Fix option A:** Move the `preserveSurrealHeadlines` declaration to after all wound engine blocks.

**Fix option B (simpler):** Each wound engine block already hardcodes `preserveSurrealHeadlines: true`
inline. Leave those hardcoded. Only the `preserveSurrealHeadlines` variable used in the expansion
pass matters — and expansion passes don't run for wound engine systems. So document the issue with
a comment and leave it for a future cleanup. Choose whichever is cleaner.

---

## Additional Audit Tasks (Beyond Known Bugs)

After fixing the above, perform these checks:

### A. Confirm individual=true isolation

When `docType === 'person1'` or `docType === 'person2'`, `buildChartDataForSystem` is called with
`null` for the other person's data. Confirm the chartDataBuilder actually omits all second-person
data in those cases and does not include any relationship or synastry fields.

### B. Confirm overlay doesn't hit wound engine

All five wound engine blocks check `docType !== 'overlay'`. Verify that when docType is `overlay`,
execution falls through to the legacy `composePromptFromJobStartPayload` path cleanly — no
`generationComplete = true` is ever set, and the legacy engine receives the correct combined chart
data for both people.

### C. Confirm expansion passes are fully skipped for wound engine systems

The expansion `expandToHardFloor()` call and the loop around it should only fire when
`!generationComplete`. Verify the exact condition in the code. If expansion can still fire for
wound engine systems, this would cause the same quality collapse we fixed. Add the
`generationComplete` guard explicitly if it's missing.

### D. Wound engine error handling

Each wound engine block calls `llmPaid.generateStreaming()` twice. If the wound call returns empty
string or throws, the writing call receives an empty wound paragraph. Add guards:

```typescript
const wound = String(woundRaw || '').trim();
if (!wound) {
  throw new Error(`Wound call returned empty for ${system} ${docType}: ${subject.name}`);
}
```

This prevents silent failures where the writing call gets no wound spine and produces a generic
reading.

### E. Vedic debug logs are production noise (textWorker.ts)

Around line 826, there are 6 `console.log` statements specifically for Vedic debugging:
```typescript
if (system === 'vedic') {
  console.log('🔍 [Vedic Debug] System:', system);
  // ...
}
```

These are development artifacts. Remove them or gate behind a `DEBUG_VEDIC` env flag.

### F. TypeScript compilation check

Run `tsc --noEmit` from the backend directory after all changes. Fix any new type errors introduced.
The existing codebase may have pre-existing type errors — do not fix those unless they are in files
you are already modifying.

---

## Files Codex Must NOT Touch

These are legacy files still used by overlay and verdict paths. Do not refactor or delete:

```
src/promptEngine/digests/westernDigest.ts
src/promptEngine/digests/vedicDigest.ts
src/prompts/systems/western.ts
src/prompts/systems/vedic.ts
src/prompts/systems/human-design.ts
src/prompts/systems/gene-keys.ts
src/prompts/systems/kabbalah.ts
src/promptEngine/composePrompt.ts
src/promptEngine/layerRegistry.ts
src/promptEngine/fromJobPayload.ts
```

---

## Success Criteria

When all fixes are applied:

1. `tsc --noEmit` passes (no new errors in modified files)
2. Western wound engine block: exactly one cost log per LLM call (wound call logs once, writing
   call logs once, no duplicates)
3. `stripVedicChartData` called with standard Vedic chart data returns lines containing all six
   grahas: Surya, Chandra, Mangal, Shani, Rahu, Ketu
4. `stripHDChartData` called with chart data containing blank lines between activation entries
   still returns Sun, Earth, Moon entries for both Personality and Design sections
5. `stripGeneKeysChartData` has explicit `inActivation` flag — activation content is intentionally
   kept, not accidentally passed through
6. `WORD_COUNT_LIMITS_OVERLAY.min` (5000) and `WORD_COUNT_LIMITS_VERDICT.min` (4000) exist and are
   used in `HARD_FLOOR_WORDS` selection
7. `chartDataForPrompt` is explicitly assigned and correct for overlay path
8. All wound engine blocks have `!generationComplete` guards except the first (western)
9. Wound call empty-string guard throws before writing call runs
10. Vedic debug console.logs removed
