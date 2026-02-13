# VEDIC MATCHMAKING SPECIFICATION (V2)

Last updated: 2026-02-13

## Authority

This V2 file defines matchmaking behavior for the migrated app.
It is aligned with the source authority:

- `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP/docs/VEDIC_MATCHMAKING_SPEC.md`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP/docs/VEDIC_MATCHMAKING_LLM_SPEC.md`

Core Vedic rules (Ashtakoota, Doshas, cancellation rules) remain authoritative and unchanged.

## Core Principle

Vedic compatibility decides baseline eligibility.
User relationship-preference scale (`1..10`, "safe to spicy") is a separate ranking lens.

The preference lens:
- does not alter Ashtakoota math,
- does not hide/override Dosha findings,
- does not hard-block by itself,
- only changes ordering priority among already eligible candidates.

## Inputs

Per candidate pair:
- `ashtakoota_total` (`0..36`)
- dosha flags/cancellations per canonical spec
- `user_a_spice` (`1..10`)
- `user_b_spice` (`1..10`)

## Match Pipeline

1. Vedic eligibility gate (hard):
- Apply canonical Vedic rules first.
- If pair fails hard Vedic gating (for example critical uncancelled dosha), exclude pair.

2. Spice alignment (soft ranking):
- `spice_distance = abs(user_a_spice - user_b_spice)`
- Compute alignment score (`0..1`) from distance:
  - `0 -> 1.00`
  - `1 -> 0.85`
  - `2 -> 0.65`
  - `3 -> 0.35`
  - `4 -> 0.15`
  - `>=5 -> 0.00`

3. Final ranking:
- Rank primarily by Vedic compatibility quality.
- Use spice alignment as secondary tie-break / weighting boost.
- Recommended combined ranking:
  - `final_rank_score = (vedic_rank_score * 0.8) + (spice_alignment_score * 0.2)`

## Behavioral Requirement

When writing compatibility narration:
- Mention preference fit directly if relevant (aligned / somewhat mismatched / strongly mismatched).
- Example mismatch language:
  - "This bond may feel emotionally safe but too low-voltage for what you are seeking."

## Non-Negotiables

- No "spice-only" hard filtering.
- No modification of Ashtakoota totals due to spice.
- No suppression of Dosha risk due to spice.

