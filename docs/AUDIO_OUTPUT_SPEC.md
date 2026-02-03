# Audio Output Specification

**Status:** Draft
**Last Updated:** 2026-01-05
**Consumer:** `audioWorker.ts` / `audio.ts`

This document serves as the **AUTHORITATIVE CONTRACT** for Audio generation. The Audio worker must adhere strictly to these presentation rules.

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
