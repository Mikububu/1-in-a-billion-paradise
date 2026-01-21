# Image Generation Architecture - 1 in a Billion

## Overview

The system generates stylized portrait images for users, with special handling for couple portraits to ensure facial accuracy.

**This applies to ALL job types:**
- ✅ Extended (single person)
- ✅ Synastry (two people compatibility)
- ✅ Nuclear V2 (generates 16 readings - comprehensive job type)
- ✅ Any future job types with couples

---

## ⚠️ CRITICAL RULE: Couple Portrait Generation Method

**THIS METHOD MUST NEVER CHANGE, REGARDLESS OF ARTISTIC STYLE:**

### The Two-Step Process

```
Step 1: Individual Portraits
Original Photo 1 → AI Style Transfer → Styled Portrait 1
Original Photo 2 → AI Style Transfer → Styled Portrait 2

Step 2: Couple Composition  
Styled Portrait 1 + Styled Portrait 2 → AI Composition → Couple Portrait
```

### Why This Approach?

When we tried generating couple portraits directly from original photos, the AI would:
- Create generic/abstract faces instead of preserving the actual people
- Change facial structures
- Make one person unrecognizable

By using already-styled portraits as inputs for the couple composition, we ensure:
- ✅ Both faces remain recognizable
- ✅ Facial features are preserved
- ✅ Consistent style across solo and couple portraits
- ✅ Works for ANY artistic style (linoleum, clay, watercolor, oil painting, etc.)

### Code Implementation

**Services:**
- `src/services/aiPortraitService.ts` - Generates individual styled portraits
- `src/services/coupleImageService.ts` - Composes couple portraits from individual portraits
- `src/workers/pdfWorker.ts` - Uses this for ALL job types (extended, synastry, nuclear_v2)

**Key Functions:**
```typescript
// Step 1: Generate individual portraits
await generateAIPortrait(originalPhoto1, userId, personId)
await generateAIPortrait(originalPhoto2, userId, personId)

// Step 2: Compose couple portrait using the styled portraits (NOT original photos)
await composeCoupleImage(userId, person1Id, person2Id, styledPortrait1Url, styledPortrait2Url)
```

**Workflow Integration (All Job Types):**
```typescript
// pdfWorker.ts handles this for all job types:
// 1. Waits for individual styled portraits to be generated
// 2. Fetches styled portrait URLs from library_people.claymation_url
// 3. Calls getCoupleImage() which uses composeCoupleImage()
// 4. Generates PDF with the couple portrait

// This works for:
// - Extended jobs (single person)
// - Synastry jobs (two people compatibility) ← Uses couple portraits
// - Nuclear V2 jobs (16 readings, comprehensive) ← Uses couple portraits
```

**Safeguards:**
- Runtime validation in `coupleImageService.ts` checks if URLs contain `/claymation.png`
- Runtime validation in `pdfWorker.ts` warns if original photos are used
- Function parameter names (`claymation1Url`) make intent clear
- Documentation warnings throughout

---

## Changing the Artistic Style

To change from linoleum to a new style (e.g., watercolor):

### 1. Update Solo Portrait Prompt
Edit `src/services/aiPortraitService.ts`:
```typescript
const stylePrompt = `New watercolor style description here...`;
```

### 2. Update Couple Composition Prompt
Edit `src/services/coupleImageService.ts`:
```typescript
text: `Compose these two watercolor portraits into a romantic couple portrait...`
```

### 3. Update Documentation
Edit `docs/IMAGE_DESIGN_PROMPTS.md` with new prompts.

### ⚠️ DO NOT CHANGE:
- The two-step process (individual → couple)
- The input type for `composeCoupleImage()` (must be styled portrait URLs, not original photos)
- The workflow in the application code

---

## Image Processing Pipeline

### Individual Portrait Generation
```
1. User uploads original photo
2. Store original in Supabase Storage (profile-images bucket)
3. Send original photo to AI with style prompt
4. Apply post-processing:
   - Auto-trim white space (sharp.trim())
   - Resize to 1024x1024
   - Color adjustments
   - Sharpen
5. Store styled portrait in Supabase Storage
6. Update library_people.claymation_url
```

### Couple Portrait Generation
```
1. Fetch styled portrait URLs for both people from Supabase
2. Download both styled portraits
3. Send BOTH STYLED PORTRAITS to AI with composition prompt
4. Apply post-processing:
   - Auto-trim white space
   - Resize to 1024x1024
   - Color adjustments
5. Store couple portrait in Supabase Storage (couple-claymations bucket)
6. Update couple_claymations table
```

---

## Testing New Styles

When testing a new artistic style:

1. Generate individual portraits for test subjects
2. Verify faces are recognizable in solo portraits
3. Generate couple portrait using those styled portraits
4. Verify BOTH faces remain recognizable in couple portrait
5. If faces are not preserved, adjust the composition prompt (NOT the workflow)

---

## Common Mistakes to Avoid

❌ **DON'T:** Send original photos directly to couple portrait generation
❌ **DON'T:** Skip individual portrait generation for couples
❌ **DON'T:** Try to generate couple portraits in one step

✅ **DO:** Always generate individual portraits first
✅ **DO:** Use styled portrait URLs as inputs for couple composition
✅ **DO:** Keep the two-step workflow intact

---

## References

- Solo Portrait Service: `src/services/aiPortraitService.ts`
- Couple Portrait Service: `src/services/coupleImageService.ts`
- Style Prompts: `docs/IMAGE_DESIGN_PROMPTS.md`
- PDF Generation: `src/services/pdf/pdfGenerator.ts`

---

**Last Updated:** January 2026  
**Current Style:** Linoleum analog handcrafted (high-contrast, bold black strokes)
