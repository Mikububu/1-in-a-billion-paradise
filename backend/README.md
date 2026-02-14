# V2 Backend Prompt Architecture

This backend scaffold gives you exactly what you asked for:

- Separate GLOBAL writing style layer
- Separate ASTROLOGICAL analysis layer per system (all 5 systems)
- Easy file editing with plain markdown

## Where to edit

### Global style (affects all systems)
- `backend/prompt-layers/style/writing-style-guide.md`

### System-specific astrology logic
- `backend/prompt-layers/systems/hellenistic-individual.md`
- `backend/prompt-layers/systems/hellenistic-synastry.md`
- `backend/prompt-layers/systems/vedic-individual.md`
- `backend/prompt-layers/systems/vedic-synastry.md`
- `backend/prompt-layers/systems/human-design-individual.md`
- `backend/prompt-layers/systems/human-design-synastry.md`
- `backend/prompt-layers/systems/gene-keys-individual.md`
- `backend/prompt-layers/systems/gene-keys-synastry.md`
- `backend/prompt-layers/systems/kabbalah-individual.md`
- `backend/prompt-layers/systems/kabbalah-synastry.md`

### Bundle final-verdict synthesis layer
- `backend/prompt-layers/verdict/final-verdict.md`

### Image transformation prompts (portrait + synastry image)
- `backend/prompt-layers/images/image-transformation-prompts.md`
  - `single_portrait` block (one person photo -> stylized portrait)
  - `synastry_portrait` block (two portraits -> couple composition)

## Core engine
- `backend/src/promptEngine/composePrompt.ts`
- `backend/src/promptEngine/layerRegistry.ts`
- `backend/src/promptEngine/layerLoader.ts`
- `backend/src/promptEngine/fromJobPayload.ts`
- `backend/src/promptEngine/imagePromptLayers.ts`

## Vedic matchmaking runtime (migrated)
- `backend/src/vedic/types.ts`
- `backend/src/vedic/contracts.ts`
- `backend/src/vedic/tables.ts`
- `backend/src/vedic/scoring.ts`
- `backend/src/vedic/matchmaking.ts`
- `backend/src/vedic/spiceRanking.ts`
- `backend/src/vedic/service.ts`
- `backend/src/vedic/httpHandlers.ts`

The Vedic runtime keeps canonical Vedic scoring deterministic and applies spice (`1..10`) only as a soft ranking lens after Vedic eligibility.

## Image transformation runtime scaffolding (migrated)
- `backend/src/images/contracts.ts`
- `backend/src/images/service.ts`
- `backend/src/images/httpHandlers.ts`

What it does now:
- Validates single-portrait and synastry-image request payloads.
- Loads prompts from `prompt-layers/images/image-transformation-prompts.md`.
- Returns normalized provider instructions for image workers/routes.

## PDF generation runtime (migrated + hardened)
- `backend/src/pdf/config.ts`
- `backend/src/pdf/contracts.ts`
- `backend/src/pdf/service.ts`

What it does now:
- Enforces strict one-content-field-per-PDF chapter validation.
- Uses a Garamond-first typography contract with safe fallback if the font file is unavailable.
- Embeds portrait/couple image when available (with resize/compression to keep files compact).
- Generates PDF output fully in-memory (`Buffer`) to avoid temp-file cleanup drift.

Core entry points:
- `generateReadingPdfBuffer(options)`
- `buildChapterFromDocType(docType, title, system, text)`
- `buildReadablePdfFileName(title)`

### Service entry points (for API/worker binding)
- `runVedicMatch(payload)` -> full pair result with eligibility gate
- `runVedicScore(payload)` -> fast breakdown + eligibility
- `runVedicRank(payload)` -> one-to-many ranking (Vedic first, spice second)

### HTTP adapter helpers
- `handleVedicMatchRequest(payload)`
- `handleVedicScoreRequest(payload)`
- `handleVedicRankRequest(payload)`

## How the frontend connects
V2 frontend now sends `promptLayerDirective` in job start payloads:
- `src/screens/home/VoiceSelectionScreen.tsx`
- `src/services/api.ts`

Backend should read `promptLayerDirective` and call `composePrompt` (or `composePromptFromJobStartPayload`).

## Design contract
1. Shared writing style is global and reusable.
2. Every system has separate `individual` and `synastry` analysis layers.
3. Verdict-mode prompts include a dedicated final-verdict layer.
4. Name/gematria is disabled in Kabbalah policy unless you intentionally change it.

## Next integration step
In your job worker pipeline, replace static prompt strings with `composePromptFromJobStartPayload(job.params)` and then send the resulting `prompt` to the LLM.

For image generation routes, replace hardcoded prompt literals with:
- `loadImagePromptLayer('single_portrait')`
- `loadImagePromptLayer('synastry_portrait')`

## Fly deploy (V2)
- Runtime entrypoint: `backend/src/server.ts`
- Docker build: `backend/Dockerfile`
- Fly config: `backend/fly.toml`
- GitHub action: `1-in-a-billion-v2/.github/workflows/fly-deploy-v2-backend.yml`

Expected repo secret:
- `FLY_API_TOKEN`

Trigger behavior:
- Auto deploy on push to `main` when `backend/**` changes.
