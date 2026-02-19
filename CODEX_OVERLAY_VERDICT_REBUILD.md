# Codex Task — Overlay Wound Engine + Verdict Rebuild
## 1-in-a-billion-v2 / backend

---

## Context

This app generates long-form soul readings across five esoteric systems (western, vedic,
human_design, gene_keys, kabbalah) for individuals and couples. Each reading is converted to audio.

A "bundle" job for a couple produces 16 documents:
- 5 systems × person1 individual reading = docs 1-5
- 5 systems × person2 individual reading = docs 6-10
- 5 systems × overlay (synastry) reading = docs 11-15
- 1 final verdict synthesizing all 15 = doc 16

Individual readings (docs 1-10) were recently rebuilt with a two-call "wound engine" architecture
that works well:
1. `stripXChartData()` — pure code, reduces chart data to ~35 signal lines
2. Wound call — one 80-120 word paragraph naming the central psychological friction
3. Writing call — wound paragraph as spine → 3,500 word literary reading

Overlay docs (11-15) and the verdict (doc 16) still use the OLD pipeline:
- Overlay: goes through `composePromptFromJobStartPayload` → `composePrompt` → MD layer engine →
  `buildOverlayPrompt` in `paidReadingPrompts.ts`. 25,000-char prompt, no organizing spine, same
  quality problem the individual readings had before the rebuild.
- Verdict: pulls `output.excerpt` (600 chars of prose) from each of the 15 prior completed tasks,
  concatenates them, feeds that as "summary" to `buildVerdictPrompt`. The verdict gets 15 truncated
  paragraphs instead of the concentrated signal it needs.

Your job: rebuild overlay with the wound engine pattern, and rebuild the verdict to synthesize
wound paragraphs instead of prose excerpts.

---

## Read These Files Before Writing Anything

```
src/workers/textWorker.ts                              (full file)
src/promptEngine/woundEngine/westernWound.ts           (pattern to follow)
src/promptEngine/woundEngine/vedicWound.ts
src/promptEngine/woundEngine/humanDesignWound.ts
src/promptEngine/woundEngine/geneKeysWound.ts
src/promptEngine/woundEngine/kabbalahWound.ts
src/prompts/structures/paidReadingPrompts.ts           (current overlay + verdict prompts)
src/prompts/config/wordCounts.ts
src/services/chartDataBuilder.ts                       (understand chart data format)
```

---

## Task 1 — Create overlayWound.ts

Create file: `src/promptEngine/woundEngine/overlayWound.ts`

This file handles synastry/overlay readings. It has the same three-step structure as the individual
wound files, but operates on TWO people's chart data and produces a RELATIONAL wound — the specific
dynamic between these two people, not a description of either person individually.

### 1a. Strip functions

Write five strip functions, one per system:

```typescript
stripWesternOverlayData(person1Raw: string, person2Raw: string): string
stripVedicOverlayData(person1Raw: string, person2Raw: string): string
stripHDOverlayData(person1Raw: string, person2Raw: string): string
stripGeneKeysOverlayData(person1Raw: string, person2Raw: string): string
stripKabbalahOverlayData(person1Raw: string, person2Raw: string): string
```

Each function:
- Calls the corresponding individual strip function on each person's raw chart data
- Returns the two stripped results labeled and combined:

```
PERSON1 CHART:
[stripped person1 data]

PERSON2 CHART:
[stripped person2 data]
```

Import the individual strip functions from their respective files. Do not duplicate strip logic.

### 1b. Relational wound prompt functions

Write five wound prompt functions:

```typescript
buildWesternOverlayWoundPrompt(params: { person1Name: string; person2Name: string; strippedChartData: string }): string
buildVedicOverlayWoundPrompt(...)
buildHDOverlayWoundPrompt(...)
buildGeneKeysOverlayWoundPrompt(...)
buildKabbalahOverlayWoundPrompt(...)
```

Each function produces a ~20-line prompt. Output: one paragraph, 80-120 words.

The relational wound is NOT:
- A description of person1's wound
- A description of person2's wound
- "They complement each other" or "they challenge each other"
- A summary of compatibility

The relational wound IS:
- The specific dynamic that emerges when these two fields collide
- What one person has that the other is unconsciously organized around needing
- The specific way they will wound each other if unconscious
- The pull that exists between them and what it is actually made of
- What this connection is FOR, underneath the story they tell about it

