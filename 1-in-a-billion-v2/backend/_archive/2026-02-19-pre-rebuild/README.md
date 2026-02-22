# Archive: Pre-Rebuild 2026-02-19

Archived before the full 5-system rebuild.

## What was here

- **westernDigest.ts** — multi-pass digest call producing NARRATIVE_ARC, WEATHER_NOTES, etc. Replaced by two-call architecture (wound + writing).
- **vedicDigest.ts** — same pattern for Vedic.
- **textWorker.ts** — contained expansion passes (up to 3), compliance rewrites (up to 2), 6500 word hard floor. Replaced by single-pass per system.
- **wordCounts.ts** — min 6500, target 8500, max 10000. Replaced by 3000/3500/4000.
- **hellenistic-individual-incarnation.md** — old western system layer.
- **vedic-individual-incarnation.md** — old Vedic system layer.
- **human-design-individual-incarnation.md** — old HD system layer.
- **gene-keys-individual-incarnation.md** — old Gene Keys system layer.
- **kabbalah-individual-incarnation.md** — old Kabbalah system layer.

## Why we rebuilt

- 2-7 LLM calls per reading producing worse output than 1 direct call
- Expansion passes adding padding to complete readings
- Compliance rewrites homogenizing voice
- 12,000 char style guide creating cognitive overload during generation
- Word count target (6500+) forcing expansion of material that was already done at 3500

## New architecture

- Two calls per reading: wound call (20-line prompt) + writing call (60-line prompt)
- Chart data stripped in code to ~40 lines before any LLM sees it
- No expansion passes
- No compliance rewrites
- Word target 3500
- All 5 systems: Sonnet 4.6
