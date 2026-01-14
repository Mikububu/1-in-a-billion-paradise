# TRAGIC REALISM LENS (GLOBAL)

This document describes the **Tragic Realism** writing lens that shapes how all astrological readings are written across the app.

It is designed to be:
- **Modular** (one switch)
- **Reversible** (kill-switch)
- **Consistent across all five systems** (Western, Vedic, Human Design, Gene Keys, Kabbalah)
- **Poetic + brutal** (no whitewash), while still being **chart-evidence-first**

---

## What it is

**Tragic Realism** means the reading must explicitly name:
- **The cost of the gift**: what must be sacrificed to live the gift cleanly (comfort, status, snobbery, numbness, control, addiction).
- **The loop**: the repeating failure pattern the person re-enters when unconscious, plus the trigger that starts it.
- **Destiny pressure**: Greek-tragedy inevitability, but **never fatalism**.
  - Use **conditional inevitability**:
    - “If they keep choosing X, the consequence will be Y.”
    - “If they refuse the sacrifice, the pattern repeats.”
- **Taboo truth** allowed: death, grief, loss, addiction, compulsion, sexual shadow.
  - No euphemism. No moral sermon. Clarity.

Critical rule: **the darkness must come from the constellation of the stars / system logic itself**.
Every harsh claim should be traceable to a concrete mechanism in the system (placements, degrees, houses, aspects; or the equivalent in Vedic/HD/GK/Kabbalah).

---

## Kill-switch (revert instantly)

The lens is controlled by one environment variable:

- `TRAGIC_REALISM_LEVEL`

Levels:
- **0**: OFF (legacy tone)
- **1**: subtle
- **2**: clear
- **3**: mythic / destiny-forward (**default**)

**Instant revert:** set `TRAGIC_REALISM_LEVEL=0` and redeploy/restart.

---

## Where it is implemented (source of truth)

### Hook readings (Sun/Moon/Rising)
- Implemented in:
  - `src/services/text/prompts.ts`
- Called by:
  - `src/services/text/deepseekClient.ts` → `generateHookReading`
  - `src/routes/readings.ts` (`/sun`, `/moon`, `/rising`)

### Deep readings (paid/long-form) + Nuclear V2
- Implemented in:
  - `src/prompts/styles/production.ts`
  - `src/prompts/styles/spicy-surreal.ts`
  - `src/prompts/structures/nuclearV2.ts`
  - `src/prompts/builder.ts` (simple prompt fallbacks)

### Extended + Synastry endpoints
- Implemented in:
  - `src/services/text/deepseekClient.ts`
    - `generateExtendedReading`
    - `generateSynastryReading`

---

## How to test quickly

1. Generate a new **hook** reading (Sun/Moon/Rising) for any person.
2. Confirm the output includes:
   - One **gift→price** line
   - One **loop** line
   - One **conditional destiny** line (“if… then…”)
3. Generate a **deep reading** or a **Nuclear V2** reading.
4. Confirm the reading makes an explicit choice between:
   - **comfort trap** vs **evolution path** (especially in overlays)

---

## Design intent (why this exists)

The app should not produce polite, whitewashed readings.
It should tell the truth people avoid — **but earned by the chart** — and show that:
- Some lives become comfortable anesthetics.
- Some connections are convenient but spiritually dead.
- Some connections demand sacrifice, and that sacrifice is the gateway to evolution.

