# Development Principles

## Core Philosophy

**WE NEVER DO QUICK FIXES.**

This is a real app. We take the time to build it right.

## Architecture Rules

### 1. Single Source of Truth (The Audible Principle)

The app should work like Audible:
- **Persistent Library**: User's data (readings, audio, PDFs) lives in `profileStore` - the permanent library
- **Background Sync**: Fetch updates from backend in the background
- **Incremental Updates**: New content is ADDED to the library, never cleared
- **Always Available**: UI always shows what's in the persistent store, even offline
- **Never Delete**: When you buy a new book in Audible, it doesn't delete your entire library

#### Critical: Each Job = Separate Receipt

**My Souls Library must work like a purchase history / log:**

- ✅ **Each job is a separate entry** (even for the same person)
- ✅ **Jobs are NEVER merged or replaced**
- ✅ **Chronological order** (newest first)
- ❌ **NEVER aggregate multiple jobs into one card**

**Example:**
```
User generates:
1. Michael (Nuclear) - Jan 10, 2026
2. Michael (Nuclear) - Jan 12, 2026

Library must show:
- Card 1: "Michael - Jan 12, 2026" (newest)
- Card 2: "Michael - Jan 10, 2026" (older)

NOT: One "Michael" card showing mixed data from both jobs
```

**Why this matters:**
- Users may want to compare readings over time
- Old readings have value (like old Audible purchases)
- New jobs should never "overwrite" or hide old ones
- Each job has its own artifacts (PDF, audio, songs)

### 2. Data Flow

```
Backend (Supabase)
    ↓
Background Fetch (check for updates)
    ↓
profileStore (Single Source of Truth - Like Audible Library)
    ↓
UI (Always reads from store)
```

**WRONG** ❌:
```typescript
const [readings, setReadings] = useState([]); // Temporary state
// Every load: clear and refetch
setReadings([]); // ❌ Deletes everything like clearing Audible library
fetch(); 
setReadings(newData);
```

**RIGHT** ✅:
```typescript
const readings = useProfileStore(s => s.people.find(p => p.id === personId)?.readings || []);
// Readings persist in store, UI just displays them
// Background: fetch updates → sync to store incrementally
```

### 3. State Management

- **profileStore**: Persistent data (people, readings, audio, PDFs) - saved to AsyncStorage
- **Component State**: Only for ephemeral UI state (loading, playing audio, progress)
- **Never Mix**: Don't put persistent data in component state

### 4. Real-Time Updates

- Jobs process in background (PDF → Audio → Song)
- Each artifact activates independently
- Store syncs incrementally as artifacts complete
- UI updates automatically via store subscriptions

## Implementation Standard

When given a choice:
- **Option A**: Proper architectural solution (takes time, but correct)
- **Option B**: Quick fix (temporary, creates tech debt)

**ALWAYS CHOOSE OPTION A.**

Take the time to build it right. This is a real app.