The wound paragraph must be specific enough that no other pair of charts produces this exact
sentence. It must cost something to read.

Rules for the paragraph:
- Third person. Use both names.
- No system vocabulary (no "synastry", no "composite", no HD terms, no Kabbalah terms)
- No repair instructions. No softening. No hope language.
- Name the dynamic. Stop.

Each system's wound prompt should reference what that system specifically reveals about the dynamic:

**Western:** synastry aspects between charts, house overlays, what planets from one chart land in
the other's angular houses, Saturn/Pluto cross-aspects

**Vedic:** Rahu/Ketu axis alignment between charts, Dasha lords in relation to each other's Lagna,
Nakshatra compatibility, karmic debt between charts

**Human Design:** defined/undefined center interplay (what one person's definition does to the
other's openness), channel completion across charts, authority compatibility, how one person's
motor centers affect the other's open centers

**Gene Keys:** shadow frequency resonance between Life's Work keys, how one person's Gift frequency
lands on the other's Shadow, codon activation across profiles

**Kabbalah:** Tikkun alignment (are they working the same correction or opposing corrections),
Sefirotic complement or conflict, Klipothic interference patterns between dominant shadow axes

### 1c. Relational writing prompt functions

Write five writing prompt functions:

```typescript
buildWesternOverlayWritingPrompt(params: { person1Name: string; person2Name: string; wound: string; strippedChartData: string }): string
buildVedicOverlayWritingPrompt(...)
buildHDOverlayWritingPrompt(...)
buildGeneKeysOverlayWritingPrompt(...)
buildKabbalahOverlayWritingPrompt(...)
```

Each prompt is ~60 lines. Structure:

```
[Narrator identity — 4 lines, different from individual reading identity, oriented toward witness]

[Wound block]
══════════════════════════════════════════════════════════
THE RELATIONAL WOUND — THIS IS THE SPINE OF EVERYTHING YOU WRITE:
[wound]
Every paragraph must connect to this wound or deepen it.
If a paragraph does not serve this dynamic, it does not belong here.
══════════════════════════════════════════════════════════

NARRATOR:
- Third person. Use both names. Never "you" or "your".
- You are watching two fields collide. Stay in the observation. Do not explain.
- The attraction and the damage are not separate things. Name both.

METAPHOR WORLD:
- Find the image this specific pair demands. Do not import one.
- The metaphor should make the pull and the danger visible simultaneously.
- Do not decorate. Every image must carry structural weight.

STRUCTURE:
- 4 to 6 sections. Invent a title for each. Specific, earned.
- The reading must show: what draws them, what they do to each other, what this is for.
- The ending does not resolve. It names the pressure still active.

ANTI-SURVEY:
- Do not tour placements or systems. Serve the relational wound.
- Do not write about each person separately then join them. They are already in collision.
- Every paragraph must add new consequence or evidence.

LENGTH: 3,500 words. Write until the dynamic is fully present. Then stop.
Do not pad. Do not repeat. Do not add a hopeful ending.

CHART DATA (authoritative — do not invent or contradict):
[strippedChartData]

Write the reading of [person1Name] and [person2Name] now:
```

Narrator identity per system:

**Western:** "You are a novelist who has watched this exact collision before, in different bodies,
across different centuries. You think in mythic repetition. You are watching two charts create a
field neither can escape alone."

**Vedic:** "You are a storyteller who understands karma as physics. You think in cycles, in past
lives meeting their unfinished business. You are watching two Dashas intersect."

**Human Design:** "You are a novelist who understands the body as a receiver. You think in
frequency, in what centers amplify and what centers consume. You are watching two body graphs
create a third field."

**Gene Keys:** "You are a novelist interested in what two people activate in each other that
neither can activate alone. You think in shadow frequencies and the specific damage of resonance.
You are watching two codon sequences meet."

**Kabbalah:** "You are a novelist who understands correction as collision. You think in light and
vessel, in what two Tikkunim do when they occupy the same room. You are watching two soul
corrections either accelerate or obstruct each other."

---

## Task 2 — Store wound paragraph in task output

In `src/workers/textWorker.ts`, every wound engine block already has a `wound` variable containing
the 80-120 word wound paragraph. Currently this is used to generate the reading but is never stored.

**Change:** Add `wound` to the task output and to the stored excerpt so the verdict can access it.

In each of the five individual wound engine blocks, after `generationComplete = true`, the wound
variable is in scope. It is already being used. No change to the wound call itself.

In the return statement at the bottom of processTask, `output` currently includes:
```typescript
output: {
  docNum,
  docType,
  system: system || null,
  title: ...,
  wordCount,
  excerpt,
  textArtifactPath,
  headline,
}
```

Add a `wound` field:
```typescript
output: {
  docNum,
  docType,
  system: system || null,
  title: ...,
  wordCount,
  excerpt,
  wound: woundForOutput,   // add this
  textArtifactPath,
  headline,
}
```

To make `wound` available at the return point, you need to hoist it out of the individual block
scopes. Add a variable declaration near the other let declarations at the top of the task scope:

```typescript
let woundForOutput: string = '';
```

Then in each individual wound engine block (and the overlay wound engine blocks from Task 3), after
computing `wound`, add:
```typescript
woundForOutput = wound;
```

The overlay wound engine also sets `woundForOutput` — the relational wound goes there too.

For the verdict and legacy-path docs where no wound is generated, `woundForOutput` stays `''`.

---

## Task 3 — Wire overlay wound engine into textWorker

In `src/workers/textWorker.ts`, add overlay wound engine handling. This runs when
`docType === 'overlay'`.

Import the new overlay wound functions at the top of the file alongside the individual imports:

```typescript
import {
  stripWesternOverlayData,
  buildWesternOverlayWoundPrompt,
  buildWesternOverlayWritingPrompt,
  stripVedicOverlayData,
  buildVedicOverlayWoundPrompt,
  buildVedicOverlayWritingPrompt,
  stripHDOverlayData,
  buildHDOverlayWoundPrompt,
  buildHDOverlayWritingPrompt,
  stripGeneKeysOverlayData,
  buildGeneKeysOverlayWoundPrompt,
  buildGeneKeysOverlayWritingPrompt,
  stripKabbalahOverlayData,
  buildKabbalahOverlayWoundPrompt,
  buildKabbalahOverlayWritingPrompt,
} from '../promptEngine/woundEngine/overlayWound';
```

In the task execution block, after the five individual system blocks and before the legacy
`if (!generationComplete)` block, add five overlay blocks. One per system:

```typescript
// ── WESTERN OVERLAY wound engine ────────────────────────────────────────
if (!generationComplete && system === 'western' && docType === 'overlay') {
  if (!person2) throw new Error(`Overlay requires person2 for western overlay`);

  // Build separate chart data for each person then strip for overlay
  const p1ChartRaw = buildChartDataForSystem('western', person1.name, p1Placements, null, null, p1BirthData, null);
  const p2ChartRaw = buildChartDataForSystem('western', person2.name, p2Placements, null, null, p2BirthData, null);
  const stripped = stripWesternOverlayData(p1ChartRaw, p2ChartRaw);

  const woundPrompt = buildWesternOverlayWoundPrompt({
    person1Name: person1.name,
    person2Name: person2.name,
    strippedChartData: stripped,
  });
  console.log(`🩸 [TextWorker] Western overlay wound call for ${person1.name} & ${person2.name}...`);
  const woundRaw = await llmPaid.generateStreaming(woundPrompt, `${label}:wound`, {
    maxTokens: 300, temperature: 0.7, maxRetries: 3,
  });
  const wUsage = llmPaid.getLastUsage();
  if (wUsage) await logLLMCost(jobId, task.id, { provider: wUsage.provider, inputTokens: wUsage.usage.inputTokens, outputTokens: wUsage.usage.outputTokens }, `text_western_overlay_wound`);
  const wound = String(woundRaw || '').trim();
  if (!wound) throw new Error(`Wound call returned empty for western overlay`);
  woundForOutput = wound;
  console.log(`✅ [TextWorker] Western overlay wound: ${wound.slice(0, 80)}...`);

  const writingPrompt = buildWesternOverlayWritingPrompt({
    person1Name: person1.name,
    person2Name: person2.name,
    wound,
    strippedChartData: stripped,
  });
  console.log(`✍️ [TextWorker] Western overlay writing call...`);
  text = await llmPaid.generateStreaming(writingPrompt, `${label}:writing`, {
    maxTokens: 16384, temperature: 0.8, maxRetries: 3,
    systemPrompt: 'You are a novelist haunted by two subjects simultaneously. You are telling the story of a collision.',
  });
  const wUsage2 = llmPaid.getLastUsage();
  if (wUsage2) await logLLMCost(jobId, task.id, { provider: wUsage2.provider, inputTokens: wUsage2.usage.inputTokens, outputTokens: wUsage2.usage.outputTokens }, `text_western_overlay_writing`);

  text = tightenParagraphs(cleanReadingText(text, { preserveSurrealHeadlines: true }), { preserveSurrealHeadlines: true });
  const footer = extractChartSignatureFooter(text);
  text = footer.body;
  wordCount = countWords(text);
  console.log(`✅ [TextWorker] Western overlay complete: ${wordCount} words`);
  generationComplete = true;
}
```

Repeat this pattern for the other four systems (vedic, human_design, gene_keys, kabbalah),
each checking `system === '[system]' && docType === 'overlay'` with `!generationComplete` guard.

The overlay blocks use `buildChartDataForSystem` called separately for each person with `null`
for the other person's data, then pass both raw outputs to the overlay strip function.

---

## Task 4 — Rebuild the verdict

### 4a. How the verdict currently works

In textWorker, when `docType === 'verdict'`:
1. Fetches all completed text_generation tasks for the job
2. Maps their `output.excerpt` (600 chars of prose) to strings
3. Concatenates as `summaries`
4. Calls `buildVerdictPrompt({ ..., allReadingsSummary: summaries })`

The problem: 600-char prose excerpts are the opening of each reading, not the concentrated
insight. The verdict receives opening paragraphs instead of the actual findings.

### 4b. New verdict input

Change the verdict data fetch to pull `wound` from each task's output instead of `excerpt`.

Replace the current summaries construction:

```typescript
// CURRENT (remove this):
const summaries = (tasks || [])
  .map((t: any) => t.output)
  .filter(Boolean)
  .filter((o: any) => o.docNum && o.docNum !== 16)
  .sort((a: any, b: any) => (a.docNum ?? 0) - (b.docNum ?? 0))
  .map((o: any) => `${o.title}: ${String(o.excerpt || '').slice(0, 600)}...`)
  .join('\n\n');
```

Replace with:

```typescript
// NEW: use wound paragraphs as verdict input
const completedOutputs = (tasks || [])
  .map((t: any) => t.output)
  .filter(Boolean)
  .filter((o: any) => o.docNum && o.docNum !== 16)
  .sort((a: any, b: any) => (a.docNum ?? 0) - (b.docNum ?? 0));

// Separate individual and overlay wounds
const person1Wounds = completedOutputs
  .filter((o: any) => o.docType === 'person1' && o.wound)
  .map((o: any) => `${o.title}:\n${o.wound}`)
  .join('\n\n');

const person2Wounds = completedOutputs
  .filter((o: any) => o.docType === 'person2' && o.wound)
  .map((o: any) => `${o.title}:\n${o.wound}`)
  .join('\n\n');

const overlayWounds = completedOutputs
  .filter((o: any) => o.docType === 'overlay' && o.wound)
  .map((o: any) => `${o.title}:\n${o.wound}`)
  .join('\n\n');

// Fallback to excerpt if wound not yet present (backwards compatibility)
const summaries = completedOutputs
  .map((o: any) => `${o.title}: ${String(o.excerpt || '').slice(0, 600)}`)
  .join('\n\n');
```

Update the `buildVerdictPrompt` call to pass the new fields:

```typescript
prompt = buildVerdictPrompt({
  person1Name: person1.name,
  person2Name: person2.name,
  person1Wounds: person1Wounds || summaries, // fallback if wounds not present
  person2Wounds: person2Wounds || '',
  overlayWounds: overlayWounds || '',
  spiceLevel,
  style,
});
```

### 4c. Rewrite buildVerdictPrompt in paidReadingPrompts.ts

Update the function signature:

```typescript
export function buildVerdictPrompt(params: {
  person1Name: string;
  person2Name: string;
  person1Wounds: string;
  person2Wounds: string;
  overlayWounds: string;
  spiceLevel: number;
  style: 'production' | 'spicy_surreal';
  outputLanguage?: OutputLanguage;
}): string
```

The new verdict prompt structure:

```
You are a novelist who has been given the concentrated essence of two souls and the space between them.
Not summaries. Not reports. The wounds — the specific frictions that organize each life.
Now synthesize. Do not summarize what you have read. Deliver the truth that emerges when all of it is held simultaneously.

══════════════════════════════════════════════════════════
WHO [PERSON1] IS — ACROSS ALL FIVE SYSTEMS:
[person1Wounds]
══════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════
WHO [PERSON2] IS — ACROSS ALL FIVE SYSTEMS:
[person2Wounds]
══════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════
WHAT HAPPENS BETWEEN THEM — ACROSS ALL FIVE SYSTEMS:
[overlayWounds]
══════════════════════════════════════════════════════════

[buildVerdictProvocations — keep existing logic]

OUTPUT REQUIREMENTS:

LENGTH: 4,000 words.

STRUCTURE (internal only — no headers in output):

PART 1 — THE SYNTHESIS (1000 words)
What do all five lenses agree on about each person and about this connection?
Not a system-by-system tour. The pattern that appears regardless of which lens is used.
Name what each person is actually organized around. Name what the connection is actually made of.

PART 2 — THE FIELD BETWEEN THEM (800 words)
The space these two people create when in proximity. What becomes possible in it. What becomes
impossible. What the field asks of each person to sustain it.

PART 3 — THE MATHEMATICS (600 words)
Where the five systems converge on the same truth. Where they diverge and what that means.
Name which systems, which wounds, which patterns. Be precise.

PART 4 — WHAT THIS IS FOR (400 words)
Every connection has a purpose beyond the people inside it. Name this one's. Precisely.

PART 5 — COMPATIBILITY SCORES
[keep existing compatibility scores block exactly as is — it works]

FORMAT RULES:
- Third person. Use both names. Never "you" or "your".
- Parts 1-4: ONE CONTINUOUS ESSAY — no headers, no breaks, pure prose.
- Spell out all numbers in prose sections.
- NO em-dashes. NO AI phrases.
- The score block is the only exception to the no-structure rule.

Deliver the verdict now:
```

Keep `buildVerdictProvocations()` helper function exactly as it is. Keep the compatibility scores
block exactly as it is — that structure is correct and working. Only change what the model receives
as input and how Part 1-4 are framed.

---

## Task 5 — TypeScript compilation

After all changes, run `tsc --noEmit` from the backend directory. Fix any type errors in the files
you modified. Do not fix pre-existing errors in files you did not touch.

---

## Files to Create

```
src/promptEngine/woundEngine/overlayWound.ts   (new)
```

## Files to Modify

```
src/workers/textWorker.ts
src/prompts/structures/paidReadingPrompts.ts
```

## Files to NOT Touch

```
src/promptEngine/woundEngine/westernWound.ts
src/promptEngine/woundEngine/vedicWound.ts
src/promptEngine/woundEngine/humanDesignWound.ts
src/promptEngine/woundEngine/geneKeysWound.ts
src/promptEngine/woundEngine/kabbalahWound.ts
src/prompts/config/wordCounts.ts
src/promptEngine/composePrompt.ts
src/promptEngine/layerRegistry.ts
src/promptEngine/fromJobPayload.ts
src/services/chartDataBuilder.ts
```

---

## Success Criteria

1. `tsc --noEmit` passes with no new errors
2. `overlayWound.ts` exports 15 functions: 5 strip + 5 wound prompt + 5 writing prompt
3. Overlay strip functions import and reuse individual strip functions — no duplicate logic
4. Each overlay wound prompt asks for the relational dynamic, not a description of either person
5. textWorker has five overlay wound engine blocks (one per system), each guarded with
   `!generationComplete && system === '[system]' && docType === 'overlay'`
6. `woundForOutput` is declared at task scope and set inside each wound engine block
   (individual and overlay)
7. Task output includes `wound: woundForOutput` field
8. Verdict data fetch pulls `wound` from prior task outputs, not `excerpt`
9. `buildVerdictPrompt` signature takes `person1Wounds`, `person2Wounds`, `overlayWounds`
10. Compatibility scores block in `buildVerdictPrompt` is unchanged
11. Console logs follow existing pattern:
    `🩸 [TextWorker] [System] overlay wound call for [name] & [name]...`
    `✅ [TextWorker] [System] overlay wound: [first 80 chars]...`
    `✍️ [TextWorker] [System] overlay writing call...`
    `✅ [TextWorker] [System] overlay complete: [N] words`
