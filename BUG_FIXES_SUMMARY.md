# Bug Fixes Summary - Voice Selection, Audio Generation, and Songs

## 🎤 BUG #1: Voice Selection Always Uses "Grandpa" (David A)

### Root Cause
The SQL trigger `enqueue_all_post_text_tasks()` creates audio tasks **without** including `voiceId` and `audioUrl` from the job params. The AudioWorker then falls back to the hardcoded default voice.

### Files Affected
- `/migrations/015_fix_audio_timeout.sql` (old trigger)
- `/workers/audioWorker.ts` line 341: `audio_url: task.input.audioUrl || this.voiceSampleUrl`

### Fix Applied ✅
**Created migration 017** (`migrations/017_fix_voice_selection.sql`)

**Changes:**
1. Trigger now fetches `voiceId` and `audioUrl` from `jobs.params`
2. Includes them in audio task input:
   ```sql
   jsonb_build_object(
     'textArtifactPath', ...,
     'voiceId', v_voice_id,  -- *** NEW ***
     'audioUrl', v_audio_url  -- *** NEW ***
   )
   ```

**How to Apply:**
```bash
# Option 1: Supabase CLI
supabase db push

# Option 2: Supabase Dashboard
# Copy contents of migrations/017_fix_voice_selection.sql
# Paste into SQL Editor > Run

# Option 3: Direct psql (if you have DATABASE_URL)
psql "$DATABASE_URL" -f migrations/017_fix_voice_selection.sql
```

**Verification:**
After applying migration, create a new job and check:
```sql
SELECT job_id, task_type, input->>'voiceId', input->>'audioUrl'
FROM job_tasks 
WHERE task_type = 'audio_generation' 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## 🔊 BUG #2: Akasha Audio "Didn't Come Back"

### Possible Causes
1. **Audio task stuck/failed** - Check task status in database
2. **Replicate rate limit / timeout** - Audio tasks can take time due to rate limits
3. **Missing voice configuration** - Related to Bug #1

### How to Debug

**Step 1: Check Akasha's job status**
```sql
-- Find Akasha's recent jobs
SELECT id, type, status, created_at, updated_at
FROM jobs
WHERE params->>'person1'->>'name' ILIKE '%akasha%'
   OR params->>'person2'->>'name' ILIKE '%akasha%'
ORDER BY created_at DESC
LIMIT 5;
```

**Step 2: Check audio tasks for that job**
```sql
-- Replace <job_id> with Akasha's job ID from above
SELECT id, task_type, status, attempts, 
       created_at, started_at, completed_at,
       input->>'docNum', input->>'title'
FROM job_tasks
WHERE job_id = '<job_id>'
  AND task_type = 'audio_generation'
ORDER BY sequence;
```

**Step 3: Check audio artifacts**
```sql
-- Check if audio was actually generated
SELECT job_id, artifact_type, storage_path, file_size_bytes, created_at
FROM job_artifacts
WHERE job_id = '<job_id>'
  AND artifact_type IN ('audio_mp3', 'audio_m4a')
ORDER BY created_at;
```

**Step 4: Check backend logs**
```bash
# Look for AudioWorker errors
grep -i "akasha\|audioworker\|replicate" backend-logs.txt
```

### Possible Fixes
- **If tasks are "claimed" or "processing" for >60 min**: Tasks are stuck, run reset endpoint:
  ```bash
  curl -X POST http://localhost:8787/api/jobs/v2/<job_id>/reset-stuck-tasks
  ```
- **If tasks failed**: Check error in `job_tasks.error_message` and retry
- **If no audio tasks exist**: Text generation may have failed, check text tasks

---

## 🎵 BUG #3: Where Are the Songs?

### Song Generation Flow
1. Text tasks complete → Trigger creates `song_generation` tasks
2. SongWorker picks up tasks (runs every 10 seconds)
3. Song is generated and saved as `audio_song` artifact
4. Available at `/api/jobs/v2/<job_id>/song/<docNum>`

### Song Worker Status
- **Enabled by default** (unless `ENABLE_SONG_WORKER=false`)
- Started in `server.ts` line 72-80
- Processes one song at a time (API rate limits)
- 60-minute timeout per song

### How to Check Song Status

**Step 1: Verify song worker is running**
```bash
# Check backend logs at startup
grep "Song worker" backend-logs.txt
# Should see: "🎵 Song worker started in background"
```

**Step 2: Check if song tasks were created**
```sql
SELECT id, job_id, status, attempts, 
       input->>'docNum', input->>'system',
       created_at, started_at, completed_at
FROM job_tasks
WHERE task_type = 'song_generation'
ORDER BY created_at DESC
LIMIT 10;
```

**Step 3: Check if songs were generated**
```sql
SELECT job_id, artifact_type, storage_path, 
       file_size_bytes, duration_seconds, created_at
