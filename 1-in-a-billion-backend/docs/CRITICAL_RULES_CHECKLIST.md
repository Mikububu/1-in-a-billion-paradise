# CRITICAL RULES CHECKLIST

**Purpose:** Prevent bugs by ensuring all workers follow documented specs.

**When to use:** Before creating/modifying ANY worker that processes person data.

---

## Rule 1: DocType Data Scoping (TEXT_READING_SPEC.md § 3.3)

**THE RULE:**
- `docType = person1` → Include ONLY person1 data
- `docType = person2` → Include ONLY person2 data  
- `docType = overlay` or `verdict` → Include BOTH people

**Check these workers:**
- [ ] `textWorker.ts` - Text generation
- [ ] `pdfWorker.ts` - PDF generation
- [ ] `audioWorker.ts` - Audio generation
- [ ] `songTaskProcessor.ts` - Song generation
- [ ] `baseWorker.ts` - Filename generation

**Common Bug Pattern:**
```typescript
// ❌ WRONG: Checks if person2 exists in job
const person2Data = person2 ? person2 : undefined;

// ✅ CORRECT: Checks if docType requires person2
const isOverlay = docType === 'overlay' || docType === 'verdict';
const person2Data = isOverlay && person2 ? person2 : undefined;
```

---

## Rule 2: System Display Names (SYSTEM_DISPLAY_NAMES mapping)

**THE RULE:**
Use mapped display names, not raw system slugs.

**Mapping Location:** `src/prompts/structures/paidReadingPrompts.ts`

```typescript
'vedic' → 'Vedic Astrology (Jyotish)'
'western' → 'Western Astrology'
'kabbalah' → 'Kabbalah'
'numerology' → 'Numerology'
'i_ching' → 'I Ching'
```

**Check these locations:**
- [ ] PDF titles
- [ ] Audio filenames
- [ ] Database trigger (job_tasks title generation)
- [ ] Frontend display labels

---

## Rule 3: TTS Compatibility (READING_DOWNLOAD_AND_KABBALAH_FIXES.md)

**THE RULE:**
Never include non-Latin characters in text destined for TTS.

**For Hebrew/Kabbalah:**
- Romanize: א → "Aleph", ב → "Bet", ג → "Gimel"
- Strip Hebrew Unicode: `[\u0590-\u05FF]`

**Check these workers:**
- [ ] `textWorker.ts` - Romanizes Hebrew before prompt
- [ ] `deepseekClient.ts` - Strips Hebrew from LLM output

---

## Rule 4: Person Data Validation

**THE RULE:**
Never use "Unknown" or "Person 1" / "Person 2" as fallbacks in generated content.

**Instead:**
- Extract actual names from `job.params.person1.name` / `job.params.person2.name`
- For missing birth data: Graceful messaging, not "Unknown"

**Check these locations:**
- [ ] Database trigger (`auto_create_job_tasks`)
- [ ] Text generation prompts
- [ ] PDF header generation
- [ ] Filename generation

---

## Rule 5: PDF Layout (VEDIC_MATCHMAKING_PDF_LAYOUT_SPEC.md)

**THE RULE:**
Follow strict layout specs for PDF generation.

**Key Points:**
- Font size: 9.5pt for body text (or user-specified)
- No hardcoded "Chapter X:" prefix (use `chapter.title` directly)
- Portrait images: Check for existence before rendering
- Couple images: Only for overlay/verdict docs

---

## Pre-Deployment Checklist

Before pushing worker changes to production:

1. [ ] Read relevant spec docs (TEXT_READING_SPEC.md, etc.)
2. [ ] Verify docType logic follows Rule 1
3. [ ] Check system names use mapped display names (Rule 2)
4. [ ] Confirm TTS compatibility (Rule 3)
5. [ ] Validate person names are extracted correctly (Rule 4)
6. [ ] Test with actual job data (not just mocks)
7. [ ] Update this checklist if new rules are discovered

---

## How This Failed (2026-01-20 Incident)

**What happened:**
- TEXT_READING_SPEC.md documented Rule 1 correctly
- textWorker.ts implemented it correctly
- pdfWorker.ts used naive `if (person2)` check instead of `if (docType === 'overlay')`
- Result: Person1 readings showed BOTH names in PDF

**Why it happened:**
- Spec only explicitly mentioned text generation
- PDF code was written independently without referencing spec
- No checklist to verify all workers follow same rules

**Fix:**
- Updated TEXT_READING_SPEC.md to explicitly list all workers (§ 3.3)
- Fixed pdfWorker.ts and baseWorker.ts
- Created this checklist document

**Lesson:**
Documentation is useless if not actively referenced during implementation. This checklist forces verification.

---

**Last Updated:** 2026-01-20
