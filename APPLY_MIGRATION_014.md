# Apply Migration 014 - Parallel Post-Text Tasks

## What This Fixes

**PROBLEM**: Songs, PDFs, and Audio were running **sequentially** (one after another), even though they all only need TEXT.

**OLD FLOW** (Wrong):
```
TEXT (20 min) → PDF (10 min) → AUDIO (60 min) → SONG (never created)
Total: 90+ minutes
```

**NEW FLOW** (Correct):
```
TEXT (20 min) → [PDF + AUDIO + SONG] all run in parallel
Total: ~60 minutes
```

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **"+ New query"**
4. Copy the entire SQL from `migrations/014_parallel_post_text_tasks.sql`
5. Paste into the SQL Editor
6. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
7. You should see: ✅ **Success. No rows returned**

### Option 2: Command Line (If you have psql access)

```bash
# Use your Postgres connection string in `DATABASE_URL` (see docs/ENVIRONMENT_VARIABLES.md)
cd 1-in-a-billion-backend
psql "$DATABASE_URL" -f migrations/014_parallel_post_text_tasks.sql
```

---

## What This Does

1. **Removes old triggers**:
   - ❌ `trg_enqueue_all_pdfs_when_all_text_complete`
   - ❌ `trg_enqueue_all_audio_when_all_pdfs_complete`

2. **Creates new unified trigger**:
   - ✅ `trg_enqueue_post_text_tasks` - Enqueues PDF, Audio, AND Song all at once

3. **Result**:
   - When all text tasks complete → **48 new tasks created instantly**:
     - 16 PDF tasks
     - 16 Audio tasks
     - 16 Song tasks (NEW!)
   - All three types run **in parallel** by workers

---

## Verification

After applying, create a new test job and check:

```sql
SELECT task_type, status, COUNT(*) 
FROM job_tasks 
WHERE job_id = '<your-job-id>' 
GROUP BY task_type, status
ORDER BY task_type;
```

You should see:
```
text_generation  | complete | 16
pdf_generation   | pending  | 16  ← All created together
audio_generation | pending  | 16  ← All created together
song_generation  | pending  | 16  ← NEW! All created together
```

---

## Impact on Existing Jobs

**Your current jobs** (started before this migration):
- Already have text + PDF complete
- Have audio running sequentially
- **Will NOT get song tasks automatically**

**New jobs** (started after this migration):
- Will get all 48 tasks (PDF+Audio+Song) immediately after text completes
- Total generation time reduced by ~30-40%!

---

## Next Steps

1. Apply this migration in Supabase Dashboard
2. For your existing 2 jobs (yours + Akasha), we can manually trigger songs if you want
3. All future jobs will automatically get songs!

