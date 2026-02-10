# PDF Content Routing Rules - CRITICAL

## ⚠️ The One-Content-Per-PDF Rule

**CRITICAL RULE:** Each PDF must use exactly ONE reading content, never the same content for multiple PDFs.

### The Bug That Must Never Happen Again

In January 2026, we had a critical bug where:
- Michael's PDF got Akasha's reading
- Akasha's PDF got Akasha's reading
- Couple PDF got Akasha's reading

**All 3 PDFs used the same content!** This was a manual script error, but we've added multiple safeguards to prevent this in production.

---

## Content Routing by Doc Type

### Person 1 Reading (`docType: 'person1'`)
```typescript
{
  person1Reading: text,        // ✅ Use this field ONLY
  person2Reading: undefined,   // ❌ Must be undefined
  overlayReading: undefined,   // ❌ Must be undefined
  verdict: undefined           // ❌ Must be undefined
}
```
- Shows: Person 1 solo portrait
- Content: Person 1's individual reading

### Person 2 Reading (`docType: 'person2'`)
```typescript
{
  person1Reading: undefined,   // ❌ Must be undefined
  person2Reading: text,        // ✅ Use this field ONLY
  overlayReading: undefined,   // ❌ Must be undefined
  verdict: undefined           // ❌ Must be undefined
}
```
- Shows: Person 2 solo portrait
- Content: Person 2's individual reading

### Overlay Reading (`docType: 'overlay'`)
```typescript
{
  person1Reading: undefined,   // ❌ Must be undefined
  person2Reading: undefined,   // ❌ Must be undefined
  overlayReading: text,        // ✅ Use this field ONLY
  verdict: undefined           // ❌ Must be undefined
}
```
- Shows: Couple portrait
- Content: Synastry/compatibility reading for both people

### Verdict Reading (`docType: 'verdict'`)
```typescript
{
  person1Reading: undefined,   // ❌ Must be undefined
  person2Reading: undefined,   // ❌ Must be undefined
  overlayReading: undefined,   // ❌ Must be undefined
  verdict: text                // ✅ Use this field ONLY
}
```
- Shows: Couple portrait
- Content: Final verdict/summary for nuclear readings

---

## Safeguards in Code

### 1. pdfWorker.ts Validation (Lines 195-210)
```typescript
// Validate: exactly ONE reading field should have content
const contentFields = [
  chapterContent.person1Reading,
  chapterContent.person2Reading,
  chapterContent.overlayReading,
  chapterContent.verdict,
].filter(Boolean);

if (contentFields.length === 0) {
  return { success: false, error: 'CRITICAL: No reading content assigned' };
}
if (contentFields.length > 1) {
  return { success: false, error: 'CRITICAL: Multiple reading fields assigned' };
}
```

### 2. pdfGenerator.ts Validation (Lines 195-220)
```typescript
// Count how many reading fields have content
const contentFields = [
  chapter.person1Reading,
  chapter.person2Reading,
  chapter.overlayReading,
  chapter.verdict,
].filter(Boolean);

if (contentFields.length !== 1) {
  throw new Error('CRITICAL PDF ERROR: Must have exactly ONE reading content per PDF');
}
```

### 3. Enhanced Logging
```typescript
console.log(`📄 Generating PDF for chapter ${docNum}: ${title}`);
console.log(`   📋 DocType: ${docType}`);
console.log(`   👤 PDF will show: ${pdfPerson1.name}${pdfPerson2 ? ` + ${pdfPerson2.name}` : ''}`);
console.log(`   📝 Content type: ${docType}`);
console.log(`   ✅ Content validation passed: 1 field assigned (${text.length} chars)`);
```

This makes it immediately obvious if the wrong content is being used.

---

## Testing Checklist

When testing PDF generation:

✅ **Person 1 PDF:**
- [ ] Shows person 1's name in title
- [ ] Shows person 1's solo portrait
- [ ] Content is person 1's individual reading
- [ ] Content length matches person 1's text length
- [ ] No person 2 information visible

✅ **Person 2 PDF:**
- [ ] Shows person 2's name in title
- [ ] Shows person 2's solo portrait
- [ ] Content is person 2's individual reading
- [ ] Content length matches person 2's text length
- [ ] No person 1 information visible

✅ **Overlay PDF:**
- [ ] Shows both names in title
- [ ] Shows couple portrait
- [ ] Content is the synastry/overlay reading
- [ ] Content is DIFFERENT from individual readings
- [ ] Content length is typically longer (combined analysis)

---

## Common Mistakes to Avoid

❌ **DON'T:** Copy-paste the same text variable for all PDFs
❌ **DON'T:** Use `person1Reading: text` for person 2 PDFs
❌ **DON'T:** Use the same content for overlay as for individual readings
❌ **DON'T:** Skip validation when writing manual scripts

✅ **DO:** Use the correct field for each doc type
✅ **DO:** Check content length to verify it's different
✅ **DO:** Use the pdfWorker.ts logic as the reference implementation
✅ **DO:** Verify portrait matches the person in the PDF

---

## Reference Files

- **Production Worker:** `src/workers/pdfWorker.ts`
- **PDF Generator:** `src/services/pdf/pdfGenerator.ts`
- **Content Interface:** `src/services/pdf/pdfGenerator.ts` (ChapterContent)
- **This Document:** `docs/PDF_CONTENT_ROUTING_RULES.md`

---

**Last Updated:** January 2026  
**Critical Bug Prevented:** Same content used for all PDFs
