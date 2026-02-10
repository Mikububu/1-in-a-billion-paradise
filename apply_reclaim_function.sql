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
