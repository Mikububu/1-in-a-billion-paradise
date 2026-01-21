# Documentation - 1 in a Billion

## Table of Contents

1. **[IMAGE_GENERATION_ARCHITECTURE.md](./IMAGE_GENERATION_ARCHITECTURE.md)** ⚠️ **CRITICAL**
   - Critical workflow for couple portrait generation
   - Must never change regardless of artistic style
   - Explains the two-step process (individual → couple)

2. **[PDF_CONTENT_ROUTING_RULES.md](./PDF_CONTENT_ROUTING_RULES.md)** ⚠️ **CRITICAL**
   - How to route correct content to correct PDFs
   - Prevents the bug where same content is used for all PDFs
   - Validation rules and safeguards

3. **[IMAGE_DESIGN_PROMPTS.md](./IMAGE_DESIGN_PROMPTS.md)**
   - Current AI prompts for portrait generation
   - How to change the artistic style
   - Technical implementation details

4. **[PDF_STYLE_GUIDE.md](./PDF_STYLE_GUIDE.md)**
   - PDF layout and typography specifications
   - Garamond font, margins, spacing
   - Page structure (title, timestamp, image, text, appendix)

---

## Quick Reference

### Changing Artistic Style

**Files to Update:**
1. `src/services/aiPortraitService.ts` - Solo portrait prompt
2. `src/services/coupleImageService.ts` - Couple composition prompt
3. `docs/IMAGE_DESIGN_PROMPTS.md` - Documentation

**What NOT to Change:**
- The two-step workflow (individual → couple)
- Input types for `composeCoupleImage()` function
- Image processing pipeline

### Current Style
**Linoleum analog handcrafted style**
- High-contrast bold black strokes
- Textured off-white paper
- Minimalist palette (black/white + red accent)
- Auto-cropped white space

---

## Architecture Decisions

### Why Two-Step Couple Portrait Generation?

When we generate couple portraits directly from original photos, AI creates generic/abstract faces. By generating individual portraits first, then composing them, we ensure:
- Both faces remain recognizable ✅
- Consistent style across solo and couple portraits ✅
- Works for any artistic style ✅

**This applies to ALL job types:**
- ✅ **Extended** (single person) - Uses solo portrait
- ✅ **Synastry** (two people compatibility) - Uses solo portraits → couple portrait
- ✅ **Nuclear V2** (generates 16 readings - hence "nuclear") - Uses solo portraits → couple portrait
- ✅ **Any future job types** - Will use the same workflow

**This is enforced in code with:**
- Documentation warnings in multiple files
- Function naming (`claymation1Url`, `claymation2Url`)
- Runtime validation in `coupleImageService.ts` (warns if URLs don't look like styled portraits)
- Runtime validation in `pdfWorker.ts` (warns if original photos detected)
- Comments throughout the codebase

**Workflow location:**
- All job types go through `pdfWorker.ts`
- `pdfWorker.ts` calls `getCoupleImage()` → `composeCoupleImage()`
- This ensures consistent behavior regardless of job type

---

## Key Services

- **aiPortraitService.ts** - Generates individual styled portraits from original photos
- **coupleImageService.ts** - Composes couple portraits from styled portraits
- **pdfGenerator.ts** - Creates PDFs with styled portraits and reading text
- **apiKeys.ts** - Manages API keys from Supabase

---

**Last Updated:** January 2026
