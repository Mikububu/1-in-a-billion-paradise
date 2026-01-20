# Configuration Files - Single Source of Truth

This directory contains centralized configuration that affects the entire system.

## Files

### `docTypeResolver.ts`
**Purpose:** Centralized logic for person1/person2/overlay data scoping  
**Used by:** All workers (text, PDF, audio, song)  
**Change here to:** Update how person data is resolved for different reading types

### `pdfConfig.ts`
**Purpose:** PDF styling, fonts, colors, layouts  
**Used by:** PDF generation (`pdfGenerator.ts`, `pdfWorker.ts`)  
**Change here to:** Update font sizes, colors, spacing in ALL PDFs

### `systemConfig.ts`
**Purpose:** System names, display names, metadata  
**Used by:** All workers, database migrations, frontend  
**Change here to:** Add new systems, update display names

### `env.ts`
**Purpose:** Environment variables and secrets  
**Used by:** Entire backend  
**Change here to:** Add new API keys, endpoints, configuration flags

## Quick Start

```typescript
// Use DocTypeResolver instead of manual logic
import { DocTypeResolver } from './docTypeResolver';
const resolver = new DocTypeResolver(docType, person1, person2);
const { primaryPerson, secondaryPerson } = resolver.resolve();

// Use PDF config instead of magic numbers
import { fontSize, color } from './pdfConfig';
doc.fontSize(fontSize('body')).fillColor(color('primary'));

// Use system config instead of hardcoded names
import { getSystemDisplayName } from './systemConfig';
const name = getSystemDisplayName('vedic'); // → 'Vedic Astrology (Jyotish)'
```

See `docs/CENTRALIZATION_GUIDE.md` for full documentation.
