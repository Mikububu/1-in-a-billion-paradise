-- ===============================================================================
-- FIX: reclaim_stale_tasks() now handles NULL heartbeats
-- ===============================================================================
-- 
-- PROBLEM: When workers crash/restart, tasks stay stuck in "processing" forever
-- because last_heartbeat stops updating and the NULL comparison fails.
--
-- SOLUTION: Also check claimed_at when heartbeat is NULL or missing.
-- ===============================================================================

CREATE OR REPLACE FUNCTION reclaim_stale_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reclaimed INTEGER := 0;
BEGIN
  -- Reset stale tasks to pending (FIXED: also check claimed_at for NULL heartbeats)
  UPDATE job_tasks
  SET 
    status = 'pending',
    worker_id = NULL,
    claimed_at = NULL,
    last_heartbeat = NULL,
    attempts = attempts + 1,
    updated_at = now(),
    error = 'Task stalled - reclaimed by watchdog'
  WHERE status IN ('claimed', 'processing')
    AND (
      -- Case 1: Heartbeat is stale
      last_heartbeat < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL)
      OR
      -- Case 2: No heartbeat but claimed too long ago (worker crashed before first heartbeat)
      (last_heartbeat IS NULL AND claimed_at < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL))
    )
    AND attempts < max_attempts;
  
  GET DIAGNOSTICS v_reclaimed = ROW_COUNT;
  
  -- Mark as failed if max attempts reached
  UPDATE job_tasks
  SET 
    status = 'failed',
    updated_at = now(),
    error = 'Max attempts exceeded'
  WHERE status IN ('claimed', 'processing')
    AND (
      last_heartbeat < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL)
      OR
      (last_heartbeat IS NULL AND claimed_at < (now() - (heartbeat_timeout_seconds || ' seconds')::INTERVAL))
    )
    AND attempts >= max_attempts;
  
  RETURN v_reclaimed;
END;
$$;

-- Permissions
ALTER FUNCTION reclaim_stale_tasks() SET search_path = public;
REVOKE ALL ON FUNCTION reclaim_stale_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclaim_stale_tasks() TO service_role;
