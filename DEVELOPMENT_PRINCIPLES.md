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
