# Centralization Guide: Single Source of Truth

**Problem:** Magic numbers, repeated logic, and hardcoded values scattered across workers.  
**Solution:** Centralized configuration files that serve as the single source of truth.

---

## 🎯 Architecture

```
src/config/
├── docTypeResolver.ts    → Person1/Person2/Overlay logic (ALL workers)
├── pdfConfig.ts          → PDF fonts, colors, layout (ALL PDF code)
├── systemConfig.ts       → System names & metadata (ALL workers + DB)
└── env.ts               → Environment variables (existing)
```

---

## 📋 What's Centralized

### 1. DocType Logic (`docTypeResolver.ts`)

**Before (Scattered):**
```typescript
// pdfWorker.ts (lines 168-177)
const isPerson2Reading = docType === 'person2';
const isOverlayReading = docType === 'overlay' || docType === 'verdict';
const pdfPerson1 = isPerson2Reading && person2 ? person2 : person1;
const pdfPerson2 = isOverlayReading && person2 ? person2 : undefined;

// songTaskProcessor.ts (lines 44-51) - DIFFERENT LOGIC!
if (docType === 'person1' || docType === 'individual') {
  personName = params.person1?.name || params.person?.name || personName;
} else if (docType === 'person2') {
  personName = params.person2?.name || personName;
}

// baseWorker.ts (lines 437-445) - YET ANOTHER VARIATION!
if (person2Name && (docType === 'overlay' || docType === 'synastry')) {
  // ...
}
```

**After (Centralized):**
```typescript
import { DocTypeResolver } from '../config/docTypeResolver';

const resolver = new DocTypeResolver(docType, person1, person2);
const { primaryPerson, secondaryPerson, filenamePerson1, filenamePerson2 } = resolver.resolve();
const { primaryPortrait, secondaryPortrait } = resolver.resolvePortraits(p1Portrait, p2Portrait);

// Now ALL workers use identical logic - change once, applies everywhere
```

---

### 2. PDF Styling (`pdfConfig.ts`)

**Before (Scattered):**
```typescript
// pdfGenerator.ts line 328
doc.fontSize(9.5).text(paragraph);

// pdfGenerator.ts line 347
doc.fontSize(9.5).fillColor('#333333').text(text);

// pdfGenerator.ts line 108
doc.font('Inter_500Medium.ttf').fontSize(18).text(title);
```

**After (Centralized):**
```typescript
import { fontSize, color, PDF_CONFIG } from '../config/pdfConfig';

doc.fontSize(fontSize('body')).text(paragraph);
doc.fontSize(fontSize('body')).fillColor(color('secondary')).text(text);
doc.font('Inter_500Medium.ttf').fontSize(fontSize('chapterTitle')).text(title);
```

**To change ALL body text:** Just edit `pdfConfig.ts` line 33:
```typescript
body: 8.5,  // Changed from 9.5 → ALL PDFs updated
```

---

### 3. System Names (`systemConfig.ts`)

**Before (Scattered):**
```typescript
// paidReadingPrompts.ts
export const SYSTEM_DISPLAY_NAMES = {
  vedic: 'Vedic Astrology (Jyotish)',
  // ...
};

// Database trigger (hardcoded SQL)
CASE 
  WHEN v_system = 'vedic' THEN 'vedic'  -- lowercase, wrong!
  -- ...
END

// Frontend (ad-hoc mapping)
const displayName = system === 'vedic' ? 'Vedic Astrology' : system;
```

**After (Centralized):**
```typescript
import { getSystemDisplayName, SYSTEMS } from '../config/systemConfig';

// In ANY worker
const displayName = getSystemDisplayName('vedic');
// → 'Vedic Astrology (Jyotish)'

// In database migration (auto-generate SQL CASE statement)
const caseStmt = generateSystemCaseStatement('v_system');
// → Full CASE...WHEN...END statement with all systems
```

---

## 🔧 How to Use

### Example 1: Refactor pdfWorker.ts

**Before:**
```typescript
const isPerson2Reading = docType === 'person2';
const isOverlayReading = docType === 'overlay' || docType === 'verdict';
const pdfPerson1 = isPerson2Reading && person2 ? person2 : person1;
const pdfPerson1Portrait = isPerson2Reading ? person2PortraitUrl : person1PortraitUrl;
const pdfPerson2 = isOverlayReading && person2 ? person2 : undefined;
const pdfPerson2Portrait = isOverlayReading ? person2PortraitUrl : undefined;
```

