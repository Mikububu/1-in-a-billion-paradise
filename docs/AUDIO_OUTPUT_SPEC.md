# Audio Output Specification

**Status:** Draft
**Last Updated:** 2026-02-04
**Consumer:** `audioWorker.ts` / `audioProcessing.ts`

This document serves as the **AUTHORITATIVE CONTRACT** for Audio generation. The Audio worker must adhere strictly to these presentation rules.

---

## ⚠️ CRITICAL: Gibberish Prevention Settings (DO NOT CHANGE)

**Confirmed working on Feb 4, 2026 - 20 min audio with zero gibberish.**

These settings in `audioProcessing.ts` MUST remain as-is to prevent audio hallucination/gibberish:

```typescript
// audioProcessing.ts - AUDIO_CONFIG
CHUNK_MAX_LENGTH: 300,        // ⚠️ DO NOT INCREASE - 450 caused gibberish
CROSSFADE_DURATION_MS: 0,     // ⚠️ DO NOT INCREASE - 80ms caused stitching issues
```

```typescript
// audioWorker.ts - Replicate API parameters
temperature: 0.7,             // Default - do not lower (causes robotic voice)
top_p: 0.95,                  // Default - do not change
repetition_penalty: 1.5,      // Prevents duplicate sentences
```

**Why 300 chars?** Chatterbox Turbo claims 500 char limit but produces gibberish on longer chunks. Original Chatterbox uses 300 and is more stable.

---

## 1. Structure
- **Format:** MP3 (128kbps) or M4A (AAC).
- **Composition:** Sequential concatenation of chunks/chapters.
- **Silence insertion:**
  - **Between Intro & Chapter 1:** 2.0 seconds.
  - **Between Chapters:** 1.5 seconds.
  - **Within Chapter (Paragraphs):** Natural pauses (handled by TTS model).

## 2. Voice Settings
- **Provider:** Chatterbox Turbo (Replicate).
- **Voice Clone:** `voice_10sec` (Reference URL from env).
- **Stability:** 0.3 (Exaggeration).
- **Clarity:** 0.5 (CFG Weight).

## 3. Metadata
- **ID3 Tags:**
  - Title: [Book Title]
  - Artist: 1-in-a-billion
  - Album: [User Name]'s Reading
