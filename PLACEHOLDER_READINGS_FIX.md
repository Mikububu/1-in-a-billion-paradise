# Placeholder Readings & ZIP Download Fix

## Problem

1. **Empty Profile Bug**: When jobs were created, people appeared in the library but their profiles showed "No Readings Yet" even though jobs were processing.
2. **ZIP Missing Songs**: ZIP download button only checked for PDF + audio, not songs.

## Root Cause

In `MyLibraryScreen.tsx`, when creating people from jobs, the `readings` array was hardcoded to `[]` (empty):

```typescript
peopleMap.set(p1Name, {
  id: `job-${job.id}-p1`,
  name: p1Name,
  readings: [], // ❌ This caused empty profiles!
  ...
});
```

## Solution

### 1. Create Placeholder Readings on Job Creation

Modified `MyLibraryScreen.tsx` (3 locations) to create placeholder readings immediately when jobs are detected:

```typescript
// Create placeholder readings based on job type
const isOverlay = job.type === 'overlay' || job.type === 'compatibility';
const systems = isOverlay 
  ? ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah', 'verdict']
  : ['western', 'vedic', 'human_design', 'gene_keys', 'kabbalah'];

const placeholderReadings = systems.map((system, index) => ({
  id: `reading-${index + 1}`,
  system: system,
  name: system === 'western' ? 'Western Astrology' : ...,
  // No paths yet - readings are inactive until artifacts are generated
  pdfPath: undefined,
  audioPath: undefined,
  songPath: undefined,
}));
```

**Result**: 
- Akasha now appears in library with 5 or 6 readings (depending on job type)
- All readings start as **inactive** (no PDF/audio/song badges)
- As artifacts complete, individual badges become **active** independently
- No "processing" UI needed - badges just light up when ready

### 2. Add Song Check to ZIP Download

Modified `PersonReadingsScreen.tsx` line 1002 to require all three artifacts:

```typescript
// Before
actual.every((r) => !!r.audioPath && !!r.pdfPath);

// After
actual.every((r) => !!r.audioPath && !!r.pdfPath && !!r.songPath);
```

**Result**: ZIP download button only appears when ALL readings have PDF + audio + song ready.

## Files Changed

1. `Paradise/1-in-a-billion-frontend/src/screens/home/MyLibraryScreen.tsx`
   - Lines ~645-680 (overlay/compatibility jobs person1)
   - Lines ~664-695 (overlay/compatibility jobs person2)
   - Lines ~710-745 (extended/single_system jobs person1)

2. `Paradise/1-in-a-billion-frontend/src/screens/home/PersonReadingsScreen.tsx`
   - Line 1002 (ZIP ready check)

## Testing

1. Create a new job for a person (e.g., Akasha)
2. Immediately after job starts, navigate to Akasha's profile
3. Should see 5-6 placeholder readings (all inactive)
4. As PDF completes → PDF badge becomes active
5. As song completes → Song badge becomes active
6. As audio completes → Audio badge becomes active
7. When ALL readings have all 3 artifacts → ZIP download button appears

## Related Bugs Fixed

- Empty profiles after job creation ✅
- Readings appearing to "swap" between profiles ✅ (fixed in previous commit with person IDs)
- ZIP button appearing before songs are ready ✅
