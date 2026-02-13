# V2 Handoff Context

Updated: 2026-02-13

## Project Topology
- Destination (active migration target): `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`
- Source (read-only reference): `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP`

## Non-Negotiables
- Never write into source folder.
- Migrate screen-by-screen with dependency checks.
- Remove orphan/unused legacy paths unless explicitly kept.

## Latest Commits (V2)
- `e46cc28` - layered prompts + bundle terminology migration
- `cca9267` - VEDIC_MATCHMAKING spec recorded as migration authority
- `e13c3f7` - spice preference lens injected + unified context circle screens
- `d347b15` - Vedic spice soft-ranking spec + migration decision

## Canonical Decision Files
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/MIGRATION_DECISIONS.md`
- `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/VEDIC_MATCHMAKING_SPEC.md`

## Prompt Architecture (Current)
- Shared writing style: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/prompt-layers/style/writing-style-guide.md`
- System layers: `individual` + `synastry` MD per system
- Final bundle synthesis layer: `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/backend/prompt-layers/verdict/final-verdict.md`

## Naming Contract
- Product types:
  - `bundle_5_readings`
  - `bundle_16_readings`
- Job type for final bundle synthesis:
  - `bundle_verdict`
- Prompt modes:
  - `individual`, `synastry`, `verdict`

## Spice + Context Contract
- `relationshipPreferenceScale (1..10)` is injected into deep-reading prompt composition.
- It is interpreted as relationship-desire lens (not prose intensity dial).
- Context circle is unified across systems (Kabbalah-specific variant removed).

## Vedic Matchmaking + Spice
- Core Vedic eligibility remains hard authority (Ashtakoota + Dosha rules).
- Spice is soft ranking only (distance-based preference alignment).
- No spice-based hard exclusion.
- No spice override of Ashtakoota/Dosha.

## Quick Recovery Checklist For New Agent
1. Read `MIGRATION_DECISIONS.md`.
2. Read `VEDIC_MATCHMAKING_SPEC.md`.
3. Confirm working only in `1-in-a-billion-v2`.
4. Keep naming contract unchanged.
5. Continue migration path + ask only necessary single questions.

