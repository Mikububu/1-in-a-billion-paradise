# Apply Missing reclaim_stale_tasks() Function

## Problem
The `reclaim_stale_tasks()` function is missing from Supabase, causing stuck tasks to never recover.

## Solution
Apply the SQL script below to your Supabase database.

## Steps

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard
   - Select your project
   - Go to: **SQL Editor** (left sidebar)

2. **Copy and Paste This SQL**

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- APPLY MISSING reclaim_stale_tasks() FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Reclaim stale tasks (watchdog for stuck workers)
CREATE OR REPLACE FUNCTION reclaim_stale_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reclaimed INTEGER := 0;
BEGIN
  -- Reset stale tasks to pending
  UPDATE job_tasks
  SET 
    status = 'pending',
    worker_id = NULL,
    claimed_at = NULL,
    last_heartbeat = NULL,
    updated_at = now(),
    error = 'Task stalled - reclaimed by watchdog'
  WHERE status IN ('claimed', 'processing')
    AND last_heartbeat < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL)
    AND attempts < max_attempts;
  
  GET DIAGNOSTICS v_reclaimed = ROW_COUNT;
  
  -- Mark as failed if max attempts reached
  UPDATE job_tasks
  SET 
    status = 'failed',
    updated_at = now(),
    error = 'Task stalled - max attempts exceeded'
  WHERE status IN ('claimed', 'processing')
    AND last_heartbeat < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL)
    AND attempts >= max_attempts;
  
  RETURN v_reclaimed;
END;
$$;

-- Set permissions
ALTER FUNCTION reclaim_stale_tasks() SET search_path = public;
REVOKE ALL ON FUNCTION reclaim_stale_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclaim_stale_tasks() TO service_role;

COMMIT;

-- Test it
SELECT reclaim_stale_tasks();
```

3. **Click "Run"**
   - You should see: `reclaim_stale_tasks | 0` (or a number if it reclaimed stuck tasks)
   - If you see an error, share it with me

4. **Verify**
   - Run this to test: `SELECT reclaim_stale_tasks();`
   - Should return a number (count of reclaimed tasks)

## What This Does

This function:
- Runs every time it's called
- Finds tasks stuck in "processing" for >10 minutes
- Resets them to "pending" so workers can retry
- Marks tasks as "failed" if they've hit max retry attempts (3)

## Next Steps

After applying this:
1. I'll set up a scheduler to call it automatically every 5 minutes
2. Investigate why workers are crashing during text generation
3. Your jobs should start completing properly
