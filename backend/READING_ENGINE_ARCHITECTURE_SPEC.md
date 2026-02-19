# Reading Engine Architecture Spec (V2)

## Purpose
Build one stable generation engine for all 5 systems that produces:
- compelling audiobook-style narrative,
- understandable language for normal users,
- system-specific flavor without jargon overload,
- deterministic, clean outputs (no control-text leaks, no patch loops).

This replaces "many layered prompt fragments + heavy rewrite pressure" with a clear 3-step writing architecture.

## Product Targets
- Individual/overlay/verdict prose must feel like a story, not a report.
- Minimum length: 4000 words (higher for overlay/verdict where needed).
- First mention of system terms must be explained in plain language.
- No internal control strings in user-facing output.
- Minimal retries and minimal post-hoc rewriting.

## Core Design
Use one generation pipeline for all systems:

1. `Digest` (LLM, structured only)
2. `Narrative Spine` (LLM, structured only)
3. `Writer` (LLM, prose only)

No extra style patch passes after the writer call except hard validation/retry.

## Deterministic vs LLM Boundaries

### Deterministic (code only)
- Ephemeris/calculators
- Chart normalization and signal ranking
- Compact evidence assembly (top N signals)
- Output contracts (word ranges, headline count)
- Validation checks (control text leakage, grammar/protocol checks)
- PDF layout

### LLM (strictly scoped)
- Digest: compress chart evidence into structured insights
- Narrative Spine: define story arc
- Writer: produce final prose from spine + compact evidence

## Prompt Contracts

### Digest Contract (JSON only)
Output strict JSON with fields:
- `loudest_signals` (8-12)
- `contradictions` (3-6)
- `timing_pressure` (1-3)
- `relationship_vector` (overlay only)
- `term_explanations` (term -> plain-language explanation)

No prose essay output allowed.

### Narrative Spine Contract (JSON only)
Output strict JSON with fields:
- `wound`
- `defense`
- `cost`
- `act1_surface`
- `act2_beneath`
- `act3_reckoning`
- `landing_temperature`
- `what_not_to_do`

No prose essay output allowed.

### Writer Contract (prose only)
- One continuous narrative with 4-6 headlines.
- Headline is followed by substantive body text (no one-line sections).
- Use system terms only when needed.
- First occurrence of a term must include plain-language explanation.
- No markdown, no bullets, no JSON.

## Jargon Policy
- Not "zero terminology".
- Policy = "explain-on-first-use":
  - example: "Rahu, the part of the psyche that hungers for what it cannot stabilize..."
- After first explanation, terms can be reused sparingly.
- Term density target:
  - max 1 technical term every ~120-180 words after opening section.

## Validation Policy (Fail-Hard, Minimal)
Run one deterministic validator after writer output:
- Reject if control text appears (examples: `THE_WOUND`, `before writing`, file-token artifacts).
- Reject if malformed pronouns or placeholder ids leak.
- Reject if headline count out of range.
- Reject if output below hard floor.

If rejected: one single rewrite retry with explicit violation list.
No multi-pass stylistic rewrite ladder.

## Overlay & Verdict Rules
- Overlay and verdict use the same architecture.
- Overlay gets both person digests + one relational spine.
- Verdict consumes wound/spine outputs from all systems, not excerpts.
- Compatibility snapshot is deterministic and PDF-only.

## File-Level Refactor Plan (Exact)

### 1) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/promptEngine/composePrompt.ts`
Refactor to three explicit modes:
- `composeDigestPrompt(...)`
- `composeSpinePrompt(...)`
- `composeWriterPrompt(...)`

Remove mixed mega-assembly and duplicated style constraints.
Keep single canonical writing style + per-system voice block.

### 2) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/workers/textWorker.ts`
Create orchestrator:
- `runReadingPipeline({ system, docType, chartData, contracts })`
  - call digest
  - call spine
  - call writer
  - validate once
  - optional single retry

Remove/disable style-flattening rewrite ladders for normal success path.
Keep strict leak/format validator.

### 3) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/services/chartDataBuilder.ts`
Add compact evidence builder:
- `buildCompactEvidence(system, docType, placements): string[]`
- emit top ranked signals only (not full dump) for writer pass.

Keep rich data for reference page and diagnostics, but do not flood writer context.

### 4) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/promptEngine/digests/westernDigest.ts`
Rewrite output to strict structured schema (JSON text block).
No literary instructions inside digest layer.

### 5) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/prompt-layers/digests/vedic-chart-digest-v1.md`
Align to same structured digest schema as Western.
Include Vedic timing fields (dasha/navamsha pressure) in normalized keys.

### 6) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/promptEngine/woundEngine/overlayWound.ts`
Keep as relational spine provider.
Ensure outputs map directly into verdict input store.

### 7) `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/src/services/pdf/pdfGenerator.ts`
PDF remains deterministic only:
- no prompt logic,
- no control-text rendering,
- strict layout enforcement.

## Rollout Order
1. Implement orchestrator + compose split.
2. Migrate Western first, verify quality.
3. Apply same contracts to Vedic.
4. Apply to HD/GK/Kabbalah.
5. Rewire overlay and verdict.
6. Run 16-output acceptance test.

## Acceptance Criteria
- All 16 PDFs generated with no control-text leakage.
- Readings feel narrative-first and understandable.
- System flavor remains distinct.
- No "patch-left/patch-right" behavior required for normal runs.
- Build clean, single stable path for future edits.

