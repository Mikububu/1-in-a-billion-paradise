# PersonReadingsScreen Refactor Plan

## Current Architecture (WRONG ❌)
```
PersonReadingsScreen
  ↓
Local State: useState([])
  ↓
Every load: Clear → Fetch → Replace
  ↓
Result: Loses data on every navigation
```

## New Architecture (AUDIBLE STYLE ✅)
```
PersonReadingsScreen
  ↓
Read from: profileStore.people[personId].readings (ALWAYS SHOWS DATA)
  ↓
Background: Fetch artifact updates from backend
  ↓
Sync: Update store incrementally (never clear)
  ↓
Result: Persistent library that syncs in background
```

## Implementation Steps

### 1. Change Data Source
- ✅ Enhanced Reading type with artifact paths
- ✅ Added store functions: `syncReadingArtifacts`, `createPlaceholderReadings`, `getReadingsByJobId`
- ⏳ Refactor PersonReadingsScreen to read from store

### 2. Reading Flow
```typescript
// On mount:
const readings = useProfileStore(s => s.getReadingsByJobId(personId, jobId));

// If no readings exist:
createPlaceholderReadings(personId, jobId, systems, createdAt);

// Background sync:
setInterval(() => {
  fetch artifacts from backend
  for each artifact:
    syncReadingArtifacts(personId, readingId, { pdfPath, audioPath, songPath })
}, 10000); // Poll every 10s while job is processing
```

### 3. UI Updates
- Readings display immediately from store
- Artifacts activate as they sync
- No loading spinners (data is always there)
- Background sync is invisible

### 4. Job Creation Integration
When job starts (SystemSelectionScreen, etc.):
```typescript
const personId = addPerson({...});
startJob({...});
createPlaceholderReadings(personId, jobId, systems, Date.now());
// ✅ Readings now exist immediately in library
```

## Benefits
- ✅ Works like Audible - library persists
- ✅ No more "No Readings Yet" flicker
- ✅ Works offline (shows cached data)
- ✅ Background sync updates smoothly
- ✅ Readings never get deleted
- ✅ Can navigate away and come back - data still there

## Files to Modify
1. ✅ `profileStore.ts` - Add sync functions
2. ⏳ `PersonReadingsScreen.tsx` - Use store instead of local state
3. ⏳ `MyLibraryScreen.tsx` - Call createPlaceholderReadings when job detected
4. ⏳ `SystemSelectionScreen.tsx` - Call createPlaceholderReadings after job start
5. ⏳ `ReadingOverviewScreen.tsx` - Same
6. ⏳ `CompleteReadingScreen.tsx` - Same
