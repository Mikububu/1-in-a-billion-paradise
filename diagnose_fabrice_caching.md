# Why Fabrice's Name Change Isn't Working - Caching Analysis

## The Problem
The app has **multiple layers of caching** that prevent the name update from showing:

### 1. **AsyncStorage Cache** (Primary Issue)
- `profileStore` uses `persist` middleware with AsyncStorage
- All people data is cached locally on the device
- Even after Supabase is updated, the app loads from AsyncStorage first
- Location: `1-in-a-billion-frontend/src/store/profileStore.ts:1193`

### 2. **profileStore State** (In-Memory)
- Zustand store keeps people in memory
- Hydrated from AsyncStorage on app start
- Location: `1-in-a-billion-frontend/src/store/profileStore.ts:510`

### 3. **useSupabaseLibraryAutoSync** (One-Time Fetch)
- Only fetches from Supabase ONCE per session
- Uses `didHydrateRef.current` to prevent re-fetching
- Location: `1-in-a-billion-frontend/src/hooks/useSupabaseLibraryAutoSync.ts:41`

### 4. **MyLibraryScreen State**
- Uses `libraryPeopleById` state that's set from Supabase queries
- But also uses `fetchPeopleWithPaidReadings` which might be cached
- Location: `1-in-a-billion-frontend/src/screens/home/MyLibraryScreen.tsx:128`

### 5. **Job Params** (Possible)
- Names might also be stored in `jobs.params.person1.name` or `jobs.params.person2.name`
- These are separate from `library_people` table

## Solutions

### Solution 1: Clear AsyncStorage (Recommended)
The user needs to clear the app's local storage to force a fresh fetch from Supabase.

### Solution 2: Update Job Params Too
If the name is in job params, those need to be updated as well.

### Solution 3: Force Re-fetch
Modify the app to force a re-fetch from Supabase when data changes.