**After:**
```typescript
import { DocTypeResolver } from '../config/docTypeResolver';

const resolver = new DocTypeResolver(docType, person1, person2);
const { primaryPerson, secondaryPerson } = resolver.resolve();
const { primaryPortrait, secondaryPortrait } = resolver.resolvePortraits(
  person1PortraitUrl, 
  person2PortraitUrl
);

// Pass to PDF generator
await generateChapterPDF(
  docNum,
  { title, system, /* ... */ },
  primaryPerson,
  secondaryPerson,
  primaryPortrait,
  secondaryPortrait,
  coupleImageUrl
);
```

**Result:** 11 lines → 4 lines. Logic is now reusable.

---

### Example 2: Change PDF Font Size

**Before:** Search through 450 lines of `pdfGenerator.ts`, find all `.fontSize(9.5)` calls, replace each one.

**After:**
```typescript
// src/config/pdfConfig.ts (line 33)
body: 8.5,  // Changed from 9.5
```

Done! All PDFs now use 8.5pt body text.

---

### Example 3: Update Database Trigger with Correct System Names

**Before:** Manually write CASE statement in SQL migration:
```sql
CASE 
  WHEN v_system = 'vedic' THEN 'Vedic Astrology (Jyotish)'
  WHEN v_system = 'western' THEN 'Western Astrology'
  -- ... 5 more systems, easy to typo
END
```

**After:** Generate SQL from TypeScript config:
```typescript
// migration script
import { generateSystemCaseStatement } from '../src/config/systemConfig';

const caseStmt = generateSystemCaseStatement('v_system');
// Auto-generates correct SQL with all systems from SYSTEMS object
```

Now if you add a new system to `systemConfig.ts`, the migration generator automatically includes it.

---

## 🎯 Benefits

### 1. **Single Source of Truth**
Change PDF font size once → Updates everywhere instantly

### 2. **Type Safety**
```typescript
fontSize('bodyyyy')  // ❌ TypeScript error: invalid key
fontSize('body')      // ✅ Correct
```

### 3. **No More Magic Numbers**
```typescript
doc.fontSize(9.5)     // ❌ What is this number?
fontSize('body')      // ✅ Self-documenting
```

### 4. **Consistency Guarantee**
All workers use `DocTypeResolver` → Impossible to have different logic

### 5. **Easy Refactoring**
Want to change how person2 readings work? Change `DocTypeResolver.resolve()` once.

### 6. **Database + Code Sync**
`systemConfig.ts` generates SQL → DB and app always match

---

## 📦 Migration Strategy

### Phase 1: Create Config Files ✅
- [x] `docTypeResolver.ts`
- [x] `pdfConfig.ts`
- [x] `systemConfig.ts`

### Phase 2: Refactor Workers (Optional)
- [ ] Refactor `pdfWorker.ts` to use `DocTypeResolver`
- [ ] Refactor `songTaskProcessor.ts` to use `DocTypeResolver`
- [ ] Refactor `pdfGenerator.ts` to use `pdfConfig` helpers
- [ ] Refactor `baseWorker.ts` to use `DocTypeResolver`

### Phase 3: Update Database Trigger
- [ ] Use `generateSystemCaseStatement()` in migration 009
- [ ] Apply migration to Supabase

**Note:** Phase 2 is optional. Even without refactoring existing code, NEW code should use these helpers.

---

## 🚨 Rules

1. **ALWAYS use config files for new code**
   - Don't hardcode font sizes → Use `fontSize('body')`
   - Don't hardcode system names → Use `getSystemDisplayName()`
   - Don't rewrite docType logic → Use `DocTypeResolver`

2. **Update config files when adding systems**
   - Add to `SYSTEMS` object in `systemConfig.ts`
   - Regenerate database migration if needed

3. **Document new config values**
   - Add JSDoc comments to explain what values do
   - Update this guide when adding new config files

---

## 📝 Example: Adding a New System

```typescript
// 1. Add to systemConfig.ts
export const SYSTEMS: Record<string, SystemMetadata> = {
  // ... existing systems
  tarot: {
    slug: 'tarot',
    displayName: 'Tarot',
    shortName: 'Tarot',
    description: 'Divination using symbolic cards',
    icon: '🃏',
  },
};

// 2. Done! Now everywhere automatically uses:
// - Display name: "Tarot"
// - Database trigger: Auto-includes in CASE statement
// - Filename: Uses "Tarot" in artifact names
```

No need to update 5 different files!

---

## 🎓 Learning Resources

- **DRY Principle:** https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- **Configuration Pattern:** https://refactoring.guru/design-patterns/singleton
- **Type-Safe Config:** TypeScript Handbook on const assertions

---

**Last Updated:** 2026-01-20  
**Maintainer:** AI Agent / Michael
