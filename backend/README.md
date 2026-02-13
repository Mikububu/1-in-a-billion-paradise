# V2 Backend Prompt Architecture

This backend scaffold gives you exactly what you asked for:

- Separate GLOBAL writing style layer
- Separate ASTROLOGICAL analysis layer per system (all 5 systems)
- Easy file editing with plain markdown

## Where to edit

### Global style (affects all systems)
- `backend/prompt-layers/style/shared-astro-fairytale-style-v1.md`

### System-specific astrology logic
- `backend/prompt-layers/systems/western-analysis-v1.md`
- `backend/prompt-layers/systems/vedic-analysis-v1.md`
- `backend/prompt-layers/systems/human-design-analysis-v1.md`
- `backend/prompt-layers/systems/gene-keys-analysis-v1.md`
- `backend/prompt-layers/systems/kabbalah-analysis-v2-no-name-gematria.md`

## Core engine
- `backend/src/promptEngine/composePrompt.ts`
- `backend/src/promptEngine/layerRegistry.ts`
- `backend/src/promptEngine/layerLoader.ts`
- `backend/src/promptEngine/fromJobPayload.ts`

## How the frontend connects
V2 frontend now sends `promptLayerDirective` in job start payloads:
- `src/screens/home/VoiceSelectionScreen.tsx`
- `src/services/api.ts`

Backend should read `promptLayerDirective` and call `composePrompt` (or `composePromptFromJobStartPayload`).

## Design contract
1. Shared writing style is global and reusable.
2. Every system has its own analysis layer and version id.
3. Kabbalah layer uses `kabbalah-analysis-v2-no-name-gematria` by default.
4. Name/gematria is disabled in Kabbalah policy unless you intentionally change it.

## Next integration step
In your job worker pipeline, replace static prompt strings with `composePromptFromJobStartPayload(job.params)` and then send the resulting `prompt` to the LLM.
