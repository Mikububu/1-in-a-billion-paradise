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
- `b00c1ff` - migrated V2 backend Vedic matchmaking runtime + spice soft-ranking module
- `5a44ad8` - added V2 backend Vedic service contracts/entrypoints (match/score/rank)
- `61132e1` - reading audio player uses dual preloaded sounds (narration+song) for faster play

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

## Big Picture Rehydration Protocol (Required Every New Session)

Before writing code, always reload these files in this order:

1. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/HANDOFF_CONTEXT.md`
2. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/MIGRATION_DECISIONS.md`
3. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/VEDIC_MATCHMAKING_SPEC.md`
4. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_PATH_WALK.md`
5. `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2/SCREEN_MIGRATION_STATUS.md`

If anything conflicts:
- `MIGRATION_DECISIONS.md` wins for product behavior.
- `VEDIC_MATCHMAKING_SPEC.md` wins for Vedic matching behavior.

## North-Star Flow (Do Not Drift)

### Onboarding and monetization
- Intro -> Sign In
- Relationship/Birth/Languages
- 3 core identity waiting/read screens
- 3 hook readings
- 3 compatibility screens
- 3 post-hook offer screens
- RevenueCat purchase
- Account creation
- Dashboard (Secret Lives)

### Post-onboarding behavior
- Dashboard remains accessible even if subscription expires.
- Expired subscription blocks chat entry only (shows renewal prompt).
- Match/gallery history remains visible (read-only).

### Context and preference injection
- Context circle text is system-agnostic (single behavior for all systems).
- `relationshipPreferenceScale (1..10)` is always injected as relationship-desire lens.
- This scale must shape interpretation and compatibility fit language.

## Folder Safety Rule

- Source folder is read-only reference:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/ONEINABILLIONAPP`
- All edits must stay in destination:
  - `/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-billion-v2`
