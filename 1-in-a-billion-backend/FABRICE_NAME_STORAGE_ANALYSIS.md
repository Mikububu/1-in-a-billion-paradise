# Where "Fabrice Renaudin" Name is Stored - Complete Analysis

## 🔍 Data Flow in MyLibraryScreen

When `MyLibraryScreen` displays a person card, it gets the name from **multiple sources in this priority order**:

### 1. **jobs.params.person1.name** (PRIMARY SOURCE) ⭐
- **Location**: `MyLibraryScreen.tsx:804`
- **Code**: `const p1Name = params.person1?.name || ...`
- **Why**: This is the **primary source** - the name is read directly from the job parameters
- **Status**: ✅ Updated in database (trace shows no "Fabrice Renaudin" in jobs.params)

### 2. **library_people.name** (FALLBACK/MATCHING)
- **Location**: `MyLibraryScreen.tsx:813` - `libraryPeopleById[p1Id]`
- **Used for**: Matching person IDs to get placements/birthData
- **Status**: ✅ Updated in database (trace shows no "Fabrice Renaudin" in library_people)

### 3. **profileStore.people** (LOCAL CACHE)
- **Location**: Zustand store persisted to AsyncStorage
- **Storage**: `AsyncStorage.getItem('profile-storage')`
- **Status**: ❌ **THIS IS WHERE IT'S STILL CACHED**
- **Why it persists**: AsyncStorage survives app restarts

### 4. **libraryPeopleById State** (IN-MEMORY CACHE)
- **Location**: `MyLibraryScreen.tsx:128` - `useState<Record<string, Person>>`
- **Source**: Fetched from Supabase `library_people` table
- **Updates when**: `queueJobs` changes
- **Status**: Should be updated if Supabase was updated, but might be stale

## 📊 Current Status (from trace)

✅ **Database is clean:**
- `library_people.name` - No "Fabrice Renaudin" found
- `jobs.params.person1.name` - No "Fabrice Renaudin" found  
- `jobs.params.person2.name` - No "Fabrice Renaudin" found
- `jobs.input` - No "Fabrice Renaudin" found

❌ **App cache still has it:**
- `AsyncStorage['profile-storage']` - Contains cached "Fabrice Renaudin"
- This is why it still shows in the UI

## 🔄 How MyLibraryScreen Builds the Display

```typescript
// Line 804: PRIMARY SOURCE - from job params
const p1Name = params.person1?.name || (isProcessing ? `Reading ${job.id.slice(0, 8)}` : undefined);

// Line 813: Try to match with library_people for richer data
const libMatch = p1Id ? libraryPeopleById[p1Id] : undefined;

// Line 814-818: Fallback chain
const storeMatch =
  libMatch ||                                    // 1. From Supabase library_people
  (p1Id ? people.find((sp) => sp?.id === p1Id) : undefined) ||  // 2. From profileStore by ID
  people.find((sp) => sp?.name === p1Name) ||   // 3. From profileStore by name
  (p1Name === userName ? user : undefined);     // 4. User profile

// Line 839: Create person object - NAME COMES FROM p1Name (job params)
const person: LibraryPerson = {
  id: p1Key,
  name: p1Name,  // <-- THIS IS FROM JOB PARAMS
  ...
};
```

## 🎯 Why It's Still Showing

Even though the database is updated, the app shows "Fabrice Renaudin" because:

1. **AsyncStorage Cache**: The `profileStore` is persisted to AsyncStorage
   - Location: `profileStore.ts:1193` - `storage: createJSONStorage(() => AsyncStorage)`
   - This cache survives app restarts
   - The name "Fabrice Renaudin" is stored in `AsyncStorage['profile-storage']`

2. **One-Time Sync**: `useSupabaseLibraryAutoSync` only fetches once per session
   - Location: `useSupabaseLibraryAutoSync.ts:41` - `didHydrateRef.current = true`
   - After first fetch, it uses cached data

3. **Job Params Priority**: MyLibraryScreen reads from `job.params` first
   - If job params were updated, it would show the new name
   - But if job params are missing/empty, it falls back to cached profileStore data

## 💡 Solution

The name will update when:
1. AsyncStorage is cleared (uninstall/reinstall app, or clear app data)
2. OR the app is restarted AND `useSupabaseLibraryAutoSync` runs again (but it only runs once per session)
3. OR a new job is created (which would use the updated name from library_people)

## 📝 Key Insight

**The name is stored in 3 places:**
1. ✅ **Database** (`jobs.params` + `library_people`) - Already updated
2. ❌ **AsyncStorage** (`profile-storage`) - Still has old name
3. ❌ **In-memory state** (`profileStore.people`) - Loaded from AsyncStorage

The app prioritizes **job params** for display, but if those are missing, it falls back to **cached profileStore data** from AsyncStorage.
