-- ═══════════════════════════════════════════════════════════════════════════
-- FIX JOB PROGRESS TRACKING - Update Percentage on EVERY Task Completion
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Problem: The existing auto_update_job_status() trigger only updates progress
-- when the job transitions FROM queued TO processing. After that, the progress
-- percentage stays stuck at ~6% even though tasks are completing.
--
-- Root Cause: Line 452 of 001_supabase_job_queue.sql has:
--   AND status != 'processing'
-- This prevents the trigger from updating progress after the first task.
--
-- Solution: Remove the status check so progress updates on EVERY task completion.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS auto_update_job_status_on_task_change ON job_tasks;
DROP FUNCTION IF EXISTS auto_update_job_status();

-- Recreate the function WITH THE FIX
CREATE OR REPLACE FUNCTION auto_update_job_status()
RETURNS TRIGGER AS $$
DECLARE
  v_pending INTEGER;
  v_complete INTEGER;
  v_failed INTEGER;
  v_total INTEGER;
  v_job_type job_type;
BEGIN
  -- Count task statuses for this job
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'complete') AS complete,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) AS total
  INTO v_pending, v_complete, v_failed, v_total
  FROM job_tasks
  WHERE job_id = COALESCE(NEW.job_id, OLD.job_id);
  
  -- Get job type for context
  SELECT type INTO v_job_type
  FROM jobs
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  -- Update job status based on task completion
  IF v_failed > 0 AND v_complete + v_failed = v_total THEN
    -- All tasks done, at least one failed
    UPDATE jobs
    SET 
      status = 'error',
      progress = progress || jsonb_build_object(
        'phase', 'error',
        'message', 'Some tasks failed',
        'percent', ROUND((v_complete::NUMERIC / NULLIF(v_total, 0)) * 100, 2)
      ),
      completed_at = now()
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    
  ELSIF v_complete = v_total THEN
    -- All tasks complete (100%)
    UPDATE jobs
    SET 
      status = 'complete',
      progress = progress || jsonb_build_object(
        'percent', 100,
        'phase', 'complete',
        'message', 'Generation complete!'
      ),
      completed_at = now()
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    
  ELSIF v_complete > 0 OR v_pending < v_total THEN
    -- ✅ FIX: Update progress on EVERY task completion (no status check)
    -- This runs for every task that completes, not just the first one
    UPDATE jobs
    SET 
      status = 'processing',
      progress = progress || jsonb_build_object(
        'percent', ROUND((v_complete::NUMERIC / NULLIF(v_total, 0)) * 100, 2),
        'phase', 'processing',
        'message', format('Processing... (%s/%s tasks complete)', v_complete, v_total),
        'tasksComplete', v_complete,
        'tasksTotal', v_total
      )
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    -- ❌ OLD (BUGGY): AND status != 'processing'
    -- ✅ NEW (FIXED): No status condition → updates every time!
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER auto_update_job_status_on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON job_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_job_status();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (Run these to test)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Check job progress for a specific job
-- SELECT id, type, status, progress->>'percent' AS percent, progress->>'message' AS message
-- FROM jobs
-- WHERE id = 'your-job-id-here';

-- 2. Check task completion status
-- SELECT job_id, COUNT(*) AS total, 
--        COUNT(*) FILTER (WHERE status = 'complete') AS complete,
--        COUNT(*) FILTER (WHERE status = 'pending') AS pending
-- FROM job_tasks
-- WHERE job_id = 'your-job-id-here'
-- GROUP BY job_id;

-- 3. Simulate task completion (for testing)
-- UPDATE job_tasks SET status = 'complete', completed_at = now() 
-- WHERE job_id = 'your-job-id-here' AND sequence = 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════