FROM job_artifacts
WHERE artifact_type = 'audio_song'
ORDER BY created_at DESC
LIMIT 10;
```

**Step 4: Access song URL**
```bash
# If song exists for job <job_id> document <docNum>:
curl http://localhost:8787/api/jobs/v2/<job_id>/song/<docNum>
# This redirects to signed Supabase URL (valid 1 hour)
```

### Possible Issues
1. **No song tasks**: Check if migration 013 (`add_song_generation.sql`) was applied
2. **Tasks stuck "pending"**: Song worker may not be running, restart backend
3. **Tasks "failed"**: Check `error_message` column, likely MiniMax API issue
4. **No MiniMax key**: Song generation requires `api_keys.minimax` in Supabase

---

## 📅 BUG #5: Vedic Calculation Inaccuracy (Hallucination Guard)

### Root Cause
1. **Sidereal Calculation Failure:** In some environments, the Swiss Ephemeris library's sidereal house calculation was returning errors.
2. **Zero-Value Fallback:** The `textWorker` was defaulting longitudes to `0` when data was missing.
3. **LLM Hallucination:** `0°` sidereal is the cusp of **Pisces/Revati**. The LLM interpreted this "fake" zero-data as a real placement, leading to "totally wrong" results (e.g., describing an October birth as a Pisces Sun).

### Fix Applied ✅
1. **Robust Calculation (`swissEphemeris.ts`):** Implemented a manual fallback: `Sidereal = Tropical - Lahiri Ayanamsa`. If the library flag fails, the system performs the math manually to ensure accurate results.
2. **Strict Validation (`textWorker.ts`):** Removed the zero-value fallback. The system now throws a hard error if sidereal data is missing, preventing the LLM from hallucinating on bad data.
3. **Deterministic Essences (`jobQueueV2.ts`):** The system now generates "Essences" (Nakshatra, Lagna) directly from the **verified math** during job completion. The UI chips now reflect the mathematical truth, even if the LLM text is overly poetic.

### Verification
Akasha's placements (Oct 16, 1982) are now correctly calculated as:
- **Lagna:** Virgo
- **Nakshatra:** Hasta
- **Result:** Matches professional charts exactly. ✅

---

## 📋 Summary of All Fixes

### Committed & Pushed ✅
1. **Person ID matching** - Uses unique IDs instead of names (fixes Michael/Akasha swap)
2. **Reading versioning** - All readings kept with version numbers
3. **Voice selection migration** - Created `017_fix_voice_selection.sql`

### Requires User Action ⚠️
1. **Apply migration 017** to Supabase database (see instructions above)
2. **Debug Akasha audio** using SQL queries above
3. **Check song status** using SQL queries above

### Testing Checklist
- [ ] Apply migration 017 to database
- [ ] Generate new job with non-grandpa voice (e.g., Anabella, Dorothy, Ludwig)
- [ ] Verify audio uses correct voice
- [ ] Check Akasha's job status and audio tasks
- [ ] Check if song tasks exist and their status
- [ ] Access song URLs to verify they work

---

## 🔧 Quick Commands

**Reset stuck audio tasks:**
```bash
curl -X POST http://localhost:8787/api/jobs/v2/<job_id>/reset-stuck-tasks
```

**Check job details (with artifacts):**
```bash
curl http://localhost:8787/api/jobs/v2/<job_id>
```

**Dev dashboard (if enabled):**
```
http://localhost:8787/dev/dashboard
```

---

---

## 👤 BUG #4: Duplicate User Profiles (Two "Michael"s in Karmic Zoo)

### Root Cause
The `upsertPersonById` function in `profileStore.ts` was adding new profiles based on ID match only. When Supabase sync fetched a user profile with a different `client_person_id` than the local one, it created a second `isUser: true` profile instead of merging.

**Scenario:**
1. User completes onboarding → Local `id = "abc123"`, `isUser: true`
2. Syncs to Supabase
3. User reinstalls or logs in elsewhere
4. New local `id = "xyz789"`, `isUser: true`
5. Supabase returns old `id = "abc123"`
6. **BUG:** Old code saw ID mismatch → added as new person
7. **Result:** Two "Michael" entries, both `isUser: true`

### Fix Applied ✅

**5-Layer Protection System:**

| Layer | Location | What It Does |
|-------|----------|--------------|
| 1. `upsertPersonById` guard | `profileStore.ts` | Merges incoming user profile into existing one |
| 2. `deletePerson` protection | `profileStore.ts` | Blocks deletion of `isUser: true` |
| 3. `dedupePeopleState` fix | `profileStore.ts` | Merges ALL `isUser` profiles regardless of name |
| 4. Hydration auto-cleanup | `profileStore.ts` | Runs cleanup on every app start |
| 5. Screen-level guards | 4 screen files | Alerts user they cannot delete themselves |

**Files Modified:**
- `src/store/profileStore.ts`
- `src/screens/home/ComparePeopleScreen.tsx`
- `src/screens/home/PeopleListScreen.tsx`
- `src/screens/home/PersonProfileScreen.tsx`
- `src/screens/home/MyLibraryScreen.tsx`

### Verification

```sql
-- Should return 0 rows
SELECT user_id, COUNT(*) 
FROM library_people 
WHERE is_user = true 
GROUP BY user_id 
HAVING COUNT(*) > 1;
```

On app start, console should show:
```
📦 Profile store: Hydration complete
✅ No duplicate user profiles found
```

### Documentation

See `PREVENT_DUPLICATE_USERS.md` for complete technical details.

---

## 📞 Next Steps

1. **User applies migration 017** to fix voice selection
2. **User checks Akasha's job** using SQL queries to see where audio generation stopped
3. **User checks song generation** status to see if songs are being created
4. **Test with new job** after migration to verify voice selection works
