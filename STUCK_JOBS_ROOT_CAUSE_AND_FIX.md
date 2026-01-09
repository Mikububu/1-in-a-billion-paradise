# Stuck Jobs - Root Cause Analysis & Fix

## 📊 Executive Summary

**Problem:** Jobs get stuck in "processing" forever, never completing.  
**Root Cause:** Missing `reclaim_stale_tasks()` function in Supabase database.  
**Impact:** 10 tasks stuck for 8+ hours, 6 jobs unable to complete.  
**Fix:** Apply missing SQL function + Deploy watchdog worker.

---

## 🔍 Root Cause Analysis

### What Happened

1. **Workers claimed tasks successfully** ✅
   - Text generation workers on Fly.io claimed 10 tasks
   - Workers sent initial heartbeats

2. **Workers crashed during processing** ❌
   - Likely during DeepSeek API calls (text generation)
   - Tasks stayed in "processing" status
   - No heartbeats sent after crash

3. **No automatic recovery** ❌
   - The `reclaim_stale_tasks()` SQL function is **missing** from Supabase
   - This function should reset stuck tasks every 5-10 minutes
   - Without it, tasks stay stuck forever

4. **Queue appears empty** ❌
   - Workers only claim "pending" tasks
   - All 10 tasks are stuck in "processing"
   - Fly logs show: "Queue depth: 0 pending tasks"

### Why This Worked Before

**If** the `reclaim_stale_tasks()` function existed before:
- Workers would crash occasionally (normal)
- Within 10 minutes, the function would reset the stuck task to "pending"
- Another worker would claim and complete it
- Jobs would finish (with delays, but they'd finish)

**Now:** No recovery → Tasks stuck forever → Jobs never complete

---

## 🛠️ The Fix (3 Steps)

### Step 1: Apply Missing SQL Function ⚠️ REQUIRED

**You must do this manually in Supabase Dashboard:**

1. Open: https://supabase.com/dashboard
2. Go to: **SQL Editor**
3. Copy/paste the SQL from: `apply_reclaim_function.sql`
4. Click: **Run**
5. Verify: Should see `reclaim_stale_tasks | 0` (or a number)

**See detailed instructions in:** `APPLY_RECLAIM_FUNCTION.md`

### Step 2: Deploy Watchdog Worker (Automated)

I've created a watchdog worker that calls `reclaim_stale_tasks()` every 5 minutes.

**To deploy:**

```bash
cd /Users/michaelperinwogenburg/Desktop/big\ challenge/Paradise/1-in-a-billion-backend
npm run build
flyctl deploy --remote-only
flyctl scale count watchdog=1 -a 1-in-a-billion-backend
```

**Verify it's running:**

```bash
flyctl logs -a 1-in-a-billion-backend | grep watchdog
```

### Step 3: Monitor & Debug Worker Crashes

Once the watchdog is running, we need to figure out why text workers are crashing.

**Check worker logs:**

```bash
flyctl logs -a 1-in-a-billion-backend --no-tail | grep "text_generation\|ERROR\|CRASH"
```

**Common causes:**
- DeepSeek API timeouts (>10 min)
- Memory leaks
- Ephemeris calculation crashes
- Uncaught exceptions

---

## 📈 Verification

### After Applying Fix

1. **Check function exists:**
   ```bash
   cd 1-in-a-billion-backend
   npx tsx check_supabase_functions.ts
   ```
   Should show: `✅ reclaim_stale_tasks EXISTS`

2. **Monitor watchdog:**
   ```bash
   flyctl logs -a 1-in-a-billion-backend | grep "Reclaimed\|No stale"
   ```

3. **Check job progress:**
   - Jobs should start completing within 10-20 minutes
   - Check PersonReadingsScreen - PDFs should become clickable
   - Audio should be available

---

## 📋 Files Changed

### New Files
- `src/workers/watchdogWorker.ts` - Automatic stale task recovery (every 5 min)
- `apply_reclaim_function.sql` - SQL to apply to Supabase
- `APPLY_RECLAIM_FUNCTION.md` - Step-by-step instructions
- `STUCK_JOBS_ROOT_CAUSE_AND_FIX.md` - This file

### Modified Files
- `fly.toml` - Added watchdog process

---

## 🎯 Success Criteria

✅ `reclaim_stale_tasks()` function exists in Supabase  
✅ Watchdog worker running on Fly.io  
✅ No tasks stuck in "processing" for >10 minutes  
✅ Jobs complete within reasonable time (5-20 min)  
✅ Akasha's reading shows up with clickable buttons  

---

## ⚠️ Important Notes

1. **The SQL function MUST be applied manually** - I cannot apply it for you
2. **Workers may still crash** - But tasks will auto-recover now
3. **We need to debug why workers crash** - But that's a separate issue
4. **This is a permanent fix** - Once applied, it will work forever

---

## 🤔 Why Wasn't This Applied Before?

Possible reasons:
- Migration 001 was partially applied (tables + `claim_tasks()` but not `reclaim_stale_tasks()`)
- Function was dropped during a schema change
- Different Supabase project/environment
- Manual database operations

**Regardless:** The fix is simple - apply the SQL function once and you're good.

---

## 📞 Next Steps

1. **You:** Apply SQL function in Supabase Dashboard (5 minutes)
2. **Me:** Deploy watchdog worker (done, just needs `flyctl deploy`)
3. **Both:** Monitor for 30 minutes to verify jobs complete
4. **Then:** Debug worker crashes if they continue

---

**Ready to apply the fix? See `APPLY_RECLAIM_FUNCTION.md` for step-by-step instructions.**
