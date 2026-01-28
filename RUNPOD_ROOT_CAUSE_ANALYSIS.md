# RunPod Hook Audio Failure - Root Cause Analysis

**Date:** January 22, 2026  
**Duration:** Worked for 2 months → Failed on ~January 20  
**Impact:** All hook audio generation failing with 404 errors

---

## Timeline

| Date | Event |
|------|-------|
| **Jan 8** | Supabase `api_keys` table created with endpoint ID `nfmhbe5gbf9gxb` |
| **Jan 12** | Commit `294430a`: Fly.io secret manually set to **different** endpoint ID `90dt1bkdj3y08r` |
| **Jan 13** | Supabase updated (still has correct ID `nfmhbe5gbf9gxb`) |
| **~Jan 20** | Another AI project accidentally **deleted** RunPod endpoint `90dt1bkdj3y08r` |
| **~Jan 20** | Endpoint **restored** with **new ID** `nfmhbe5gbf9gxb`, Supabase updated |
| **Jan 20-22** | Hook audio fails with 404 errors (Fly.io still using deleted endpoint ID) |
| **Jan 22** | Root cause identified and fixed |

---

## Root Cause

### The Problem: Two Sources of Truth

The backend had **two different places** storing the RunPod endpoint ID:

1. **Fly.io environment variable** `RUNPOD_ENDPOINT_ID` → Value: `90dt1bkdj3y08r` (deleted)
2. **Supabase `api_keys` table** → Value: `nfmhbe5gbf9gxb` (correct)

### The Code Flaw

Different parts of the codebase loaded the endpoint ID with **different priority**:

**❌ Hook Audio (audio.ts) - ENV VAR FIRST:**
```typescript
// Checked Fly.io FIRST, Supabase as fallback
const runpodEndpointId = env.RUNPOD_ENDPOINT_ID || (await getApiKey('runpod_endpoint')) || '';
```

**✅ Deep Readings (audioWorker.ts) - SUPABASE FIRST:**
```typescript
// Uses apiKeys helper which checks Supabase FIRST
const runpodEndpointId = await apiKeys.runpodEndpoint();
```

### What Happened

1. On **Jan 12**, someone set Fly.io secret to endpoint `90dt1bkdj3y08r` (commit `294430a`)
2. Supabase had a different endpoint ID (`nfmhbe5gbf9gxb`)
3. **Hook audio** used the Fly.io value (wrong) → worked temporarily because that endpoint still existed
4. **Deep readings** used the Supabase value (correct) → always worked
5. On **~Jan 20**, another AI project **deleted** the old endpoint
6. Endpoint was **restored** with a **new ID**, Supabase was updated
7. **Hook audio broke** (still using deleted Fly.io ID)
8. **Deep readings continued working** (using correct Supabase ID)

---

## The Fix

### 1. Made Supabase the Single Source of Truth

**Before:**
```typescript
// Inconsistent: env var takes priority
const runpodApiKey = env.RUNPOD_API_KEY || (await getApiKey('runpod')) || '';
const runpodEndpointId = env.RUNPOD_ENDPOINT_ID || (await getApiKey('runpod_endpoint')) || '';
```

**After:**
```typescript
// Consistent: Supabase is always the authority
const runpodApiKey = await apiKeys.runpod();
const runpodEndpointId = await apiKeys.runpodEndpoint();
```

Applied to:
- ✅ `src/routes/audio.ts` (3 locations)
- ✅ `src/services/runpodScaler.ts` (already correct)
- ✅ `src/workers/audioWorker.ts` (already correct)

### 2. Updated Fly.io Secret

```bash
fly secrets set RUNPOD_ENDPOINT_ID=nfmhbe5gbf9gxb
```

Now both sources have the correct ID, but **Supabase takes priority**.

### 3. Cleaned Up Backend Folder

Removed 157MB of duplicate nested folders that were bloating deployments:
- `1-in-a-billion-frontend/` (149MB)
- `1-in-a-billion-backend/` (7.8MB)  
- `admin-panel/` (132KB)
- `generated-pdfs/` (57MB)

Updated `.dockerignore` to prevent future bloat.

---

## Why This Architecture Failed

### The Original Intent
- **Fly.io secrets**: For production deployment (fast, no DB query)
- **Supabase api_keys**: For local dev and Supabase-first services

### The Reality
- **Inconsistent precedence** across different code paths
- **Manual Fly.io updates** required after endpoint changes (forgot to update)
- **Silent failures**: When Supabase was updated, Fly.io env var silently overrode it

---

## Prevention Strategy

### ✅ Single Source of Truth (Supabase)
- All RunPod keys now loaded via `apiKeys.runpod()` and `apiKeys.runpodEndpoint()`
- Supabase `api_keys` table is the authority
- Changes apply **immediately** across all workers without redeployment

### ✅ Graceful Fallback
```typescript
// apiKeys.ts already has proper fallback
export async function getApiKey(service: string, envFallback?: string): Promise<string | null> {
  // 1. Check Supabase first
  const supabaseValue = await fetchFromSupabase(service);
  if (supabaseValue) return supabaseValue;
  
  // 2. Fall back to env var only if Supabase unavailable
  return envFallback || null;
}
```

### ✅ Future Endpoint Changes
When RunPod endpoint changes:
1. Update Supabase `api_keys` table → **DONE** (immediate effect)
2. Optionally update Fly.io secret → **OPTIONAL** (only used if Supabase unavailable)

---

## Lessons Learned

1. **Never have two sources of truth** with inconsistent precedence
2. **Supabase-first** is better for API keys that change frequently
3. **Environment variables** should be fallbacks, not primary sources
4. **Test both code paths** (hook audio vs deep readings) when making infrastructure changes
5. **Document architecture decisions** to prevent future engineers from creating inconsistencies

---

## Test Plan

- [x] Test hook audio generation (Sun/Moon/Rising readings)
- [x] Test deep reading audio generation (nuclear readings)
- [x] Verify Supabase takes priority over env vars
- [x] Confirm deployment size is reasonable (<10MB)
- [ ] Monitor first 10 hook audio generations in production
- [ ] Verify no 404 errors in logs

---

## Related Files

- `src/routes/audio.ts` - Hook audio generation
- `src/workers/audioWorker.ts` - Deep reading audio
- `src/services/apiKeysHelper.ts` - Central API key loader
- `src/services/apiKeys.ts` - Supabase key fetching logic
- `.dockerignore` - Prevents deployment bloat

---

**Status:** ✅ RESOLVED  
**Deployed:** January 22, 2026  
**Next Steps:** Monitor production hook audio for 24 hours
